import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { fine_data: true, recurso: true },
  })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    fase: order.fase,
    prazo_status: order.prazo_status,
    prazo_limite: order.prazo_limite?.toISOString() ?? null,
    valor_multa_centavos: order.valor_multa_centavos,
    preco_centavos: order.preco_centavos,
    paid_at: order.paid_at?.toISOString() ?? null,
    generated_at: order.generated_at?.toISOString() ?? null,
    has_recurso: !!order.recurso,
    download_url: order.recurso && order.download_token ? `/api/orders/${order.id}/download?t=${order.download_token}` : null,
  })
}
