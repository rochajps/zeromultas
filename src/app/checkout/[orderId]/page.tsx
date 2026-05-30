'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  params: { orderId: string }
}

interface CheckoutData {
  hash: string
  qr_code_text: string
  qr_code_base64: string
  preco_centavos: number
  expires_at: string | null
}

interface StatusData {
  status: string
  download_url: string | null
}

function formatBRL(c: number) {
  return (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function CheckoutPage({ params }: Props) {
  const router = useRouter()
  const [data, setData] = useState<CheckoutData | null>(null)
  const [status, setStatus] = useState<string>('aguardando_pagamento')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cria cobrança (uma vez)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/orders/${params.orderId}/checkout`, { method: 'POST' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Falha no checkout')
        if (mounted) setData(json)
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Erro')
      }
    })()
    return () => {
      mounted = false
    }
  }, [params.orderId])

  // Polling de status
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${params.orderId}`)
        const json: StatusData = await res.json()
        setStatus(json.status)
        if (json.download_url) setDownloadUrl(json.download_url)
      } catch {}
    }, 4000)
    return () => clearInterval(t)
  }, [params.orderId])

  const pago = ['pago', 'gerado', 'entregue'].includes(status)

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl">
        <a href={`/dados/${params.orderId}`} className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
          ← Voltar
        </a>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!data && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="mt-3 text-sm text-slate-600">Gerando código Pix…</p>
          </div>
        )}

        {data && !pago && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total a pagar</p>
              <p className="mt-1 text-3xl font-bold">{formatBRL(data.preco_centavos)}</p>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                {data.qr_code_base64 ? (
                  <img
                    src={`data:image/png;base64,${data.qr_code_base64}`}
                    alt="QR Code Pix"
                    className="mx-auto h-56 w-56"
                  />
                ) : (
                  <p className="text-xs text-slate-400">QR não disponível — use o código abaixo</p>
                )}
                <p className="mt-3 text-xs text-slate-500">Abra o app do banco, escolha Pix, leia o QR</p>
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-slate-500">Ou copie e cole no app:</label>
                <div className="mt-1 flex gap-2">
                  <input
                    readOnly
                    value={data.qr_code_text}
                    className="flex-1 truncate rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(data.qr_code_text)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 text-sm text-slate-600">
                <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                Aguardando confirmação do Pix…
              </div>
            </div>

            <p className="text-center text-xs text-slate-400">
              Não fechamos a página automaticamente. Quando o pagamento for confirmado, libera o download aqui mesmo.
            </p>
          </div>
        )}

        {pago && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
              ✓
            </div>
            <h1 className="mt-3 text-2xl font-bold text-emerald-900">Pagamento confirmado!</h1>
            {downloadUrl ? (
              <>
                <p className="mt-2 text-sm text-emerald-800">Seu recurso está pronto. Baixe o PDF abaixo:</p>
                <a
                  href={downloadUrl}
                  className="mt-5 inline-block rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Baixar recurso em PDF
                </a>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-emerald-800">Gerando seu recurso… (5–30 segundos)</p>
                <div className="mx-auto mt-4 h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
