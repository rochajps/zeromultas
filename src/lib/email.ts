// Envio de e-mail transacional via Resend.
// Fila em tabela EmailOutbox: idempotente por (order_id, tipo), retry com tentativas.

import { prisma } from './prisma'
import { signDownloadToken } from './download-token'

const RESEND_API = 'https://api.resend.com/emails'

export type EmailTipo = 'entrega_recurso'

interface EmailDestinatario {
  email: string
  nome: string
}

interface EnvioContext {
  order_id: string
  destinatario: EmailDestinatario
  download_url: string
  expira_em_h: number
}

export async function enqueueRecursoEmail(order_id: string): Promise<{ ok: boolean; reason?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: order_id },
    include: {
      driver_data: { select: { nome: true, email: true } },
      recurso: { select: { id: true } },
    },
  })
  if (!order) return { ok: false, reason: 'order não encontrada' }
  if (!order.recurso) return { ok: false, reason: 'sem recurso gerado' }
  const email = order.driver_data?.email
  if (!email) return { ok: false, reason: 'sem email do condutor' }

  // Idempotência: se já enviou ou está pendente, não duplica
  const existing = await prisma.emailOutbox.findUnique({
    where: { order_id_tipo: { order_id, tipo: 'entrega_recurso' } },
  })
  if (existing && existing.status === 'enviado') {
    return { ok: true, reason: 'já enviado' }
  }

  const row = existing
    ? existing
    : await prisma.emailOutbox.create({
        data: {
          order_id,
          tipo: 'entrega_recurso',
          destinatario: email,
          status: 'pendente',
        },
      })

  // Dispara em background (não bloqueia)
  processOutbox(row.id).catch((e) => console.error('[email:bg]', e))
  return { ok: true }
}

export async function processOutbox(id: number) {
  const row = await prisma.emailOutbox.findUnique({ where: { id } })
  if (!row || row.status === 'enviado') return

  const order = await prisma.order.findUnique({
    where: { id: row.order_id },
    include: { driver_data: { select: { nome: true, email: true } } },
  })
  if (!order || !order.driver_data?.email) {
    await prisma.emailOutbox.update({
      where: { id },
      data: { status: 'erro', last_error: 'sem destinatário', tentativas: { increment: 1 } },
    })
    return
  }

  const ttlHoras = Number(process.env.DOWNLOAD_TOKEN_TTL_HORAS ?? 72)
  const token = signDownloadToken({ order_id: order.id, ttl_hours: ttlHoras })
  const baseUrl = (process.env.APP_BASE_URL ?? 'https://zeromultas.pro').replace(/\/+$/, '')
  const downloadUrl = `${baseUrl}/download/${token}`

  const ctx: EnvioContext = {
    order_id: order.id,
    destinatario: { email: order.driver_data.email, nome: order.driver_data.nome },
    download_url: downloadUrl,
    expira_em_h: ttlHoras,
  }

  try {
    const sent = await sendViaResend(ctx)
    await prisma.emailOutbox.update({
      where: { id },
      data: {
        status: 'enviado',
        sent_at: new Date(),
        provider_message_id: sent.id ?? null,
        tentativas: { increment: 1 },
        last_error: null,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.emailOutbox.update({
      where: { id },
      data: { status: 'erro', last_error: msg.slice(0, 500), tentativas: { increment: 1 } },
    })
  }
}

export async function retryEmailErrors(limit = 20): Promise<{ retried: number }> {
  const rows = await prisma.emailOutbox.findMany({
    where: { status: 'erro', tentativas: { lt: 5 } },
    orderBy: { created_at: 'asc' },
    take: limit,
  })
  await Promise.all(rows.map((r) => processOutbox(r.id)))
  return { retried: rows.length }
}

// ============================================================
// Envio via Resend API
// ============================================================
interface ResendResponse {
  id?: string
}

async function sendViaResend(ctx: EnvioContext): Promise<ResendResponse> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY ausente')
  const from = process.env.EMAIL_FROM ?? 'Zero Multas <onboarding@resend.dev>'
  const replyTo = process.env.EMAIL_REPLY_TO ?? 'contato@zeromultas.pro'

  const html = buildHtml(ctx)
  const text = buildText(ctx)

  const r = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [ctx.destinatario.email],
      reply_to: replyTo,
      subject: 'Seu recurso de multa está pronto',
      html,
      text,
      tags: [
        { name: 'tipo', value: 'entrega_recurso' },
        { name: 'order_id', value: ctx.order_id },
      ],
    }),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`Resend ${r.status}: ${t.slice(0, 400)}`)
  }
  return (await r.json()) as ResendResponse
}

// ============================================================
// Templates
// ============================================================
function buildHtml(ctx: EnvioContext): string {
  const firstName = ctx.destinatario.nome.split(' ')[0] || 'cliente'
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seu recurso está pronto</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;line-height:1.55;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <p style="font-size:13px;color:#475569;margin:0 0 8px 0;letter-spacing:0.04em;text-transform:uppercase;">Zero Multas</p>
      <h1 style="font-size:24px;color:#11317A;margin:0 0 16px 0;">Olá, ${escapeHtml(firstName)}!</h1>
      <p style="font-size:16px;color:#334155;margin:0 0 16px 0;">Seu recurso administrativo de multa está <strong>pronto</strong> e disponível pra download.</p>
      <p style="font-size:16px;color:#334155;margin:0 0 24px 0;">Clique no botão abaixo pra baixar o PDF:</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${ctx.download_url}" style="display:inline-block;background:#1A56DB;color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold;font-size:16px;">📄 Baixar meu recurso</a>
      </p>
      <p style="font-size:14px;color:#64748b;margin:24px 0 8px 0;">⏱️ O link expira em <strong>${ctx.expira_em_h} horas</strong>. Se passar, é só acessar a página de conclusão pelo seu navegador (o recurso continua disponível lá).</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <h2 style="font-size:16px;color:#11317A;margin:0 0 12px 0;">Próximo passo</h2>
      <p style="font-size:14px;color:#475569;margin:0 0 8px 0;">Protocole o recurso no órgão autuador <strong>dentro do prazo legal</strong> (em geral, 30 dias da notificação). O protocolo é gratuito e pode ser feito pelo próprio condutor.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <div style="background:#fef3c7;border-radius:8px;padding:12px 16px;">
        <p style="font-size:13px;color:#92400e;margin:0;"><strong>📬 Caiu no spam?</strong> Marque como "não é spam" pra receber nossas próximas mensagens na caixa de entrada. Se preferir, acesse o link direto pela página do site.</p>
      </div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">Zero Multas — Recurso administrativo de multa de trânsito. Documento gerado para autoatendimento. Sem garantia de resultado.<br><a href="${process.env.APP_BASE_URL ?? 'https://zeromultas.pro'}/privacidade" style="color:#94a3b8;">Política de Privacidade</a></p>
    </div>
  </div>
</body>
</html>`
}

function buildText(ctx: EnvioContext): string {
  const firstName = ctx.destinatario.nome.split(' ')[0] || 'cliente'
  return `Olá, ${firstName}!

Seu recurso administrativo de multa está PRONTO e disponível pra download.

Baixar o PDF (link válido por ${ctx.expira_em_h} horas):
${ctx.download_url}

PRÓXIMO PASSO:
Protocole o recurso no órgão autuador dentro do prazo legal (em geral, 30 dias da notificação). O protocolo é gratuito e pode ser feito pelo próprio condutor.

CAIU NO SPAM?
Marque como "não é spam" pra receber as próximas mensagens na caixa de entrada. O recurso também continua disponível na página do site.

---
Zero Multas — Recurso administrativo de multa de trânsito.
Documento gerado para autoatendimento. Sem garantia de resultado.
Política de Privacidade: ${process.env.APP_BASE_URL ?? 'https://zeromultas.pro'}/privacidade
`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
