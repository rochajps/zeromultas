// Score honesto a partir do modo de geração.
// O número/medidor exibido vem do score_band — não pelo modelo.

import type { ScoreBand } from './modo-geracao'

export interface ScoreInput {
  band: ScoreBand
  is_multa: boolean
  config?: ScoreConfig
}

export interface ScoreConfig {
  score_alta?: number
  score_media?: number
  score_moderada_baixa?: number
  msg_alta?: string
  msg_media?: string
  msg_moderada_baixa?: string
  msg_nao_eh_multa?: string
}

export const DEFAULT_SCORE_CONFIG: Required<ScoreConfig> = {
  score_alta: 90,
  score_media: 80,
  score_moderada_baixa: 70,
  msg_alta:
    'Encontramos vício formal claro nessa multa. Excelente fundamentação pra anular.',
  msg_media:
    'Há motivos sólidos pra contestar essa multa. Sua peça vai com fundamentação técnica forte.',
  msg_moderada_baixa:
    'Construímos seu recurso nos princípios do processo administrativo: ampla defesa, contraditório e razoabilidade. Recorrer é um direito seu — e o protocolo é gratuito.',
  msg_nao_eh_multa: 'Não conseguimos identificar uma multa válida nesta imagem.',
}

export interface ScoreResult {
  score: number
  band: ScoreBand
  faixa: 'baixo' | 'moderado' | 'alto'
  mensagem: string
}

export function computeScore({ band, is_multa, config }: ScoreInput): ScoreResult {
  const cfg = { ...DEFAULT_SCORE_CONFIG, ...(config ?? {}) }
  if (!is_multa) {
    return { score: 0, band, faixa: 'baixo', mensagem: cfg.msg_nao_eh_multa }
  }
  if (band === 'alta') {
    return { score: cfg.score_alta, band, faixa: 'alto', mensagem: cfg.msg_alta }
  }
  if (band === 'media') {
    return { score: cfg.score_media, band, faixa: 'moderado', mensagem: cfg.msg_media }
  }
  // moderada_baixa
  return { score: cfg.score_moderada_baixa, band, faixa: 'moderado', mensagem: cfg.msg_moderada_baixa }
}
