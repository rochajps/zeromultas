// Roteamento determinístico do modo de geração da peça.
// Decide em CÓDIGO (não no prompt) qual modo usar a partir dos fatos da análise.
// Princípio: detecção honesta — nunca inventa vício.

export type ModoGeracao = 'vicio_forte' | 'moderado' | 'generico'
export type ScoreBand = 'alta' | 'media' | 'moderada_baixa'

export interface VicioFinal {
  campo?: string
  tipo: 'formal' | 'processual' | 'material'
  artigo?: string
  descricao: string
  forca: 'forte' | 'moderado' | 'fraco'
  fundamento?: string
  observacao?: string
}

export interface AnaliseEntrada {
  tipo_notificacao?: 'NA' | 'NP' | 'desconhecido' | null
  data_infracao?: Date | string | null
  data_notificacao?: Date | string | null
  vicio_forte?: boolean | null
  vicio_razao?: string | null
  vicios_detectados?: Array<{
    tipo?: string
    artigo?: string
    descricao?: string
    forca?: string
  }> | null
}

export interface RotaResult {
  modo: ModoGeracao
  vicios_finais: VicioFinal[]
  score_band: ScoreBand
  permite_arguir_sumula_312: boolean
}

const PRAZO_NA_EXPEDICAO_DIAS = 30

export function definirModoGeracao(analise: AnaliseEntrada): RotaResult {
  // 1.1 — vícios verificáveis do modelo (sanitizados)
  const verificaveis: VicioFinal[] = (analise.vicios_detectados ?? []).map((v) => ({
    tipo: normalizeTipo(v.tipo),
    artigo: v.artigo,
    descricao: v.descricao ?? '',
    forca: normalizeForca(v.forca),
  })).filter((v) => v.descricao.length > 0)

  // 1.2 — sinais que o CÓDIGO resolve

  // (a) prazo de expedição da NA — art. 281, § único, II CTB.
  //     Se NA + data_infracao + data_notificacao e (notif - infracao) > 30 dias → vício processual forte.
  const derivados: VicioFinal[] = []
  if (analise.tipo_notificacao === 'NA') {
    const dInfracao = parseDate(analise.data_infracao)
    const dNotif = parseDate(analise.data_notificacao)
    if (dInfracao && dNotif) {
      const diff = daysBetween(dInfracao, dNotif)
      if (diff > PRAZO_NA_EXPEDICAO_DIAS) {
        derivados.push({
          campo: 'prazo_expedicao',
          tipo: 'processual',
          artigo: 'art. 281, § único, II, CTB',
          descricao: `Notificação de autuação expedida ${diff} dias após a infração, superando o prazo de 30 dias.`,
          forca: 'forte',
          fundamento: 'CTB art. 281, parágrafo único, inciso II — autuação considerada insubsistente quando não expedida dentro de 30 dias.',
        })
      }
    }
  }

  // (b) Súmula 312 STJ (dupla notificação): NUNCA afirma — só sinaliza permissão de ARGUIR como subsidiário.
  //     Só faz sentido pra NA (que dá ensejo a futura NP). Não detectamos a NP automaticamente sem histórico.
  const permite_arguir_sumula_312 = analise.tipo_notificacao === 'NA'

  // 1.2 — vicios_finais = verificaveis + derivados
  const vicios_finais = [...verificaveis, ...derivados]

  // 1.3 — modo pela maior força presente
  const tem_forte = vicios_finais.some((v) => v.forca === 'forte') || analise.vicio_forte === true
  const tem_alguma = vicios_finais.length > 0
  const modo: ModoGeracao = tem_forte ? 'vicio_forte' : tem_alguma ? 'moderado' : 'generico'

  // 1.4 — score band
  const score_band: ScoreBand =
    modo === 'vicio_forte' ? 'alta' : modo === 'moderado' ? 'media' : 'moderada_baixa'

  return { modo, vicios_finais, score_band, permite_arguir_sumula_312 }
}

// ---- helpers ----

function parseDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d
  const x = new Date(d)
  return isNaN(x.getTime()) ? null : x
}

function daysBetween(a: Date, b: Date): number {
  const m = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())
  return Math.floor((m(b) - m(a)) / 86_400_000)
}

function normalizeTipo(t: string | undefined): 'formal' | 'processual' | 'material' {
  if (t === 'processual' || t === 'material') return t
  return 'formal'
}

function normalizeForca(f: string | undefined): 'forte' | 'moderado' | 'fraco' {
  if (f === 'forte' || f === 'moderado' || f === 'fraco') return f
  return 'moderado'
}
