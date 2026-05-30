import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatBRL } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export default async function PedidoDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { fine_data: true, driver_data: true, driver_input: true, recurso: true, price_tier: true },
  })
  if (!order) notFound()

  return (
    <div className="space-y-6">
      <Link href="/admin/pedidos" className="text-sm text-slate-500 hover:text-slate-700">← Pedidos</Link>
      <div>
        <p className="text-xs uppercase text-slate-500">Pedido</p>
        <h1 className="font-mono text-xl font-bold">{order.id}</h1>
        <p className="text-sm text-slate-600">
          Status: <strong>{order.status}</strong> · Fase: <strong>{order.fase}</strong> · Criado em {order.created_at.toLocaleString('pt-BR')}
        </p>
      </div>

      <Section title="Dados da multa">
        {order.fine_data ? (
          <Grid pairs={[
            ['Placa', order.fine_data.placa],
            ['Órgão', order.fine_data.orgao_autuador],
            ['AIT', order.fine_data.num_ait],
            ['Código', order.fine_data.codigo_infracao],
            ['Descrição', order.fine_data.descricao_infracao],
            ['Data infração', order.fine_data.data_infracao?.toLocaleDateString('pt-BR') ?? null],
            ['Data notificação', order.fine_data.data_notificacao?.toLocaleDateString('pt-BR') ?? null],
            ['Tipo', order.fine_data.tipo_notificacao],
            ['Valor', order.fine_data.valor_multa_centavos ? formatBRL(order.fine_data.valor_multa_centavos) : null],
            ['Vício forte', order.fine_data.vicio_forte ? `Sim — ${order.fine_data.vicio_razao}` : 'Não'],
            ['Score', String(order.fine_data.score ?? '—')],
          ]} />
        ) : <Empty />}
      </Section>

      <Section title="Condutor">
        {order.driver_data ? (
          <Grid pairs={[
            ['Nome', order.driver_data.nome],
            ['CPF', order.driver_data.cpf],
            ['CNH', order.driver_data.num_cnh],
            ['Endereço', order.driver_data.endereco],
          ]} />
        ) : <Empty />}
      </Section>

      <Section title="Motivo do condutor">
        {order.driver_input ? (
          <p className="whitespace-pre-wrap text-sm">{order.driver_input.motivo_injustica}</p>
        ) : <Empty />}
      </Section>

      <Section title="Pagamento">
        <Grid pairs={[
          ['Preço', order.preco_centavos ? formatBRL(order.preco_centavos) : null],
          ['Faixa', order.price_tier?.faixa ?? null],
          ['TriboPay hash', order.tribopay_hash],
          ['Pago em', order.paid_at?.toLocaleString('pt-BR') ?? null],
        ]} />
      </Section>

      <Section title="Recurso gerado">
        {order.recurso ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Gerado em {order.recurso.gerado_em.toLocaleString('pt-BR')} · arquivo: <code>{order.recurso.pdf_path}</code>
              </p>
              <a
                href={`/api/admin/pedidos/${order.id}/download`}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Baixar PDF
              </a>
            </div>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs">
              {order.recurso.texto}
            </pre>
          </div>
        ) : <Empty />}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function Grid({ pairs }: { pairs: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 text-sm">
      {pairs.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="font-medium">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function Empty() {
  return <p className="text-sm text-slate-400">Sem dados.</p>
}
