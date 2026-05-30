// Cliente TriboPay (PIX).
// Suporta dois modos: 'live' (HTTP real) e 'mock' (dev/sem credenciais).
// Quando a documentação da TriboPay estiver confirmada, ajustar os endpoints/payload
// em LIVE_CONFIG abaixo. Estrutura aqui é genérica de PSPs brasileiros.

export interface PixCharge {
  hash: string
  qr_code_text: string // copia-e-cola
  qr_code_base64: string // imagem do QR
  amount_centavos: number
  expires_at: string | null // ISO
}

export interface ChargeStatus {
  hash: string
  status: 'pendente' | 'pago' | 'cancelado' | 'expirado' | 'desconhecido'
  paid_at: string | null
  amount_centavos: number | null
}

export interface CreateChargeArgs {
  amount_centavos: number
  order_id: string
  description: string
  payer?: { name?: string; document?: string }
  webhook_url?: string
}

function mode(): 'live' | 'mock' {
  const m = (process.env.TRIBOPAY_MODE ?? '').toLowerCase()
  if (m === 'live') return 'live'
  return 'mock'
}

function liveConfig() {
  const apiUrl = process.env.TRIBOPAY_API_URL
  const apiKey = process.env.TRIBOPAY_API_KEY
  if (!apiUrl || !apiKey) throw new Error('TRIBOPAY_API_URL e TRIBOPAY_API_KEY são obrigatórias em modo live')
  return { apiUrl, apiKey }
}

// ---------- API pública ----------

export async function createPixCharge(args: CreateChargeArgs): Promise<PixCharge> {
  return mode() === 'live' ? createLive(args) : createMock(args)
}

export async function fetchChargeStatus(hash: string): Promise<ChargeStatus> {
  return mode() === 'live' ? statusLive(hash) : statusMock(hash)
}

// ---------- Modo MOCK (dev) ----------
// Mantém um mapa em memória de hashes → status, pra simular o ciclo.
const _mockStore = new Map<string, ChargeStatus>()

function genHash(): string {
  return 'mock_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

async function createMock({ amount_centavos, order_id, description }: CreateChargeArgs): Promise<PixCharge> {
  const hash = genHash()
  const fakePix = `00020126360014BR.GOV.BCB.PIX0114${order_id.slice(0, 14)}5204000053039865802BR5910ZERO MULTAS6009SAO PAULO62070503***6304MOCK`
  const fakeQrPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  _mockStore.set(hash, { hash, status: 'pendente', paid_at: null, amount_centavos })
  console.log(`[tribopay:mock] charge criada hash=${hash} order=${order_id} valor=${amount_centavos} desc="${description}"`)
  return {
    hash,
    qr_code_text: fakePix,
    qr_code_base64: fakeQrPng,
    amount_centavos,
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  }
}

async function statusMock(hash: string): Promise<ChargeStatus> {
  const s = _mockStore.get(hash)
  if (!s) return { hash, status: 'desconhecido', paid_at: null, amount_centavos: null }
  return s
}

/** Util de dev: marca um hash como pago (usado pelo admin/dev pra simular pagamento). */
export function _mockMarkPaid(hash: string) {
  const s = _mockStore.get(hash)
  if (!s) return false
  s.status = 'pago'
  s.paid_at = new Date().toISOString()
  return true
}

// ---------- Modo LIVE (HTTP) ----------
// AJUSTAR conforme docs.tribopay.com.br quando recebermos credenciais.

async function createLive(args: CreateChargeArgs): Promise<PixCharge> {
  const { apiUrl, apiKey } = liveConfig()
  const resp = await fetch(`${apiUrl}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      amount: args.amount_centavos,
      payment_method: 'pix',
      external_reference: args.order_id,
      description: args.description,
      customer: args.payer
        ? { name: args.payer.name, document: { number: args.payer.document } }
        : undefined,
      postback_url: args.webhook_url,
    }),
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`TriboPay create failed [${resp.status}]: ${body.slice(0, 400)}`)
  }
  const json = (await resp.json()) as any
  // os caminhos abaixo são uma melhor-suposição comum em PSPs BR — ajustar pelo retorno real
  const hash: string = json.hash ?? json.id ?? json.transaction?.hash
  const text: string = json.pix?.qr_code ?? json.pix?.copia_e_cola ?? json.qr_code_text
  const png: string = json.pix?.qr_code_base64 ?? json.qr_code_base64 ?? ''
  return {
    hash,
    qr_code_text: text,
    qr_code_base64: png,
    amount_centavos: args.amount_centavos,
    expires_at: json.pix?.expiration_date ?? json.expires_at ?? null,
  }
}

async function statusLive(hash: string): Promise<ChargeStatus> {
  const { apiUrl, apiKey } = liveConfig()
  const resp = await fetch(`${apiUrl}/transactions/${encodeURIComponent(hash)}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`TriboPay status failed [${resp.status}]: ${body.slice(0, 400)}`)
  }
  const json = (await resp.json()) as any
  const raw = String(json.status ?? json.transaction?.status ?? '').toLowerCase()
  const status: ChargeStatus['status'] =
    raw === 'paid' || raw === 'approved' || raw === 'pago'
      ? 'pago'
      : raw === 'canceled' || raw === 'cancelled' || raw === 'cancelado'
      ? 'cancelado'
      : raw === 'expired' || raw === 'expirado'
      ? 'expirado'
      : raw === 'pending' || raw === 'waiting_payment' || raw === 'pendente'
      ? 'pendente'
      : 'desconhecido'
  return {
    hash,
    status,
    paid_at: json.paid_at ?? json.transaction?.paid_at ?? null,
    amount_centavos: json.amount ?? null,
  }
}
