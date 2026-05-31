import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActivePrompt } from '@/lib/prompts'
import { analyzeFine, MODEL_ANALYSIS } from '@/lib/anthropic'
import { routePhase } from '@/lib/phase-router'
import { pickTier } from '@/lib/pricing'
import { computeScore } from '@/lib/scoring'
import { definirModoGeracao } from '@/lib/modo-geracao'
import { logEvent } from '@/lib/events'
import { getSettings } from '@/lib/settings'
import { rateLimit } from '@/lib/rate-limit'
import { recordApiUsage } from '@/lib/usage'
import { validateAnaliseOutput, decideAnaliseStatus, STATUS_MSGS, type AnaliseStatus } from '@/lib/analise-validator'
import {
  detectMimeFromBuffer,
  checkHoneypot,
  verifyTurnstile,
  sha256Hex,
  getCachedAnalysis,
  saveCachedAnalysis,
  checkBudget,
  incrementBudget,
  logSecurityEvent,
  hashIp,
} from '@/lib/security'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FILE_SIZE = 12 * 1024 * 1024
const ALLOWED_DETECTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v === 'string' && v.length > 0) return v
  return null
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent')
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    null
  const ipHashed = hashIp(ip)

  // ============================================================
  // CAMADA: Rate limit (já existente, primeira barreira)
  // ============================================================
  const rl = rateLimit(`upload:${ip ?? 'unknown'}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    await logSecurityEvent({ action: 'rate_limit', ip_hash: ipHashed, rule: 'ip_5_per_hour', metadata: { retryAfter: rl.retryAfterSec } })
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Formato de envio inválido.' }, { status: 400 })
  }

  // ============================================================
  // CAMADA: Honeypot (campo oculto + tempo de preenchimento)
  // ============================================================
  const honeypotValue = stringOrNull(formData.get('website'))
  const formStartedAt = Number(formData.get('form_started_at') ?? 0)
  const hp = checkHoneypot({
    honeypot_value: honeypotValue,
    form_started_at: Number.isFinite(formStartedAt) && formStartedAt > 0 ? formStartedAt : null,
  })
  if (!hp.ok) {
    await logSecurityEvent({ action: hp.reason as never, ip_hash: ipHashed, rule: 'honeypot' })
    // Mensagem genérica — não educar o atacante
    return NextResponse.json({ error: 'Sessão inválida. Recarregue a página e tente novamente.' }, { status: 400 })
  }

  // ============================================================
  // CAMADA: Turnstile (Cloudflare)
  // ============================================================
  const turnstileToken = stringOrNull(formData.get('turnstileToken')) ?? req.headers.get('cf-turnstile-response')
  const ts = await verifyTurnstile(turnstileToken, ip)
  if (!ts.ok) {
    await logSecurityEvent({
      action: ts.reason?.startsWith('turnstile_missing') ? 'turnstile_missing' : 'turnstile_fail',
      ip_hash: ipHashed,
      rule: ts.reason ?? 'turnstile',
    })
    return NextResponse.json({ error: 'Verificação de segurança falhou. Recarregue a página e tente novamente.' }, { status: 400 })
  }

  // ============================================================
  // CAMADA: Validação de arquivo (tamanho + magic bytes)
  // ============================================================
  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo ausente.' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'Arquivo vazio.' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) {
    await logSecurityEvent({ action: 'oversized', ip_hash: ipHashed, metadata: { size: file.size } })
    return NextResponse.json({ error: 'Arquivo acima de 12MB.' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const detectedMime = detectMimeFromBuffer(buffer)
  if (!detectedMime || !ALLOWED_DETECTED.has(detectedMime)) {
    await logSecurityEvent({
      action: 'invalid_file',
      ip_hash: ipHashed,
      metadata: { declared: file.type, detected: detectedMime },
    })
    return NextResponse.json({ error: 'Formato de arquivo não suportado.' }, { status: 415 })
  }

  // ============================================================
  // CAMADA: Cache por hash (dedup — pula chamada API se imagem repetida)
  // ============================================================
  const settings = await getSettings()
  const fileHash = sha256Hex(buffer)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let analise: any = null
  let cacheHit = false

  const cached = await getCachedAnalysis(fileHash)
  if (cached) {
    analise = cached
    cacheHit = true
    await logSecurityEvent({ action: 'cache_hit', ip_hash: ipHashed, rule: 'hash_match', metadata: { hash: fileHash.slice(0, 16) } })
  }

  // ============================================================
  // CAMADA: Disjuntor global de orçamento
  // ============================================================
  if (!cacheHit) {
    const budget = await checkBudget({
      maxHour: Number(process.env.MAX_ANALISES_HORA ?? 300),
      maxDay: Number(process.env.MAX_ANALISES_DIA ?? 2000),
    })
    if (!budget.ok) {
      await logSecurityEvent({
        action: 'budget_capped',
        ip_hash: ipHashed,
        rule: budget.reason ?? null,
        metadata: budget.current as Record<string, unknown>,
      })
      return NextResponse.json(
        { error: 'Estamos com alta demanda agora. Tente em alguns minutos.' },
        { status: 503, headers: { 'Retry-After': '120' } },
      )
    }
  }

  // ============================================================
  // CHAMADA À API (só aqui se tudo passou)
  // ============================================================
  try {
    const utm = {
      utm_source: stringOrNull(formData.get('utm_source')),
      utm_medium: stringOrNull(formData.get('utm_medium')),
      utm_campaign: stringOrNull(formData.get('utm_campaign')),
      utm_content: stringOrNull(formData.get('utm_content')),
      utm_term: stringOrNull(formData.get('utm_term')),
    }

    if (!cacheHit) {
      const systemPrompt = await getActivePrompt('analise')
      const result = await analyzeFine({ buffer, mimeType: detectedMime, systemPrompt })
      analise = result.data
      await incrementBudget()
      const cacheTtlHours = Number(process.env.CACHE_TTL_HORAS ?? 48)
      await saveCachedAnalysis(fileHash, analise, cacheTtlHours)
      // Salva usage do call real (cache_hit não conta)
    }

    if (!analise) throw new Error('Análise vazia')

    // Validação estrita do JSON da análise
    const validated = validateAnaliseOutput(analise)
    if (!validated.ok) {
      const attempts = Number(req.cookies.get('zm_uploads')?.value ?? '0') + 1
      const res = NextResponse.json({
        error: STATUS_MSGS.schema_invalido,
        analise_status: 'schema_invalido' as AnaliseStatus,
        attempts,
        suggest_manual: attempts >= 2,
      }, { status: 422 })
      res.cookies.set('zm_uploads', String(attempts), { maxAge: 3600, sameSite: 'lax', path: '/' })
      await logEvent({ tipo: 'analise_falha', user_agent: ua, ip, metadata: { reason: validated.reason } })
      return res
    }
    analise = validated.data

    const analiseStatus: AnaliseStatus = decideAnaliseStatus(analise)
    if (analiseStatus !== 'valido' && analiseStatus !== 'multa_nao_suportada') {
      const attempts = Number(req.cookies.get('zm_uploads')?.value ?? '0') + 1
      const res = NextResponse.json({
        error: STATUS_MSGS[analiseStatus],
        analise_status: analiseStatus,
        attempts,
        suggest_manual: attempts >= 2,
      }, { status: 422 })
      res.cookies.set('zm_uploads', String(attempts), { maxAge: 3600, sameSite: 'lax', path: '/' })
      await logEvent({ tipo: 'analise_falha', user_agent: ua, ip, metadata: { analise_status: analiseStatus, tipo_documento: analise.tipo_documento } })
      return res
    }

    const dataNotif = analise.data_notificacao ? new Date(analise.data_notificacao) : null
    const dataInfr = analise.data_infracao ? new Date(analise.data_infracao) : null

    const tipoOriginal = analise.tipo_notificacao
    const tipoEfetivo =
      tipoOriginal === 'desconhecido'
        ? (settings.tipo_padrao_quando_desconhecido as 'NA' | 'NP')
        : tipoOriginal
    const dataMissing = !dataNotif
    const valorMissing = !analise.valor_multa_centavos

    const phase = routePhase({
      tipo_notificacao: tipoEfetivo,
      data_notificacao: dataNotif,
      prazoDias: settings.prazo_dias,
    })

    const rota = definirModoGeracao({
      tipo_notificacao: tipoEfetivo,
      data_infracao: dataInfr,
      data_notificacao: dataNotif,
      vicio_forte: analise.vicio_forte,
      vicio_razao: analise.vicio_razao,
      vicios_detectados: analise.vicios_detectados,
    })

    const score = computeScore({
      band: rota.score_band,
      is_multa: analise.is_multa,
      config: settings,
    })

    let preco_centavos: number | null = null
    let faixa_id: number | null = null
    if (analise.valor_multa_centavos) {
      const tiers = await prisma.priceTier.findMany({ where: { ativo: true } })
      const pricing = pickTier(analise.valor_multa_centavos, tiers)
      if (pricing) {
        preco_centavos = pricing.preco_centavos
        faixa_id = pricing.tier.id
      }
    }

    const order = await prisma.order.create({
      data: {
        status: 'analisado',
        valor_multa_centavos: analise.valor_multa_centavos ?? null,
        valor_missing: valorMissing,
        data_missing: dataMissing,
        faixa_id,
        preco_centavos,
        fase: phase.fase,
        prazo_limite: phase.prazo_limite,
        prazo_status: phase.prazo_status,
        modo_geracao: rota.modo,
        vicios_finais: rota.vicios_finais as never,
        score_band: rota.score_band,
        permite_arguir_sumula_312: rota.permite_arguir_sumula_312,
        analise_status: analiseStatus,
        tipo_documento: analise.tipo_documento,
        verificado: analiseStatus === 'valido',
        origem_dados: 'analise',
        analisado_em: new Date(),
        ...utm,
        fine_data: {
          create: {
            is_multa: analise.is_multa,
            tipo_notificacao: tipoEfetivo,
            data_notificacao: dataNotif,
            data_infracao: dataInfr,
            num_ait: analise.num_ait,
            orgao_autuador: analise.orgao_autuador,
            codigo_infracao: analise.codigo_infracao,
            descricao_infracao: analise.descricao_infracao,
            placa: analise.placa,
            veiculo: analise.veiculo,
            valor_multa_centavos: analise.valor_multa_centavos ?? null,
            vicio_forte: analise.vicio_forte,
            vicio_razao: analise.vicio_razao,
            vicios_detectados: (analise.vicios_detectados ?? []) as never,
            score: score.score,
            raw_analise: analise as never,
          },
        },
      },
    })

    if (!cacheHit) {
      // Anthropic já foi chamada — salva usage real
      // (recordApiUsage seria chamado dentro do analyzeFine se exposesse o usage; aqui não temos
      // o objeto raw. TODO em fase 2: refatorar analyzeFine pra emitir usage no upload e cache. )
    }

    await logSecurityEvent({
      action: 'analise_ok',
      ip_hash: ipHashed,
      rule: cacheHit ? 'cache_hit' : 'api_call',
      metadata: { orderId: order.id, cache: cacheHit },
    })

    await logEvent({
      tipo: 'analise',
      order_id: order.id,
      user_agent: ua,
      ip,
      metadata: {
        fase: phase.fase,
        modo: rota.modo,
        score: score.score,
        score_band: rota.score_band,
        vicios_finais_count: rota.vicios_finais.length,
        vicio_forte: analise.vicio_forte,
        valor_missing: valorMissing,
        data_missing: dataMissing,
        cache_hit: cacheHit,
      },
    })

    const okRes = NextResponse.json({
      orderId: order.id,
      is_multa: analise.is_multa,
      fase: phase.fase,
      prazo_status: phase.prazo_status,
      prazo_limite: phase.prazo_limite?.toISOString() ?? null,
      dias_restantes: phase.dias_restantes,
      score: score.score,
      score_faixa: score.faixa,
      score_mensagem: score.mensagem,
      vicio_forte: analise.vicio_forte,
      vicio_razao: analise.vicio_razao,
      valor_multa_centavos: analise.valor_multa_centavos ?? null,
      valor_missing: valorMissing,
      data_missing: dataMissing,
      preco_centavos,
    })
    okRes.cookies.set('zm_uploads', '0', { maxAge: 0, path: '/' })
    return okRes
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload]', msg)
    await logEvent({ tipo: 'analise_falha', user_agent: ua, ip, metadata: { error: msg } })
    return NextResponse.json({ error: 'Falha na análise. Tente novamente.' }, { status: 500 })
  }
}
