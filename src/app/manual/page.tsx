'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function maskCEP(v: string): string {
  const d = v.replace(/\D+/g, '').slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}
function maskPlaca(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
}
function isPlacaValida(v: string): boolean {
  return /^[A-Z]{3}[0-9]{1}[A-Z0-9]{1}[0-9]{2}$/.test(v)
}

export default function ManualPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Campos
  const [tipo, setTipo] = useState<'NA' | 'NP'>('NA')
  const [orgao, setOrgao] = useState('')
  const [ait, setAit] = useState('')
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataInfracao, setDataInfracao] = useState('')
  const [dataNotificacao, setDataNotificacao] = useState('')
  const [placa, setPlaca] = useState('')
  const [valorReais, setValorReais] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (!isPlacaValida(placa)) throw new Error('Placa inválida (use ABC1D23 ou ABC1234).')
      const valor = Number(valorReais.replace(',', '.'))
      if (!valor || valor <= 0) throw new Error('Valor inválido.')
      if (!dataNotificacao) throw new Error('Data da notificação é obrigatória.')

      const res = await fetch('/api/orders/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tipo_notificacao: tipo,
          orgao_autuador: orgao,
          num_ait: ait,
          codigo_infracao: codigo,
          descricao_infracao: descricao,
          data_infracao: dataInfracao,
          data_notificacao: dataNotificacao,
          placa,
          valor_multa_centavos: Math.round(valor * 100),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao criar pedido manual.')
      router.push(`/resultado/${data.orderId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <a href="/" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
          ← Voltar
        </a>
        <h1 className="text-2xl font-bold">Preencher dados manualmente</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sem problema. Informe os dados da sua multa abaixo. Vamos gerar seu recurso fundamentado em princípios do
          processo administrativo.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="text-sm font-medium">Tipo de notificação</label>
            <div className="mt-2 flex gap-3">
              {(['NA', 'NP'] as const).map((v) => (
                <label key={v} className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="tipo"
                    value={v}
                    checked={tipo === v}
                    onChange={() => setTipo(v)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    <strong>{v}</strong> — {v === 'NA' ? 'Notificação de Autuação' : 'Notificação de Penalidade'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Órgão autuador</label>
              <input
                type="text"
                required
                value={orgao}
                onChange={(e) => setOrgao(e.target.value.toUpperCase())}
                placeholder="DETRAN-SP, CET, etc."
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nº do AIT</label>
              <input
                type="text"
                required
                value={ait}
                onChange={(e) => setAit(e.target.value.toUpperCase())}
                placeholder="Ex: AIT123456"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Placa do veículo</label>
              <input
                type="text"
                required
                value={placa}
                onChange={(e) => setPlaca(maskPlaca(e.target.value))}
                placeholder="ABC1D23"
                maxLength={7}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tracking-widest uppercase"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Valor da multa (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={valorReais}
                onChange={(e) => setValorReais(e.target.value)}
                placeholder="195,23"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Data da infração</label>
              <input
                type="date"
                required
                value={dataInfracao}
                onChange={(e) => setDataInfracao(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data da notificação</label>
              <input
                type="date"
                required
                value={dataNotificacao}
                onChange={(e) => setDataNotificacao(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Código da infração</label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ex: 5169-1 (opcional)"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Descrição da infração</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: avançar o sinal vermelho (opcional)"
              maxLength={200}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <p className="text-xs text-slate-500">
            Os dados informados serão a base do seu recurso. Como não verificamos imagem, a peça vai fundamentada em
            princípios do processo administrativo (ampla defesa, contraditório, razoabilidade).
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-300"
          >
            {loading ? 'Criando…' : 'Continuar pro recurso'}
          </button>
        </form>
      </div>
    </main>
  )
}
