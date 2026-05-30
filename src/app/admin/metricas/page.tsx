import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const FUNIL: { tipo: string; label: string }[] = [
  { tipo: 'visita', label: 'Visitas' },
  { tipo: 'upload', label: 'Uploads iniciados' },
  { tipo: 'analise', label: 'Análises concluídas' },
  { tipo: 'dados_condutor', label: 'Dados do condutor' },
  { tipo: 'checkout', label: 'Cobrança gerada' },
  { tipo: 'pago', label: 'Pagamentos confirmados' },
  { tipo: 'gerado', label: 'Recursos gerados' },
  { tipo: 'entregue', label: 'Recursos baixados' },
]

export default async function MetricasPage() {
  const counts = await Promise.all(
    FUNIL.map((f) => prisma.event.count({ where: { tipo: f.tipo } }).then((n) => ({ ...f, n }))),
  )

  const maior = Math.max(1, ...counts.map((c) => c.n))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Métricas — funil</h1>
      <p className="text-sm text-slate-600">Agregado de todos os eventos desde o início.</p>

      <div className="space-y-3">
        {counts.map((c, i) => {
          const pct = (c.n / maior) * 100
          const conv = i > 0 && counts[0].n > 0 ? `${((c.n / counts[0].n) * 100).toFixed(1)}%` : null
          return (
            <div key={c.tipo} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{c.label}</span>
                <span className="text-sm">
                  <strong>{c.n}</strong>
                  {conv && <span className="ml-2 text-xs text-slate-500">({conv} do topo)</span>}
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
  )
}
