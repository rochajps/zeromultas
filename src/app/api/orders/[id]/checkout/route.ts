import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createPixCharge } from '@/lib/tribopay'
import { logEvent } from '@/lib/events'
import { getSettings } from '@/lib/settings'
import { pickTier } from '@/lib/pricing'

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
    if (!order.driver_data) {
      return NextResponse.json({ error: 'Complete os dados do condutor antes do checkout.' }, { status: 400 })
    }

    const settings = await getSettings()

    // Recalcular preço com tiers atuais
    let precoAtual = order.preco_centavos
    let faixaIdAtual = order.faixa_id
    if (order.valor_multa_centavos) {
      const tiers = await prisma.priceTier.findMany({ where: { ativo: true } })
      const pricing = pickTier(order.valor_multa_centavos, tiers)
      if (pricing) {
        precoAtual = pricing.preco_centavos
        faixaIdAtual = pricing.tier.id
      }
    }

    // Validar faixa de valor da multa configurada no admin
    if (order.valor_multa_centavos != null) {
      if (settings.valor_minimo_multa_centavos > 0 && order.valor_multa_centavos < settings.valor_minimo_multa_centavos) {
        return NextResponse.json({ error: settings.msg_valor_fora_faixa }, { status: 409 })
      }
      if (settings.valor_maximo_multa_centavos > 0 && order.valor_multa_centavos > settings.valor_maximo_multa_centavos) {
        return NextResponse.json({ error: settings.msg_valor_fora_faixa }, { status: 409 })
      }
    }

    if (!precoAtual || !faixaIdAtual) {
      return NextResponse.json({ error: 'Preço não definido. Reanalise a multa ou informe o valor.' }, { status: 400 })
    }

    if (precoAtual !== order.preco_centavos || faixaIdAtual !== order.faixa_id) {
      await prisma.order.update({
        where: { id: orderId },
        data: { preco_centavos: precoAtual, faixa_id: faixaIdAtual },
      })
    }

    if (order.tribopay_hash && order.status === 'aguardando_pagamento') {
      return NextResponse.json({
        orderId,
        hash: order.tribopay_hash,
        reused: true,
        preco_centavos: precoAtual,
      })
    }

    const charge = await createPixCharge({
      amount_centavos: precoAtual,
      order_id: orderId,
      description: `Recurso de multa #${orderId.slice(0, 8)}`,
      payer: { name: order.driver_data.nome, document: order.driver_data.cpf, email: null, phone: order.driver_data.whatsapp ?? null },
      webhook_url: publicUrl('/api/webhook/tribopay'),
    })

    const downloadToken = order.download_token ?? randomBytes(24).toString('hex')

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'aguardando_pagamento',
        tribopay_hash: charge.hash,
        download_token: downloadToken,
        checkout_em: new Date(),
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
