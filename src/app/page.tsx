'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { FunnelTracker, ConsentBanner, track } from '@/components/Funnel'
import { useRouter } from 'next/navigation'

type UploadResult = {
  orderId: string
  is_multa: boolean
  fase: 'defesa_previa' | 'jari' | 'vencido'
  score: number
  preco_centavos: number | null
}

// ============================================================
// Página
// ============================================================
export default function HomePage() {
  useEffect(() => {
    track({ step: 'page_view' })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const utm: Record<string, string> = {}
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => {
      const v = params.get(k)
      if (v) utm[k] = v
    })
    fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: 'visita_lp', metadata: utm }),
      keepalive: true,
    }).catch(() => {})
  }, [])
  return (
    <>
      <FaqJsonLd />
      <main className="min-h-screen bg-white text-slate-900">
        <Header />
        <Hero />
        <UrgencyBar />
        <HowItWorks />
        <WhyAppeal />
        <Vicios />
        <Deliverable />
        <Pricing />
        <Testimonials />
        <Faq />
        <Trust />
        <FinalCta />
        <Footer />
      </main>
    <ConsentBanner />
    </>
  )
}

// ============================================================
// Utils
// ============================================================
function scrollToUploader() {
  const el = document.getElementById('avaliar')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function CtaButton({
  variant = 'primary',
  full = false,
  children,
  onClick,
}: {
  variant?: 'primary' | 'secondary'
  full?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/30 active:scale-[0.98]'
  const styles =
    variant === 'primary'
      ? 'bg-brand-blue text-white hover:bg-brand-blue-dark'
      : 'bg-brand-yellow text-brand-blue-dark hover:bg-brand-yellow-hover'
  return (
    <button onClick={onClick ?? scrollToUploader} className={`${base} ${styles} ${full ? 'w-full' : ''}`}>
      {children}
    </button>
  )
}

// ============================================================
// Header
// ============================================================
function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
        <a href="/" className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <span className="text-lg font-extrabold tracking-tight text-brand-blue-dark sm:text-xl">Zero Multas</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href="#como-funciona"
            className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline-block"
          >
            Como funciona
          </a>
          <button
            onClick={scrollToUploader}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-blue-dark"
          >
            Avaliar minha multa
          </button>
        </div>
      </div>
    </header>
  )
}

// ============================================================
// Hero (com uploader integrado)
// ============================================================
function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-50">
      {/* losangos decorativos de fundo */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <DiamondBg className="absolute -right-10 top-10 h-40 w-40 text-brand-yellow" />
        <DiamondBg className="absolute -left-12 bottom-12 h-28 w-28 text-brand-yellow" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-start gap-10 px-4 py-12 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
        {/* Coluna esquerda — copy */}
        <div className="text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-blue-dark">
            <DotPulse /> Análise grátis · Pague só se quiser recorrer
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-brand-blue-dark sm:text-5xl lg:text-6xl">
            Recurso de multa <span className="text-brand-blue">pronto em minutos</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg text-slate-600">
            Envie a foto da sua multa. A gente identifica a fase certa (defesa prévia ou JARI), aponta os vícios e
            gera um recurso jurídico em PDF, pronto pra protocolar.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <CtaButton>
              Avaliar minha multa de graça
              <ArrowRight className="h-5 w-5" />
            </CtaButton>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Descubra em segundos se você tem chance de recorrer — sem pagar nada.
          </p>

          {/* trust strip */}
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
              <ShieldIcon className="h-4 w-4 text-brand-blue" /> Pagamento via PIX
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
              <LockIcon className="h-4 w-4 text-brand-blue" /> Dados protegidos (LGPD)
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
              <DownloadIcon className="h-4 w-4 text-brand-blue" /> Entrega imediata
            </span>
          </div>
        </div>

        {/* Coluna direita — uploader */}
        <div id="avaliar" className="relative">
          <Uploader />
        </div>
      </div>
    </section>
  )
}

function Uploader() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<File | null>(null)
  const [utm, setUtm] = useState<Record<string, string>>({})
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [formStartedAt] = useState<number>(() => Date.now())
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (document.querySelector('script[data-turnstile]')) return
    const sc = document.createElement('script')
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    sc.async = true
    sc.defer = true
    sc.setAttribute('data-turnstile', 'true')
    document.head.appendChild(sc)
  }, [])

  useEffect(() => {
    let widgetId: string | null = null
    let cancelled = false
    const tryRender = () => {
      if (cancelled) return
      const w = window as unknown as { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void; reset: (id: string) => void } }
      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      if (w.turnstile && turnstileRef.current && siteKey && !widgetId) {
        widgetId = w.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
          theme: 'light',
          size: 'flexible',
        })
        widgetIdRef.current = widgetId
        return
      }
      setTimeout(tryRender, 200)
    }
    tryRender()
    return () => {
      cancelled = true
      const w = window as unknown as { turnstile?: { remove: (id: string) => void } }
      if (widgetId && w.turnstile) w.turnstile.remove(widgetId)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const obj: Record<string, string> = {}
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => {
      const v = params.get(k)
      if (v) obj[k] = v
    })
    setUtm(obj)
  }, [])

  const resetTurnstile = useCallback(() => {
    setTurnstileToken('')
    const w = window as unknown as { turnstile?: { reset: (id: string) => void } }
    if (w.turnstile && widgetIdRef.current) {
      try { w.turnstile.reset(widgetIdRef.current) } catch (e) { console.error('[turnstile] reset', e) }
    }
  }, [])

  // Fallback: se o token não chegar em 6s, mostra botão pra recarregar a verificação
  const [needsReload, setNeedsReload] = useState(false)
  useEffect(() => {
    if (turnstileToken) {
      setNeedsReload(false)
      return
    }
    const t = setTimeout(() => setNeedsReload(true), 6000)
    return () => clearTimeout(t)
  }, [turnstileToken])

  // Hard reload do widget: remove e renderiza novo do zero (último recurso)
  const hardReloadTurnstile = useCallback(() => {
    setNeedsReload(false)
    setTurnstileToken('')
    const w = window as unknown as {
      turnstile?: {
        remove: (id: string) => void
        render: (el: HTMLElement, opts: Record<string, unknown>) => string
      }
    }
    if (!w.turnstile || !turnstileRef.current) return
    if (widgetIdRef.current) {
      try { w.turnstile.remove(widgetIdRef.current) } catch {}
      widgetIdRef.current = null
    }
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey) return
    setTimeout(() => {
      const ww = window as unknown as { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string } }
      if (!ww.turnstile || !turnstileRef.current) return
      widgetIdRef.current = ww.turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
        theme: 'light',
        size: 'flexible',
      })
    }, 100)
  }, [])

  const upload = useCallback(
    async (file: File) => {
      setError(null)
      setSelected(file)
      setLoading(true)

      // Espera até 3s pelo token Turnstile renovar (se acabou de submeter outro)
      let tokenAtual = turnstileToken
      if (!tokenAtual) {
        for (let i = 0; i < 30 && !tokenAtual; i++) {
          await new Promise((r) => setTimeout(r, 100))
          // re-read from state — useState não atualiza no closure, ler do DOM via getResponse
          const w = window as unknown as { turnstile?: { getResponse: (id: string) => string } }
          if (w.turnstile && widgetIdRef.current) {
            try {
              const t = w.turnstile.getResponse(widgetIdRef.current)
              if (t) tokenAtual = t
            } catch {}
          }
        }
      }

      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('turnstileToken', tokenAtual)
        fd.append('form_started_at', String(formStartedAt))
        fd.append('website', '')
        Object.entries(utm).forEach(([k, v]) => fd.append(k, v))
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data: UploadResult | { error: string } = await res.json()
        if (!res.ok) throw new Error((data as { error: string }).error ?? 'Falha na análise')
        router.push(`/resultado/${(data as UploadResult).orderId}`)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erro ao processar')
        setLoading(false)
        setSelected(null)
      } finally {
        // Token Turnstile é de uso único — sempre reseta após cada submit
        resetTurnstile()
      }
    },
    [router, utm, turnstileToken, formStartedAt, resetTurnstile],
  )

  return (
    <div className="relative">
      {/* Fita amarela "advertência" */}
      <div className="absolute -top-3 left-6 z-10 rounded-md bg-brand-yellow px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-brand-blue-dark shadow-sm">
        Análise gratuita
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (turnstileToken) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (!turnstileToken) return
          const f = e.dataTransfer.files?.[0]
          if (f) upload(f)
        }}
        className={`rounded-2xl border-2 bg-white p-6 shadow-xl ring-1 ring-slate-200/60 transition sm:p-8 ${
          dragOver ? 'border-brand-blue bg-blue-50' : 'border-dashed border-slate-300'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
        />

        {loading ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-brand-blue" />
            <p className="mt-5 text-base font-semibold text-brand-blue-dark">Analisando sua multa…</p>
            <p className="mt-1 text-sm text-slate-500">Verificando fase, prazo e vícios formais</p>
            {selected && <p className="mt-2 text-xs text-slate-400 truncate">📎 {selected.name}</p>}
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-yellow/30">
                <UploadIcon className="h-9 w-9 text-brand-blue-dark" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-brand-blue-dark">Envie a foto ou PDF da multa</h2>
              <p className="mt-1 text-sm text-slate-500">
                Aceita JPG, PNG, HEIC ou PDF — até 12MB
              </p>
            </div>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={!turnstileToken}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold shadow-sm transition active:scale-[0.98] ${turnstileToken ? 'bg-brand-blue text-white hover:bg-brand-blue-dark' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
              >
                <FileIcon className="h-5 w-5" />
                <span>{turnstileToken ? 'Selecionar arquivo' : 'Validando…'}</span>
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={!turnstileToken}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold shadow-sm transition active:scale-[0.98] sm:hidden ${turnstileToken ? 'bg-brand-yellow text-brand-blue-dark hover:bg-brand-yellow-hover' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                <CameraIcon className="h-5 w-5" />
                <span>{turnstileToken ? 'Tirar foto pela câmera' : 'Aguarde…'}</span>
              </button>
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <LockIcon className="h-3.5 w-3.5" /> A imagem é processada e descartada — não guardamos seu arquivo.
            </p>
            {!turnstileToken && !needsReload && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-700">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                Validando segurança da sessão…
              </p>
            )}
            {!turnstileToken && needsReload && (
              <div className="mt-2 text-center">
                <p className="text-xs text-red-700">Verificação travada. Clique pra tentar de novo:</p>
                <button
                  type="button"
                  onClick={hardReloadTurnstile}
                  className="mt-1 inline-block rounded-md bg-brand-blue px-3 py-1 text-xs font-semibold text-white hover:bg-brand-blue-dark"
                >
                  ↻ Reiniciar verificação
                </button>
              </div>
            )}

          <div ref={turnstileRef} className="mt-3 flex justify-center" />

          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', height: 0, width: 0, opacity: 0, pointerEvents: 'none' }}
            aria-hidden="true"
          />

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Urgency bar
// ============================================================
function UrgencyBar() {
  return (
    <section className="bg-brand-yellow">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm font-semibold text-brand-blue-dark sm:text-base">
          <WarningSign className="mr-2 inline-block h-5 w-5 align-middle" />
          Multa tem prazo. O recurso só vale dentro do prazo legal — em geral, <strong>no mínimo 30 dias</strong> da
          notificação. Não deixe vencer.
        </p>
        <button
          onClick={scrollToUploader}
          className="shrink-0 rounded-lg bg-brand-blue-dark px-4 py-2 text-sm font-bold text-white hover:bg-brand-blue"
        >
          Avaliar agora
        </button>
      </div>
    </section>
  )
}

// ============================================================
// Como funciona
// ============================================================
const STEPS = [
  {
    n: 1,
    title: 'Envie a multa',
    desc: 'Foto ou PDF da notificação. Identificamos a fase aberta e detectamos os vícios formais.',
    icon: <DocIcon className="h-7 w-7" />,
  },
  {
    n: 2,
    title: 'Veja o diagnóstico',
    desc: 'Score honesto, prazo restante e qual fase usar (defesa prévia ou JARI).',
    icon: <ChartIcon className="h-7 w-7" />,
  },
  {
    n: 3,
    title: 'Pague só se quiser recorrer',
    desc: 'Preço pela faixa da multa. PIX na hora.',
    icon: <PixIcon className="h-7 w-7" />,
  },
  {
    n: 4,
    title: 'Baixe o recurso em PDF',
    desc: 'Peça jurídica fundamentada, pronta pra protocolar no órgão autuador.',
    icon: <DownloadIcon className="h-7 w-7" />,
  },
]

function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Eyebrow>Como funciona</Eyebrow>
          <h2 className="mt-3 text-3xl font-extrabold text-brand-blue-dark sm:text-4xl">4 passos. Sem mistério.</h2>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="group relative rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue text-base font-extrabold text-white">
                  {s.n}
                </span>
                <span className="text-brand-blue-dark/40 group-hover:text-brand-blue">{s.icon}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-brand-blue-dark">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <CtaButton variant="secondary">
            Avaliar minha multa de graça
            <ArrowRight className="h-5 w-5" />
          </CtaButton>
        </div>
      </div>
    </section>
  )
}

// ============================================================
// Por que recorrer
// ============================================================
const WHYS = [
  {
    icon: <BalanceIcon className="h-8 w-8" />,
    title: 'É seu direito',
    desc: 'Recorrer na esfera administrativa é gratuito. O órgão autuador é obrigado a analisar.',
  },
  {
    icon: <PauseIcon className="h-8 w-8" />,
    title: 'Pontos suspensos',
    desc: 'Enquanto o recurso está sob análise, a pontuação na CNH fica suspensa.',
  },
  {
    icon: <UserIcon className="h-8 w-8" />,
    title: 'Sem advogado',
    desc: 'Você mesmo protocola. A peça é objetiva, clara e fundamentada nos dispositivos certos.',
  },
  {
    icon: <BookIcon className="h-8 w-8" />,
    title: 'Fundamentado no CTB',
    desc: 'Não é modelo genérico. A peça aplica artigos específicos e jurisprudência consolidada.',
  },
]

function WhyAppeal() {
  return (
    <section className="bg-slate-50 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Eyebrow>Por que vale a pena</Eyebrow>
          <h2 className="mt-3 text-3xl font-extrabold text-brand-blue-dark sm:text-4xl">
            Risco baixo. Resultado possível.
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Tentar recorrer é melhor que pagar sem questionar. E você nem precisa pagar pra descobrir se vale.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHYS.map((w) => (
            <div key={w.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-yellow/30 text-brand-blue-dark">
                {w.icon}
              </span>
              <h3 className="mt-4 text-base font-bold text-brand-blue-dark">{w.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{w.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================
// Vícios
// ============================================================
const VICIOS = [
  {
    title: 'Erros no auto',
    desc: 'Placa errada, marca/modelo/cor divergente, local genérico demais, código da infração ausente, identificação do agente em branco, campo "observações" sem dados.',
    color: 'border-l-brand-blue',
  },
  {
    title: 'Falhas no processo',
    desc: 'Notificação enviada fora do prazo legal, falta da dupla notificação, ausência de assinatura, irregularidade na ciência.',
    color: 'border-l-brand-yellow',
  },
  {
    title: 'Vícios de mérito',
    desc: 'Infração não ocorreu, radar sem aferição do INMETRO, ausência de sinalização adequada, excludentes (estado de necessidade, etc).',
    color: 'border-l-red-500',
  },
]

function Vicios() {
  return (
    <section className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <Eyebrow>Sua multa pode ter erro</Eyebrow>
          <h2 className="mt-3 text-3xl font-extrabold text-brand-blue-dark sm:text-4xl">
            A maioria das multas tem ao menos um.
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Encontrando um desses pontos, sua chance aumenta — e é exatamente isso que verificamos de graça.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {VICIOS.map((v) => (
            <div
              key={v.title}
              className={`rounded-xl border border-slate-200 border-l-4 bg-slate-50 p-5 ${v.color}`}
            >
              <h3 className="text-base font-bold text-brand-blue-dark">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{v.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <CtaButton>
            Avaliar minha multa de graça
            <ArrowRight className="h-5 w-5" />
          </CtaButton>
        </div>
      </div>
    </section>
  )
}

// ============================================================
// O que você recebe (mockups)
// ============================================================
function Deliverable() {
  return (
    <section className="bg-brand-blue-dark px-4 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Eyebrow inverted>O que você recebe</Eyebrow>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Diagnóstico claro + peça pronta</h2>
          <p className="mt-3 text-base text-blue-100">
            Antes de pagar, você vê exatamente em que pé está a sua multa. Depois, baixa o documento.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <DiagnosticMock />
          <PdfMock />
        </div>
      </div>
    </section>
  )
}

function DiagnosticMock() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fase aberta</p>
          <p className="mt-1 text-xl font-extrabold text-brand-blue-dark">Defesa Prévia</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">DENTRO DO PRAZO</span>
      </div>
      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-700">Viabilidade do recurso</span>
          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">Alto · 85/100</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-[85%] rounded-full bg-emerald-500" />
        </div>
        <p className="mt-3 text-sm text-emerald-700">
          ✓ Identificamos vício formal: <strong>campo &quot;observações&quot; da MBFT em branco</strong>
        </p>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Placa</dt>
          <dd className="font-bold text-brand-blue-dark">ABC-1D23</dd>
        </div>
        <div>
          <dt className="text-slate-500">Valor</dt>
          <dd className="font-bold text-brand-blue-dark">R$ 293,47</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate-500">Infração</dt>
          <dd className="font-bold text-brand-blue-dark">Avançar sinal vermelho — código 605-1</dd>
        </div>
      </dl>
      <p className="mt-4 text-center text-xs text-slate-400">Exemplo da tela de diagnóstico</p>
    </div>
  )
}

function PdfMock() {
  return (
    <div className="relative rounded-2xl bg-white p-2 shadow-2xl">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900">
        <div className="border-b-2 border-brand-yellow pb-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Petição</p>
          <h3 className="mt-1 text-lg font-extrabold text-brand-blue-dark">DEFESA PRÉVIA</h3>
        </div>
        <div className="mt-5 space-y-2 text-[11px] leading-relaxed text-slate-700">
          <p className="font-bold">À AUTORIDADE DE TRÂNSITO DO DETRAN-SP</p>
          <p>
            <strong>[NOME COMPLETO DO CONDUTOR]</strong>, brasileiro(a), CPF nº [CPF], CNH nº [CNH], residente e
            domiciliado(a) em [ENDEREÇO], vem, respeitosamente, à presença de V. Sa., apresentar
          </p>
          <p className="font-bold uppercase">Defesa Prévia</p>
          <p>
            contra a autuação consubstanciada no AIT nº [AIT], lavrada em [DATA], tendo em vista o veículo de placa
            [PLACA], pelos fatos e fundamentos a seguir expostos:
          </p>
          <p className="font-bold mt-2">I — DOS FATOS</p>
          <p>O recorrente foi notificado da suposta infração ao art. [...]</p>
          <p className="font-bold mt-2">II — DO MÉRITO</p>
          <p>Verifica-se vício formal grave no auto de infração: o campo &quot;observações&quot; da MBFT [...]</p>
        </div>
        <p className="mt-5 text-center text-[10px] text-slate-400">Exemplo de peça gerada</p>
      </div>
      <div className="absolute -top-3 right-4 rounded-md bg-brand-yellow px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-brand-blue-dark shadow">
        PDF · A4
      </div>
    </div>
  )
}

// ============================================================
// Preço
// ============================================================
function Pricing() {
  return (
    <section className="bg-slate-50 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl text-center">
        <Eyebrow>Preço</Eyebrow>
        <h2 className="mt-3 text-3xl font-extrabold text-brand-blue-dark sm:text-4xl">
          Pague só se quiser recorrer.
        </h2>
        <p className="mt-3 text-base text-slate-600">
          O preço varia pela faixa do valor da multa. Você vê o valor exato no diagnóstico antes de pagar.
        </p>

        <div className="mt-10 inline-flex flex-col items-stretch rounded-2xl border-2 border-brand-yellow bg-white p-6 shadow-lg sm:flex-row sm:items-center sm:gap-8 sm:p-8">
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <span className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-brand-blue-dark">
              Risco zero
            </span>
            <p className="mt-3 text-2xl font-extrabold text-brand-blue-dark">Análise grátis</p>
            <p className="mt-1 text-sm text-slate-600">Você descobre se vale recorrer antes de gastar.</p>
          </div>
          <div className="my-5 hidden h-16 w-px bg-slate-200 sm:block" />
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Se decidir recorrer
            </span>
            <p className="mt-3 text-2xl font-extrabold text-brand-blue-dark">A partir de R$ 47</p>
            <p className="mt-1 text-sm text-slate-600">
              Preço depende da faixa da sua multa. PIX na hora. Sem mensalidade.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <CtaButton>
            Ver o preço da minha multa
            <ArrowRight className="h-5 w-5" />
          </CtaButton>
        </div>
      </div>
    </section>
  )
}

// ============================================================
// Depoimentos (placeholders — preencher com reais)
// ============================================================
type Testimonial = { name: string; place: string; text: string }

// TODO: trocar este array por depoimentos reais (com autorização explícita do cliente).
// Enquanto estiver vazio, a seção fica oculta.
const TESTIMONIALS: Testimonial[] = []

function Testimonials() {
  if (TESTIMONIALS.length === 0) return null
  return (
    <section className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Eyebrow>Depoimentos</Eyebrow>
          <h2 className="mt-3 text-3xl font-extrabold text-brand-blue-dark sm:text-4xl">
            Condutores que recorreram
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <Stars />
              <blockquote className="mt-3 text-sm text-slate-700">&ldquo;{t.text}&rdquo;</blockquote>
              <figcaption className="mt-4 text-xs font-semibold text-brand-blue-dark">
                {t.name} <span className="font-normal text-slate-500">· {t.place}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================
// FAQ
// ============================================================
const FAQ_ITEMS = [
  {
    q: 'É confiável? Como funciona o pagamento?',
    a: 'O serviço é pago via PIX, processado por instituição autorizada. Você só paga depois de ver o diagnóstico — se decidir que vale recorrer. O PDF é liberado na hora após a confirmação.',
  },
  {
    q: 'Preciso de advogado?',
    a: 'Não. Na esfera administrativa o próprio condutor protocola o recurso. A peça que você baixa já vem pronta pra apresentar no órgão autuador (DETRAN ou municipal).',
  },
  {
    q: 'E se o recurso não for aceito?',
    a: 'Recurso administrativo não tem garantia de êxito — quem decide é o órgão autuador. O que entregamos é uma peça fundamentada nos artigos certos do CTB e nos vícios verificáveis na sua multa. No próprio diagnóstico mostramos uma estimativa honesta de viabilidade antes de você pagar.',
  },
  {
    q: 'Meus dados e documentos estão seguros?',
    a: 'A imagem da multa e a foto da CNH são processadas em memória e descartadas em seguida — não são armazenadas. Os dados que ficam (nome, CPF, endereço, motivo informado) são guardados em servidor próprio com acesso restrito, em conformidade com a LGPD.',
  },
  {
    q: 'Quanto tempo leva?',
    a: 'A análise gratuita acontece em segundos. Depois do pagamento via PIX, o recurso em PDF fica disponível pra download em aproximadamente 30 segundos.',
  },
  {
    q: 'Funciona para qualquer multa e qualquer órgão?',
    a: 'Sim. A peça é genérica para o CTB (Código de Trânsito Brasileiro) e direcionada ao órgão autuador identificado na sua notificação — DETRAN estadual, polícia rodoviária, ou autarquia municipal de trânsito (CET, EMTU etc).',
  },
  {
    q: 'E se minha multa já estiver vencida?',
    a: 'O sistema gera o recurso de qualquer multa que você enviar. O prazo de protocolo é responsabilidade sua — apresentamos no diagnóstico a data limite estimada com base no CTB (30 dias da notificação).',
  },
]

function Faq() {
  return (
    <section id="faq" className="bg-slate-50 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <Eyebrow>Dúvidas frequentes</Eyebrow>
          <h2 className="mt-3 text-3xl font-extrabold text-brand-blue-dark sm:text-4xl">
            Tirando as dúvidas mais comuns
          </h2>
        </div>
        <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {FAQ_ITEMS.map((it) => (
            <details key={it.q} className="group p-5">
              <summary className="flex cursor-pointer items-center justify-between gap-3 font-bold text-brand-blue-dark">
                <span>{it.q}</span>
                <span className="text-brand-blue transition-transform group-open:rotate-180">▾</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}

// ============================================================
// Trust (segurança)
// ============================================================
function Trust() {
  return (
    <section className="bg-white px-4 py-12">
      <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-3">
        {[
          { icon: <LockIcon className="h-6 w-6" />, title: 'Pagamento por PIX', desc: 'Sem cadastro de cartão. Confirmação na hora.' },
          { icon: <ShieldIcon className="h-6 w-6" />, title: 'Imagens descartadas', desc: 'A foto da multa e da CNH não são armazenadas.' },
          { icon: <BookIcon className="h-6 w-6" />, title: 'Conformidade LGPD', desc: 'Dados em servidor próprio, acesso restrito.' },
        ].map((t) => (
          <div key={t.title} className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white">
              {t.icon}
            </div>
            <div>
              <p className="text-sm font-bold text-brand-blue-dark">{t.title}</p>
              <p className="text-xs text-slate-600">{t.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ============================================================
// Final CTA
// ============================================================
function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-brand-blue">
      <div className="absolute inset-0 opacity-20">
        <DiamondBg className="absolute -right-12 -top-12 h-64 w-64 text-brand-yellow" />
        <DiamondBg className="absolute -bottom-12 -left-12 h-72 w-72 text-brand-yellow" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 py-16 text-center text-white sm:py-20">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Não pague a multa antes de verificar.</h2>
        <p className="mt-4 text-base text-blue-100 sm:text-lg">
          A análise é grátis. O recurso só sai se você quiser. Em poucos minutos você sabe se vale recorrer.
        </p>
        <div className="mt-8">
          <CtaButton variant="secondary">
            Avaliar minha multa de graça
            <ArrowRight className="h-5 w-5" />
          </CtaButton>
        </div>
      </div>
    </section>
  )
}

// ============================================================
// Footer
// ============================================================
function Footer() {
  return (
    <footer className="bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 text-sm sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <LogoMark className="h-7 w-7" />
              <span className="text-base font-extrabold text-brand-blue-dark">Zero Multas</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Recurso administrativo de multa de trânsito em minutos.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-blue-dark">Navegação</p>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
              <li><a href="#como-funciona" className="hover:text-brand-blue-dark">Como funciona</a></li>
              <li><a href="#faq" className="hover:text-brand-blue-dark">Dúvidas frequentes</a></li>
              <li><a href="#avaliar" className="hover:text-brand-blue-dark">Avaliar minha multa</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-blue-dark">Legal</p>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
              <li><a href="/privacidade" className="hover:text-brand-blue-dark">Política de Privacidade</a></li>
              <li><a href="/termos" className="hover:text-brand-blue-dark">Termos de Uso</a></li>
            </ul>
          </div>
        </div>

        <div className="my-8 divider-road" aria-hidden />

        <p className="text-xs leading-relaxed text-slate-500">
          O Zero Multas oferece geração de documentos para autoatendimento. <strong>Não é escritório de advocacia
          e não garante resultado.</strong> O recurso administrativo pode ser protocolado pelo próprio condutor
          junto ao órgão autuador.
        </p>
        <p className="mt-3 text-xs text-slate-400">© {new Date().getFullYear()} Zero Multas. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}

// ============================================================
// Pequenos blocos
// ============================================================
function Eyebrow({ children, inverted = false }: { children: React.ReactNode; inverted?: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
        inverted ? 'bg-brand-yellow text-brand-blue-dark' : 'bg-brand-blue/10 text-brand-blue'
      }`}
    >
      {children}
    </span>
  )
}

function DotPulse() {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  )
}

function Stars() {
  return (
    <div className="flex gap-0.5 text-brand-yellow" aria-label="5 estrelas">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

// ============================================================
// SVG ICONS (originais, tema trânsito)
// ============================================================
function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect x="2" y="2" width="36" height="36" rx="8" fill="#1A56DB" />
      <path d="M12 14h16M12 20h12M12 26h16" stroke="#FFCD00" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="29" cy="20" r="2.5" fill="#FFCD00" />
    </svg>
  )
}

function DiamondBg({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden>
      <rect x="20" y="20" width="60" height="60" rx="6" transform="rotate(45 50 50)" fill="currentColor" />
    </svg>
  )
}

function WarningSign({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" transform="rotate(45 12 12)" fill="#FFCD00" stroke="#11317A" strokeWidth="1.5" />
      <path d="M12 9v5M12 17v.5" stroke="#11317A" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function ArrowRight({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UploadIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V4m0 0L7 9m5-5l5 5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FileIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function CameraIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 8a2 2 0 012-2h2l2-2h6l2 2h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v12m0 0l-5-5m5 5l5-5M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DocIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChartIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19h16M6 16v-5m5 5V8m5 8v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function PixIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3L3 12l9 9 9-9-9-9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 12l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BalanceIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v18M5 8h14M5 8l-2 5h4l-2-5zm14 0l-2 5h4l-2-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function PauseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 9v6M14 9v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function UserIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 21a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function BookIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 7h8M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
