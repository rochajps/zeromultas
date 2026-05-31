// Token assinado pra link de download. HMAC-SHA256 — sem dependências.
// Formato: <order_id_base64url>.<exp_unix>.<sig_base64url>

import { createHmac, timingSafeEqual } from 'crypto'

const DEFAULT_TTL_HOURS = 72

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function secret(): string {
  const s = process.env.DOWNLOAD_TOKEN_SECRET
  if (!s) throw new Error('DOWNLOAD_TOKEN_SECRET ausente no .env')
  return s
}

export interface SignDownloadTokenArgs {
  order_id: string
  ttl_hours?: number
}

export function signDownloadToken({ order_id, ttl_hours = DEFAULT_TTL_HOURS }: SignDownloadTokenArgs): string {
  const exp = Math.floor(Date.now() / 1000) + ttl_hours * 3600
  const oidEnc = b64url(Buffer.from(order_id, 'utf8'))
  const payload = `${oidEnc}.${exp}`
  const sig = b64url(createHmac('sha256', secret()).update(payload).digest())
  return `${payload}.${sig}`
}

export interface VerifyResult {
  ok: boolean
  order_id?: string
  exp?: number
  reason?: 'malformed' | 'bad_signature' | 'expired'
}

export function verifyDownloadToken(token: string): VerifyResult {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'malformed' }
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }
  const [oidEnc, expStr, sig] = parts
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp <= 0) return { ok: false, reason: 'malformed' }

  // Verifica assinatura
  const expectedSig = b64url(createHmac('sha256', secret()).update(`${oidEnc}.${expStr}`).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' }
  }

  // Expirou?
  if (Math.floor(Date.now() / 1000) > exp) return { ok: false, reason: 'expired' }

  let order_id: string
  try {
    order_id = b64urlDecode(oidEnc).toString('utf8')
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!order_id) return { ok: false, reason: 'malformed' }

  return { ok: true, order_id, exp }
}
