// Rate limit in-memory por IP. Suficiente pra MVP single-instance (PM2 fork).
// Quando escalar pra múltiplas instâncias, trocar por Redis ou Upstash.

type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()

// Limpa entradas expiradas (chamada esporádica)
let lastCleanup = 0
function maybeCleanup(now: number) {
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  store.forEach((b, k) => { if (b.resetAt < now) store.delete(k) })
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSec: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  maybeCleanup(now)
  let b = store.get(key)
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + windowMs }
    store.set(key, b)
  }
  b.count++
  const allowed = b.count <= limit
  const remaining = Math.max(0, limit - b.count)
  const retryAfterSec = Math.ceil(Math.max(0, b.resetAt - now) / 1000)
  return { allowed, remaining, resetAt: b.resetAt, retryAfterSec }
}
