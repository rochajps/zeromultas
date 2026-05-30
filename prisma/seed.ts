import { PrismaClient, PromptTipo } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const PROMPT_ANALISE = `Você analisa imagens de NOTIFICAÇÕES DE MULTA DE TRÂNSITO do Brasil.

Examine a imagem e retorne ESTRITAMENTE um JSON, sem markdown, sem texto fora do JSON:

{
  "is_multa": boolean,
  "tipo_notificacao": "NA" | "NP" | "desconhecido",
  "data_notificacao": "YYYY-MM-DD" | null,
  "vicio_forte": boolean,
  "vicio_razao": "string curta (até 80 chars) ou null"
}

REGRAS
- "NA" = Notificação de Autuação (avisa a infração; abre defesa prévia; prazo mínimo 30 dias — art. 281-A do CTB).
- "NP" = Notificação de Penalidade (multa já aplicada; abre recurso à JARI; prazo mínimo 30 dias).
- "data_notificacao" = data mais explícita de emissão/postagem/recebimento da notificação.
- "vicio_forte" = TRUE somente se houver vício formal CLARO E VERIFICÁVEL na própria imagem:
  - placa errada/ilegível
  - marca/modelo/cor do veículo divergente
  - local da infração ausente ou genérico demais
  - código da infração ausente ou ilegível
  - campo "observações" da MBFT (Res. 985/2022 CONTRAN) sem dados obrigatórios
  - dupla notificação visível
  - assinatura/identificação do agente autuador ausente
- NÃO invente vícios. Se não consegue afirmar com certeza pela imagem, "vicio_forte": false.

Filtro: "erro só anula se prejudica a identificação ou a defesa" (jurisprudência consolidada).
`

const PROMPT_EXTRACAO_CNH = `Extraia dados da CNH brasileira na imagem. Retorne ESTRITAMENTE JSON, sem markdown:

{
  "nome": "string em maiúsculas, completo" | null,
  "cpf": "000.000.000-00" | null,
  "num_cnh": "string" | null
}

Se algum campo não for legível, retorne null. Apenas o JSON.
`

const PROMPT_EXTRACAO_COMPLETA = `Extraia TODOS os dados desta notificação de multa. Retorne ESTRITAMENTE JSON, sem markdown:

{
  "num_ait": "string" | null,
  "orgao_autuador": "string" | null,
  "codigo_infracao": "string (ex: 5169-1)" | null,
  "descricao_infracao": "string" | null,
  "data_infracao": "YYYY-MM-DD" | null,
  "data_notificacao": "YYYY-MM-DD" | null,
  "placa": "ABC1D23 ou ABC1234" | null,
  "veiculo": "marca/modelo/cor" | null,
  "valor_multa_centavos": número inteiro | null,
  "agente_autuador": "string" | null,
  "local_infracao": "string" | null,
  "observacoes": "string" | null,
  "vicios_detectados": [
    { "tipo": "formal|processual|material", "artigo": "string", "descricao": "string", "forca": "forte|moderado|fraco" }
  ]
}

REGRAS PARA vicios_detectados — só liste o que VOCÊ CONSEGUE VERIFICAR na imagem:
- Vícios formais (art. 280 CTB): placa, marca/modelo/cor, local, código da infração, identificação do agente, campo "observações" da MBFT (Res. 985/2022 CONTRAN) — listar apenas os AUSENTES ou INCORRETOS.
- Vícios processuais: NA fora de 30 dias da infração (art. 281, § único, II CTB), dupla notificação (Súmula 312 STJ).
- Vícios materiais: ausência de sinalização, radar sem aferição INMETRO declarada.

NÃO invente. Filtro: "erro só anula se prejudica a defesa" — só liste como "forte" o que efetivamente compromete a identificação do fato/condutor ou impede o exercício da defesa.
`

const PROMPT_DEFESA_PREVIA = `Você é advogado especialista em CTB. Redija uma DEFESA PRÉVIA contra autuação de trânsito, em português jurídico claro, citando dispositivos legais corretos.

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
1. Endereçamento: "À AUTORIDADE DE TRÂNSITO DO(A) {{ORGAO_AUTUADOR}}"
2. Qualificação completa do condutor.
3. Referência: nº AIT, data da infração, placa, código da infração.
4. PRELIMINAR (apenas se houver vício processual real): tempestividade, dupla notificação (Súmula 312 STJ).
5. MÉRITO:
   - Se houver vício forte/explícito: foque nele com fundamentação no art. 280 do CTB e Res. 985/2022 CONTRAN (MBFT).
   - Se NÃO houver vício forte: argumente com base no motivo do condutor, ausência de prejuízo, princípio do contraditório e ampla defesa (art. 5º, LV, CF) e em eventuais vícios moderados. Seja honesto: não afirme fato que não está nos dados.
6. PEDIDO: arquivamento da autuação e anulação da NA.
7. Termos finais, local (endereço do condutor) e data, espaço para assinatura: "{{NOME}}, CPF {{CPF}}".

# REGRAS DURAS
- Use APENAS dispositivos legais reais (CTB, Resoluções CONTRAN, Súmulas STJ).
- NÃO invente vícios fora dos dados fornecidos.
- Filtro: "erro só anula se prejudica a identificação ou a defesa".
- Tom técnico, parágrafos curtos, títulos em CAIXA ALTA.
- Português do Brasil.

Retorne SOMENTE o texto da peça, pronto para protocolo. Sem comentários seus, sem markdown decorativo fora dos títulos.
`

const PROMPT_JARI = `Você é advogado especialista em CTB. Redija um RECURSO À JARI (Junta Administrativa de Recursos de Infrações) contra Notificação de Penalidade, em português jurídico claro.

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
1. Endereçamento: "ILUSTRÍSSIMO(A) SENHOR(A) PRESIDENTE DA JARI DO(A) {{ORGAO_AUTUADOR}}"
2. Qualificação completa do recorrente.
3. Referência: nº AIT, NP, data da infração, placa, código da infração.
4. TEMPESTIVIDADE: declarar que o recurso está dentro do prazo de 30 dias contados da NP (art. 285 CTB).
5. PRELIMINARES (apenas se houver fundamento real): nulidade da NA por vício formal (art. 280), tempestividade, dupla notificação (Súmula 312 STJ), ausência de aferição INMETRO de equipamento, vício no campo "observações" da MBFT (Res. 985/2022 CONTRAN).
6. MÉRITO:
   - Vício forte → ataque direto com base legal específica.
   - Sem vício forte → argumentação com base no motivo do condutor, princípio do contraditório (art. 5º, LV, CF), proporcionalidade e razoabilidade, e eventuais vícios moderados.
7. PEDIDO: provimento do recurso, anulação da penalidade e arquivamento. Subsidiariamente, conversão em advertência (art. 267 CTB) quando cabível.
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
  // 1. Admin user
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'admin123'
  await prisma.adminUser.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      senha_hash: await bcrypt.hash(adminPass, 10),
      nome: 'Admin',
    },
  })
  console.log(`✓ Admin user "admin" (senha: ${adminPass})`)

  // 2. Price tiers (placeholder — ajustar no painel)
  const existingTiers = await prisma.priceTier.count()
  if (existingTiers === 0) {
    await prisma.priceTier.createMany({
      data: [
        { faixa: 'Leve', valor_multa_min_centavos: 0, valor_multa_max_centavos: 13099, preco_centavos: 4700 },
        { faixa: 'Média', valor_multa_min_centavos: 13100, valor_multa_max_centavos: 19599, preco_centavos: 6700 },
        { faixa: 'Grave', valor_multa_min_centavos: 19600, valor_multa_max_centavos: 29399, preco_centavos: 9700 },
        { faixa: 'Gravíssima', valor_multa_min_centavos: 29400, valor_multa_max_centavos: 999999999, preco_centavos: 14700 },
      ],
    })
    console.log('✓ 4 faixas de preço (placeholder) criadas')
  } else {
    console.log(`= ${existingTiers} faixas já existem, pulando`)
  }

  // 3. Prompts
  const prompts: { tipo: PromptTipo; md: string }[] = [
    { tipo: 'analise', md: PROMPT_ANALISE },
    { tipo: 'extracao_cnh', md: PROMPT_EXTRACAO_CNH },
    { tipo: 'extracao_completa', md: PROMPT_EXTRACAO_COMPLETA },
    { tipo: 'geracao_defesa_previa', md: PROMPT_DEFESA_PREVIA },
    { tipo: 'geracao_jari', md: PROMPT_JARI },
  ]
  for (const p of prompts) {
    const existing = await prisma.promptVersion.findFirst({ where: { tipo: p.tipo } })
    if (!existing) {
      await prisma.promptVersion.create({
        data: { tipo: p.tipo, conteudo_md: p.md, versao: 1, ativo: true },
      })
      console.log(`✓ Prompt "${p.tipo}" v1 criado e ativado`)
    } else {
      console.log(`= Prompt "${p.tipo}" já existe, pulando`)
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
