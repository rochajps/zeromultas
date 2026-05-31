// Conversion outbox + senders pra Meta CAPI, GA4 Measurement Protocol, Google Ads.
// Estrutura completa. As funções send* falham com mensagem clara quando credenciais ausentes.
// Quando você plugar as chaves no .env, status='pendente' do outbox passa a 'enviado'.

import { createHash } from 'crypto'
import { prisma } from './prisma'

export type Platform = 'meta' | 'google_ads' | 'ga4'
export type ConversionEvent = 'page_view' | 'lead' | 'initiate_checkout' | 'purchase'

// ============================================================
// Hash de PII (SHA-256 lowercase trim) — exigido por Meta/Google
// ============================================================
export function hashPii(v: string | null | undefined): string | null {
  if (!v) return null
  return createHash('sha256').update(v.trim().toLowerCase()).digest('hex')
}

// ============================================================
// Outbox
// ============================================================
export async function enqueueConversion(args: {
  order_id: string
  platform: Platform
  evento: ConversionEvent
  payload: Record<string, unknown>
}) {
  const row = await prisma.conversionOutbox.upsert({
    where: {
      order_id_platform_evento: { order_id: args.order_id, platform: args.platform, evento: args.evento },
    },
    create: {
      order_id: args.order_id,
      platform: args.platform,
      evento: args.evento,
      payload: args.payload as never,
      status: 'pendente',
    },
    update: {
      // Não sobrescreve se já enviado
    },
  })
  // Dispara em background (não bloqueia)
  if (row.status === 'pendente') {
    processOutboxRow(row.id).catch((err) => console.error('[outbox:bg]', err))
  }
  return row
}

export async function processOutboxRow(id: bigint) {
  const row = await prisma.conversionOutbox.findUnique({ where: { id } })
  if (!row || row.status === 'enviado') return

  const sender = SENDERS[row.platform as Platform]
  if (!sender) {
    await prisma.conversionOutbox.update({
      where: { id },
      data: { status: 'erro', last_error: 'platform sem sender' },
    })
    return
  }

  try {
    await sender(row.evento as ConversionEvent, row.payload as Record<string, unknown>)
    await prisma.conversionOutbox.update({
      where: { id },
      data: { status: 'enviado', sent_at: new Date(), tentativas: { increment: 1 }, last_error: null },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.conversionOutbox.update({
      where: { id },
      data: { status: 'erro', tentativas: { increment: 1 }, last_error: msg },
    })
  }
}

export async function retryAllErrored(limit = 20): Promise<{ retried: number }> {
  const rows = await prisma.conversionOutbox.findMany({
    where: { status: 'erro', tentativas: { lt: 5 } },
    orderBy: { created_at: 'asc' },
    take: limit,
  })
  await Promise.all(rows.map((r) => processOutboxRow(r.id)))
  return { retried: rows.length }
}

// ============================================================
// Senders (stubs prontos pra ativação)
// ============================================================
const SENDERS: Record<Platform, (evento: ConversionEvent, payload: Record<string, unknown>) => Promise<void>> = {
  meta: sendToMeta,
  ga4: sendToGA4,
  google_ads: sendToGoogleAds,
}

async function sendToMeta(evento: ConversionEvent, payload: Record<string, unknown>) {
  const pixel = process.env.META_PIXEL_ID
  const token = process.env.META_CAPI_ACCESS_TOKEN
  if (!pixel || !token) throw new Error('META_PIXEL_ID/META_CAPI_ACCESS_TOKEN ausentes — credenciais não configuradas')

  const eventNameMap: Record<ConversionEvent, string> = {
    page_view: 'PageView',
    lead: 'Lead',
    initiate_checkout: 'InitiateCheckout',
    purchase: 'Purchase',
  }

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: eventNameMap[evento],
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        ...payload,
      },
    ],
  }
  if (process.env.META_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_TEST_EVENT_CODE
  }

  const url = `https://graph.facebook.com/v19.0/${pixel}/events?access_token=${token}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`Meta ${r.status}: ${txt.slice(0, 300)}`)
  }
}

async function sendToGA4(evento: ConversionEvent, payload: Record<string, unknown>) {
  const measurementId = process.env.GA4_MEASUREMENT_ID
  const apiSecret = process.env.GA4_API_SECRET
  if (!measurementId || !apiSecret) throw new Error('GA4_MEASUREMENT_ID/GA4_API_SECRET ausentes — credenciais não configuradas')

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`GA4 ${r.status}: ${txt.slice(0, 300)}`)
  }
}

async function sendToGoogleAds(evento: ConversionEvent, _payload: Record<string, unknown>) {
  const dev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const cid = process.env.GOOGLE_ADS_CONVERSION_ID
  const label = process.env.GOOGLE_ADS_CONVERSION_LABEL
  if (!dev || !cid || !label) {
    throw new Error('GOOGLE_ADS_* ausentes — credenciais não configuradas (preencher e implementar OAuth flow)')
  }
  if (evento !== 'purchase') {
    // Eventos sem valor real podem ir só pro GA4
    throw new Error('Google Ads upload só pra purchase nesse setup')
  }
  // Implementação real: Google Ads API ClickConversion upload com gclid.
  // Estrutura pronta, mas precisa OAuth completo. Marcar como TODO:
  throw new Error('TODO: implementar OAuth2 + ClickConversion upload (Google Ads API v17)')
}

// ============================================================
// Helpers de payload pra cada plataforma (use no webhook)
// ============================================================

export function buildMetaPurchasePayload(args: {
  value_brl: number
  currency: string
  event_id: string
  ip?: string | null
  user_agent?: string | null
  fbp?: string | null
  fbc?: string | null
  email?: string | null
  phone?: string | null
  event_source_url?: string | null
}) {
  return {
    event_id: args.event_id,
    event_source_url: args.event_source_url ?? null,
    user_data: {
      fbp: args.fbp ?? undefined,
      fbc: args.fbc ?? undefined,
      em: args.email ? [hashPii(args.email)] : undefined,
      ph: args.phone ? [hashPii(args.phone.replace(/\D+/g, ''))] : undefined,
      client_ip_address: args.ip ?? undefined,
      client_user_agent: args.user_agent ?? undefined,
    },
    custom_data: {
      currency: args.currency,
      value: args.value_brl,
    },
  }
}

export function buildGA4PurchasePayload(args: {
  client_id: string
  value_brl: number
  currency: string
  transaction_id: string
  user_id?: string | null
}) {
  return {
    client_id: args.client_id,
    user_id: args.user_id ?? undefined,
    events: [
      {
        name: 'purchase',
        params: {
          value: args.value_brl,
          currency: args.currency,
          transaction_id: args.transaction_id,
        },
      },
    ],
  }
}
