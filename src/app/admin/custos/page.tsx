import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { computeCostUSD } from '@/lib/usage'
import { formatDateTimeBR } from '@/lib/format'

export const dynamic = 'force-dynamic'

const USD_BRL = 5.5

function fmtUsd(v: number): string {
  return `$${v.toFixed(4)}`
}
function fmtBrl(v: number): string {
  return (v * USD_BRL).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function CustosPage() {
  // Agregação por kind (analise, extracao_cnh, geracao)
  const all = await prisma.apiUsage.findMany({
    orderBy: { created_at: 'desc' },
    take: 500,
    select: {
      id: true,
      order_id: true,
      kind: true,
      model: true,
      input_tokens: true,
      output_tokens: true,
      cache_creation_input_tokens: true,
      cache_read_input_tokens: true,
      created_at: true,
    },
  })

  const allKinds = ['analise', 'extracao_cnh', 'geracao', 'other'] as const
  type Kind = typeof allKinds[number]

  const summary: Record<Kind, { calls: number; in_tokens: number; out_tokens: number; cost: number }> = {
    analise: { calls: 0, in_tokens: 0, out_tokens: 0, cost: 0 },
    extracao_cnh: { calls: 0, in_tokens: 0, out_tokens: 0, cost: 0 },
    geracao: { calls: 0, in_tokens: 0, out_tokens: 0, cost: 0 },
    other: { calls: 0, in_tokens: 0, out_tokens: 0, cost: 0 },
  }

  let totalCost = 0
  for (const u of all) {
    const c = computeCostUSD(u, u.model)
    const kind = (u.kind as Kind) in summary ? (u.kind as Kind) : 'other'
    summary[kind].calls++
    summary[kind].in_tokens += u.input_tokens
    summary[kind].out_tokens += u.output_tokens
    summary[kind].cost += c.total
    totalCost += c.total
  }

  // Custo por pedido (agregado por order_id)
  const porPedido = new Map<string, number>()
  for (const u of all) {
    if (!u.order_id) continue
    const c = computeCostUSD(u, u.model).total
    porPedido.set(u.order_id, (porPedido.get(u.order_id) ?? 0) + c)
  }
  const topPedidos = [...porPedido.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Custos de API</h1>
        <p className="mt-1 text-sm text-slate-600">Tokens reais consumidos por chamada à Anthropic. Custo calculado com os preços atuais dos modelos.</p>
      </div>

      <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6">
        <p className="text-xs uppercase tracking-wide text-emerald-700">Total gasto (últimas 500 chamadas)</p>
        <p className="mt-1 text-4xl font-extrabold text-emerald-900">
          {fmtUsd(totalCost)} <span className="text-2xl text-emerald-700">≈ {fmtBrl(totalCost)}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {allKinds.filter((k) => summary[k].calls > 0).map((k) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{labelKind(k)}</p>
            <p className="mt-1 text-2xl font-bold">{fmtUsd(summary[k].cost)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {summary[k].calls} {summary[k].calls === 1 ? 'chamada' : 'chamadas'} ·{' '}
              {summary[k].in_tokens.toLocaleString('pt-BR')} in / {summary[k].out_tokens.toLocaleString('pt-BR')} out
            </p>
            <p className="text-xs text-slate-400">
              média: {fmtUsd(summary[k].cost / summary[k].calls)} / chamada
            </p>
          </div>
        ))}
      </div>

      {topPedidos.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 p-4 text-sm font-semibold">Top 20 pedidos por custo</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Pedido</th>
                <th className="p-3 text-right">Custo</th>
                <th className="p-3 text-right">≈ R$</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {topPedidos.map(([oid, c]) => (
                <tr key={oid} className="hover:bg-slate-50">
                  <td className="p-2 font-mono text-xs">
                    <Link href={`/admin/pedidos/${oid}`} className="text-blue-600 hover:underline">
                      {oid.slice(0, 14)}
                    </Link>
                  </td>
                  <td className="p-2 text-right font-mono text-xs">{fmtUsd(c)}</td>
                  <td className="p-2 text-right font-mono text-xs text-slate-500">{fmtBrl(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 p-4 text-sm font-semibold">Últimas chamadas</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Quando</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Modelo</th>
                <th className="p-3 text-right">In</th>
                <th className="p-3 text-right">Out</th>
                <th className="p-3 text-right">Cache</th>
                <th className="p-3 text-right">Custo</th>
                <th className="p-3">Pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {all.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">Nenhuma chamada registrada ainda.</td></tr>
              )}
              {all.slice(0, 50).map((u) => {
                const c = computeCostUSD(u, u.model)
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-2 text-xs text-slate-500">{formatDateTimeBR(u.created_at)}</td>
                    <td className="p-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{labelKind(u.kind)}</span></td>
                    <td className="p-2 text-xs font-mono text-slate-500">{u.model}</td>
                    <td className="p-2 text-right font-mono text-xs">{u.input_tokens.toLocaleString('pt-BR')}</td>
                    <td className="p-2 text-right font-mono text-xs">{u.output_tokens.toLocaleString('pt-BR')}</td>
                    <td className="p-2 text-right font-mono text-xs text-slate-500">
                      {u.cache_read_input_tokens > 0 ? `R:${u.cache_read_input_tokens}` : ''}
                      {u.cache_creation_input_tokens > 0 ? ` C:${u.cache_creation_input_tokens}` : ''}
                      {!u.cache_read_input_tokens && !u.cache_creation_input_tokens && '—'}
                    </td>
                    <td className="p-2 text-right font-mono text-xs font-semibold">{fmtUsd(c.total)}</td>
                    <td className="p-2 text-xs">
                      {u.order_id ? (
                        <Link href={`/admin/pedidos/${u.order_id}`} className="font-mono text-blue-600 hover:underline">
                          {u.order_id.slice(0, 10)}
                        </Link>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Valor exato cobrado pela Anthropic em{' '}
        <a className="underline" href="https://console.anthropic.com/settings/usage" target="_blank">console.anthropic.com</a>.
        Taxa USD/BRL usada aqui: {USD_BRL}. Cache reads custam 90% menos que tokens normais.
      </p>
    </div>
  )
}

function labelKind(k: string): string {
  return { analise: 'Análise', extracao_cnh: 'CNH', geracao: 'Geração', other: 'Outro' }[k] ?? k
}
