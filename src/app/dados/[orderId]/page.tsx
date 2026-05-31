'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  params: { orderId: string }
}

// ============ máscaras ============
function maskCpf(v: string): string {
  const d = v.replace(/\D+/g, '').slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
}
function maskCEP(v: string): string {
  const d = v.replace(/\D+/g, '').slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}
function maskPhone(v: string): string {
  const d = v.replace(/\D+/g, '').slice(0, 11)
  if (d.length <= 10)
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
function maskCnh(v: string): string {
  return v.replace(/\D+/g, '').slice(0, 11)
}

export default function DadosPage({ params }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [modo, setModo] = useState<'foto' | 'manual'>('foto')
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [cnh, setCnh] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [motivo, setMotivo] = useState('')
  const [lgpd, setLgpd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!loading) {
        navigator.sendBeacon?.(
          '/api/events',
          new Blob([JSON.stringify({ tipo: 'abandono_dados', order_id: params.orderId })], { type: 'application/json' }),
        )
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [params.orderId, loading])

  // ViaCEP autocomplete
  async function buscarCep(cepValor: string) {
    const digits = cepValor.replace(/\D+/g, '')
    if (digits.length !== 8) return
    setBuscandoCep(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await r.json()
      if (data && !data.erro) {
        const partes = [data.logradouro, data.bairro, `${data.localidade}-${data.uf}`].filter(Boolean)
        if (!endereco) setEndereco(partes.join(', '))
      }
    } catch {} finally {
      setBuscandoCep(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('modo', modo)
      fd.append('endereco', endereco)
      fd.append('cep', cep.replace(/\D+/g, ''))
      if (whatsapp) fd.append('whatsapp', whatsapp.replace(/\D+/g, ''))
      if (motivo) fd.append('motivo_injustica', motivo)
      fd.append('consentimento_lgpd', lgpd ? 'true' : 'false')

      if (modo === 'foto') {
        if (!file) {
          setError('Envie a foto da CNH ou troque pra digitação manual.')
          setLoading(false)
          return
        }
        fd.append('cnh_file', file)
      } else {
        fd.append('nome', nome)
        fd.append('cpf', cpf)
        fd.append('num_cnh', cnh)
      }

      const res = await fetch(`/api/orders/${params.orderId}/driver`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        if (data.requires_manual) {
          setError('Não conseguimos ler a foto. Use a opção "Digitar manualmente" abaixo.')
          setModo('manual')
        } else {
          throw new Error(data.error ?? 'Falha ao salvar')
        }
        setLoading(false)
        return
      }
      router.push(`/checkout/${params.orderId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
      setLoading(false)
    }
  }

  const cpfDigits = cpf.replace(/\D+/g, '')
  const cnhDigits = cnh.replace(/\D+/g, '')
  const cepDigits = cep.replace(/\D+/g, '')

  const whatsappDigits = whatsapp.replace(/\D+/g, '')
  const podeEnviar =
    endereco.length >= 5 &&
    cepDigits.length === 8 &&
    whatsappDigits.length >= 10 &&
    lgpd &&
    (modo === 'foto'
      ? !!file
      : nome.length >= 5 && cpfDigits.length === 11 && cnhDigits.length >= 9)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <a href={`/resultado/${params.orderId}`} className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
          ← Voltar
        </a>
        <h1 className="text-2xl font-bold">Quase lá — seus dados</h1>
        <p className="mt-1 text-sm text-slate-600">Precisamos do mínimo legal pra montar a peça em seu nome.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Toggle foto/manual */}
          <div className="flex gap-2 rounded-lg bg-slate-100 p-1 text-sm">
            <button
              type="button"
              onClick={() => setModo('foto')}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium ${modo === 'foto' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
            >
              📷 Foto da CNH
            </button>
            <button
              type="button"
              onClick={() => setModo('manual')}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium ${modo === 'manual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
            >
              ✏️ Digitar
            </button>
          </div>

          {modo === 'foto' ? (
            <div>
              <label className="text-sm font-medium">Foto da CNH (frente)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 flex w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:bg-slate-50"
              >
                {file ? `📎 ${file.name}` : '📷 Selecionar / tirar foto da CNH'}
              </button>
              <p className="mt-1 text-xs text-slate-400">
                🔒 Extraímos nome, CPF e nº da CNH e <strong>descartamos a imagem</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Nome completo (como na CNH)</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value.toUpperCase())}
                  placeholder="JOÃO DA SILVA"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">CPF</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nº da CNH</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    value={cnh}
                    onChange={(e) => setCnh(maskCnh(e.target.value))}
                    placeholder="00000000000"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">CEP</label>
              <input
                type="text"
                required
                inputMode="numeric"
                value={cep}
                onChange={(e) => setCep(maskCEP(e.target.value))}
                onBlur={(e) => buscarCep(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              {buscandoCep && <p className="mt-1 text-xs text-slate-400">Buscando endereço…</p>}
            </div>
            <div>
              <label className="text-sm font-medium">WhatsApp</label>
              <input
                type="tel"
                required
                inputMode="numeric"
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Endereço (Rua, número, bairro, cidade-UF)</label>
            <input
              type="text"
              required
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua das Flores, 123, Centro, São Paulo-SP"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">Preencheremos automaticamente após digitar o CEP — confira o número e complemento.</p>
          </div>

          <div>
            <label className="text-sm font-medium">Por que você considera a multa injusta? <span className="text-slate-400 font-normal">(opcional, mas ajuda a peça)</span></label>
            <textarea
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o que aconteceu. Quanto mais específico, melhor."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={lgpd}
              onChange={(e) => setLgpd(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span className="text-xs text-slate-600">
              Autorizo o uso dos meus dados pessoais para gerar o recurso administrativo, conforme a{' '}
              <a href="/privacidade" target="_blank" className="text-blue-600 underline">Política de Privacidade</a> e os{' '}
              <a href="/termos" target="_blank" className="text-blue-600 underline">Termos de Uso</a>.
              A foto da CNH é descartada após extração.
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !podeEnviar}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Processando…' : 'Continuar pro pagamento'}
          </button>
        </form>
      </div>
    </main>
  )
}
