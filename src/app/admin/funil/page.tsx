import { prisma } from '@/lib/prisma'
import { FUNNEL_STEPS, STEP_LABELS, type FunnelStep } from '@/lib/funnel'

export const dynamic = 'force-dynamic'

export default async function FunilPage({ searchParams }: { searchParams: { source?: string } }) {
  const filterSource = searchParams.source && searchParams.source !== 'all' ? searchParams.source : null

  // 1. Contagem por step (sessions únicos)
  const stepCounts = await Promise.all(
    FUNNEL_STEPS.map(async (step) => {
      const where: { step: string; utm_source?: string } = { step }
      if (filterSource) where.utm_source = filterSource
      const rows = await prisma.funnelEvent.findMany({
        where,
        select: { session_id: true },
        distinct: ['session_id'],
      })
      return { step, sessions: rows.length }
    }),
  )

  const max = Math.max(1, ...stepCounts.map((s) => s.sessions))
  const topo = stepCounts[0]?.sessions ?? 0

  // 2. Outbox por plataforma
  const outboxByStatus = await prisma.conversionOutbox.groupBy({
    by: ['platform', 'status'],
    _count: { id: true },
  })

  // 3. Fontes UTM (top 10)
  const sources = await prisma.funnelEvent.groupBy({
    by: ['utm_source'],
    _count: { id: true },
    where: { step: 'page_view' },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  // 4. Por resultado (vicio_forte/moderado/generico/nao_multa)
  const porResultado = await prisma.funnelEvent.groupBy({
    by: ['resultado'],
    _count: { id: true },
    where: { step: 'analysis_completed' },
    orderBy: { _count: { id: 'desc' } },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Funil</h1>
        <p className="mt-1 text-sm text-slate-600">Sessões únicas por etapa, taxa de queda e segmentações.</p>
      </div>

      {/* Filtro por source */}
      <div className="flex flex-wrap gap-2">
        <a
          href="/admin/funil"
          className={`rounded-full px-3 py-1 text-xs ${!filterSource ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}
        >
          Todos
        </a>
        {sources.map((s) => (
          <a
            key={s.utm_source ?? 'null'}
            href={`/admin/funil?source=${encodeURIComponent(s.utm_source ?? 'null')}`}
            className={`rounded-full px-3 py-1 text-xs ${filterSource === (s.utm_source ?? 'null') ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}
          >
            {s.utm_source ?? '(direto)'} · {s._count.id}
          </a>
        ))}
      </div>

      {/* Funil visual */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Funil de conversão {filterSource ? `· ${filterSource}` : ''}</h2>
        <div className="mt-5 space-y-2">
          {stepCounts.map((s, i) => {
            const pct = (s.sessions / max) * 100
            const conv = topo > 0 ? ((s.sessions / topo) * 100).toFixed(1) + '%' : '0%'
            const dropFromPrev = i > 0 && stepCounts[i - 1].sessions > 0
              ? (((stepCounts[i - 1].sessions - s.sessions) / stepCounts[i - 1].sessions) * 100).toFixed(1) + '%'
              : null
            return (
              <div key={s.step} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{STEP_LABELS[s.step as FunnelStep]}</span>
                  <span className="text-sm">
                    <strong>{s.sessions}</strong>
                    <span className="ml-2 text-xs text-slate-500">{conv} do topo</span>
                    {dropFromPrev && (
                      <span className={`ml-2 text-xs ${parseFloat(dropFromPrev) > 50 ? 'text-red-600' : 'text-slate-500'}`}>
                        ↓ {dropFromPrev} de queda
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Por resultado da análise */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Análises por resultado</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {porResultado.map((r) => (
            <div key={r.resultado ?? 'null'} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{r.resultado ?? '(sem)'}</p>
              <p className="mt-1 text-xl font-bold">{r._count.id}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Outbox de conversões */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Outbox de conversões (Meta / GA4 / Google Ads)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Status dos envios server-side. Pendente = na fila. Erro = credenciais ausentes ou rejeição da plataforma.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(['meta', 'ga4', 'google_ads'] as const).map((plat) => {
            const rows = outboxByStatus.filter((r) => r.platform === plat)
            const tot = rows.reduce((s, r) => s + r._count.id, 0)
            const enviado = rows.find((r) => r.status === 'enviado')?._count.id ?? 0
            const erro = rows.find((r) => r.status === 'erro')?._count.id ?? 0
            const pendente = rows.find((r) => r.status === 'pendente')?._count.id ?? 0
            return (
              <div key={plat} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold uppercase">{plat.replace('_', ' ')}</p>
                <p className="mt-1 text-xs text-slate-500">Total: {tot}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-emerald-700">Enviado</span><strong>{enviado}</strong></div>
                  <div className="flex justify-between"><span className="text-amber-700">Pendente</span><strong>{pendente}</strong></div>
                  <div className="flex justify-between"><span className="text-red-700">Erro</span><strong>{erro}</strong></div>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Pra ativar os envios reais: preencher <code>.env</code> com Meta Pixel + CAPI token, GA4 Measurement ID + API Secret, e Google Ads credentials.
        </p>
      </div>
    </div>
  )
}
