// POST /api/orders/manual — cria pedido a partir de dados digitados pelo usuário.
// Força modo=generico, verificado=false, origem_dados=manual.
// NÃO chama a API de visão.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { routePhase } from '@/lib/phase-router'
import { pickTier } from '@/lib/pricing'
import { computeScore } from '@/lib/scoring'
import { getSettings } from '@/lib/settings'
import { logEvent } from '@/lib/events'
import { sanitizeTextField } from '@/lib/analise-validator'

export const runtime = 'nodejs'

const PLACA_RE = /^[A-Z]{3}[0-9]{1}[A-Z0-9]{1}[0-9]{2}$/

interface Body {
  tipo_notificacao?: 'NA' | 'NP'
  orgao_autuador?: string
  num_ait?: string
  codigo_infracao?: string
  descricao_infracao?: string
  data_infracao?: string
  data_notificacao?: string
  placa?: string
  valor_multa_centavos?: number
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent')
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    null

  try {
    const body = (await req.json()) as Body

    // Validação estrita
    const tipo = body.tipo_notificacao
    if (tipo !== 'NA' && tipo !== 'NP') {
      return NextResponse.json({ error: 'Tipo de notificação inválido (use NA ou NP).' }, { status: 400 })
    }
    const placa = (body.placa ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
    if (!PLACA_RE.test(placa)) {
      return NextResponse.json({ error: 'Placa inválida (formato ABC1D23 ou ABC1234).' }, { status: 400 })
    }
    const valor = typeof body.valor_multa_centavos === 'number' && body.valor_multa_centavos > 0
      ? Math.round(body.valor_multa_centavos)
      : null
    if (!valor) return NextResponse.json({ error: 'Valor da multa inválido.' }, { status: 400 })

    const dataNotif = body.data_notificacao ? new Date(body.data_notificacao) : null
    if (!dataNotif || isNaN(dataNotif.getTime())) {
      return NextResponse.json({ error: 'Data da notificação inválida.' }, { status: 400 })
    }
    const dataInfr = body.data_infracao ? new Date(body.data_infracao) : null
    if (dataInfr && dataInfr > dataNotif) {
      return NextResponse.json({ error: 'Data da infração não pode ser depois da notificação.' }, { status: 400 })
    }

    // Sanitiza campos textuais (anti-XSS / anti-injection na geração)
    const orgao = sanitizeTextField(body.orgao_autuador, 100)
    const ait = sanitizeTextField(body.num_ait, 50).toUpperCase().replace(/[^A-Z0-9-]/g, '')
    const codigo = sanitizeTextField(body.codigo_infracao, 20)
    const descricao = sanitizeTextField(body.descricao_infracao, 200)

    const settings = await getSettings()

    // Calcula fase com regra atual
    const phase = routePhase({
      tipo_notificacao: tipo,
      data_notificacao: dataNotif,
      prazoDias: settings.prazo_dias,
    })

    // Preço pela faixa
    let preco_centavos: number | null = null
    let faixa_id: number | null = null
    if (valor) {
      const tiers = await prisma.priceTier.findMany({ where: { ativo: true } })
      const pricing = pickTier(valor, tiers)
      if (pricing) {
        preco_centavos = pricing.preco_centavos
        faixa_id = pricing.tier.id
      }
    }

    // Score: dados manuais entram em moderada_baixa
    const score = computeScore({
      band: 'moderada_baixa',
      is_multa: true,
      config: settings,
    })

    const order = await prisma.order.create({
      data: {
        status: 'analisado',
        valor_multa_centavos: valor,
        valor_missing: false,
        data_missing: false,
        faixa_id,
        preco_centavos,
        fase: phase.fase,
        prazo_limite: phase.prazo_limite,
        prazo_status: phase.prazo_status,
        // Modos: força generico, sem vícios
        modo_geracao: 'generico',
        vicios_finais: [] as never,
        score_band: 'moderada_baixa',
        permite_arguir_sumula_312: tipo === 'NA',
        // Status novo
        analise_status: 'valido',
        tipo_documento: 'manual',
        verificado: false,
        origem_dados: 'manual',
        analisado_em: new Date(),
        fine_data: {
          create: {
            is_multa: true,
            tipo_notificacao: tipo,
            data_notificacao: dataNotif,
            data_infracao: dataInfr,
            num_ait: ait || null,
            orgao_autuador: orgao || null,
            codigo_infracao: codigo || null,
            descricao_infracao: descricao || null,
            placa,
            valor_multa_centavos: valor,
            vicio_forte: false,
            vicio_razao: null,
            vicios_detectados: [] as never,
            score: score.score,
            raw_analise: { origem: 'manual' } as never,
          },
        },
        manual_fine_data: {
          create: {
            tipo_notificacao: tipo,
            orgao_autuador: orgao || null,
            num_ait: ait || null,
            codigo_infracao: codigo || null,
            descricao_infracao: descricao || null,
            data_infracao: dataInfr,
            data_notificacao: dataNotif,
            placa,
            valor_centavos: valor,
          },
        },
      },
    })

    await logEvent({
      tipo: 'analise',
      order_id: order.id,
      user_agent: ua,
      ip,
      metadata: { origem: 'manual', tipo, fase: phase.fase },
    })

    return NextResponse.json({
      orderId: order.id,
      origem: 'manual',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[manual]', msg)
    return NextResponse.json({ error: 'Falha ao criar pedido manual. Tente novamente.' }, { status: 500 })
  }
}
