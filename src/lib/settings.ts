import { prisma } from './prisma'

export interface SettingsValues {
  prazo_dias: number
  prazo_cetran_dias: number
  // Scores por band
  score_alta: number
  score_media: number
  score_moderada_baixa: number
  // Comportamento
  tipo_padrao_quando_desconhecido: string
  // Valor da multa
  valor_minimo_multa_centavos: number
  valor_maximo_multa_centavos: number
  // Mensagens por band
  msg_alta: string
  msg_media: string
  msg_moderada_baixa: string
  msg_nao_eh_multa: string
  msg_valor_fora_faixa: string
}

export const DEFAULT_SETTINGS: SettingsValues = {
  prazo_dias: 30,
  prazo_cetran_dias: 30,
  score_alta: 85,
  score_media: 65,
  score_moderada_baixa: 40,
  tipo_padrao_quando_desconhecido: 'NA',
  valor_minimo_multa_centavos: 0,
  valor_maximo_multa_centavos: 0,
  msg_alta:
    'Identificamos vício formal/processual claro. Chance significativa de anulação com fundamentação correta.',
  msg_media:
    'Há indícios que sustentam o recurso. Vale tentar — sem garantia de êxito.',
  msg_moderada_baixa:
    'Não encontramos vício formal forte, mas ainda vale recorrer: o processo é gratuito, suspende pontos enquanto está em análise e o seu motivo será fundamentado tecnicamente em princípios do processo administrativo. Sem promessa de resultado.',
  msg_nao_eh_multa: 'Não conseguimos identificar uma multa válida nesta imagem.',
  msg_valor_fora_faixa:
    'O valor da multa está fora da faixa que atendemos no momento. Recomendamos pagar diretamente o auto.',
}

let _cache: { values: SettingsValues; loadedAt: number } | null = null
const CACHE_TTL_MS = 60_000

export async function getSettings(force = false): Promise<SettingsValues> {
  const now = Date.now()
  if (!force && _cache && now - _cache.loadedAt < CACHE_TTL_MS) {
    return _cache.values
  }
  const rows = await prisma.setting.findMany()
  const values: SettingsValues = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    const key = row.key as keyof SettingsValues
    if (!(key in DEFAULT_SETTINGS)) continue
    if (row.type === 'number' && row.value_number != null) {
      (values as unknown as Record<string, unknown>)[key] = row.value_number
    } else if (row.type === 'text' && row.value_text != null) {
      (values as unknown as Record<string, unknown>)[key] = row.value_text
    }
  }
  _cache = { values, loadedAt: now }
  return values
}

export function invalidateSettingsCache() {
  _cache = null
}
