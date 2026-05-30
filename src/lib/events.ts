import { prisma } from './prisma'
import { createHash } from 'crypto'

export type EventoTipo =
  | 'visita'
  | 'upload'
  | 'analise'
  | 'analise_falha'
  | 'dados_condutor'
  | 'checkout'
  | 'pago'
  | 'gerado'
  | 'entregue'

export interface LogEventArgs {
  tipo: EventoTipo
  order_id?: string | null
  metadata?: Record<string, unknown>
  user_agent?: string | null
  ip?: string | null
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const salt = process.env.IP_HASH_SALT ?? 'zeromultas-default-salt'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export async function logEvent({ tipo, order_id, metadata, user_agent, ip }: LogEventArgs) {
  try {
    await prisma.event.create({
      data: {
        tipo,
        order_id: order_id ?? null,
        metadata: (metadata ?? null) as never,
        user_agent: user_agent ?? null,
        ip_hash: hashIp(ip),
      },
    })
  } catch (err) {
    console.error('[events] falha ao logar evento', tipo, err)
  }
}
