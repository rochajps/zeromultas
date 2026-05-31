import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { routePhase } from '@/lib/phase-router'
import { pickTier } from '@/lib/pricing'
import { computeScore } from '@/lib/scoring'
import { getSettings } from '@/lib/settings'
import { logEvent } from '@/lib/events'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const orderId = params.id
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const valorRaw = body.valor_multa_reais
  const dataRaw = body.data_notificacao
  const tipoRaw = body.tipo_notificacao

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { fine_data: true },
  })
  if (!order || !order.fine_data) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  }

  const settings = await getSettings()

  let valorCentavos: number | null = order.valor_multa_centavos
  if (order.valor_missing && typeof valorRaw === 'number' && valorRaw > 0) {
    valorCentavos = Math.round(valorRaw * 100)
  }

  let dataNotif: Date | null = order.fine_data.data_notificacao
  if (order.data_missing && typeof dataRaw === 'string' && dataRaw.length >= 8) {
    const parsed = new Date(dataRaw)
    if (!isNaN(parsed.getTime())) dataNotif = parsed
  }

  let tipo = order.fine_data.tipo_notificacao
  if (!tipo || tipo === 'desconhecido') {
    if (tipoRaw === 'NA' || tipoRaw === 'NP') tipo = tipoRaw
    else tipo = settings.tipo_padrao_quando_desconhecido as 'NA' | 'NP'
  }

  const phase = routePhase({
    tipo_notificacao: tipo,
    data_notificacao: dataNotif,
    prazoDias: settings.prazo_dias,
  })

  const score = computeScore({
    vicio_forte: order.fine_data.vicio_forte ?? false,
    is_multa: order.fine_data.is_multa ?? true,
    config: settings,
  })

  let preco_centavos: number | null = order.preco_centavos
  let faixa_id: number | null = order.faixa_id
  if (valorCentavos) {
    const tiers = await prisma.priceTier.findMany({ where: { ativo: true } })
    const pricing = pickTier(valorCentavos, tiers)
    if (pricing) {
      preco_centavos = pricing.preco_centavos
      faixa_id = pricing.tier.id
    }
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        valor_multa_centavos: valorCentavos,
        valor_missing: !valorCentavos,
        preco_centavos,
        faixa_id,
        fase: phase.fase,
        prazo_limite: phase.prazo_limite,
        prazo_status: phase.prazo_status,
        data_missing: !dataNotif,
        status: 'analisado',
      },
    }),
    prisma.fineData.update({
      where: { order_id: orderId },
      data: {
        tipo_notificacao: tipo,
        data_notificacao: dataNotif,
        valor_multa_centavos: valorCentavos,
        score: score.score,
      },
    }),
  ])

  await logEvent({ tipo: 'completou_dados_manuais', order_id: orderId, metadata: { valorCentavos, dataNotif: dataNotif?.toISOString() ?? null, tipo } })

  return NextResponse.json({
    ok: true,
    orderId,
    fase: phase.fase,
    prazo_status: phase.prazo_status,
    prazo_limite: phase.prazo_limite?.toISOString() ?? null,
    valor_multa_centavos: valorCentavos,
    preco_centavos,
    score: score.score,
  })
}
