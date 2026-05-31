import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getIntegrationKeys, setIntegrationKey, SECRET_KEYS, type IntegrationKey } from '@/lib/integrations'

export const dynamic = 'force-dynamic'

async function salvar(formData: FormData) {
  'use server'
  const fields: IntegrationKey[] = [
    'meta_pixel_id',
    'meta_capi_token',
    'meta_test_event_code',
    'meta_enabled',
    'ga4_measurement_id',
    'ga4_api_secret',
    'ga4_enabled',
    'google_ads_developer_token',
    'google_ads_conversion_id',
    'google_ads_conversion_label',
    'google_ads_enabled',
  ]
  for (const k of fields) {
    let v = String(formData.get(k) ?? '')
    if (k.endsWith('_enabled')) {
      v = formData.get(k) === 'on' ? 'true' : 'false'
    }
    // Pra secrets: se vier vazio, NÃO sobrescreve (mantém o atual)
    if (SECRET_KEYS.has(k) && v.length === 0) continue
    await setIntegrationKey(k, v)
  }
  redirect('/admin/integracoes?saved=1')
}

function maskSecret(value: string | null | undefined): string {
  if (!value) return ''
  if (value.length <= 8) return '••••'
  return value.slice(0, 4) + '••••' + value.slice(-4)
}

export default async function IntegracoesPage({ searchParams }: { searchParams: { saved?: string } }) {
  const keys = await getIntegrationKeys(true)
  const outboxCount = await prisma.conversionOutbox.groupBy({ by: ['platform', 'status'], _count: { id: true } })

  function outbox(platform: 'meta' | 'ga4' | 'google_ads') {
    const rows = outboxCount.filter((r) => r.platform === platform)
    return {
      enviado: rows.find((r) => r.status === 'enviado')?._count.id ?? 0,
      pendente: rows.find((r) => r.status === 'pendente')?._count.id ?? 0,
      erro: rows.find((r) => r.status === 'erro')?._count.id ?? 0,
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="mt-1 text-sm text-slate-600">Cole as credenciais aqui. Ficam no banco (não no .env). Cache TTL 60s.</p>
        <p className="mt-1 text-xs text-slate-500">
          <a href="/admin/integracoes/eventos" className="text-blue-600 underline">Mapear quais steps disparam cada evento →</a>
        </p>
      </div>

      {searchParams.saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ <strong>Credenciais salvas.</strong> Próximas conversões enfileiradas usarão essas chaves em até 60s.
        </div>
      )}

      <form action={salvar} className="space-y-5">
        {/* META */}
        <Card title="📱 Meta (Facebook + Instagram)" enabled={keys.meta_enabled} outbox={outbox('meta')}>
          <Field
            id="meta_enabled"
            label="Envio ligado"
            type="toggle"
            checked={keys.meta_enabled}
          />
          <Field
            id="meta_pixel_id"
            label="Pixel ID"
            value={keys.meta_pixel_id ?? ''}
            placeholder="Ex.: 1234567890123456"
            help="Encontre em business.facebook.com → Events Manager → Pixel."
          />
          <Field
            id="meta_capi_token"
            label="Conversions API Access Token"
            value=""
            placeholder={keys.meta_capi_token ? `Atual: ${maskSecret(keys.meta_capi_token)} (deixe vazio pra manter)` : 'Cole o token...'}
            secret
            help="Events Manager → Configurações → Conversions API → Generate Access Token."
          />
          <Field
            id="meta_test_event_code"
            label="Test Event Code (opcional)"
            value={keys.meta_test_event_code ?? ''}
            placeholder="TEST12345"
            help="Use enquanto valida em 'Test Events' do Events Manager. Apague pra ir pra produção."
          />
        </Card>

        {/* GA4 */}
        <Card title="📊 Google Analytics 4" enabled={keys.ga4_enabled} outbox={outbox('ga4')}>
          <Field id="ga4_enabled" label="Envio ligado" type="toggle" checked={keys.ga4_enabled} />
          <Field
            id="ga4_measurement_id"
            label="Measurement ID"
            value={keys.ga4_measurement_id ?? ''}
            placeholder="G-XXXXXXXXXX"
            help="GA4 → Admin → Data Streams → Web stream → Measurement ID."
          />
          <Field
            id="ga4_api_secret"
            label="Measurement Protocol API Secret"
            value=""
            placeholder={keys.ga4_api_secret ? `Atual: ${maskSecret(keys.ga4_api_secret)} (deixe vazio pra manter)` : 'Cole o secret...'}
            secret
            help="GA4 → Data Streams → Measurement Protocol API secrets → Create."
          />
        </Card>

        {/* GOOGLE ADS */}
        <Card title="🎯 Google Ads (Conversions Upload)" enabled={keys.google_ads_enabled} outbox={outbox('google_ads')}>
          <Field id="google_ads_enabled" label="Envio ligado" type="toggle" checked={keys.google_ads_enabled} />
          <Field
            id="google_ads_conversion_id"
            label="Conversion ID"
            value={keys.google_ads_conversion_id ?? ''}
            placeholder="AW-XXXXXXXXXX"
          />
          <Field
            id="google_ads_conversion_label"
            label="Conversion Label"
            value={keys.google_ads_conversion_label ?? ''}
            placeholder="abcDEFghi12345"
            help="Ads → Tools → Conversions → escolher 'Purchase' → Tag setup → label."
          />
          <Field
            id="google_ads_developer_token"
            label="Developer Token"
            value=""
            placeholder={keys.google_ads_developer_token ? `Atual: ${maskSecret(keys.google_ads_developer_token)} (deixe vazio pra manter)` : 'Cole o token...'}
            secret
            help="Necessário pra import offline via Google Ads API."
          />
        </Card>

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Salvar todas as integrações
        </button>
      </form>
    </div>
  )
}

function Card({
  title,
  enabled,
  outbox,
  children,
}: {
  title: string
  enabled: boolean
  outbox: { enviado: number; pendente: number; erro: number }
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className={`rounded-full px-2 py-0.5 ${enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
            {enabled ? 'ativa' : 'desligada'}
          </span>
          <span className="text-slate-500">
            ✓ {outbox.enviado} · ⏳ {outbox.pendente} · ✕ {outbox.erro}
          </span>
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
}

function Field({
  id,
  label,
  type,
  value,
  checked,
  placeholder,
  help,
  secret,
}: {
  id: string
  label: string
  type?: 'toggle'
  value?: string
  checked?: boolean
  placeholder?: string
  help?: string
  secret?: boolean
}) {
  if (type === 'toggle') {
    return (
      <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
        <input type="checkbox" name={id} defaultChecked={checked} className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </label>
    )
  }
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr,minmax(0,420px)] sm:items-start">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {help && <p className="text-xs text-slate-500">{help}</p>}
      </div>
      <input
        id={id}
        name={id}
        type={secret ? 'password' : 'text'}
        defaultValue={value}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
      />
    </div>
  )
}
