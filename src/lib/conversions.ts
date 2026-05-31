// Conversion outbox + senders pra Meta CAPI, GA4 Measurement Protocol, Google Ads.
// Chaves vêm do banco via getIntegrationKeys() — admin pode editar em /admin/integracoes.

import { createHash } from 'crypto'
import { prisma } from './prisma'
import { getIntegrationKeys, lookupMapping, type Step as MappableStep } from './integrations'

export type Platform = 'meta' | 'ga4' | 'google_ads'
export type ConversionEvent = 'page_view' | 'lead' | 'initiate_checkout' | 'purchase'

export function hashPii(v: string | null | undefined): string | null {
  if (!v) return null
  return createHash('sha256').update(v.trim().toLowerCase()).digest('hex')
}

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
    update: {},
  })
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

const SENDERS: Record<Platform, (evento: ConversionEvent, payload: Record<string, unknown>) => Promise<void>> = {
  meta: sendToMeta,
  ga4: sendToGA4,
  google_ads: sendToGoogleAds,
}

const EVENT_TO_STEP: Record<ConversionEvent, MappableStep> = {
  page_view: 'page_view',
  lead: 'analysis_completed',
  initiate_checkout: 'pix_generated',
  purchase: 'purchase',
}

async function sendToMeta(evento: ConversionEvent, payload: Record<string, unknown>) {
  const k = await getIntegrationKeys()
  if (!k.meta_enabled) throw new Error('Meta desligada nas configurações')
  if (!k.meta_pixel_id || !k.meta_capi_token) throw new Error('Meta sem credenciais')

  const mapping = await lookupMapping(EVENT_TO_STEP[evento], 'meta')
  if (!mapping?.enabled) throw new Error('Evento Meta desligado no mapeamento')
  const eventName = mapping.event_name

  const body: Record<string, unknown> = {
    data: [{ event_name: eventName, event_time: Math.floor(Date.now() / 1000), action_source: 'website', ...payload }],
  }
  if (k.meta_test_event_code) body.test_event_code = k.meta_test_event_code

  const url = `https://graph.facebook.com/v19.0/${k.meta_pixel_id}/events?access_token=${encodeURIComponent(k.meta_capi_token)}`
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`Meta ${r.status}: ${txt.slice(0, 300)}`)
  }
}

async function sendToGA4(evento: ConversionEvent, payload: Record<string, unknown>) {
  const k = await getIntegrationKeys()
  if (!k.ga4_enabled) throw new Error('GA4 desligado nas configurações')
  if (!k.ga4_measurement_id || !k.ga4_api_secret) throw new Error('GA4 sem credenciais')

  const mapping = await lookupMapping(EVENT_TO_STEP[evento], 'ga4')
  if (!mapping?.enabled) throw new Error('Evento GA4 desligado no mapeamento')

  // Renomeia o evento conforme mapping
  if (Array.isArray((payload as { events?: unknown }).events)) {
    type Ev = { name: string; params?: Record<string, unknown> }
    const events = (payload as { events: Ev[] }).events
    events.forEach((e) => (e.name = mapping.event_name))
  }

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(k.ga4_measurement_id)}&api_secret=${encodeURIComponent(k.ga4_api_secret)}`
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`GA4 ${r.status}: ${txt.slice(0, 300)}`)
  }
}

async function sendToGoogleAds(evento: ConversionEvent, _payload: Record<string, unknown>) {
  const k = await getIntegrationKeys()
  if (!k.google_ads_enabled) throw new Error('Google Ads desligado nas configurações')
  if (!k.google_ads_developer_token || !k.google_ads_conversion_id || !k.google_ads_conversion_label) {
    throw new Error('Google Ads sem credenciais completas')
  }
  if (evento !== 'purchase') throw new Error('Google Ads aceita só purchase nesse setup')
  throw new Error('TODO: implementar OAuth2 + ClickConversion upload (Google Ads API v17)')
}

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
    custom_data: { currency: args.currency, value: args.value_brl },
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
