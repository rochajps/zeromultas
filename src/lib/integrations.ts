// Configuração de integrações (Meta CAPI / GA4 / Google Ads) e mapeamento de eventos.
// Lê do banco com cache TTL 60s. Fallback pra process.env quando não há registro.

import { prisma } from './prisma'

export type Platform = 'meta' | 'ga4' | 'google_ads'

export interface IntegrationKeys {
  meta_pixel_id: string | null
  meta_capi_token: string | null
  meta_test_event_code: string | null
  meta_enabled: boolean
  ga4_measurement_id: string | null
  ga4_api_secret: string | null
  ga4_enabled: boolean
  google_ads_developer_token: string | null
  google_ads_conversion_id: string | null
  google_ads_conversion_label: string | null
  google_ads_enabled: boolean
}

const INTEGRATION_KEYS = [
  'meta_pixel_id',
  'meta_capi_token',
  'meta_test_event_code',
  'meta_enabled',
  'ga4_measurement_id',
  'ga4_api_secret',
  'ga4_enabled',
  'google_ads_developer_token',
  'google_ads_conversion_id',
  'google_ads_conversion_label',
  'google_ads_enabled',
] as const

export type IntegrationKey = (typeof INTEGRATION_KEYS)[number]

export const SECRET_KEYS = new Set<IntegrationKey>([
  'meta_capi_token',
  'ga4_api_secret',
  'google_ads_developer_token',
])

let _cache: { values: IntegrationKeys; loadedAt: number } | null = null
const CACHE_TTL_MS = 60_000

function envFallback(key: IntegrationKey): string | null {
  const map: Record<IntegrationKey, string> = {
    meta_pixel_id: 'META_PIXEL_ID',
    meta_capi_token: 'META_CAPI_ACCESS_TOKEN',
    meta_test_event_code: 'META_TEST_EVENT_CODE',
    meta_enabled: '',
    ga4_measurement_id: 'GA4_MEASUREMENT_ID',
    ga4_api_secret: 'GA4_API_SECRET',
    ga4_enabled: '',
    google_ads_developer_token: 'GOOGLE_ADS_DEVELOPER_TOKEN',
    google_ads_conversion_id: 'GOOGLE_ADS_CONVERSION_ID',
    google_ads_conversion_label: 'GOOGLE_ADS_CONVERSION_LABEL',
    google_ads_enabled: '',
  }
  const envName = map[key]
  if (!envName) return null
  return process.env[envName] ?? null
}

export async function getIntegrationKeys(force = false): Promise<IntegrationKeys> {
  const now = Date.now()
  if (!force && _cache && now - _cache.loadedAt < CACHE_TTL_MS) return _cache.values

  const rows = await prisma.integrationConfig.findMany({
    where: { key: { in: INTEGRATION_KEYS as unknown as string[] } },
  })
  const map = new Map(rows.map((r) => [r.key as IntegrationKey, r.value]))

  const v: IntegrationKeys = {
    meta_pixel_id: map.get('meta_pixel_id') ?? envFallback('meta_pixel_id'),
    meta_capi_token: map.get('meta_capi_token') ?? envFallback('meta_capi_token'),
    meta_test_event_code: map.get('meta_test_event_code') ?? envFallback('meta_test_event_code'),
    meta_enabled: (map.get('meta_enabled') ?? 'false') === 'true',
    ga4_measurement_id: map.get('ga4_measurement_id') ?? envFallback('ga4_measurement_id'),
    ga4_api_secret: map.get('ga4_api_secret') ?? envFallback('ga4_api_secret'),
    ga4_enabled: (map.get('ga4_enabled') ?? 'false') === 'true',
    google_ads_developer_token: map.get('google_ads_developer_token') ?? envFallback('google_ads_developer_token'),
    google_ads_conversion_id: map.get('google_ads_conversion_id') ?? envFallback('google_ads_conversion_id'),
    google_ads_conversion_label: map.get('google_ads_conversion_label') ?? envFallback('google_ads_conversion_label'),
    google_ads_enabled: (map.get('google_ads_enabled') ?? 'false') === 'true',
  }
  _cache = { values: v, loadedAt: now }
  return v
}

export function invalidateIntegrationsCache() {
  _cache = null
}

export async function setIntegrationKey(key: IntegrationKey, value: string | null) {
  if (!INTEGRATION_KEYS.includes(key)) throw new Error('chave inválida')
  const v = value ?? ''
  await prisma.integrationConfig.upsert({
    where: { key },
    update: { value: v, is_secret: SECRET_KEYS.has(key) },
    create: { key, value: v, is_secret: SECRET_KEYS.has(key) },
  })
  invalidateIntegrationsCache()
}

// ============================================================
// EventMapping (qual step vira qual evento em cada plataforma)
// ============================================================

export type Step =
  | 'page_view'
  | 'upload_started'
  | 'analysis_completed'
  | 'data_collection_completed'
  | 'pix_generated'
  | 'purchase'

export const MAPPABLE_STEPS: Step[] = [
  'page_view',
  'upload_started',
  'analysis_completed',
  'data_collection_completed',
  'pix_generated',
  'purchase',
]

export interface EventMappingValue {
  enabled: boolean
  event_name: string
  value_cents: number | null // override de valor monetário (null = sem valor / purchase usa valor real)
  currency: string
}

let _mappingCache: { map: Map<string, EventMappingValue>; loadedAt: number } | null = null

function makeKey(step: Step, platform: Platform): string {
  return `${step}:${platform}`
}

const DEFAULT_MAPPING: Record<string, EventMappingValue> = {
  // Page view
  'page_view:meta': { enabled: true, event_name: 'PageView', value_cents: null, currency: 'BRL' },
  'page_view:ga4': { enabled: true, event_name: 'page_view', value_cents: null, currency: 'BRL' },
  // Lead (análise completa = lead)
  'analysis_completed:meta': { enabled: true, event_name: 'Lead', value_cents: null, currency: 'BRL' },
  'analysis_completed:ga4': { enabled: true, event_name: 'generate_lead', value_cents: null, currency: 'BRL' },
  // InitiateCheckout
  'pix_generated:meta': { enabled: true, event_name: 'InitiateCheckout', value_cents: null, currency: 'BRL' },
  'pix_generated:ga4': { enabled: true, event_name: 'begin_checkout', value_cents: null, currency: 'BRL' },
  // Purchase
  'purchase:meta': { enabled: true, event_name: 'Purchase', value_cents: null, currency: 'BRL' },
  'purchase:ga4': { enabled: true, event_name: 'purchase', value_cents: null, currency: 'BRL' },
  'purchase:google_ads': { enabled: true, event_name: 'purchase', value_cents: null, currency: 'BRL' },
}

export async function getEventMapping(force = false): Promise<Map<string, EventMappingValue>> {
  const now = Date.now()
  if (!force && _mappingCache && now - _mappingCache.loadedAt < CACHE_TTL_MS) return _mappingCache.map

  const rows = await prisma.eventMapping.findMany()
  const map = new Map<string, EventMappingValue>(Object.entries(DEFAULT_MAPPING))
  for (const r of rows) {
    const key = makeKey(r.step as Step, r.platform as Platform)
    map.set(key, {
      enabled: r.enabled,
      event_name: r.event_name,
      value_cents: r.value_cents,
      currency: r.currency,
    })
  }
  _mappingCache = { map, loadedAt: now }
  return map
}

export function invalidateMappingCache() {
  _mappingCache = null
}

export async function lookupMapping(step: Step, platform: Platform): Promise<EventMappingValue | null> {
  const map = await getEventMapping()
  return map.get(makeKey(step, platform)) ?? null
}

export async function setEventMapping(step: Step, platform: Platform, value: EventMappingValue) {
  await prisma.eventMapping.upsert({
    where: { step_platform: { step, platform } },
    update: {
      enabled: value.enabled,
      event_name: value.event_name,
      value_cents: value.value_cents,
      currency: value.currency,
    },
    create: {
      step,
      platform,
      enabled: value.enabled,
      event_name: value.event_name,
      value_cents: value.value_cents,
      currency: value.currency,
    },
  })
  invalidateMappingCache()
}
