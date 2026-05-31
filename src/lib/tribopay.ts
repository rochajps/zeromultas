// Cliente TriboPay (PIX) — endpoint /api/public/v1/transactions
// Auth: api_token no BODY (não header).
// Modelo: produto + oferta pré-criados no painel TriboPay; amount é informado por chamada.

export interface PixCharge {
  hash: string
  qr_code_text: string
  qr_code_base64: string
  amount_centavos: number
  expires_at: string | null
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
  payer: { name: string; email?: string | null; document?: string | null; phone?: string | null }
  webhook_url?: string
}

function mode(): 'live' | 'mock' {
  return (process.env.TRIBOPAY_MODE ?? '').toLowerCase() === 'live' ? 'live' : 'mock'
}

function liveConfig() {
  const apiUrl = process.env.TRIBOPAY_API_URL ?? 'https://api.tribopay.com.br'
  const apiToken = process.env.TRIBOPAY_API_KEY
  const offerHash = process.env.TRIBOPAY_OFFER_HASH
  const productHash = process.env.TRIBOPAY_PRODUCT_HASH
  if (!apiToken || !offerHash || !productHash) {
    throw new Error('TRIBOPAY_API_KEY, TRIBOPAY_OFFER_HASH e TRIBOPAY_PRODUCT_HASH são obrigatórias em modo live')
  }
  return { apiUrl, apiToken, offerHash, productHash }
}

function sanitizeDigits(s: string | null | undefined): string | undefined {
  if (!s) return undefined
  const d = s.replace(/\D+/g, '')
  return d.length > 0 ? d : undefined
}

// ---------- API pública ----------

export async function createPixCharge(args: CreateChargeArgs): Promise<PixCharge> {
  return mode() === 'live' ? createLive(args) : createMock(args)
}

export async function fetchChargeStatus(hash: string): Promise<ChargeStatus> {
  return mode() === 'live' ? statusLive(hash) : statusMock(hash)
}

// ---------- Modo MOCK (dev) ----------
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

export function _mockMarkPaid(hash: string) {
  const s = _mockStore.get(hash)
  if (!s) return false
  s.status = 'pago'
  s.paid_at = new Date().toISOString()
  return true
}

// ---------- Modo LIVE ----------

async function createLive(args: CreateChargeArgs): Promise<PixCharge> {
  const { apiUrl, apiToken, offerHash, productHash } = liveConfig()

  const body = {
    api_token: apiToken,
    offer_hash: offerHash,
    payment_method: 'pix',
    amount: args.amount_centavos,
    customer: {
      name: args.payer.name,
      email: args.payer.email ?? `pedido-${args.order_id.slice(0, 10)}@zeromultas.pro`,
      document: sanitizeDigits(args.payer.document),
      phone_number: sanitizeDigits(args.payer.phone),
    },
    cart: [
      {
        product_hash: productHash,
        offer_hash: offerHash,
        title: args.description,
        price: args.amount_centavos,
        quantity: 1,
        operation_type: 1,
        tangible: false,
      },
    ],
    external_reference: args.order_id,
    postback_url: args.webhook_url,
  }

  const resp = await fetch(`${apiUrl}/api/public/v1/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })

  const text = await resp.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`TriboPay create resposta não-JSON [${resp.status}]: ${text.slice(0, 400)}`)
  }

  if (!resp.ok) {
    throw new Error(`TriboPay create [${resp.status}]: ${text.slice(0, 600)}`)
  }

  // Estrutura de retorno (com base em padrões PSP BR — ajustar conforme primeira resposta real)
  const data = (json.data ?? json) as Record<string, unknown>
  const pix = (data.pix ?? json.pix ?? {}) as Record<string, unknown>
  const hash = (data.hash ?? json.hash ?? data.id ?? json.id) as string | undefined
  const qrText = (pix.qr_code ?? pix.pix_qr_code ?? pix.copy_paste ?? pix.payload) as string | undefined
  const qrBase64 = ((pix.qr_code_base64 ?? pix.pix_qr_code_base64) as string | undefined) ?? ''
  const expires = (pix.expiration_date ?? pix.expires_at ?? data.expires_at) as string | undefined

  if (!hash || !qrText) {
    throw new Error(`TriboPay create OK mas faltam campos no retorno. JSON: ${text.slice(0, 600)}`)
  }

  // TriboPay nem sempre retorna o PNG do QR — geramos a partir do texto copia-e-cola
  let qrPng = qrBase64
  if (!qrPng) {
    const QRCode = (await import('qrcode')).default
    const dataUrl = await QRCode.toDataURL(qrText, { errorCorrectionLevel: 'M', margin: 1, width: 320 })
    qrPng = dataUrl.replace(/^data:image\/png;base64,/, '')
  }

  return {
    hash,
    qr_code_text: qrText,
    qr_code_base64: qrPng,
    amount_centavos: args.amount_centavos,
    expires_at: expires ?? null,
  }
}

async function statusLive(hash: string): Promise<ChargeStatus> {
  const { apiUrl, apiToken } = liveConfig()
  const url = new URL(`${apiUrl}/api/public/v1/transactions/${encodeURIComponent(hash)}`)
  url.searchParams.set('api_token', apiToken)
  const resp = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  const text = await resp.text()
  if (!resp.ok) {
    throw new Error(`TriboPay status [${resp.status}]: ${text.slice(0, 400)}`)
  }
  const json = JSON.parse(text) as Record<string, unknown>
  const data = (json.data ?? json) as Record<string, unknown>
  const raw = String(data.payment_status ?? data.status ?? '').toLowerCase()

  const status: ChargeStatus['status'] =
    raw === 'paid' || raw === 'approved' || raw === 'pago'
      ? 'pago'
      : raw === 'canceled' || raw === 'cancelled' || raw === 'cancelado' || raw === 'refunded'
      ? 'cancelado'
      : raw === 'expired' || raw === 'expirado'
      ? 'expirado'
      : raw === 'pending' || raw === 'waiting_payment' || raw === 'pendente'
      ? 'pendente'
      : 'desconhecido'

  return {
    hash,
    status,
    paid_at: (data.paid_at as string | null) ?? null,
    amount_centavos: (data.amount as number | null) ?? null,
  }
}
