import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createPixCharge } from '@/lib/tribopay'
import { logEvent } from '@/lib/events'
import { getSettings } from '@/lib/settings'
import { routePhase } from '@/lib/phase-router'
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
    if (!order.driver_data || !order.driver_input) {
      return NextResponse.json({ error: 'Complete os dados do condutor antes do checkout.' }, { status: 400 })
    }

    // Recalcular fase + preço com as regras ATUAIS antes de qualquer cobrança.
    // Isso garante que mudanças no /admin/regras se aplicam mesmo a pedidos antigos.
    const settings = await getSettings()
    let faseAtual = order.fase
    let precoAtual = order.preco_centavos
    let faixaIdAtual = order.faixa_id

    if (order.fine_data && !order.data_missing) {
      const phase = routePhase({
        tipo_notificacao: order.fine_data.tipo_notificacao,
        data_notificacao: order.fine_data.data_notificacao,
        prazoDias: settings.prazo_dias,
      })
      faseAtual = phase.fase
      const bloqueio =
        settings.cobrar_proximo_vencimento_dias > 0 &&
        phase.dias_restantes != null &&
        phase.dias_restantes < settings.cobrar_proximo_vencimento_dias
      if (bloqueio) faseAtual = 'vencido'
    }
    if (order.valor_multa_centavos && faseAtual !== 'vencido') {
      const tiers = await prisma.priceTier.findMany({ where: { ativo: true } })
      const pricing = pickTier(order.valor_multa_centavos, tiers)
      if (pricing) {
        precoAtual = pricing.preco_centavos
        faixaIdAtual = pricing.tier.id
      }
    }

    if (faseAtual === 'vencido') {
      return NextResponse.json({ error: 'Pedido com prazo vencido — não cobramos.' }, { status: 409 })
    }
    if (!precoAtual || !faixaIdAtual) {
      return NextResponse.json({ error: 'Preço não definido. Reanalise a multa.' }, { status: 400 })
    }

    // Salva a fase e preço efetivos antes de criar a cobrança
    if (faseAtual !== order.fase || precoAtual !== order.preco_centavos || faixaIdAtual !== order.faixa_id) {
      await prisma.order.update({
        where: { id: orderId },
        data: { fase: faseAtual, preco_centavos: precoAtual, faixa_id: faixaIdAtual },
      })
    }

    // Idempotência: já existe cobrança PIX pendente
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
      payer: { name: order.driver_data.nome, document: order.driver_data.cpf, email: null, phone: null },
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
