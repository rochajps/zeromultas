// Score honesto — agora SEM considerar prazo_status como bloqueio.
// Só usa is_multa e vicio_forte. Nunca devolve "vencido" como faixa.

export interface ScoreInput {
  vicio_forte: boolean
  is_multa: boolean
  config?: ScoreConfig
}

export interface ScoreConfig {
  score_alto?: number
  score_moderado?: number
  msg_score_alto?: string
  msg_score_moderado?: string
  msg_nao_eh_multa?: string
}

export const DEFAULT_SCORE_CONFIG: Required<ScoreConfig> = {
  score_alto: 85,
  score_moderado: 55,
  msg_score_alto:
    'Identificamos vício formal/processual claro. Chance significativa de anulação com fundamentação correta.',
  msg_score_moderado:
    'Não identificamos vício formal forte, mas ainda vale recorrer: é gratuito, suspende pontos e o seu motivo será fundamentado tecnicamente. Sem garantia de êxito.',
  msg_nao_eh_multa: 'Não conseguimos identificar uma multa válida nesta imagem.',
}

export interface ScoreResult {
  score: number
  faixa: 'baixo' | 'moderado' | 'alto'
  mensagem: string
}

export function computeScore({ vicio_forte, is_multa, config }: ScoreInput): ScoreResult {
  const cfg = { ...DEFAULT_SCORE_CONFIG, ...(config ?? {}) }
  if (!is_multa) {
    return { score: 0, faixa: 'baixo', mensagem: cfg.msg_nao_eh_multa }
  }
  if (vicio_forte) {
    return { score: cfg.score_alto, faixa: 'alto', mensagem: cfg.msg_score_alto }
  }
  return { score: cfg.score_moderado, faixa: 'moderado', mensagem: cfg.msg_score_moderado }
}
