import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatBRL } from '@/lib/pricing'
import { formatDateBR } from '@/lib/format'
import { getSettings } from '@/lib/settings'
import { routePhase } from '@/lib/phase-router'
import { computeScore } from '@/lib/scoring'
import { CompleteDataForm, ScoreBadge, TrackResultView } from './client'

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
  const settings = await getSettings()

  // Recalcula sempre. Nunca bloqueia por prazo.
  const recalculavel = order.status === 'analisado' || order.status === 'aguardando_pagamento' || order.status === 'vencido'
  let fase: 'defesa_previa' | 'jari' | 'cetran' = 'defesa_previa'
  let prazoLimite: Date | null = order.prazo_limite

  if (fineData) {
    if (order.fase === 'cetran') {
      // Mantém CETRAN se ativado manualmente
      fase = 'cetran'
    } else if (recalculavel && !order.data_missing) {
      const phase = routePhase({
        tipo_notificacao: fineData.tipo_notificacao,
        data_notificacao: fineData.data_notificacao,
        prazoDias: settings.prazo_dias,
      })
      fase = phase.fase
      prazoLimite = phase.prazo_limite
    } else {
      fase = (order.fase === 'jari' ? 'jari' : 'defesa_previa')
    }
  }

  const score = fineData
    ? computeScore({
        band: order.score_band ?? (fineData.vicio_forte ? 'alta' : 'moderada_baixa'),
        is_multa: fineData.is_multa ?? false,
        config: settings,
      })
    : null

  const precisaCompletar = order.valor_missing || order.data_missing

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <TrackResultView orderId={order.id} />
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
          ← Voltar
        </Link>

        {!fineData?.is_multa ? (
          <NaoEhMulta mensagem={settings.msg_nao_eh_multa} />
        ) : precisaCompletar ? (
          <CompleteDataForm
            orderId={order.id}
            valorMissing={order.valor_missing}
            dataMissing={order.data_missing}
          />
        ) : (
          <Diagnostico
            orderId={order.id}
            fase={fase}
            score={score?.score ?? 0}
            vicioForte={fineData.vicio_forte ?? false}
            vicioRazao={fineData.vicio_razao}
            mensagem={score?.mensagem ?? ''}
            placa={fineData.placa}
            descricao={fineData.descricao_infracao}
            valorMulta={fineData.valor_multa_centavos}
            preco={order.preco_centavos}
            faixaLabel={order.price_tier?.faixa ?? null}
            prazoLimite={prazoLimite}
          />
        )}
      </div>
    </main>
  )
}

function NaoEhMulta({ mensagem }: { mensagem: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-xl font-bold text-amber-900">Não identificamos uma multa válida</h1>
      <p className="mt-2 text-sm text-amber-800">{mensagem}</p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
        Enviar outra imagem
      </Link>
    </div>
  )
}

function Diagnostico(props: {
  orderId: string
  fase: 'defesa_previa' | 'jari' | 'cetran'
  score: number
  vicioForte: boolean
  vicioRazao: string | null
  mensagem: string
  placa: string | null
  descricao: string | null
  valorMulta: number | null
  preco: number | null
  faixaLabel: string | null
  prazoLimite: Date | null
}) {
  const faseLabel =
    props.fase === 'defesa_previa' ? 'Defesa Prévia' :
    props.fase === 'jari' ? 'Recurso à JARI' :
    'Recurso ao CETRAN'

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Fase aberta</p>
        <h1 className="mt-1 text-2xl font-bold">{faseLabel}</h1>
        {props.prazoLimite && (
          <p className="mt-1 text-sm text-slate-600">
            Protocolar até <strong>{formatDateBR(props.prazoLimite)}</strong>
          </p>
        )}

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-slate-700">Sua chance de recorrer</span>
            <ScoreBadge score={props.score} />
          </div>
          {props.vicioForte ? (
            <p className="mt-3 text-sm text-emerald-700">
              ✓ Encontramos um erro formal: <strong>{props.vicioRazao ?? '—'}</strong>. Boa pedida pra anular.
            </p>
          ) : (
            <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{props.mensagem}</p>
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
          Pagamento único por PIX. Sem mensalidade, sem assinatura. PDF liberado logo após confirmação.
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
