// Etapas fixas do funil. Mudar com cuidado — os relatórios dependem dessa lista.

import { prisma } from './prisma'

export type FunnelStep =
  | 'page_view'
  | 'upload_started'
  | 'analysis_requested'
  | 'analysis_completed'
  | 'data_collection_started'
  | 'data_collection_completed'
  | 'checkout_started'
  | 'pix_generated'
  | 'payment_pending'
  | 'purchase'
  | 'recurso_generated'
  | 'recurso_downloaded'

export const FUNNEL_STEPS: FunnelStep[] = [
  'page_view',
  'upload_started',
  'analysis_requested',
  'analysis_completed',
  'data_collection_started',
  'data_collection_completed',
  'checkout_started',
  'pix_generated',
  'payment_pending',
  'purchase',
  'recurso_generated',
  'recurso_downloaded',
]

export const STEP_LABELS: Record<FunnelStep, string> = {
  page_view: 'Visita',
  upload_started: 'Selecionou arquivo',
  analysis_requested: 'Enviou pra análise',
  analysis_completed: 'Viu resultado',
  data_collection_started: 'Iniciou dados',
  data_collection_completed: 'Concluiu dados',
  checkout_started: 'Iniciou checkout',
  pix_generated: 'PIX gerado',
  payment_pending: 'Aguardando PIX',
  purchase: 'Pagamento confirmado',
  recurso_generated: 'Recurso gerado',
  recurso_downloaded: 'Baixou PDF',
}

export interface AttributionData {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  gclid: string | null
  fbclid: string | null
}

export async function logFunnelEvent(args: {
  session_id?: string | null
  order_id?: string | null
  step: FunnelStep
  event_id?: string | null
  resultado?: string | null
  device?: string | null
  metadata?: Record<string, unknown>
  attribution?: AttributionData
}) {
  try {
    await prisma.funnelEvent.create({
      data: {
        session_id: args.session_id ?? null,
        order_id: args.order_id ?? null,
        step: args.step,
        event_id: args.event_id ?? null,
        resultado: args.resultado ?? null,
        device: args.device ?? null,
        metadata: (args.metadata ?? null) as never,
        utm_source: args.attribution?.utm_source ?? null,
        utm_medium: args.attribution?.utm_medium ?? null,
        utm_campaign: args.attribution?.utm_campaign ?? null,
        gclid: args.attribution?.gclid ?? null,
        fbclid: args.attribution?.fbclid ?? null,
      },
    })
  } catch (e) {
    console.error('[funnel:log]', e)
  }
}
