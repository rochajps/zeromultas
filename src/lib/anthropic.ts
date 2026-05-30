import Anthropic from '@anthropic-ai/sdk'
import { resizeForAnalysis, isPdfMime, isImageMime } from './images'

export const MODEL_ANALYSIS = 'claude-haiku-4-5'
export const MODEL_GENERATION = 'claude-sonnet-4-6'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ausente em env')
  _client = new Anthropic({ apiKey })
  return _client
}

type MediaContent =
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }

export async function prepareMedia(buffer: Buffer, mimeType: string): Promise<MediaContent> {
  if (isPdfMime(mimeType)) {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
    }
  }
  if (!isImageMime(mimeType)) {
    throw new Error(`MIME não suportado: ${mimeType}`)
  }
  const prepared = await resizeForAnalysis(buffer)
  return {
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: prepared.buffer.toString('base64') },
  }
}

interface JsonCallOpts {
  systemPrompt: string
  media: MediaContent
  userText?: string
  maxTokens?: number
  cacheSystem?: boolean
}

async function callJson<T = unknown>({ systemPrompt, media, userText, maxTokens = 300, cacheSystem = true }: JsonCallOpts): Promise<{
  data: T
  raw: string
  usage: Anthropic.Messages.Usage
}> {
  const resp = await client().messages.create({
    model: MODEL_ANALYSIS,
    max_tokens: maxTokens,
    system: cacheSystem
      ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
      : systemPrompt,
    messages: [
      {
        role: 'user',
        content: [media, ...(userText ? [{ type: 'text' as const, text: userText }] : [])],
      },
    ],
  })
  const text = resp.content
    .filter((c): c is Anthropic.Messages.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim()
  const parsed = extractJson<T>(text)
  return { data: parsed, raw: text, usage: resp.usage }
}

function extractJson<T>(s: string): T {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fenced ? fenced[1] : s
  const first = candidate.indexOf('{')
  const last = candidate.lastIndexOf('}')
  if (first < 0 || last < first) throw new Error('Resposta sem JSON válido: ' + s.slice(0, 200))
  return JSON.parse(candidate.slice(first, last + 1)) as T
}

// ---------- ANÁLISE + EXTRAÇÃO COMPLETA (Haiku, pré-pagamento, imagem descartada após) ----------

export interface VicioDetectado {
  tipo: 'formal' | 'processual' | 'material'
  artigo: string
  descricao: string
  forca: 'forte' | 'moderado' | 'fraco'
}

export interface AnaliseResult {
  is_multa: boolean
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
  vicios_detectados: VicioDetectado[]
}

export async function analyzeFine(args: { buffer: Buffer; mimeType: string; systemPrompt: string }) {
  const media = await prepareMedia(args.buffer, args.mimeType)
  return callJson<AnaliseResult>({
    systemPrompt: args.systemPrompt,
    media,
    maxTokens: 1500,
  })
}

// ---------- Extração CNH (Haiku) ----------

export interface CnhData {
  nome: string | null
  cpf: string | null
  num_cnh: string | null
}

export async function extractCNH(args: { buffer: Buffer; mimeType: string; systemPrompt: string }) {
  const media = await prepareMedia(args.buffer, args.mimeType)
  return callJson<CnhData>({
    systemPrompt: args.systemPrompt,
    media,
    maxTokens: 250,
  })
}

// ---------- GERAÇÃO da peça (Sonnet, pós-pagamento) ----------

export async function generateRecursoText({ systemPrompt }: { systemPrompt: string }): Promise<{ texto: string; usage: Anthropic.Messages.Usage }> {
  const resp = await client().messages.create({
    model: MODEL_GENERATION,
    max_tokens: 4000,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Redija a peça agora, no formato indicado.' }] },
    ],
  })
  const texto = resp.content
    .filter((c): c is Anthropic.Messages.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim()
  return { texto, usage: resp.usage }
}
