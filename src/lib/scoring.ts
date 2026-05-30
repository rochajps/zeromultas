// Score honesto com gradiente — sempre comunica que vale recorrer.
// vicio_forte → score alto; sem vício → score moderado (recurso genérico).

export interface ScoreInput {
  vicio_forte: boolean
  prazo_status: 'valido' | 'vencido'
  is_multa: boolean
}

export interface ScoreResult {
  score: number // 0-100
  faixa: 'vencido' | 'baixo' | 'moderado' | 'alto'
  mensagem: string
}

export function computeScore({ vicio_forte, prazo_status, is_multa }: ScoreInput): ScoreResult {
  if (!is_multa) {
    return {
      score: 0,
      faixa: 'vencido',
      mensagem: 'Não conseguimos identificar uma multa válida nesta imagem.',
    }
  }
  if (prazo_status === 'vencido') {
    return {
      score: 0,
      faixa: 'vencido',
      mensagem:
        'O prazo administrativo já encerrou. Não cobramos por recurso intempestivo — não há viabilidade nesta fase.',
    }
  }
  if (vicio_forte) {
    return {
      score: 85,
      faixa: 'alto',
      mensagem:
        'Identificamos vício formal/processual claro. Chance significativa de anulação com fundamentação correta.',
    }
  }
  return {
    score: 55,
    faixa: 'moderado',
    mensagem:
      'Não identificamos vício formal forte, mas ainda vale recorrer: é gratuito, suspende pontos e o seu motivo será fundamentado tecnicamente. Sem garantia de êxito.',
  }
}
