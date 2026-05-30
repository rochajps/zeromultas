import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatBRL } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { orderId: string }
}

export default async function ResultadoPage({ params }: PageProps) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { fine_data: true, price_tier: true },
  })
  if (!order) notFound()

  const fineData = order.fine_data
  const vencido = order.fase === 'vencido' || order.status === 'vencido'
  const score = fineData?.score ?? 0

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <BackLink />
        {!fineData?.is_multa ? (
          <NaoEhMulta />
        ) : vencido ? (
          <Vencido prazoLimite={order.prazo_limite} />
        ) : (
          <Diagnostico
            orderId={order.id}
            fase={order.fase as "defesa_previa" | "jari"}
            score={score}
            vicioForte={fineData.vicio_forte ?? false}
            vicioRazao={fineData.vicio_razao}
            placa={fineData.placa}
            descricao={fineData.descricao_infracao}
            valorMulta={fineData.valor_multa_centavos}
            preco={order.preco_centavos}
            faixaLabel={order.price_tier?.faixa ?? null}
            prazoLimite={order.prazo_limite}
          />
        )}
      </div>
    </main>
  )
}

function BackLink() {
  return (
    <Link href="/" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
      ← Voltar
    </Link>
  )
}

function NaoEhMulta() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-xl font-bold text-amber-900">Não identificamos uma multa válida</h1>
      <p className="mt-2 text-sm text-amber-800">
        A imagem enviada não parece ser uma notificação de multa de trânsito. Confirme que é uma NA (Notificação de
        Autuação) ou NP (Notificação de Penalidade) e envie novamente.
      </p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
        Enviar outra imagem
      </Link>
    </div>
  )
}

function Vencido({ prazoLimite }: { prazoLimite: Date | null }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h1 className="text-xl font-bold text-red-900">Prazo administrativo encerrado</h1>
      <p className="mt-2 text-sm text-red-800">
        O prazo de 30 dias para defesa prévia ou recurso à JARI já venceu
        {prazoLimite ? ` em ${prazoLimite.toLocaleDateString('pt-BR')}` : ''}. Não vamos cobrar por um recurso intempestivo —
        seria desperdício seu.
      </p>
      <p className="mt-3 text-sm text-red-800">
        Em alguns casos ainda cabe recurso ao CETRAN (2ª instância) ou via judicial — converse com um advogado.
      </p>
    </div>
  )
}

function Diagnostico(props: {
  orderId: string
  fase: 'defesa_previa' | 'jari'
  score: number
  vicioForte: boolean
  vicioRazao: string | null
  placa: string | null
  descricao: string | null
  valorMulta: number | null
  preco: number | null
  faixaLabel: string | null
  prazoLimite: Date | null
}) {
  const faseLabel = props.fase === 'defesa_previa' ? 'Defesa Prévia' : 'Recurso à JARI'
  const scoreBg = props.score >= 80 ? 'bg-emerald-500' : props.score >= 50 ? 'bg-blue-500' : 'bg-slate-400'
  const scoreFaixa = props.score >= 80 ? 'Alto' : props.score >= 50 ? 'Moderado' : 'Baixo'

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Fase aberta</p>
        <h1 className="mt-1 text-2xl font-bold">{faseLabel}</h1>
        {props.prazoLimite && (
          <p className="mt-1 text-sm text-slate-600">
            Prazo até <strong>{props.prazoLimite.toLocaleDateString('pt-BR')}</strong>
          </p>
        )}

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-slate-700">Viabilidade do recurso</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${scoreBg}`}>
              {scoreFaixa} · {props.score}/100
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full ${scoreBg}`} style={{ width: `${props.score}%` }} />
          </div>
          {props.vicioForte ? (
            <p className="mt-3 text-sm text-emerald-700">
              ✓ Identificamos vício formal claro: <strong>{props.vicioRazao ?? '—'}</strong>. Boa fundamentação pra anular.
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Não identificamos vício formal forte, mas <strong>ainda vale recorrer</strong>: o processo é gratuito, suspende pontos
              e o seu motivo será fundamentado tecnicamente. Sem garantia de êxito.
            </p>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          {props.placa && (
            <div>
              <dt className="text-slate-500">Placa</dt>
              <dd className="font-semibold">{props.placa}</dd>
            </div>
          )}
          {props.valorMulta != null && (
            <div>
              <dt className="text-slate-500">Valor da multa</dt>
              <dd className="font-semibold">{formatBRL(props.valorMulta)}</dd>
            </div>
          )}
          {props.descricao && (
            <div className="col-span-2">
              <dt className="text-slate-500">Infração</dt>
              <dd className="font-semibold">{props.descricao}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Preço do recurso</p>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-3xl font-bold">{props.preco ? formatBRL(props.preco) : '—'}</span>
          {props.faixaLabel && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{props.faixaLabel}</span>}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Pagamento único por Pix. Sem mensalidade, sem assinatura. PDF liberado logo após confirmação.
        </p>
        <Link
          href={`/dados/${props.orderId}`}
          className="mt-5 block w-full rounded-lg bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Gerar meu recurso
        </Link>
      </div>
    </div>
  )
}
