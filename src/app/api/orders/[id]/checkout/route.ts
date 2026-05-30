import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createPixCharge } from '@/lib/tribopay'
import { logEvent } from '@/lib/events'

export const runtime = 'nodejs'
export const maxDuration = 30

function publicUrl(path: string): string {
  const base = (process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
  return `${base}${path}`
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const orderId = params.id
  const ua = req.headers.get('user-agent')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { fine_data: true, driver_data: true, driver_input: true, price_tier: true },
    })
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    if (order.status === 'vencido' || order.fase === 'vencido') {
      return NextResponse.json({ error: 'Pedido com prazo vencido — não cobramos.' }, { status: 409 })
    }
    if (!order.driver_data || !order.driver_input) {
      return NextResponse.json({ error: 'Complete os dados do condutor antes do checkout.' }, { status: 400 })
    }
    if (!order.preco_centavos || !order.faixa_id) {
      return NextResponse.json({ error: 'Preço não definido. Reanalise a multa.' }, { status: 400 })
    }

    // Se já tem cobrança PIX pendente nesse pedido, devolve a mesma (idempotência)
    if (order.tribopay_hash && order.status === 'aguardando_pagamento') {
      return NextResponse.json({
        orderId,
        hash: order.tribopay_hash,
        reused: true,
        preco_centavos: order.preco_centavos,
      })
    }

    const charge = await createPixCharge({
      amount_centavos: order.preco_centavos,
      order_id: orderId,
      description: `Recurso de multa #${orderId.slice(0, 8)}`,
      payer: { name: order.driver_data.nome, document: order.driver_data.cpf },
      webhook_url: publicUrl('/api/webhook/tribopay'),
    })

    // Token único pra liberar download depois (vinculado ao pedido)
    const downloadToken = order.download_token ?? randomBytes(24).toString('hex')

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'aguardando_pagamento',
        tribopay_hash: charge.hash,
        download_token: downloadToken,
      },
    })

    await logEvent({ tipo: 'checkout', order_id: orderId, user_agent: ua, ip, metadata: { hash: charge.hash } })

    return NextResponse.json({
      orderId,
      hash: charge.hash,
      qr_code_text: charge.qr_code_text,
      qr_code_base64: charge.qr_code_base64,
      preco_centavos: charge.amount_centavos,
      expires_at: charge.expires_at,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[checkout]', msg)
    return NextResponse.json({ error: 'Falha ao gerar cobrança.' }, { status: 500 })
  }
}
