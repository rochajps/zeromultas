// Gera a peça parametrizada por modo (vicio_forte / moderado / generico).
import fs from 'fs/promises'
import path from 'path'
import PDFDocument from 'pdfkit'
import { prisma } from './prisma'
import { getActivePrompt, renderPrompt } from './prompts'
import { generateRecursoText, MODEL_GENERATION } from './anthropic'
import { logEvent } from './events'
import { recordApiUsage } from './usage'
import type { Fase, PromptTipo, ModoGeracao } from '@prisma/client'

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

// Instruções específicas por modo, anexadas ao system prompt base.
function instrucoesPorModo(modo: ModoGeracao, permite_sumula_312: boolean): string {
  if (modo === 'vicio_forte') {
    return `
# MODO DE GERAÇÃO: VÍCIO FORTE

A peça deve cravar os vícios listados em "VICIOS_FINAIS" abaixo, com a fundamentação legal correta.

DOS FATOS:
- Descrever a autuação e apontar OBJETIVAMENTE o(s) vício(s) presentes em VICIOS_FINAIS.

DO DIREITO:
- Fundamentar cada vício com o artigo correto (use o campo "artigo" de cada vício, p.ex.: art. 280 CTB para formais; art. 281 §único, II para o atraso da NA; Súmula 312 STJ para dupla notificação se aplicável).
- Demonstrar o prejuízo à identificação do fato/condutor ou à defesa.
- NÃO afirme vício que não esteja em VICIOS_FINAIS.

DOS PEDIDOS:
- Nulidade/insubsistência do auto de infração e arquivamento.
- Cancelamento da penalidade e dos pontos.
`
  }
  if (modo === 'moderado') {
    return `
# MODO DE GERAÇÃO: VÍCIO MODERADO

Use a lista de VICIOS_FINAIS como base, articulando cada vício com o fundamento legal apropriado.

DOS FATOS: descrever a autuação e apontar os vícios moderados/fracos presentes em VICIOS_FINAIS.

DO DIREITO: fundamentar com o artigo de cada vício (CTB, Resoluções CONTRAN). Demonstrar prejuízo à defesa, ainda que parcial. NÃO afirmar vício que não esteja em VICIOS_FINAIS.

DOS PEDIDOS:
- Principal: nulidade/insubsistência e arquivamento.
- Subsidiário: conversão da penalidade em advertência por escrito (art. 267 CTB) quando cabível (infração leve/média e condutor não reincidente). Apresentar como faculdade da autoridade, não como direito.
`
  }
  // generico
  return `
# MODO DE GERAÇÃO: GENÉRICO (sem vício formal identificado)

LIMITES INEGOCIÁVEIS:
- NÃO INVENTE vício. NÃO cite art. 280 do CTB alegando defeito que não existe.
- NÃO prometa resultado. NÃO use linguagem de "alta chance" ou similar.

DOS FATOS:
- Construir a partir do MOTIVO_INJUSTICA fornecido pelo condutor. Essa narrativa é a base.
- Se o motivo for vago/incompleto, redigir contestação de mérito SÓBRIA, sem fabricar circunstâncias.

DO DIREITO:
- Apoiar em fundamentos legítimos de menor força:
  • Contestação de mérito dos fatos imputados.
  • Princípios do processo administrativo: ampla defesa e contraditório (art. 5º, LV, CF), razoabilidade e proporcionalidade da penalidade.
  • Pedido de reexame das provas (imagem do equipamento, comprovação de aferição do INMETRO quando infração de velocidade, sinalização adequada quando infração de placa de regulamentação).
${permite_sumula_312 ? `- Pode QUESTIONAR (como ponto subsidiário, na forma de pedido de verificação — JAMAIS afirmar) a regularidade da dupla notificação à luz da Súmula 312 do STJ.` : ''}

DOS PEDIDOS:
- Principal: cancelamento/arquivamento da autuação ou da penalidade.
- Subsidiário: conversão da penalidade em advertência por escrito (art. 267 CTB) — incluir apenas quando cabível (infração de natureza leve ou média e condutor não reincidente nos últimos 12 meses na mesma infração). Redigir como FACULDADE da autoridade, não como direito.

Linguagem formal, parágrafos curtos, títulos em CAIXA ALTA. Português do Brasil.
`
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

  const faseEfetiva: Fase = order.fase === 'vencido' ? 'defesa_previa' : (order.fase ?? 'defesa_previa')
  const tipo = promptTipoPorFase(faseEfetiva)
  const template = await getActivePrompt(tipo)

  // Modo de geração — usa o salvo no Order, ou default 'generico' (não bloqueia)
  const modo: ModoGeracao = order.modo_geracao ?? 'generico'
  const permite_sumula_312 = order.permite_arguir_sumula_312 ?? false
  const vicios_finais = (order.vicios_finais as unknown as object[]) ?? []

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
    tipo_notificacao: order.fine_data.tipo_notificacao,
  }

  const basePrompt = renderPrompt(template, {
    FINE_DATA_JSON: JSON.stringify(fineData, null, 2),
    NOME: order.driver_data.nome,
    CPF: order.driver_data.cpf,
    CNH: order.driver_data.num_cnh,
    ENDERECO: order.driver_data.endereco,
    MOTIVO_INJUSTICA: order.driver_input.motivo_injustica || '(não informado)',
    ORGAO_AUTUADOR: order.fine_data.orgao_autuador ?? 'AUTORIDADE AUTUADORA',
  })

  const systemPrompt =
    basePrompt +
    '\n\n---\n\n' +
    instrucoesPorModo(modo, permite_sumula_312) +
    '\n\n# VICIOS_FINAIS (lista oficial de vícios verificáveis — única base permitida)\n' +
    '```json\n' + JSON.stringify(vicios_finais, null, 2) + '\n```' +
    '\n\n# MOTIVO_INJUSTICA (palavras do próprio condutor)\n' +
    '"""\n' + (order.driver_input.motivo_injustica || '(o condutor não preencheu)') + '\n"""\n'

  const { texto, usage } = await generateRecursoText({ systemPrompt })
  await recordApiUsage({ order_id: orderId, kind: 'geracao', model: MODEL_GENERATION, usage })

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

  await logEvent({ tipo: 'gerado', order_id: orderId, metadata: { fase: faseEfetiva, modo, chars: texto.length } })

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

    // Disclaimer no rodapé
    doc.moveDown(2)
    doc.fontSize(8).fillColor('#666').text(
      'Documento gerado para autoatendimento. Sem garantia de resultado. O recurso administrativo pode ser protocolado pelo próprio condutor junto ao órgão autuador. zeromultas.pro',
      { align: 'center' }
    )

    doc.end()
  })

  return filePath
}

function faseLabel(fase: Fase | null): string {
  if (fase === 'jari') return 'RECURSO À JARI'
  if (fase === 'cetran') return 'RECURSO AO CETRAN'
  return 'DEFESA PRÉVIA'
}
