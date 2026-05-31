'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ============================================================
// Tracking on-mount (viu_resultado)
// ============================================================
export function TrackResultView({ orderId }: { orderId: string }) {
  useEffect(() => {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: 'viu_resultado', order_id: orderId }),
      keepalive: true,
    }).catch(() => {})
  }, [orderId])
  return null
}

// ============================================================
// Badge de score em linguagem leiga
// ============================================================
export function ScoreBadge({ score }: { score: number }) {
  let label: string, cls: string
  if (score >= 80) {
    label = 'Boa chance de anular'
    cls = 'bg-emerald-500 text-white'
  } else if (score >= 60) {
    label = 'Vale tentar'
    cls = 'bg-blue-500 text-white'
  } else if (score >= 30) {
    label = 'Vale tentar (sem garantia)'
    cls = 'bg-amber-500 text-white'
  } else if (score > 0) {
    label = 'Chance baixa'
    cls = 'bg-slate-400 text-white'
  } else {
    label = '—'
    cls = 'bg-slate-300 text-slate-700'
  }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{label}</span>
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

