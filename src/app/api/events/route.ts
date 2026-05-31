// Endpoint cliente pra logar eventos do funil (visita_lp, abandono_*, etc).
// Sem autenticação, sem rate limit pesado — eventos são leves.

import { NextRequest, NextResponse } from 'next/server'
import { logEvent, type EventoTipo } from '@/lib/events'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const ALLOWED: EventoTipo[] = [
  'visita',
  'visita_lp',
  'viu_resultado',
  'abandono_resultado',
  'abandono_dados',
  'abandono_checkout',
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tipo = body?.tipo as EventoTipo
    if (!ALLOWED.includes(tipo)) {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }
    const ua = req.headers.get('user-agent')
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    // Rate limit leve: 60 eventos/IP/min
    const rl = rateLimit(`event:${ip ?? 'unknown'}`, 60, 60_000)
    if (!rl.allowed) return NextResponse.json({ ok: false }, { status: 429 })

    await logEvent({
      tipo,
      order_id: typeof body.order_id === 'string' ? body.order_id : null,
      metadata: typeof body.metadata === 'object' ? body.metadata : undefined,
      user_agent: ua,
      ip,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
