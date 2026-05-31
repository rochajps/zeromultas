import { prisma } from './prisma'

export interface SettingsValues {
  // Prazo
  prazo_dias: number
  prazo_cetran_dias: number
  cobrar_proximo_vencimento_dias: number
  // Score
  score_alto: number
  score_moderado: number
  score_min_visivel: number
  // Comportamento
  permitir_vencido: boolean
  permitir_cetran_direto: boolean
  tipo_padrao_quando_desconhecido: string // 'NA' | 'NP'
  // Valor
  valor_minimo_multa_centavos: number
  valor_maximo_multa_centavos: number
  // Mensagens
  msg_score_alto: string
  msg_score_moderado: string
  msg_score_vencido: string
  msg_nao_eh_multa: string
  msg_vencido_alternativa: string
  msg_valor_fora_faixa: string
}

export const DEFAULT_SETTINGS: SettingsValues = {
  prazo_dias: 30,
  prazo_cetran_dias: 30,
  cobrar_proximo_vencimento_dias: 0,
  score_alto: 85,
  score_moderado: 55,
  score_min_visivel: 0,
  permitir_vencido: false,
  permitir_cetran_direto: true,
  tipo_padrao_quando_desconhecido: 'NA',
  valor_minimo_multa_centavos: 0,
  valor_maximo_multa_centavos: 0,
  msg_score_alto:
    'Identificamos vício formal/processual claro. Chance significativa de anulação com fundamentação correta.',
  msg_score_moderado:
    'Não identificamos vício formal forte, mas ainda vale recorrer: é gratuito, suspende pontos e o seu motivo será fundamentado tecnicamente. Sem garantia de êxito.',
  msg_score_vencido:
    'O prazo administrativo já encerrou. Não cobramos por recurso intempestivo — não há viabilidade nesta fase.',
  msg_nao_eh_multa: 'Não conseguimos identificar uma multa válida nesta imagem.',
  msg_vencido_alternativa:
    'Se você já recebeu a decisão negativa da JARI, ainda tem 30 dias contados da ciência pra recorrer ao CETRAN (3ª instância). A gente gera essa peça também.',
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
    } else if (row.type === 'boolean' && row.value_bool != null) {
      (values as unknown as Record<string, unknown>)[key] = row.value_bool
    }
  }
  _cache = { values, loadedAt: now }
  return values
}

export function invalidateSettingsCache() {
  _cache = null
}
