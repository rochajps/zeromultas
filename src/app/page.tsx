'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type UploadResult = {
  orderId: string
  is_multa: boolean
  fase: 'defesa_previa' | 'jari' | 'vencido'
  score: number
  preco_centavos: number | null
}

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <HowItWorks />
      <FAQ />
      <Footer />
    </main>
  )
}

function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <a href="/" className="flex items-center gap-2">
          <span className="inline-block h-7 w-7 rounded-md bg-blue-600" />
          <span className="text-lg font-semibold tracking-tight">Zero Multas</span>
        </a>
        <a href="#como-funciona" className="text-sm text-slate-600 hover:text-slate-900">
          Como funciona
        </a>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          Análise grátis · Pague só se for viável
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Recurso de multa <span className="text-blue-600">pronto em minutos</span>
        </h1>
        <p className="mt-4 text-base text-slate-600 sm:text-lg">
          Envie a foto da sua multa. A gente identifica a fase certa (defesa prévia ou JARI), aponta os vícios e
          gera um recurso jurídico em PDF, pronto pra protocolar.
        </p>
        <div className="mt-8">
          <UploadCard />
        </div>
      </div>
    </section>
  )
}

function UploadCard() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [utm, setUtm] = useState<Record<string, string>>({})

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const obj: Record<string, string> = {}
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => {
      const v = params.get(k)
      if (v) obj[k] = v
    })
    setUtm(obj)
  }, [])

  const onSelect = useCallback(
    async (file: File) => {
      setError(null)
      setLoading(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        Object.entries(utm).forEach(([k, v]) => fd.append(k, v))
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data: UploadResult | { error: string } = await res.json()
        if (!res.ok) throw new Error((data as { error: string }).error ?? 'Falha na análise')
        router.push(`/resultado/${(data as UploadResult).orderId}`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro ao processar'
        setError(msg)
        setLoading(false)
      }
    },
    [router, utm],
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onSelect(f)
      }}
      className={`rounded-2xl border-2 border-dashed bg-white p-8 transition shadow-sm ${
        dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onSelect(f)
        }}
      />
      {loading ? (
        <div className="py-6 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-sm text-slate-600">Analisando sua multa…</p>
          <p className="mt-1 text-xs text-slate-400">Verificando fase, prazo e vícios formais</p>
        </div>
      ) : (
        <>
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <h2 className="mt-3 text-lg font-semibold">Envie a foto ou PDF da multa</h2>
            <p className="mt-1 text-sm text-slate-500">Aceita JPG, PNG, HEIC ou PDF — até 12MB</p>
          </div>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Selecionar arquivo
            </button>
          </div>
          {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
          <p className="mt-4 text-center text-xs text-slate-400">
            🔒 A imagem é processada e descartada — não guardamos seu arquivo.
          </p>
        </>
      )}
    </div>
  )
}

function HowItWorks() {
  const steps = [
    { n: 1, t: 'Envie a multa', d: 'Foto ou PDF da notificação. A IA identifica a fase aberta e detecta vícios formais.' },
    { n: 2, t: 'Veja o diagnóstico', d: 'Score honesto, prazo restante e qual fase usar (defesa prévia ou JARI).' },
    { n: 3, t: 'Pague só se quiser recorrer', d: 'Preço pela faixa da multa. Pix na hora.' },
    { n: 4, t: 'Baixe o recurso em PDF', d: 'Peça jurídica fundamentada, pronta pra protocolar no órgão autuador.' },
  ]
  return (
    <section id="como-funciona" className="border-t border-slate-200 bg-white px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Como funciona</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{s.n}</div>
              <h3 className="mt-3 font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQ() {
  const items = [
    {
      q: 'Vale mesmo a pena recorrer?',
      a: 'Sim. O recurso administrativo é gratuito, suspende a aplicação dos pontos enquanto está em julgamento e tem baixo risco — você não piora sua situação tentando.',
    },
    {
      q: 'E se eu não tiver vício forte na multa?',
      a: 'A gente avisa de forma honesta: você ainda pode recorrer com base no seu motivo e em vícios moderados. Sem prometer "alta chance" — transparente conforme CDC.',
    },
    {
      q: 'O que vocês fazem com a foto da minha CNH?',
      a: 'Extraímos nome, CPF e número da CNH em memória, e descartamos a imagem na sequência. Não armazenamos nem compartilhamos a foto.',
    },
    {
      q: 'E se o prazo já venceu?',
      a: 'Te avisamos antes de cobrar. Não vendemos recurso intempestivo — seria desperdício seu.',
    },
  ]
  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Dúvidas frequentes</h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {items.map((it) => (
            <details key={it.q} className="group p-5">
              <summary className="flex cursor-pointer items-center justify-between font-medium">
                {it.q}
                <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <p className="mt-3 text-sm text-slate-600">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">
      <p>
        © {new Date().getFullYear()} Zero Multas. Análise jurídica administrativa por IA — não substitui consultoria com
        advogado nos casos complexos.
      </p>
    </footer>
  )
}
