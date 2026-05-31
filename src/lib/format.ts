// Formatação de datas em fuso horário de Brasília.
// Postgres armazena em UTC; sempre exibimos em America/Sao_Paulo.

const TZ = 'America/Sao_Paulo'

export function formatDateBR(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { timeZone: TZ })
}

export function formatDateTimeBR(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { timeZone: TZ })
}
