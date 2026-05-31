import { redirect } from 'next/navigation'
import {
  MAPPABLE_STEPS,
  getEventMapping,
  setEventMapping,
  type Step,
  type Platform,
} from '@/lib/integrations'
import { STEP_LABELS } from '@/lib/funnel'

export const dynamic = 'force-dynamic'

const PLATFORMS: Platform[] = ['meta', 'ga4', 'google_ads']
const PLAT_LABELS: Record<Platform, string> = {
  meta: '📱 Meta',
  ga4: '📊 GA4',
  google_ads: '🎯 Google Ads',
}

async function salvar(formData: FormData) {
  'use server'
  for (const step of MAPPABLE_STEPS) {
    for (const plat of PLATFORMS) {
      const enabled = formData.get(`${step}_${plat}_enabled`) === 'on'
      const event_name = String(formData.get(`${step}_${plat}_name`) ?? '').trim()
      const valor = String(formData.get(`${step}_${plat}_value`) ?? '').trim()
      const value_cents = valor.length > 0 ? Math.round(Number(valor) * 100) : null
      if (!event_name && !enabled) continue // não cria registro vazio
      await setEventMapping(step as Step, plat, {
        enabled,
        event_name: event_name || step,
        value_cents,
        currency: 'BRL',
      })
    }
  }
  redirect('/admin/integracoes/eventos?saved=1')
}

export default async function EventosMapeamentoPage({ searchParams }: { searchParams: { saved?: string } }) {
  const map = await getEventMapping(true)

  return (
    <div className="space-y-6">
      <div>
        <a href="/admin/integracoes" className="text-sm text-slate-500 hover:text-slate-700">← Integrações</a>
        <h1 className="mt-2 text-2xl font-bold">Mapeamento de eventos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Define qual nome de evento cada step do funil dispara em cada plataforma. Valor opcional é o que aparece como "value" do evento (em R$).
          <strong>Purchase</strong> sempre usa o valor real pago (ignora o override).
        </p>
      </div>

      {searchParams.saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ <strong>Mapeamento salvo.</strong> Próximas conversões enfileiradas usarão essas regras em até 60s.
        </div>
      )}

      <form action={salvar} className="space-y-4">
        {MAPPABLE_STEPS.map((step) => (
          <div key={step} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">
              {STEP_LABELS[step as keyof typeof STEP_LABELS] ?? step}{' '}
              <code className="ml-2 text-xs font-normal text-slate-500">{step}</code>
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {PLATFORMS.map((plat) => {
                const k = `${step}:${plat}`
                const cfg = map.get(k)
                const isPurchase = step === 'purchase'
                return (
                  <div key={plat} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-600">{PLAT_LABELS[plat]}</p>
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={`${step}_${plat}_enabled`}
                        defaultChecked={cfg?.enabled ?? false}
                        className="h-4 w-4"
                      />
                      Enviar
                    </label>
                    <div className="mt-3">
                      <label className="text-xs text-slate-500">Nome do evento</label>
                      <input
                        type="text"
                        name={`${step}_${plat}_name`}
                        defaultValue={cfg?.event_name ?? ''}
                        placeholder={defaultEventName(step, plat)}
                        className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                      />
                    </div>
                    <div className="mt-2">
                      <label className="text-xs text-slate-500">
                        Valor R$ <span className="text-slate-400">(opcional)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name={`${step}_${plat}_value`}
                        defaultValue={cfg?.value_cents != null ? (cfg.value_cents / 100).toFixed(2) : ''}
                        placeholder={isPurchase ? 'auto (valor pago)' : ''}
                        disabled={isPurchase}
                        className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Salvar mapeamento
        </button>
      </form>
    </div>
  )
}

function defaultEventName(step: Step, plat: Platform): string {
  const defaults: Record<string, string> = {
    'page_view:meta': 'PageView',
    'page_view:ga4': 'page_view',
    'analysis_completed:meta': 'Lead',
    'analysis_completed:ga4': 'generate_lead',
    'pix_generated:meta': 'InitiateCheckout',
    'pix_generated:ga4': 'begin_checkout',
    'purchase:meta': 'Purchase',
    'purchase:ga4': 'purchase',
    'purchase:google_ads': 'purchase',
  }
  return defaults[`${step}:${plat}`] ?? step
}
