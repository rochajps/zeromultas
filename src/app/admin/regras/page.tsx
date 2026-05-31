import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { invalidateSettingsCache, DEFAULT_SETTINGS, type SettingsValues } from '@/lib/settings'

export const dynamic = 'force-dynamic'

type RowDef = {
  key: keyof SettingsValues
  type: 'number' | 'text' | 'select'
  group: 'prazo' | 'score' | 'mensagens' | 'comportamento' | 'valor'
  label: string
  description: string
  rows?: number
  options?: { value: string; label: string }[]
}

const ROW_DEFS: RowDef[] = [
  { key: 'prazo_dias', type: 'number', group: 'prazo', label: 'Prazo legal (dias)', description: 'Usado só pra calcular o prazo de informação na tela do usuário. Não bloqueia nada.' },
  { key: 'prazo_cetran_dias', type: 'number', group: 'prazo', label: 'Prazo do CETRAN (dias)', description: 'Quantos dias após a ciência da decisão da JARI ainda dá pra recorrer ao CETRAN.' },
  { key: 'tipo_padrao_quando_desconhecido', type: 'select', group: 'comportamento', label: 'Tipo padrão quando IA não identifica', description: 'Quando a IA não consegue dizer se é NA ou NP, assume esse padrão.', options: [{value:'NA',label:'NA — Notificação de Autuação (defesa prévia)'},{value:'NP',label:'NP — Notificação de Penalidade (recurso à JARI)'}] },
  { key: 'valor_minimo_multa_centavos', type: 'number', group: 'valor', label: 'Valor mínimo da multa (centavos)', description: 'Bloqueia checkout se multa < esse valor. 0 = sem mínimo. Ex.: 13000 = R$ 130,00.' },
  { key: 'valor_maximo_multa_centavos', type: 'number', group: 'valor', label: 'Valor máximo da multa (centavos)', description: 'Bloqueia checkout se multa > esse valor. 0 = sem máximo.' },
  { key: 'score_alta', type: 'number', group: 'score', label: 'Score para banda ALTA (vício forte)', description: '0-100. Aparece como "Boa chance" no front.' },
  { key: 'score_media', type: 'number', group: 'score', label: 'Score para banda MÉDIA (vício moderado)', description: '0-100. Aparece como "Vale tentar" no front.' },
  { key: 'score_moderada_baixa', type: 'number', group: 'score', label: 'Score para banda MODERADA-BAIXA (genérico)', description: '0-100. Pedido sem vício formal. Aparece como "Vale tentar (sem garantia)" no front.' },
  { key: 'msg_alta', type: 'text', group: 'mensagens', label: 'Mensagem — banda ALTA', description: 'Exibida quando o pedido tem vício forte.', rows: 3 },
  { key: 'msg_media', type: 'text', group: 'mensagens', label: 'Mensagem — banda MÉDIA', description: 'Exibida quando o pedido tem vícios moderados/fracos.', rows: 4 },
  { key: 'msg_moderada_baixa', type: 'text', group: 'mensagens', label: 'Mensagem — banda MODERADA-BAIXA (genérico)', description: 'Exibida quando NÃO há vício formal — peça construída sobre o motivo do condutor. NÃO usar linguagem de "alta chance".', rows: 4 },
  { key: 'msg_nao_eh_multa', type: 'text', group: 'mensagens', label: 'Mensagem — não é multa', description: 'Exibida quando a imagem não é uma notificação válida.', rows: 2 },
  { key: 'msg_valor_fora_faixa', type: 'text', group: 'mensagens', label: 'Mensagem — valor fora da faixa', description: 'Exibida quando multa está fora da faixa min/max.', rows: 2 },
]

const GROUP_LABELS: Record<RowDef['group'], string> = {
  prazo: '⏱️ Prazo (informativo)',
  comportamento: '🎯 Comportamento do funil',
  valor: '💰 Valor da multa aceito',
  score: '📊 Score (viabilidade)',
  mensagens: '💬 Mensagens ao usuário',
}

async function salvarRegras(formData: FormData) {
  'use server'
  const ops = ROW_DEFS.map((def) => {
    const raw = formData.get(def.key)
    if (def.type === 'number') {
      const n = Number(String(raw ?? '').trim())
      if (!Number.isFinite(n)) return null
      return prisma.setting.upsert({
        where: { key: def.key },
        update: { type: 'number', value_number: n, value_text: null, value_bool: null, description: def.description, group: def.group },
        create: { key: def.key, type: 'number', value_number: n, description: def.description, group: def.group },
      })
    } else {
      const text = String(raw ?? '').trim()
      return prisma.setting.upsert({
        where: { key: def.key },
        update: { type: 'text', value_text: text, value_number: null, value_bool: null, description: def.description, group: def.group },
        create: { key: def.key, type: 'text', value_text: text, description: def.description, group: def.group },
      })
    }
  }).filter(Boolean) as ReturnType<typeof prisma.setting.upsert>[]
  await prisma.$transaction(ops)
  invalidateSettingsCache()
  redirect('/admin/regras?saved=1')
}

export default async function RegrasPage({ searchParams }: { searchParams: { saved?: string } }) {
  const rows = await prisma.setting.findMany()
  const current: Record<string, string | number> = {}
  for (const def of ROW_DEFS) {
    const row = rows.find((r) => r.key === def.key)
    if (def.type === 'number') {
      current[def.key] = row?.value_number ?? (DEFAULT_SETTINGS[def.key] as number)
    } else {
      current[def.key] = row?.value_text ?? (DEFAULT_SETTINGS[def.key] as string)
    }
  }

  const groups: RowDef['group'][] = ['prazo', 'comportamento', 'valor', 'score', 'mensagens']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regras de negócio</h1>
        <p className="mt-1 text-sm text-slate-600">Comportamento do funil sem mexer no código. Cache TTL 60s.</p>
      </div>

      {searchParams.saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ <strong>Alterações salvas com sucesso.</strong> Cache invalidado.
        </div>
      )}

      <form action={salvarRegras} className="space-y-6">
        {groups.map((g) => (
          <div key={g} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{GROUP_LABELS[g]}</h2>
            <div className="mt-4 space-y-5">
              {ROW_DEFS.filter((d) => d.group === g).map((def) => (
                <div key={def.key} className="grid gap-3 sm:grid-cols-[1fr,minmax(0,320px)] sm:items-start">
                  <div>
                    <label htmlFor={def.key} className="text-sm font-medium text-slate-800">{def.label}</label>
                    <p className="text-xs text-slate-500">{def.description}</p>
                    <p className="mt-1 text-[11px] text-slate-400">Padrão: <code>{String(DEFAULT_SETTINGS[def.key])}</code></p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {def.type === 'number' ? (
                      <input id={def.key} name={def.key} type="number" defaultValue={String(current[def.key])} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" />
                    ) : def.type === 'select' ? (
                      <select id={def.key} name={def.key} defaultValue={String(current[def.key])} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                        {def.options!.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    ) : (
                      <textarea id={def.key} name={def.key} rows={def.rows ?? 3} defaultValue={String(current[def.key])} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          Salvar regras
        </button>
      </form>
    </div>
  )
}
