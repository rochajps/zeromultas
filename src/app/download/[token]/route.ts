// GET /download/[token] — link público de download protegido por token assinado.
// Sem JWT, sem dependências externas — só HMAC-SHA256.

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import { prisma } from '@/lib/prisma'
import { verifyDownloadToken } from '@/lib/download-token'
import { rateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/events'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    null

  // Rate limit por IP (varredura de tokens)
  const rl = rateLimit(`download:${ip ?? 'unknown'}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    return new NextResponse('Tente novamente em alguns minutos.', { status: 429 })
  }

  const v = verifyDownloadToken(params.token)
  if (!v.ok) {
    const friendly =
      v.reason === 'expired'
        ? 'Esse link expirou. Solicite um novo na página do seu pedido.'
        : 'Esse link não é válido.'
    return new NextResponse(htmlError(friendly), {
      status: v.reason === 'expired' ? 410 : 403,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  const order = await prisma.order.findUnique({
    where: { id: v.order_id! },
    include: { recurso: true },
  })
  if (!order || !order.recurso) {
    return new NextResponse(htmlError('Recurso não encontrado.'), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }
  if (!['pago', 'gerado', 'entregue'].includes(order.status)) {
    return new NextResponse(htmlError('Pedido ainda não está liberado.'), {
      status: 402,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  let pdf: Buffer
  try {
    pdf = await fs.readFile(order.recurso.pdf_path)
  } catch {
    return new NextResponse(htmlError('Arquivo indisponível no momento. Acesse a página do pedido pra baixar.'), {
      status: 500,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (order.status === 'gerado') {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'entregue' } })
    await logEvent({ tipo: 'entregue', order_id: order.id, metadata: { via: 'email_link' } })
  }

  return new NextResponse(pdf as never, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recurso-${order.id.slice(0, 8)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}

function htmlError(msg: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Zero Multas</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:24px;text-align:center;color:#0f172a;}
h1{color:#11317A;font-size:20px;}p{color:#475569;font-size:15px;}a{color:#1A56DB;}</style>
</head><body>
<h1>Link indisponível</h1>
<p>${msg.replace(/[<>]/g, '')}</p>
<p style="margin-top:32px;"><a href="/">Voltar ao site</a></p>
</body></html>`
}
