import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/events'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const orderId = params.id
  const token = req.nextUrl.searchParams.get('t')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { recurso: true },
  })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  if (!order.download_token || !token || token !== order.download_token) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 403 })
  }
  if (!['pago', 'gerado', 'entregue'].includes(order.status)) {
    return NextResponse.json({ error: 'Pedido ainda não pago.' }, { status: 402 })
  }
  if (!order.recurso) {
    return NextResponse.json({ error: 'Recurso ainda sendo gerado. Aguarde alguns segundos.' }, { status: 425 })
  }

  let pdf: Buffer
  try {
    pdf = await fs.readFile(order.recurso.pdf_path)
  } catch {
    return NextResponse.json({ error: 'Arquivo do recurso indisponível.' }, { status: 500 })
  }

  if (order.status === 'gerado') {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'entregue' } })
    await logEvent({ tipo: 'entregue', order_id: orderId })
  }

  return new NextResponse(pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recurso-${orderId.slice(0, 8)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
