'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  params: { orderId: string }
}

export default function DadosPage({ params }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [endereco, setEndereco] = useState('')
  const [motivo, setMotivo] = useState('')
  const [lgpd, setLgpd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError('Envie a foto da CNH.')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('cnh_file', file)
      fd.append('endereco', endereco)
      fd.append('motivo_injustica', motivo)
      fd.append('consentimento_lgpd', lgpd ? 'true' : 'false')
      const res = await fetch(`/api/orders/${params.orderId}/driver`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao salvar')
      router.push(`/checkout/${params.orderId}`)
    } catch (err: any) {
      setError(err?.message ?? 'Erro inesperado')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl">
        <a href={`/resultado/${params.orderId}`} className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
          ← Voltar
        </a>
        <h1 className="text-2xl font-bold">Quase lá — seus dados</h1>
        <p className="mt-1 text-sm text-slate-600">Precisamos do mínimo legal pra montar a peça e protocolar em seu nome.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="text-sm font-medium">Foto da CNH (frente)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 flex w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:bg-slate-50"
            >
              {file ? `📎 ${file.name}` : '📷 Selecionar foto da CNH'}
            </button>
            <p className="mt-1 text-xs text-slate-400">
              🔒 Extraímos nome, CPF e nº da CNH e <strong>descartamos a imagem</strong> em seguida.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Endereço completo</label>
            <input
              type="text"
              required
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro, cidade-UF"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Por que você considera a multa injusta?</label>
            <textarea
              required
              rows={5}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o que aconteceu. Quanto mais específico, melhor."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <p className="mt-1 text-xs text-slate-400">Mín. 10 caracteres.</p>
          </div>

          <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={lgpd}
              onChange={(e) => setLgpd(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span className="text-xs text-slate-600">
              Autorizo o uso dos meus dados pessoais para a finalidade exclusiva de gerar o recurso administrativo
              contratado, conforme a <a href="/privacidade" target="_blank" className="text-blue-600 underline">Política de Privacidade</a> e os <a href="/termos" target="_blank" className="text-blue-600 underline">Termos de Uso</a>. A imagem da CNH é descartada após extração;
              dados ficam armazenados em servidor próprio, com acesso restrito.
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !file || endereco.length < 5 || motivo.length < 10 || !lgpd}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Processando…' : 'Continuar pro pagamento'}
          </button>
        </form>
      </div>
    </main>
  )
}
