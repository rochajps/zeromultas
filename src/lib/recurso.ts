// Gera a peça (chamada 2 Sonnet) + PDF. Não bloqueia mais por fase.
import fs from 'fs/promises'
import path from 'path'
import PDFDocument from 'pdfkit'
import { prisma } from './prisma'
import { getActivePrompt, renderPrompt } from './prompts'
import { generateRecursoText } from './anthropic'
import { logEvent } from './events'
import type { Fase, PromptTipo } from '@prisma/client'

const STORAGE_DIR = process.env.RECURSOS_DIR ?? path.resolve(process.cwd(), 'storage', 'recursos')

function brl(centavos: number | null | undefined): string {
  if (centavos == null) return 'não informado'
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function promptTipoPorFase(fase: Fase | null): PromptTipo {
  if (fase === 'jari') return 'geracao_jari'
  if (fase === 'cetran') return 'geracao_cetran'
  return 'geracao_defesa_previa'
}

export async function generateRecursoForOrder(orderId: string): Promise<{ pdfPath: string; texto: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { fine_data: true, driver_data: true, driver_input: true },
  })
  if (!order) throw new Error('Pedido não encontrado')
  if (!order.fine_data) throw new Error('Pedido sem dados da multa')
  if (!order.driver_data) throw new Error('Pedido sem dados do condutor')
  if (!order.driver_input) throw new Error('Pedido sem motivo do condutor')

  // Se fase ainda está como 'vencido' (legado), trata como defesa_previa por default
  const faseEfetiva: Fase = order.fase === 'vencido' ? 'defesa_previa' : (order.fase ?? 'defesa_previa')
  const tipo = promptTipoPorFase(faseEfetiva)
  const template = await getActivePrompt(tipo)

  const fineData = {
    num_ait: order.fine_data.num_ait,
    orgao_autuador: order.fine_data.orgao_autuador,
    codigo_infracao: order.fine_data.codigo_infracao,
    descricao_infracao: order.fine_data.descricao_infracao,
    data_infracao: order.fine_data.data_infracao?.toISOString().slice(0, 10) ?? null,
    data_notificacao: order.fine_data.data_notificacao?.toISOString().slice(0, 10) ?? null,
    placa: order.fine_data.placa,
    veiculo: order.fine_data.veiculo,
    valor_multa_centavos: order.fine_data.valor_multa_centavos,
    valor_multa_brl: brl(order.fine_data.valor_multa_centavos),
    vicios_detectados: order.fine_data.vicios_detectados,
    vicio_forte: order.fine_data.vicio_forte,
    vicio_razao: order.fine_data.vicio_razao,
    tipo_notificacao: order.fine_data.tipo_notificacao,
  }

  const systemPrompt = renderPrompt(template, {
    FINE_DATA_JSON: JSON.stringify(fineData, null, 2),
    NOME: order.driver_data.nome,
    CPF: order.driver_data.cpf,
    CNH: order.driver_data.num_cnh,
    ENDERECO: order.driver_data.endereco,
    MOTIVO_INJUSTICA: order.driver_input.motivo_injustica,
    ORGAO_AUTUADOR: order.fine_data.orgao_autuador ?? 'AUTORIDADE AUTUADORA',
  })

  const { texto } = await generateRecursoText({ systemPrompt })

  const pdfPath = await writePdf(orderId, texto, faseEfetiva)

  await prisma.$transaction([
    prisma.recurso.upsert({
      where: { order_id: orderId },
      update: { texto, pdf_path: pdfPath, gerado_em: new Date() },
      create: { order_id: orderId, texto, pdf_path: pdfPath },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'gerado', generated_at: new Date(), fase: faseEfetiva },
    }),
  ])

  await logEvent({ tipo: 'gerado', order_id: orderId, metadata: { fase: faseEfetiva, chars: texto.length } })

  return { pdfPath, texto }
}

async function writePdf(orderId: string, texto: string, fase: Fase | null): Promise<string> {
  await fs.mkdir(STORAGE_DIR, { recursive: true, mode: 0o750 })
  const filename = `${orderId}.pdf`
  const filePath = path.join(STORAGE_DIR, filename)

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: faseLabel(fase) } })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', async () => {
      try {
        await fs.writeFile(filePath, Buffer.concat(chunks), { mode: 0o640 })
        resolve()
      } catch (e) {
        reject(e)
      }
    })
    doc.on('error', reject)

    doc.font('Helvetica-Bold').fontSize(14).text(faseLabel(fase), { align: 'center' })
    doc.moveDown(1.5)
    doc.font('Helvetica').fontSize(11)
    const paragrafos = texto.split(/\n{2,}/)
    paragrafos.forEach((p, i) => {
      doc.text(p.trim(), { align: 'justify', lineGap: 2 })
      if (i < paragrafos.length - 1) doc.moveDown(0.8)
    })
    doc.end()
  })

  return filePath
}

function faseLabel(fase: Fase | null): string {
  if (fase === 'jari') return 'RECURSO À JARI'
  if (fase === 'cetran') return 'RECURSO AO CETRAN'
  return 'DEFESA PRÉVIA'
}
