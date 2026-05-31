// Camadas anti-abuso para o endpoint de análise.
// Cada função retorna { ok: boolean, reason?: string } e nunca lança em fluxo normal.

import { createHash } from 'crypto'
import { prisma } from './prisma'
import type { AnaliseResult } from './anthropic'

// ============================================================
// 1. Validação de arquivo por MAGIC BYTES
// ============================================================
export type DetectedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'application/pdf' | null

export function detectMimeFromBuffer(buf: Buffer): DetectedMime {
  if (buf.length < 12) return null
  const h = buf
  // JPEG: FF D8 FF
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return 'image/jpeg'
  // PNG: 89 50 4E 47
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47) return 'image/png'
  // PDF: 25 50 44 46 (%PDF)
  if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) return 'application/pdf'
  // WEBP: RIFF....WEBP
  if (
    h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 &&
    h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50
  ) return 'image/webp'
  // HEIC/HEIF: bytes 4..8 = "ftyp", bytes 8..12 = brand
  if (h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70) {
    const brand = h.subarray(8, 12).toString('ascii')
    if (['heic', 'heix', 'mif1', 'msf1', 'heif'].includes(brand)) return 'image/heic'
  }
  return null
}

// ============================================================
// 2. Honeypot
// ============================================================
export interface HoneypotInput {
  honeypot_value: string | null
  form_started_at: number | null
  now?: number
}

export function checkHoneypot({ honeypot_value, form_started_at, now }: HoneypotInput): { ok: boolean; reason?: string } {
  // Campo oculto preenchido → bot
  if (honeypot_value && honeypot_value.length > 0) {
    return { ok: false, reason: 'honeypot_filled' }
  }
  // Submissão muito rápida (< 1.5s) → bot
  const t = now ?? Date.now()
  if (form_started_at && t - form_started_at < 1500) {
    return { ok: false, reason: 'too_fast' }
  }
  return { ok: true }
}

// ============================================================
// 3. Turnstile (Cloudflare)
// ============================================================
export async function verifyTurnstile(token: string | null, ip: string | null): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  // Bypass em dev quando não configurado
  if (!secret || secret === 'PLACEHOLDER' || secret.startsWith('1x')) {
    return { ok: true, reason: 'dev_bypass' }
  }
  if (!token) return { ok: false, reason: 'turnstile_missing' }
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip ?? '',
      }),
      // 10s timeout via AbortController
      signal: AbortSignal.timeout?.(10_000),
    })
    const data = await r.json().catch(() => ({ success: false }))
    if (!data.success) {
      return { ok: false, reason: `turnstile_failed:${(data['error-codes'] ?? []).join(',')}` }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'turnstile_network' }
  }
}

// ============================================================
// 4. Cache por hash (dedup de imagem repetida)
// ============================================================
export function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

export async function getCachedAnalysis(hash: string): Promise<AnaliseResult | null> {
  const row = await prisma.analysisCache.findUnique({ where: { hash } })
  if (!row) return null
  if (row.expira_em < new Date()) {
    await prisma.analysisCache.delete({ where: { hash } }).catch(() => {})
    return null
  }
  await prisma.analysisCache.update({
    where: { hash },
    data: { cnt_hits: { increment: 1 } },
  }).catch(() => {})
  return row.resultado as unknown as AnaliseResult
}

export async function saveCachedAnalysis(hash: string, resultado: AnaliseResult, ttlHours: number): Promise<void> {
  const expira_em = new Date(Date.now() + ttlHours * 3600_000)
  await prisma.analysisCache.upsert({
    where: { hash },
    update: { resultado: resultado as never, expira_em },
    create: { hash, resultado: resultado as never, expira_em },
  })
}

// ============================================================
// 5. Disjuntor global de orçamento
// ============================================================
export interface BudgetLimits {
  maxHour: number
  maxDay: number
}

function windowKey(prefix: 'hour' | 'day', d: Date): string {
  const iso = d.toISOString()
  return prefix === 'hour' ? `hour:${iso.slice(0, 13)}` : `day:${iso.slice(0, 10)}`
}

export async function checkBudget(limits: BudgetLimits): Promise<{ ok: boolean; reason?: string; current?: { hour: number; day: number } }> {
  const now = new Date()
  const [hourCounter, dayCounter] = await Promise.all([
    prisma.usageCounter.findUnique({ where: { janela: windowKey('hour', now) } }),
    prisma.usageCounter.findUnique({ where: { janela: windowKey('day', now) } }),
  ])
  const current = { hour: hourCounter?.total ?? 0, day: dayCounter?.total ?? 0 }
  if (current.hour >= limits.maxHour) return { ok: false, reason: 'budget_hour', current }
  if (current.day >= limits.maxDay) return { ok: false, reason: 'budget_day', current }
  return { ok: true, current }
}

export async function incrementBudget(): Promise<void> {
  const now = new Date()
  const hKey = windowKey('hour', now)
  const dKey = windowKey('day', now)
  await prisma.$transaction([
    prisma.usageCounter.upsert({
      where: { janela: hKey },
      update: { total: { increment: 1 } },
      create: { janela: hKey, total: 1 },
    }),
    prisma.usageCounter.upsert({
      where: { janela: dKey },
      update: { total: { increment: 1 } },
      create: { janela: dKey, total: 1 },
    }),
  ])
}

// ============================================================
// 6. Log de eventos de segurança
// ============================================================
export type SecurityAction =
  | 'analise_ok'
  | 'cache_hit'
  | 'rate_limit'
  | 'turnstile_fail'
  | 'turnstile_missing'
  | 'honeypot_filled'
  | 'too_fast'
  | 'budget_capped'
  | 'invalid_file'
  | 'oversized'

export async function logSecurityEvent(args: {
  action: SecurityAction
  ip_hash?: string | null
  session_id?: string | null
  rule?: string | null
  metadata?: Record<string, unknown>
}) {
  try {
    await prisma.securityEvent.create({
      data: {
        acao: args.action,
        ip_hash: args.ip_hash ?? null,
        session_id: args.session_id ?? null,
        regra: args.rule ?? null,
        metadata: (args.metadata ?? null) as never,
      },
    })
  } catch (err) {
    console.error('[security:log]', err)
  }
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const salt = process.env.IP_HASH_SALT ?? 'zeromultas-default'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}
