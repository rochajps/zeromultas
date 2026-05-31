import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatBRL } from '@/lib/pricing'
import { formatDateBR, formatDateTimeBR } from '@/lib/format'
import { generateRecursoForOrder } from '@/lib/recurso'
import { logEvent } from '@/lib/events'
import { randomBytes } from 'crypto'
import { SubmitButton, FlashMessage } from './_components'

export const dynamic = 'force-dynamic'

async function marcarPagoManual(formData: FormData) {
  'use server'
  const orderId = String(formData.get('orderId'))
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { recurso: true } })
    if (!order) throw new Error('Pedido não encontrado.')

    const downloadToken = order.download_token ?? randomBytes(24).toString('hex')
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'pago', paid_at: new Date(), download_token: downloadToken },
    })
    await logEvent({ tipo: 'pago', order_id: orderId, metadata: { source: 'admin_manual' } })

    if (!order.recurso) {
      generateRecursoForOrder(orderId).catch((e) => console.error('[admin:gen]', e))
      redirect(`/admin/pedidos/${orderId}?ok=Pago+marcado.+Recurso+sendo+gerado+em+background.`)
    }
    redirect(`/admin/pedidos/${orderId}?ok=Pedido+marcado+como+pago.`)
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e // re-throw redirect
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    redirect(`/admin/pedidos/${orderId}?err=${encodeURIComponent(msg)}`)
  }
}

async function gerarRecursoManual(formData: FormData) {
  'use server'
  const orderId = String(formData.get('orderId'))
  // Fire-and-forget: dispara em background pra UI não travar nem perder se o user sair.
  // Erros são logados no PM2 e ficam visíveis no detalhe do pedido depois.
  generateRecursoForOrder(orderId).catch((e) => {
    console.error('[admin:gen-manual]', orderId, e)
  })
  redirect(`/admin/pedidos/${orderId}?ok=Gerando+recurso+em+background.+Atualize+a+pagina+em+%7E30s+pra+ver+o+resultado.`)
}

export default async function PedidoDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { ok?: string; err?: string }
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { fine_data: true, driver_data: true, driver_input: true, recurso: true, price_tier: true },
  })
  if (!order) notFound()

  const isPago = ['pago', 'gerado', 'entregue'].includes(order.status)
  const temRecurso = !!order.recurso

  return (
    <div className="space-y-6">
      <Link href="/admin/pedidos" className="text-sm text-slate-500 hover:text-slate-700">← Pedidos</Link>
      <div>
        <p className="text-xs uppercase text-slate-500">Pedido</p>
        <h1 className="font-mono text-xl font-bold">{order.id}</h1>
        <p className="text-sm text-slate-600">
          Status: <strong>{order.status}</strong> · Fase: <strong>{order.fase}</strong> · Criado em {formatDateTimeBR(order.created_at)}
        </p>
      </div>

      {searchParams.ok && <FlashMessage type="success" text={searchParams.ok} />}
      {searchParams.err && <FlashMessage type="error" text={searchParams.err} />}

      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold text-amber-900">⚙️ Ações manuais (backup)</h2>
        <p className="mt-1 text-xs text-amber-700">
          Use quando o pagamento não foi reconhecido automaticamente ou pra forçar geração do recurso.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {!isPago && (
            <form action={marcarPagoManual}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton variant="success" pendingChildren="Marcando como pago…">
                💰 Marcar como pago
              </SubmitButton>
            </form>
          )}
          {isPago && (
            <form action={gerarRecursoManual}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton variant="primary" pendingChildren="Gerando recurso…">
                {temRecurso ? '🔄 Regenerar recurso' : '📝 Gerar recurso agora'}
              </SubmitButton>
            </form>
          )}
          {!isPago && (
            <form action={gerarRecursoManual}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton variant="ghost" pendingChildren="Gerando recurso…">
                📝 Gerar recurso (sem cobrar)
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      <Section title="Dados da multa">
        {order.fine_data ? (
          <Grid pairs={[
            ['Placa', order.fine_data.placa],
            ['Órgão', order.fine_data.orgao_autuador],
            ['AIT', order.fine_data.num_ait],
            ['Código', order.fine_data.codigo_infracao],
            ['Descrição', order.fine_data.descricao_infracao],
            ['Data infração', order.fine_data.data_infracao ? formatDateBR(order.fine_data.data_infracao) : null],
            ['Data notificação', order.fine_data.data_notificacao ? formatDateBR(order.fine_data.data_notificacao) : null],
            ['Tipo', order.fine_data.tipo_notificacao],
            ['Valor', order.fine_data.valor_multa_centavos ? formatBRL(order.fine_data.valor_multa_centavos) : null],
            ['Vício forte', order.fine_data.vicio_forte ? `Sim — ${order.fine_data.vicio_razao}` : 'Não'],
            ['Score', String(order.fine_data.score ?? '—')],
            ['Origem dos dados', order.origem_dados ?? '—'],
            ['Verificado', order.verificado ? 'Sim' : 'Não'],
            ['Tipo doc', order.tipo_documento ?? '—'],
            ['Status análise', order.analise_status ?? '—'],
          ]} />
        ) : <Empty />}
      </Section>

      <Section title="Condutor">
        {order.driver_data ? (
          <Grid pairs={[
            ['Nome', order.driver_data.nome],
            ['CPF', order.driver_data.cpf],
            ['CNH', order.driver_data.num_cnh],
            ['CEP', order.driver_data.cep],
            ['WhatsApp', order.driver_data.whatsapp],
            ['Endereço', order.driver_data.endereco],
          ]} />
        ) : <Empty />}
      </Section>

      <Section title="Motivo do condutor">
        {order.driver_input?.motivo_injustica ? (
          <p className="whitespace-pre-wrap text-sm">{order.driver_input.motivo_injustica}</p>
        ) : <p className="text-sm text-slate-400">Não preenchido.</p>}
      </Section>

      <Section title="Pagamento">
        <Grid pairs={[
          ['Preço', order.preco_centavos ? formatBRL(order.preco_centavos) : null],
          ['Faixa', order.price_tier?.faixa ?? null],
          ['TriboPay hash', order.tribopay_hash],
          ['Pago em', order.paid_at ? formatDateTimeBR(order.paid_at) : null],
        ]} />
      </Section>

      <Section title="Recurso gerado">
        {order.recurso ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Gerado em {formatDateTimeBR(order.recurso.gerado_em)} · arquivo: <code>{order.recurso.pdf_path}</code>
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
