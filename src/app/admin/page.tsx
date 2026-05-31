import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const [orders, pendentes, pagos, gerados] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'aguardando_pagamento' } }),
    prisma.order.count({ where: { status: 'pago' } }),
    prisma.order.count({ where: { status: { in: ['gerado', 'entregue'] } } }),
  ])

  const cards = [
    { label: 'Pedidos totais', value: orders, href: '/admin/pedidos' },
    { label: 'Aguardando Pix', value: pendentes, href: '/admin/pedidos?status=aguardando_pagamento' },
    { label: 'Pagos', value: pagos, href: '/admin/pedidos?status=pago' },
    { label: 'Recursos entregues', value: gerados, href: '/admin/pedidos?status=gerado' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400"
          >
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Faixas de preço" desc="Editar valores cobrados por faixa da multa" href="/admin/precos" />
        <Card title="Prompts" desc="Versões do prompt MD usado pelo Claude" href="/admin/prompts" />
        <Card title="Métricas" desc="Funil de conversão e eventos" href="/admin/metricas" />
      </div>
    </div>
  )
}

function Card({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link href={href} className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-400">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{desc}</p>
    </Link>
  )
}
