'use client'

import { useEffect, useState } from 'react'

const SESSION_COOKIE = 'zm_sid'
const CONSENT_COOKIE = 'zm_consent'
const ATTR_COOKIE = 'zm_attr'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.split(';').find((c) => c.trim().startsWith(name + '='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : null
}

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${days * 86400}; path=/; SameSite=Lax`
}

function getOrCreateSessionId(): string {
  let sid = getCookie(SESSION_COOKIE)
  if (!sid) {
    sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    setCookie(SESSION_COOKIE, sid, 30)
  }
  return sid
}

interface Attribution {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  gclid: string | null
  fbclid: string | null
  fbp: string | null
  fbc: string | null
  referrer: string | null
}

function captureAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
    gclid: params.get('gclid'),
    fbclid: params.get('fbclid'),
    fbp: getCookie('_fbp'),
    fbc: getCookie('_fbc'),
    referrer: document.referrer || null,
  }
}

function persistFirstTouch(attr: Attribution) {
  if (getCookie(ATTR_COOKIE)) return
  setCookie(ATTR_COOKIE, JSON.stringify(attr), 90)
}

function readFirstTouch(): Attribution | null {
  const v = getCookie(ATTR_COOKIE)
  if (!v) return null
  try {
    return JSON.parse(v) as Attribution
  } catch {
    return null
  }
}

export function getStoredAttribution(): Attribution | null {
  return typeof window === 'undefined' ? null : readFirstTouch()
}

export function getSessionId(): string | null {
  return typeof window === 'undefined' ? null : getCookie(SESSION_COOKIE)
}

export type Step =
  | 'page_view'
  | 'upload_started'
  | 'analysis_requested'
  | 'analysis_completed'
  | 'data_collection_started'
  | 'data_collection_completed'
  | 'checkout_started'
  | 'pix_generated'
  | 'payment_pending'
  | 'recurso_downloaded'

interface TrackArgs {
  step: Step
  order_id?: string | null
  resultado?: string | null
  metadata?: Record<string, unknown>
}

export async function track({ step, order_id, resultado, metadata }: TrackArgs) {
  if (typeof window === 'undefined') return
  const attr = getStoredAttribution() ?? captureAttribution()
  const sid = getOrCreateSessionId()
  const event_id = `${sid}-${step}-${Date.now()}`
  const device = /Mobi|Android|iPhone/.test(navigator.userAgent) ? 'mobile' : 'desktop'

  fetch('/api/funnel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      session_id: sid,
      order_id: order_id ?? null,
      step,
      event_id,
      resultado: resultado ?? null,
      device,
      metadata: metadata ?? null,
      attribution: {
        utm_source: attr.utm_source,
        utm_medium: attr.utm_medium,
        utm_campaign: attr.utm_campaign,
        gclid: attr.gclid,
        fbclid: attr.fbclid,
      },
    }),
    keepalive: true,
  }).catch(() => {})
}

// ============================================================
// FunnelTracker: instala session, persiste atribuição, dispara um step
// ============================================================
export function FunnelTracker({
  step = 'page_view' as Step,
  order_id,
  resultado,
}: {
  step?: Step
  order_id?: string | null
  resultado?: string | null
}) {
  useEffect(() => {
    getOrCreateSessionId()
    const attr = captureAttribution()
    persistFirstTouch(attr)
    track({ step, order_id: order_id ?? null, resultado: resultado ?? null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

// ============================================================
// ConsentBanner: LGPD opt-in pra carregar pixels Meta/Google
// ============================================================
export function ConsentBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const c = getCookie(CONSENT_COOKIE)
    if (c !== '1' && c !== '0') setOpen(true)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-2xl">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-xs text-slate-700">
          Usamos cookies essenciais para o funcionamento do site. Com seu consentimento, também medimos a performance
          dos anúncios pra continuar oferecendo análise gratuita. Não rastreamos seus dados sensíveis (CPF, CNH).{' '}
          <a href="/privacidade" className="underline">Ver Política de Privacidade</a>.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setCookie(CONSENT_COOKIE, '0', 365)
              setOpen(false)
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Recusar
          </button>
          <button
            onClick={() => {
              setCookie(CONSENT_COOKIE, '1', 365)
              setOpen(false)
            }}
            className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-dark"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}
