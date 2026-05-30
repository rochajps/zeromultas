// Lógica pura de roteamento da fase do recurso administrativo de trânsito.
// Não usa IA — determinístico, a partir do tipo da notificação e da data.

export const PRAZO_DIAS = 30 // art. 281-A do CTB (defesa prévia) e art. 285 (JARI)

export type TipoNotificacao = 'NA' | 'NP' | 'desconhecido'
export type Fase = 'defesa_previa' | 'jari' | 'vencido'
export type PrazoStatusValue = 'valido' | 'vencido'

export interface PhaseInput {
  tipo_notificacao: TipoNotificacao | null | undefined
  data_notificacao: Date | string | null | undefined
  now?: Date
}

export interface PhaseResult {
  fase: Fase
  prazo_status: PrazoStatusValue
  prazo_limite: Date | null
  dias_restantes: number | null
  motivo?: string
}

export function routePhase(input: PhaseInput): PhaseResult {
  const now = input.now ?? new Date()
  const tipo = input.tipo_notificacao ?? null
  const dataNotif = parseDate(input.data_notificacao)

  if (!tipo || tipo === 'desconhecido') {
    return vencidoResult(null, null, 'Tipo de notificação não identificado')
  }
  if (!dataNotif) {
    return vencidoResult(null, null, 'Data da notificação ausente')
  }

  const prazo_limite = addDays(dataNotif, PRAZO_DIAS)
  const dias_restantes = daysDiff(prazo_limite, now)
  const vencido = dias_restantes < 0

  if (vencido) {
    return vencidoResult(prazo_limite, dias_restantes, 'Prazo administrativo encerrado')
  }
  if (tipo === 'NA') {
    return { fase: 'defesa_previa', prazo_status: 'valido', prazo_limite, dias_restantes }
  }
  return { fase: 'jari', prazo_status: 'valido', prazo_limite, dias_restantes }
}

function vencidoResult(prazo_limite: Date | null, dias_restantes: number | null, motivo: string): PhaseResult {
  return { fase: 'vencido', prazo_status: 'vencido', prazo_limite, dias_restantes, motivo }
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
  const ms = toMidnight(target) - toMidnight(from)
  return Math.floor(ms / 86_400_000)
}
