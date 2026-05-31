import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActivePrompt } from '@/lib/prompts'
import { analyzeFine } from '@/lib/anthropic'
import { routePhase } from '@/lib/phase-router'
import { pickTier } from '@/lib/pricing'
import { computeScore } from '@/lib/scoring'
import { logEvent } from '@/lib/events'
import { getSettings } from '@/lib/settings'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FILE_SIZE = 12 * 1024 * 1024
const ALLOWED_MIMES = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/i

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v === 'string' && v.length > 0) return v
  return null
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

  const rl = rateLimit(`upload:${ip ?? 'unknown'}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo ausente.' }, { status: 400 })
    if (file.size === 0) return NextResponse.json({ error: 'Arquivo vazio.' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Arquivo acima de 12MB.' }, { status: 413 })
    if (!ALLOWED_MIMES.test(file.type)) return NextResponse.json({ error: `Tipo não suportado: ${file.type}` }, { status: 415 })

    const utm = {
      utm_source: stringOrNull(formData.get('utm_source')),
      utm_medium: stringOrNull(formData.get('utm_medium')),
      utm_campaign: stringOrNull(formData.get('utm_campaign')),
      utm_content: stringOrNull(formData.get('utm_content')),
      utm_term: stringOrNull(formData.get('utm_term')),
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const settings = await getSettings()
    const systemPrompt = await getActivePrompt('analise')

    const { data: analise } = await analyzeFine({ buffer, mimeType: file.type, systemPrompt })
    // imagem descartada

    const dataNotif = analise.data_notificacao ? new Date(analise.data_notificacao) : null
    const dataInfr = analise.data_infracao ? new Date(analise.data_infracao) : null

    // === Regras anti-trava ===
    // Se IA não identificou tipo, assumimos NA. Se não tem data, marcamos data_missing
    // e DEIXAMOS o usuário completar na próxima tela (não vamos pra 'vencido' às cegas).
    const tipoOriginal = analise.tipo_notificacao
    const tipoEfetivo = tipoOriginal === 'desconhecido' ? 'NA' : tipoOriginal
    const dataMissing = !dataNotif
    const valorMissing = !analise.valor_multa_centavos

    let fase: 'defesa_previa' | 'jari' | 'vencido' = 'defesa_previa'
    let prazo_status: 'valido' | 'vencido' = 'valido'
    let prazo_limite: Date | null = null
    let diasRestantes: number | null = null

    if (!dataMissing && analise.is_multa) {
      const phase = routePhase({
        tipo_notificacao: tipoEfetivo,
        data_notificacao: dataNotif,
        prazoDias: settings.prazo_dias,
      })
      fase = phase.fase
      prazo_status = phase.prazo_status
      prazo_limite = phase.prazo_limite
      diasRestantes = phase.dias_restantes

      const bloqueiaPrazo =
        settings.cobrar_proximo_vencimento_dias > 0 &&
        diasRestantes != null &&
        diasRestantes < settings.cobrar_proximo_vencimento_dias
      if (bloqueiaPrazo) {
        fase = 'vencido'
        prazo_status = 'vencido'
      }
    }

    const score = computeScore({
      vicio_forte: analise.vicio_forte,
      prazo_status,
      is_multa: analise.is_multa,
      config: settings,
    })

    let preco_centavos: number | null = null
    let faixa_id: number | null = null
    if (analise.valor_multa_centavos && fase !== 'vencido') {
      const tiers = await prisma.priceTier.findMany({ where: { ativo: true } })
      const pricing = pickTier(analise.valor_multa_centavos, tiers)
      if (pricing) {
        preco_centavos = pricing.preco_centavos
        faixa_id = pricing.tier.id
      }
    }

    const order = await prisma.order.create({
      data: {
        status: fase === 'vencido' ? 'vencido' : 'analisado',
        valor_multa_centavos: analise.valor_multa_centavos ?? null,
        valor_missing: valorMissing,
        data_missing: dataMissing,
        faixa_id,
        preco_centavos,
        fase,
        prazo_limite,
        prazo_status,
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

    await logEvent({
      tipo: 'analise',
      order_id: order.id,
      user_agent: ua,
      ip,
      metadata: {
        fase,
        score: score.score,
        vicio_forte: analise.vicio_forte,
        valor_missing: valorMissing,
        data_missing: dataMissing,
        tipo_assumido: tipoOriginal === 'desconhecido' ? 'NA' : undefined,
      },
    })

    return NextResponse.json({
      orderId: order.id,
      is_multa: analise.is_multa,
      fase,
      prazo_status,
      prazo_limite: prazo_limite?.toISOString() ?? null,
      dias_restantes: diasRestantes,
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload]', msg)
    await logEvent({ tipo: 'analise_falha', user_agent: ua, ip, metadata: { error: msg } })
    return NextResponse.json({ error: 'Falha na análise. Tente novamente.' }, { status: 500 })
  }
}
