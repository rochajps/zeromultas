import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchChargeStatus } from '@/lib/tribopay'
import { generateRecursoForOrder } from '@/lib/recurso'
import { logEvent } from '@/lib/events'

export const runtime = 'nodejs'
export const maxDuration = 60

// Endpoint do postback da TriboPay. Sempre responde 2xx, nunca confia só no payload:
// busca o status real na API antes de marcar como pago (defesa contra spoofing).

export async function POST(req: NextRequest) {
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    try { body = Object.fromEntries(await req.formData()) } catch {}
  }

  // Doc/payload da TriboPay pode variar — extrai hash em vários campos comuns
  const hash: string | null =
    body?.hash ??
    body?.transaction?.hash ??
    body?.data?.hash ??
    body?.order_id ??
    body?.id ??
    null

  if (!hash) {
    console.warn('[webhook:tribopay] payload sem hash:', JSON.stringify(body).slice(0, 300))
    // Responde 200 mesmo assim pra não causar reenvio em loop com payload inválido
    return NextResponse.json({ ok: false, error: 'sem hash' })
  }

  try {
    const order = await prisma.order.findFirst({ where: { tribopay_hash: hash } })
    if (!order) {
      console.warn('[webhook:tribopay] order não encontrada hash=', hash)
      return NextResponse.json({ ok: false, error: 'order não encontrada' })
    }

    // Idempotência: se já tá pago ou gerado, retorna OK
    if (order.status === 'pago' || order.status === 'gerado' || order.status === 'entregue') {
      return NextResponse.json({ ok: true, idempotent: true, status: order.status })
    }

    // VALIDAÇÃO NA ORIGEM (crítico contra spoofing)
    const status = await fetchChargeStatus(hash)
    if (status.status !== 'pago') {
      await logEvent({ tipo: 'analise_falha', order_id: order.id, metadata: { webhook_status: status.status } })
      return NextResponse.json({ ok: true, ignored: true, source_status: status.status })
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'pago', paid_at: new Date() },
    })
    await logEvent({ tipo: 'pago', order_id: order.id, metadata: { hash } })

    // Dispara geração em background — não bloqueia o webhook
    // (em produção idealmente vai pra uma fila; aqui já tá no Node, pode rodar inline com handle de erro)
    generateRecursoForOrder(order.id).catch((e) => {
      console.error('[webhook:gen] falha na geração', order.id, e)
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook:tribopay]', err)
    // Importante responder 2xx pra evitar replay storm; loga e segue
    return NextResponse.json({ ok: false, error: 'erro interno' })
  }
}

// Endpoint admin/dev: força marcação como pago (modo mock)
export async function GET(req: NextRequest) {
  if (process.env.TRIBOPAY_MODE !== 'mock') {
    return NextResponse.json({ error: 'apenas em modo mock' }, { status: 403 })
  }
  const hash = req.nextUrl.searchParams.get('hash')
  if (!hash) return NextResponse.json({ error: 'hash obrigatório' }, { status: 400 })
  const { _mockMarkPaid } = await import('@/lib/tribopay')
  _mockMarkPaid(hash)
  // Reaproveita o POST handler internamente
  const fake = new NextRequest(new URL(req.url), { method: 'POST', body: JSON.stringify({ hash }), headers: { 'content-type': 'application/json' } })
  return POST(fake)
}
