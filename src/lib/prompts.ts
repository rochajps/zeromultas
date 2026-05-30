import { prisma } from './prisma'
import type { PromptTipo } from '@prisma/client'

export async function getActivePrompt(tipo: PromptTipo): Promise<string> {
  const row = await prisma.promptVersion.findFirst({
    where: { tipo, ativo: true },
    orderBy: { versao: 'desc' },
  })
  if (!row) throw new Error(`Nenhum prompt ativo para tipo=${tipo}`)
  return row.conteudo_md
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}
