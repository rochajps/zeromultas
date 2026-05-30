import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { PromptTipo } from '@prisma/client'

export const dynamic = 'force-dynamic'

const TIPOS: { id: PromptTipo; label: string }[] = [
  { id: 'analise', label: 'Análise + extração (Haiku, pré-pagamento)' },
  { id: 'extracao_cnh', label: 'Extração de CNH (Haiku)' },
  { id: 'geracao_defesa_previa', label: 'Geração: Defesa Prévia (Sonnet, pós-pagamento)' },
  { id: 'geracao_jari', label: 'Geração: Recurso à JARI (Sonnet, pós-pagamento)' },
]

async function novaVersao(formData: FormData) {
  'use server'
  const tipo = formData.get('tipo') as PromptTipo
  const conteudo = String(formData.get('conteudo') ?? '')
  const notas = String(formData.get('notas') ?? '') || null
  if (!conteudo.trim()) return
  const ativo = await prisma.promptVersion.findFirst({ where: { tipo, ativo: true }, orderBy: { versao: 'desc' } })
  const novaV = (ativo?.versao ?? 0) + 1
  await prisma.$transaction(async (tx) => {
    if (ativo) await tx.promptVersion.update({ where: { id: ativo.id }, data: { ativo: false } })
    await tx.promptVersion.create({
      data: { tipo, conteudo_md: conteudo, versao: novaV, ativo: true, notas },
    })
  })
  revalidatePath('/admin/prompts')
}

async function ativar(formData: FormData) {
  'use server'
  const id = Number(formData.get('id'))
  const versao = await prisma.promptVersion.findUnique({ where: { id } })
  if (!versao) return
  await prisma.$transaction([
    prisma.promptVersion.updateMany({ where: { tipo: versao.tipo, ativo: true }, data: { ativo: false } }),
    prisma.promptVersion.update({ where: { id }, data: { ativo: true } }),
  ])
  revalidatePath('/admin/prompts')
}

export default async function PromptsPage({ searchParams }: { searchParams: { tipo?: string } }) {
  const tipoAtual = (searchParams.tipo as PromptTipo) || 'analise'
  const versoes = await prisma.promptVersion.findMany({
    where: { tipo: tipoAtual },
    orderBy: { versao: 'desc' },
  })
  const ativo = versoes.find((v) => v.ativo) ?? versoes[0]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prompts (MD)</h1>

      <div className="flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <a
            key={t.id}
            href={`/admin/prompts?tipo=${t.id}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              t.id === tipoAtual ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700">
          Versão ativa: v{ativo?.versao ?? '—'}{ativo?.notas ? ` — ${ativo.notas}` : ''}
        </h2>
        <form action={novaVersao} className="mt-3 space-y-3">
          <input type="hidden" name="tipo" value={tipoAtual} />
          <textarea
            name="conteudo"
            rows={18}
            defaultValue={ativo?.conteudo_md ?? ''}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
          />
          <input
            name="notas"
            placeholder="Notas da nova versão (ex: 'ajustou tom técnico')"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            Criar nova versão e ativar
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 p-4 text-sm font-semibold text-slate-700">Histórico</h2>
        <ul className="divide-y divide-slate-200">
          {versoes.map((v) => (
            <li key={v.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm">
                  <strong>v{v.versao}</strong> {v.ativo && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">ativa</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {v.notas ?? '—'} · {v.created_at.toLocaleString('pt-BR')}
                </p>
              </div>
              {!v.ativo && (
                <form action={ativar}>
                  <input type="hidden" name="id" value={v.id} />
                  <button className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50">
                    Ativar esta
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
