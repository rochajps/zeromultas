// Validação estrita do JSON retornado pela análise (chamada 1).
// Se o modelo "fugir do formato" (texto extra, campo errado), o caller cai no fallback.

export type AnaliseStatus =
  | 'valido'
  | 'multa_nao_suportada'
  | 'nao_multa'
  | 'ilegivel'
  | 'suspeito'
  | 'baixa_confianca'
  | 'schema_invalido'

export interface AnaliseValidated {
  is_multa: boolean
  tipo_documento: 'multa' | 'cnh' | 'documento' | 'foto_aleatoria' | 'suspeito'
  multa_suportada: boolean
  legibilidade: 'boa' | 'ok' | 'ruim'
  confianca_geral: 'alta' | 'media' | 'baixa'
  motivo_classificacao: string
  tipo_notificacao: 'NA' | 'NP' | 'desconhecido'
  data_notificacao: string | null
  data_infracao: string | null
  num_ait: string | null
  orgao_autuador: string | null
  codigo_infracao: string | null
  descricao_infracao: string | null
  placa: string | null
  veiculo: string | null
  valor_multa_centavos: number | null
  agente_autuador: string | null
  local_infracao: string | null
  observacoes: string | null
  vicio_forte: boolean
  vicio_razao: string | null
  vicios_detectados: Array<{ tipo: string; artigo?: string; descricao: string; forca: string }>
}

export type ValidateResult =
  | { ok: true; data: AnaliseValidated }
  | { ok: false; reason: string; raw?: unknown }

const TIPO_DOC_VALUES = new Set(['multa', 'cnh', 'documento', 'foto_aleatoria', 'suspeito'])
const LEGI_VALUES = new Set(['boa', 'ok', 'ruim'])
const CONF_VALUES = new Set(['alta', 'media', 'baixa'])
const TIPO_NOT_VALUES = new Set(['NA', 'NP', 'desconhecido'])
const FORCA_VALUES = new Set(['forte', 'moderado', 'fraco'])
const TIPO_VICIO_VALUES = new Set(['formal', 'processual', 'material'])

function isStr(v: unknown): v is string {
  return typeof v === 'string'
}
function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean'
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

// Caps para evitar inflar geração com input gigante / injection via OCR
const MAX_STRING = 500
const MAX_VICIOS = 10

function cap(s: unknown, max = MAX_STRING): string | null {
  if (!isStr(s)) return null
  const t = s.trim().slice(0, max)
  return t.length > 0 ? t : null
}

export function validateAnaliseOutput(parsed: unknown): ValidateResult {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'output não é objeto', raw: parsed }
  }
  const o = parsed as Record<string, unknown>

  // Campos com defaults seguros quando ausentes
  const is_multa = isBool(o.is_multa) ? o.is_multa : false

  const tipo_documento = (isStr(o.tipo_documento) && TIPO_DOC_VALUES.has(o.tipo_documento)
    ? o.tipo_documento
    : 'foto_aleatoria') as AnaliseValidated['tipo_documento']

  const multa_suportada = isBool(o.multa_suportada) ? o.multa_suportada : false

  const legibilidade = (isStr(o.legibilidade) && LEGI_VALUES.has(o.legibilidade)
    ? o.legibilidade
    : 'ok') as AnaliseValidated['legibilidade']

  const confianca_geral = (isStr(o.confianca_geral) && CONF_VALUES.has(o.confianca_geral)
    ? o.confianca_geral
    : 'media') as AnaliseValidated['confianca_geral']

  const motivo_classificacao = cap(o.motivo_classificacao, 80) ?? ''

  const tipo_notificacao = (isStr(o.tipo_notificacao) && TIPO_NOT_VALUES.has(o.tipo_notificacao)
    ? o.tipo_notificacao
    : 'desconhecido') as AnaliseValidated['tipo_notificacao']

  const valor_multa_centavos = isNum(o.valor_multa_centavos) && o.valor_multa_centavos >= 0
    ? Math.round(o.valor_multa_centavos)
    : null

  let vicios = Array.isArray(o.vicios_detectados) ? o.vicios_detectados : []
  vicios = vicios.slice(0, MAX_VICIOS)
  const vicios_detectados = vicios
    .map((v): AnaliseValidated['vicios_detectados'][0] | null => {
      if (!v || typeof v !== 'object') return null
      const vv = v as Record<string, unknown>
      const tipo = isStr(vv.tipo) && TIPO_VICIO_VALUES.has(vv.tipo) ? vv.tipo : 'formal'
      const forca = isStr(vv.forca) && FORCA_VALUES.has(vv.forca) ? vv.forca : 'moderado'
      const desc = cap(vv.descricao, 300)
      if (!desc) return null
      return { tipo, artigo: cap(vv.artigo, 100) ?? undefined, descricao: desc, forca }
    })
    .filter(Boolean) as AnaliseValidated['vicios_detectados']

  return {
    ok: true,
    data: {
      is_multa,
      tipo_documento,
      multa_suportada,
      legibilidade,
      confianca_geral,
      motivo_classificacao,
      tipo_notificacao,
      data_notificacao: cap(o.data_notificacao, 20),
      data_infracao: cap(o.data_infracao, 20),
      num_ait: cap(o.num_ait, 50),
      orgao_autuador: cap(o.orgao_autuador, 100),
      codigo_infracao: cap(o.codigo_infracao, 20),
      descricao_infracao: cap(o.descricao_infracao, 200),
      placa: cap(o.placa, 10),
      veiculo: cap(o.veiculo, 100),
      valor_multa_centavos,
      agente_autuador: cap(o.agente_autuador, 100),
      local_infracao: cap(o.local_infracao, 200),
      observacoes: cap(o.observacoes, 300),
      vicio_forte: isBool(o.vicio_forte) ? o.vicio_forte : false,
      vicio_razao: cap(o.vicio_razao, 100),
      vicios_detectados,
    },
  }
}

// ============================================================
// Roteamento: decide analise_status a partir do JSON validado
// ============================================================
export function decideAnaliseStatus(d: AnaliseValidated): AnaliseStatus {
  if (d.tipo_documento === 'suspeito') return 'suspeito'
  if (!d.is_multa) return 'nao_multa'
  if (!d.multa_suportada) return 'multa_nao_suportada'
  if (d.legibilidade === 'ruim') return 'ilegivel'
  if (d.confianca_geral === 'baixa') return 'baixa_confianca'
  return 'valido'
}

// ============================================================
// Mensagens amigáveis por status (não expõe motivo cru do modelo)
// ============================================================
export const STATUS_MSGS: Record<AnaliseStatus, string> = {
  valido: '',
  nao_multa:
    'Essa imagem não parece ser a notificação da multa. Envie a foto da notificação de autuação (NA) ou de penalidade (NP) emitida pelo órgão de trânsito.',
  ilegivel:
    'A imagem ficou difícil de ler. Tente outra foto mais nítida, com o documento inteiro enquadrado e em boa iluminação.',
  suspeito:
    'Não conseguimos identificar uma notificação de multa válida nessa imagem. Envie a foto da notificação emitida pelo órgão de trânsito.',
  baixa_confianca:
    'A imagem está difícil de analisar com segurança. Tente outra foto mais nítida — ou preencha os dados manualmente.',
  multa_nao_suportada:
    'Esse tipo de notificação está fora do nosso escopo atendido pela análise automática. Você pode preencher os dados manualmente e seguimos com seu recurso.',
  schema_invalido:
    'Tivemos um problema momentâneo ao analisar. Tente novamente — ou preencha os dados manualmente.',
}

// ============================================================
// Sanitização anti-XSS / anti-injection pra dados de usuário
// ============================================================
export function sanitizeTextField(s: string | null | undefined, maxLen = 500): string {
  if (!s) return ''
  // Escapa < e > (anti-XSS) e limita tamanho.
  let out = String(s).replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;')).trim()
  if (out.length > maxLen) out = out.slice(0, maxLen)
  return out
}
