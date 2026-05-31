import { NextRequest, NextResponse } from 'next/server'
import { logFunnelEvent, FUNNEL_STEPS, type FunnelStep } from '@/lib/funnel'

export const runtime = 'nodejs'

// Steps que o CLIENT pode disparar. Purchase é só server-side (webhook).
const CLIENT_ALLOWED: FunnelStep[] = FUNNEL_STEPS.filter((s) => s !== 'purchase' && s !== 'recurso_generated')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!CLIENT_ALLOWED.includes(body?.step)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    await logFunnelEvent({
      session_id: body.session_id ?? null,
      order_id: body.order_id ?? null,
      step: body.step,
      event_id: body.event_id ?? null,
      resultado: body.resultado ?? null,
      device: body.device ?? null,
      metadata: body.metadata,
      attribution: body.attribution,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
