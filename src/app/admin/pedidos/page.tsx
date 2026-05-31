import Link from 'next/link'
import { formatDateBR, formatDateTimeBR } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import { formatBRL } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const STATUSES = ['analisado', 'aguardando_pagamento', 'pago', 'gerado', 'entregue'] as const

export default async function PedidosPage({ searchParams }: { searchParams: { status?: string } }) {
  const filter = searchParams.status && (STATUSES as readonly string[]).includes(searchParams.status)
    ? (searchParams.status as (typeof STATUSES)[number])
    : null
  const orders = await prisma.order.findMany({
    where: filter ? { status: filter } : {},
    orderBy: { created_at: 'desc' },
    take: 200,
    include: { fine_data: { select: { placa: true, descricao_infracao: true } }, driver_data: { select: { nome: true } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos {filter ? `(${filter})` : ''}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/pedidos"
            className={`rounded-full px-3 py-1 text-xs ${!filter ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}
          >
            Todos
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/pedidos?status=${s}`}
              className={`rounded-full px-3 py-1 text-xs ${filter === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Status</th>
              <th className="p-3">Fase</th>
              <th className="p-3">Condutor</th>
              <th className="p-3">Placa</th>
              <th className="p-3">Valor multa</th>
              <th className="p-3">Preço</th>
              <th className="p-3">Criado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {orders.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-slate-400">Sem pedidos</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="p-2 font-mono text-xs">
                  <Link href={`/admin/pedidos/${o.id}`} className="text-blue-600 hover:underline">
                    {o.id.slice(0, 10)}
                  </Link>
                </td>
                <td className="p-2"><StatusBadge s={o.status} /></td>
                <td className="p-2 text-xs">{o.fase ?? '—'}</td>
                <td className="p-2 text-xs">{o.driver_data?.nome ?? '—'}</td>
                <td className="p-2 text-xs font-mono">{o.fine_data?.placa ?? '—'}</td>
                <td className="p-2 text-xs">{o.valor_multa_centavos ? formatBRL(o.valor_multa_centavos) : '—'}</td>
                <td className="p-2 text-xs font-semibold">{o.preco_centavos ? formatBRL(o.preco_centavos) : '—'}</td>
                <td className="p-2 text-xs text-slate-500">{formatDateTimeBR(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ s }: { s: string }) {
  const colors: Record<string, string> = {
    analisado: 'bg-slate-200 text-slate-700',
    aguardando_pagamento: 'bg-amber-100 text-amber-800',
    pago: 'bg-blue-100 text-blue-800',
    gerado: 'bg-emerald-100 text-emerald-800',
    entregue: 'bg-emerald-100 text-emerald-800',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs ${colors[s] ?? 'bg-slate-100'}`}>{s}</span>
}
