// Lógica pura de roteamento da fase do recurso administrativo.
// IMPORTANTE: nunca retorna fase='vencido'. Quando o prazo passou,
// ainda retorna fase válida (defesa_previa ou jari) e marca prazo_status
// apenas como INFORMAÇÃO — nunca como bloqueio.

export const PRAZO_DIAS_DEFAULT = 30

export type Fase = 'defesa_previa' | 'jari' | 'cetran' | 'vencido' // 'vencido' mantido só pra compat. com pedidos antigos
export type PrazoStatusValue = 'valido' | 'vencido'

export interface PhaseInput {
  tipo_notificacao: 'NA' | 'NP' | 'desconhecido' | null | undefined
  data_notificacao: Date | string | null | undefined
  now?: Date
  prazoDias?: number
}

export interface PhaseResult {
  fase: 'defesa_previa' | 'jari'
  prazo_status: PrazoStatusValue
  prazo_limite: Date | null
  dias_restantes: number | null
}

export function routePhase(input: PhaseInput): PhaseResult {
  const now = input.now ?? new Date()
  const prazoDias = input.prazoDias ?? PRAZO_DIAS_DEFAULT
  const tipo = input.tipo_notificacao ?? null
  const dataNotif = parseDate(input.data_notificacao)

  // Fase determinada pelo tipo. Se desconhecido, default = defesa_previa.
  const fase: 'defesa_previa' | 'jari' = tipo === 'NP' ? 'jari' : 'defesa_previa'

  if (!dataNotif) {
    return { fase, prazo_status: 'valido', prazo_limite: null, dias_restantes: null }
  }

  const prazo_limite = addDays(dataNotif, prazoDias)
  const dias_restantes = daysDiff(prazo_limite, now)
  const prazo_status: PrazoStatusValue = dias_restantes >= 0 ? 'valido' : 'vencido'

  return { fase, prazo_status, prazo_limite, dias_restantes }
}

function parseDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d
  const parsed = new Date(d)
  return isNaN(parsed.getTime()) ? null : parsed
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function daysDiff(target: Date, from: Date): number {
  const toMidnight = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())
  return Math.floor((toMidnight(target) - toMidnight(from)) / 86_400_000)
}
