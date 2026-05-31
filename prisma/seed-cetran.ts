import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROMPT_CETRAN = `Você é advogado especialista em CTB. Redija um RECURSO AO CETRAN (Conselho Estadual de Trânsito — 3ª instância administrativa) contra decisão denegatória da JARI, em português jurídico claro.

# DADOS DA MULTA
{{FINE_DATA_JSON}}

# DADOS DO CONDUTOR
- Nome: {{NOME}}
- CPF: {{CPF}}
- CNH: {{CNH}}
- Endereço: {{ENDERECO}}

# MOTIVO INFORMADO PELO CONDUTOR
"""
{{MOTIVO_INJUSTICA}}
"""

# ESTRUTURA OBRIGATÓRIA
1. Endereçamento: "AO CONSELHO ESTADUAL DE TRÂNSITO — CETRAN"
2. Qualificação completa do recorrente.
3. Referência: nº AIT, decisão da JARI a ser reformada, data da infração, placa.
4. TEMPESTIVIDADE: declarar que o recurso está dentro do prazo de 30 dias contados da ciência da decisão da JARI (art. 288 CTB).
5. PRELIMINARES (apenas se houver fundamento real): nulidade da NA por vício formal (art. 280), tempestividade, vícios processuais da JARI (motivação genérica, ausência de análise dos argumentos da defesa, decisão contrária à prova dos autos).
6. MÉRITO:
   - Reiterar os fundamentos da defesa prévia/recurso à JARI quando aplicável.
   - Vício forte → ataque direto com base legal específica (art. 280 CTB, Res. 985/2022 CONTRAN — MBFT).
   - Sem vício forte → argumentação com base no motivo do condutor, princípio do contraditório (art. 5º, LV, CF), proporcionalidade e razoabilidade.
   - Demonstrar que a decisão da JARI não enfrentou os argumentos da defesa de forma adequada.
7. PEDIDO: provimento do recurso, reforma da decisão da JARI, anulação da penalidade e arquivamento. Subsidiariamente, conversão em advertência (art. 267 CTB) quando cabível.
8. Termos finais, local (endereço do recorrente) e data, espaço para assinatura: "{{NOME}}, CPF {{CPF}}".

# REGRAS DURAS
- Use APENAS dispositivos legais reais (CTB, Resoluções CONTRAN, Súmulas STJ).
- NÃO invente vícios fora dos dados.
- Filtro: "erro só anula se prejudica a defesa".
- Tom técnico, parágrafos curtos, títulos em CAIXA ALTA.
- Português do Brasil.

Retorne SOMENTE o texto da peça, pronto para protocolo.
`

async function main() {
  const ativo = await prisma.promptVersion.findFirst({
    where: { tipo: 'geracao_cetran' as never },
    orderBy: { versao: 'desc' },
  })
  if (!ativo) {
    await prisma.promptVersion.create({
      data: {
        tipo: 'geracao_cetran' as never,
        conteudo_md: PROMPT_CETRAN,
        versao: 1,
        ativo: true,
        notas: 'v1 inicial — recurso ao CETRAN (3ª instância)',
      },
    })
    console.log('✓ Prompt geracao_cetran v1 criado e ativado')
  } else {
    console.log(`= Prompt geracao_cetran já existe (v${ativo.versao})`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
