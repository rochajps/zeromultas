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
  score_alta: 85,
  score_media: 65,
  score_moderada_baixa: 40,
  msg_alta:
    'Identificamos vício formal/processual claro. Chance significativa de anulação com fundamentação correta.',
  msg_media:
    'Há indícios que sustentam o recurso. Vale tentar — sem garantia de êxito.',
  msg_moderada_baixa:
    'Não encontramos vício formal forte, mas ainda vale recorrer: o processo é gratuito, suspende pontos enquanto está em análise e o seu motivo será fundamentado tecnicamente em princípios do processo administrativo. Sem promessa de resultado.',
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
