// Score honesto com gradiente.
// Valores e mensagens default podem ser sobrescritos por settings do banco.

export interface ScoreInput {
  vicio_forte: boolean
  prazo_status: 'valido' | 'vencido'
  is_multa: boolean
  config?: ScoreConfig
}

export interface ScoreConfig {
  score_alto?: number
  score_moderado?: number
  msg_score_alto?: string
  msg_score_moderado?: string
  msg_score_vencido?: string
  msg_nao_eh_multa?: string
}

export const DEFAULT_SCORE_CONFIG: Required<ScoreConfig> = {
  score_alto: 85,
  score_moderado: 55,
  msg_score_alto:
    'Identificamos vício formal/processual claro. Chance significativa de anulação com fundamentação correta.',
  msg_score_moderado:
    'Não identificamos vício formal forte, mas ainda vale recorrer: é gratuito, suspende pontos e o seu motivo será fundamentado tecnicamente. Sem garantia de êxito.',
  msg_score_vencido:
    'O prazo administrativo já encerrou. Não cobramos por recurso intempestivo — não há viabilidade nesta fase.',
  msg_nao_eh_multa: 'Não conseguimos identificar uma multa válida nesta imagem.',
}

export interface ScoreResult {
  score: number
  faixa: 'vencido' | 'baixo' | 'moderado' | 'alto'
  mensagem: string
}

export function computeScore({ vicio_forte, prazo_status, is_multa, config }: ScoreInput): ScoreResult {
  const cfg = { ...DEFAULT_SCORE_CONFIG, ...(config ?? {}) }
  if (!is_multa) {
    return { score: 0, faixa: 'vencido', mensagem: cfg.msg_nao_eh_multa }
  }
  if (prazo_status === 'vencido') {
    return { score: 0, faixa: 'vencido', mensagem: cfg.msg_score_vencido }
  }
  if (vicio_forte) {
    return { score: cfg.score_alto, faixa: 'alto', mensagem: cfg.msg_score_alto }
  }
  return { score: cfg.score_moderado, faixa: 'moderado', mensagem: cfg.msg_score_moderado }
}
