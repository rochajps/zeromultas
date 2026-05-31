// GET /api/orders/[id] — status pro front fazer polling.
// Quando o pedido tá aguardando_pagamento, consultamos o TriboPay ATIVAMENTE como backup
// (caso o webhook não tenha chegado por qualquer motivo).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchChargeStatus } from '@/lib/tribopay'
import { generateRecursoForOrder } from '@/lib/recurso'
import { logEvent } from '@/lib/events'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  let order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { fine_data: true, recurso: true },
  })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  // Backup polling: se está aguardando_pagamento E tem hash, pergunta direto pro TriboPay
  if (order.status === 'aguardando_pagamento' && order.tribopay_hash) {
    try {
      const status = await fetchChargeStatus(order.tribopay_hash)
      if (status.status === 'pago') {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'pago', paid_at: new Date() },
        })
        await logEvent({ tipo: 'pago', order_id: order.id, metadata: { source: 'polling' } })
        // dispara geração em background (não bloqueia o polling)
        generateRecursoForOrder(order.id).catch((e) => {
          console.error('[polling:gen] falha', order!.id, e)
        })
        // re-fetch pra refletir o novo status
        order = await prisma.order.findUnique({
          where: { id: params.id },
          include: { fine_data: true, recurso: true },
        })
      } else if (status.status === 'cancelado' || status.status === 'expirado') {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'analisado' }, // volta pra estado anterior
        })
      }
    } catch (e) {
      // erro no polling não trava o front
      console.error('[polling:tribopay]', e)
    }
  }

  return NextResponse.json({
    orderId: order!.id,
    status: order!.status,
    fase: order!.fase,
    prazo_status: order!.prazo_status,
    prazo_limite: order!.prazo_limite?.toISOString() ?? null,
    valor_multa_centavos: order!.valor_multa_centavos,
    preco_centavos: order!.preco_centavos,
    placa: order!.fine_data?.placa ?? null,
    placa_missing: !order!.fine_data?.placa,
    paid_at: order!.paid_at?.toISOString() ?? null,
    generated_at: order!.generated_at?.toISOString() ?? null,
    has_recurso: !!order!.recurso,
    download_url:
      order!.recurso && order!.download_token
        ? `/api/orders/${order!.id}/download?t=${order!.download_token}`
        : null,
  })
}
