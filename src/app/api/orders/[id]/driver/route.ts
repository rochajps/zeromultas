import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActivePrompt } from '@/lib/prompts'
import { extractCNH } from '@/lib/anthropic'
import { logEvent } from '@/lib/events'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_MIMES = /^image\/(jpeg|png|webp|gif|heic|heif)$/i

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const orderId = params.id
  const ua = req.headers.get('user-agent')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    if (order.status === 'vencido' || order.fase === 'vencido') {
      return NextResponse.json({ error: 'Pedido com prazo vencido.' }, { status: 409 })
    }

    const formData = await req.formData()
    const file = formData.get('cnh_file')
    const endereco = (formData.get('endereco') ?? '').toString().trim()
    const motivo = (formData.get('motivo_injustica') ?? '').toString().trim()
    const consentimento = formData.get('consentimento_lgpd') === 'true' || formData.get('consentimento_lgpd') === 'on'

    if (!(file instanceof File)) return NextResponse.json({ error: 'CNH ausente.' }, { status: 400 })
    if (file.size === 0) return NextResponse.json({ error: 'CNH vazia.' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Imagem da CNH acima de 8MB.' }, { status: 413 })
    if (!ALLOWED_MIMES.test(file.type)) return NextResponse.json({ error: 'Use foto da CNH (jpeg/png).' }, { status: 415 })
    if (endereco.length < 5) return NextResponse.json({ error: 'Endereço inválido.' }, { status: 400 })
    if (motivo.length < 10) return NextResponse.json({ error: 'Descreva por que a multa é injusta (mín. 10 caracteres).' }, { status: 400 })
    if (!consentimento) return NextResponse.json({ error: 'É necessário aceitar a política de privacidade.' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const systemPrompt = await getActivePrompt('extracao_cnh')

    const { data: cnh } = await extractCNH({ buffer, mimeType: file.type, systemPrompt })
    // imagem da CNH descartada — não persistimos

    if (!cnh.nome || !cnh.cpf || !cnh.num_cnh) {
      return NextResponse.json(
        { error: 'Não conseguimos ler todos os campos da CNH. Envie uma foto mais nítida.' },
        { status: 422 },
      )
    }

    await prisma.$transaction([
      prisma.driverData.upsert({
        where: { order_id: orderId },
        update: { nome: cnh.nome, cpf: cnh.cpf, num_cnh: cnh.num_cnh, endereco },
        create: { order_id: orderId, nome: cnh.nome, cpf: cnh.cpf, num_cnh: cnh.num_cnh, endereco },
      }),
      prisma.driverInput.upsert({
        where: { order_id: orderId },
        update: { motivo_injustica: motivo, consentimento_lgpd: true, consentido_em: new Date() },
        create: { order_id: orderId, motivo_injustica: motivo, consentimento_lgpd: true, consentido_em: new Date() },
      }),
    ])

    await logEvent({ tipo: 'dados_condutor', order_id: orderId, user_agent: ua, ip })

    return NextResponse.json({ ok: true, nome: cnh.nome })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[driver]', msg)
    return NextResponse.json({ error: 'Falha ao processar dados. Tente novamente.' }, { status: 500 })
  }
}
