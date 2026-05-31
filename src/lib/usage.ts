// Tracking de uso da API Anthropic.
// Salva input/output/cache tokens por chamada. Custo é calculado on-the-fly com
// os preços atuais — assim, se a Anthropic alterar preços, dashboards refletem sem migração.

import { prisma } from './prisma'

export type ApiKind = 'analise' | 'extracao_cnh' | 'geracao' | 'other'

interface AnthropicUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

// Preços por 1M tokens (USD). Editar aqui quando Anthropic atualizar.
interface ModelPrice {
  input: number
  output: number
  cache_create: number
  cache_read: number
}

const PRICES: Record<string, ModelPrice> = {
  // Haiku 4.5
  'claude-haiku-4-5': { input: 1, output: 5, cache_create: 1.25, cache_read: 0.1 },
  // Sonnet 4.6
  'claude-sonnet-4-6': { input: 3, output: 15, cache_create: 3.75, cache_read: 0.3 },
  // Opus 4.7
  'claude-opus-4-7': { input: 15, output: 75, cache_create: 18.75, cache_read: 1.5 },
}

const DEFAULT_PRICE: ModelPrice = { input: 3, output: 15, cache_create: 3.75, cache_read: 0.3 }

export function priceFor(model: string): ModelPrice {
  if (model in PRICES) return PRICES[model]
  // Match parcial: 'claude-haiku-4-5-20251001' → 'claude-haiku-4-5'
  for (const key of Object.keys(PRICES)) {
    if (model.startsWith(key)) return PRICES[key]
  }
  if (model.includes('haiku')) return PRICES['claude-haiku-4-5']
  if (model.includes('sonnet')) return PRICES['claude-sonnet-4-6']
  if (model.includes('opus')) return PRICES['claude-opus-4-7']
  return DEFAULT_PRICE
}

/** Custo em USD a partir de tokens + modelo. */
export function computeCostUSD(
  usage: AnthropicUsage,
  model: string,
): { total: number; breakdown: { input: number; output: number; cache_create: number; cache_read: number } } {
  const p = priceFor(model)
  const breakdown = {
    input: (usage.input_tokens * p.input) / 1_000_000,
    output: (usage.output_tokens * p.output) / 1_000_000,
    cache_create: ((usage.cache_creation_input_tokens ?? 0) * p.cache_create) / 1_000_000,
    cache_read: ((usage.cache_read_input_tokens ?? 0) * p.cache_read) / 1_000_000,
  }
  return {
    total: breakdown.input + breakdown.output + breakdown.cache_create + breakdown.cache_read,
    breakdown,
  }
}

export interface RecordUsageArgs {
  order_id?: string | null
  kind: ApiKind
  model: string
  usage: AnthropicUsage
  request_id?: string | null
}

export async function recordApiUsage({ order_id, kind, model, usage, request_id }: RecordUsageArgs) {
  try {
    await prisma.apiUsage.create({
      data: {
        order_id: order_id ?? null,
        kind,
        model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
        request_id: request_id ?? null,
      },
    })
  } catch (err) {
    console.error('[usage] falha ao salvar', err)
  }
}
