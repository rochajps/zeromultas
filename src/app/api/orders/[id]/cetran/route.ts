// Ativa a fase CETRAN num pedido vencido. CETRAN é a 3ª instância administrativa,
// cabível após decisão negativa da JARI (prazo de 30 dias da ciência da decisão).
// O usuário declara que está dentro do prazo do CETRAN; o sistema confia.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pickTier } from '@/lib/pricing'
import { logEvent } from '@/lib/events'
import { getSettings } from '@/lib/settings'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const orderId = params.id
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { fine_data: true },
  })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  // Atualiza fase pra cetran. Pricing usa o valor multa (mesmo se vencido).
  const settings = await getSettings()
  let preco_centavos = order.preco_centavos
  let faixa_id = order.faixa_id
  if (order.valor_multa_centavos && !preco_centavos) {
    const tiers = await prisma.priceTier.findMany({ where: { ativo: true } })
    const pricing = pickTier(order.valor_multa_centavos, tiers)
    if (pricing) {
      preco_centavos = pricing.preco_centavos
      faixa_id = pricing.tier.id
    }
  }

  // Define prazo do CETRAN a partir de "hoje" + prazo_dias (assumindo decisão recente)
  const prazoLimite = new Date()
  prazoLimite.setDate(prazoLimite.getDate() + settings.prazo_cetran_dias)

  await prisma.order.update({
    where: { id: orderId },
    data: {
      fase: 'cetran',
      status: 'analisado',
      prazo_status: 'valido',
      prazo_limite: prazoLimite,
      preco_centavos,
      faixa_id,
    },
  })

  await logEvent({ tipo: 'ativou_cetran', order_id: orderId })

  return NextResponse.json({ ok: true, orderId, fase: 'cetran', preco_centavos })
}
