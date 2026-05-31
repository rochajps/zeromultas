import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActivePrompt } from '@/lib/prompts'
import { extractCNH } from '@/lib/anthropic'
import { logEvent } from '@/lib/events'
import { recordApiUsage } from '@/lib/usage'
import { MODEL_ANALYSIS } from '@/lib/anthropic'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_MIMES = /^image\/(jpeg|png|webp|gif|heic|heif)$/i

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const orderId = params.id
  const ua = req.headers.get('user-agent')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { fine_data: true } })
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    // Não bloqueamos aqui por fase vencida — a decisão fica pro /checkout (que recalcula com regras atuais).

    const formData = await req.formData()
    const file = formData.get('cnh_file')
    const modoManual = formData.get('modo') === 'manual'
    const endereco = (formData.get('endereco') ?? '').toString().trim()
    const cepRaw = (formData.get('cep') ?? '').toString().replace(/\D+/g, '')
    const whatsapp = (formData.get('whatsapp') ?? '').toString().replace(/\D+/g, '') || null
    const motivo = (formData.get('motivo_injustica') ?? '').toString().trim()
    const consentimento = formData.get('consentimento_lgpd') === 'true' || formData.get('consentimento_lgpd') === 'on'
    const placaInput = (formData.get('placa') ?? '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)

    if (endereco.length < 5) return NextResponse.json({ error: 'Endereço inválido.' }, { status: 400 })
    if (cepRaw.length !== 8) return NextResponse.json({ error: 'CEP inválido.' }, { status: 400 })
    if (!whatsapp || whatsapp.length < 10) return NextResponse.json({ error: 'WhatsApp é obrigatório (mín. 10 dígitos com DDD).' }, { status: 400 })
    if (!consentimento) return NextResponse.json({ error: 'É necessário aceitar a política de privacidade.' }, { status: 400 })

    // Placa: se FineData não tem, exigir do user
    const placaExistente = order.fine_data?.placa ?? null
    let placaFinal: string | null = placaExistente
    if (!placaExistente) {
      const re = /^[A-Z]{3}[0-9]{1}[A-Z0-9]{1}[0-9]{2}$/
      if (!placaInput || !re.test(placaInput)) {
        return NextResponse.json({ error: 'Placa do veículo é obrigatória (formato ABC1D23 ou ABC1234).' }, { status: 400 })
      }
      placaFinal = placaInput
    }

    let nome: string | null = null
    let cpf: string | null = null
    let num_cnh: string | null = null

    if (modoManual) {
      nome = (formData.get('nome') ?? '').toString().trim()
      cpf = (formData.get('cpf') ?? '').toString().trim()
      num_cnh = (formData.get('num_cnh') ?? '').toString().trim()
      if (!nome || nome.length < 5) return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 })
      const cpfDigits = cpf.replace(/\D+/g, '')
      if (cpfDigits.length !== 11) return NextResponse.json({ error: 'CPF deve ter 11 dígitos.' }, { status: 400 })
      cpf = cpfDigits
      if (!num_cnh || num_cnh.replace(/\D+/g, '').length < 9) {
        return NextResponse.json({ error: 'Número da CNH inválido.' }, { status: 400 })
      }
      num_cnh = num_cnh.replace(/\D+/g, '')
    } else {
      if (!(file instanceof File)) return NextResponse.json({ error: 'CNH ausente.' }, { status: 400 })
      if (file.size === 0) return NextResponse.json({ error: 'CNH vazia.' }, { status: 400 })
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Imagem da CNH acima de 8MB.' }, { status: 413 })
      if (!ALLOWED_MIMES.test(file.type)) return NextResponse.json({ error: 'Use foto da CNH (jpeg/png).' }, { status: 415 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const systemPrompt = await getActivePrompt('extracao_cnh')
      const { data: cnh, usage: cnhUsage } = await extractCNH({ buffer, mimeType: file.type, systemPrompt })
      await recordApiUsage({ order_id: orderId, kind: 'extracao_cnh', model: MODEL_ANALYSIS, usage: cnhUsage })

      if (!cnh.nome || !cnh.cpf || !cnh.num_cnh) {
        return NextResponse.json(
          { error: 'Não conseguimos ler todos os campos da CNH.', requires_manual: true, parcial: cnh },
          { status: 422 },
        )
      }
      nome = cnh.nome
      cpf = cnh.cpf.replace(/\D+/g, '')
      num_cnh = cnh.num_cnh.replace(/\D+/g, '')
    }

    const updateFinePlaca = !placaExistente && placaFinal
      ? [prisma.fineData.update({ where: { order_id: orderId }, data: { placa: placaFinal } })]
      : []

    await prisma.$transaction([
      ...updateFinePlaca,
      prisma.driverData.upsert({
        where: { order_id: orderId },
        update: { nome: nome!, cpf: cpf!, num_cnh: num_cnh!, endereco, cep: cepRaw, whatsapp },
        create: { order_id: orderId, nome: nome!, cpf: cpf!, num_cnh: num_cnh!, endereco, cep: cepRaw, whatsapp },
      }),
      prisma.driverInput.upsert({
        where: { order_id: orderId },
        update: { motivo_injustica: motivo, consentimento_lgpd: true, consentido_em: new Date() },
        create: { order_id: orderId, motivo_injustica: motivo, consentimento_lgpd: true, consentido_em: new Date() },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { cnh_manual: modoManual, dados_em: new Date() },
      }),
    ])

    await logEvent({ tipo: modoManual ? 'cnh_manual' : 'dados_condutor', order_id: orderId, user_agent: ua, ip })

    return NextResponse.json({ ok: true, nome })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[driver]', msg)
    return NextResponse.json({ error: 'Falha ao processar dados. Tente novamente.' }, { status: 500 })
  }
}
