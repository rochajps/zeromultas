'use client'

import { useEffect, useState } from 'react'
import { track } from '@/components/Funnel'
import { useRouter } from 'next/navigation'

// ============================================================
// Tracking on-mount (viu_resultado)
// ============================================================
export function TrackResultView({ orderId, resultado }: { orderId: string; resultado?: string | null }) {
  useEffect(() => {
    track({ step: 'analysis_completed', order_id: orderId, resultado: resultado ?? null })
    fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: 'viu_resultado', order_id: orderId }),
      keepalive: true,
    }).catch(() => {})
  }, [orderId, resultado])
  return null
}

// ============================================================
// Badge de score em linguagem leiga
// ============================================================
export function ScoreBadge({ score }: { score: number }) {
  // High-conversion display: número grande + barra de progresso animada
  if (score === 0) {
    return <span className="rounded-full bg-slate-300 px-3 py-1 text-xs font-bold text-slate-700">—</span>
  }

  const isAlta = score >= 90
  const isMedia = score >= 80 && score < 90
  const barColor = isAlta
    ? 'from-emerald-400 via-emerald-500 to-emerald-600'
    : isMedia
    ? 'from-blue-500 via-blue-600 to-blue-700'
    : 'from-emerald-300 via-emerald-400 to-emerald-500'
  const textColor = isAlta || isMedia ? 'text-emerald-700' : 'text-emerald-600'
  const glow = isAlta ? 'shadow-[0_0_16px_rgba(16,185,129,0.6)]' : isMedia ? 'shadow-[0_0_12px_rgba(37,99,235,0.45)]' : ''
  const pulse = isAlta ? 'animate-pulse' : ''

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-3xl font-black tracking-tight ${textColor}`}>{score}%</span>
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">de chance</span>
      </div>
      <div className={`mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 ${glow}`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} ${pulse} relative overflow-hidden`}
          style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Form pra completar valor/data quando IA não conseguiu
// ============================================================
export function CompleteDataForm({
  orderId,
  valorMissing,
  dataMissing,
}: {
  orderId: string
  valorMissing: boolean
  dataMissing: boolean
}) {
  const router = useRouter()
  const [valor, setValor] = useState('')
  const [data, setData] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const body: Record<string, unknown> = {}
      if (valorMissing) {
        const v = Number(valor.replace(',', '.'))
        if (!v || v <= 0) {
          setError('Valor da multa inválido.')
          setLoading(false)
          return
        }
        body.valor_multa_reais = v
      }
      if (dataMissing) {
        if (!data) {
          setError('Informe a data da notificação.')
          setLoading(false)
          return
        }
        body.data_notificacao = data
      }
      const res = await fetch(`/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Falha ao salvar')
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-xl font-bold text-amber-900">Falta só um detalhe</h1>
      <p className="mt-2 text-sm text-amber-800">
        Não conseguimos ler {valorMissing && dataMissing ? 'o valor e a data' : valorMissing ? 'o valor' : 'a data'} na imagem. Pode digitar
        pra gente?
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        {valorMissing && (
          <div>
            <label className="text-sm font-medium text-amber-900">Valor da multa (R$)</label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="195,23"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-amber-700">Aparece na notificação como &quot;Valor da multa&quot; ou &quot;Valor a pagar&quot;.</p>
          </div>
        )}

        {dataMissing && (
          <div>
            <label className="text-sm font-medium text-amber-900">Data da notificação</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-amber-700">Data em que você recebeu a notificação (carta ou aviso).</p>
          </div>
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          disabled={loading}
          className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:bg-amber-300"
        >
          {loading ? 'Salvando…' : 'Continuar'}
        </button>
      </form>
    </div>
  )
}

