import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { invalidateSettingsCache, DEFAULT_SETTINGS, type SettingsValues } from '@/lib/settings'

export const dynamic = 'force-dynamic'

type RowDef = {
  key: keyof SettingsValues
  type: 'number' | 'text'
  group: 'prazo' | 'score' | 'mensagens' | 'cobranca'
  label: string
  description: string
  rows?: number // textarea
}

const ROW_DEFS: RowDef[] = [
  {
    key: 'prazo_dias',
    type: 'number',
    group: 'prazo',
    label: 'Prazo legal (dias)',
    description: 'Quantos dias após a notificação ainda dá pra recorrer. Padrão CTB: 30.',
  },
  {
    key: 'cobrar_proximo_vencimento_dias',
    type: 'number',
    group: 'prazo',
    label: 'Bloquear venda se faltam menos de X dias',
    description: 'Não cobrar quando o prazo está prestes a vencer. 0 = nunca bloquear.',
  },
  {
    key: 'score_alto',
    type: 'number',
    group: 'score',
    label: 'Score quando há vício forte',
    description: '0-100. Exibido quando a análise detecta vício claro.',
  },
  {
    key: 'score_moderado',
    type: 'number',
    group: 'score',
    label: 'Score quando não há vício forte',
    description: '0-100. Recurso genérico ainda é viável.',
  },
  {
    key: 'msg_score_alto',
    type: 'text',
    group: 'mensagens',
    label: 'Mensagem — score alto',
    description: 'Texto exibido ao usuário quando há vício forte.',
    rows: 3,
  },
  {
    key: 'msg_score_moderado',
    type: 'text',
    group: 'mensagens',
    label: 'Mensagem — score moderado',
    description: 'Texto exibido quando não há vício forte mas ainda vale recorrer.',
    rows: 4,
  },
  {
    key: 'msg_score_vencido',
    type: 'text',
    group: 'mensagens',
    label: 'Mensagem — prazo vencido',
    description: 'Texto exibido quando o prazo administrativo já encerrou.',
    rows: 3,
  },
  {
    key: 'msg_nao_eh_multa',
    type: 'text',
    group: 'mensagens',
    label: 'Mensagem — não é multa',
    description: 'Texto exibido quando a imagem enviada não parece notificação de multa.',
    rows: 2,
  },
]

const GROUP_LABELS: Record<RowDef['group'], string> = {
  prazo: '⏱️ Prazo e tempestividade',
  score: '📊 Score (viabilidade)',
  mensagens: '💬 Mensagens ao usuário',
  cobranca: '💳 Cobrança',
}

async function salvarRegras(formData: FormData) {
  'use server'
  const ops = ROW_DEFS.map((def) => {
    const raw = String(formData.get(def.key) ?? '').trim()
    if (def.type === 'number') {
      const n = Number(raw)
      if (!Number.isFinite(n)) return null
      return prisma.setting.upsert({
        where: { key: def.key },
        update: { type: 'number', value_number: n, value_text: null, value_bool: null, description: def.description, group: def.group },
        create: { key: def.key, type: 'number', value_number: n, description: def.description, group: def.group },
      })
    } else {
      return prisma.setting.upsert({
        where: { key: def.key },
        update: { type: 'text', value_text: raw, value_number: null, value_bool: null, description: def.description, group: def.group },
        create: { key: def.key, type: 'text', value_text: raw, description: def.description, group: def.group },
      })
    }
  }).filter(Boolean) as ReturnType<typeof prisma.setting.upsert>[]
  await prisma.$transaction(ops)
  invalidateSettingsCache()
  revalidatePath('/admin/regras')
}

async function restaurarPadrao(formData: FormData) {
  'use server'
  const key = String(formData.get('key') ?? '') as keyof SettingsValues
  if (!(key in DEFAULT_SETTINGS)) return
  const def = ROW_DEFS.find((d) => d.key === key)
  if (!def) return
  const defaultValue = DEFAULT_SETTINGS[key]
  if (def.type === 'number') {
    await prisma.setting.upsert({
      where: { key },
      update: { type: 'number', value_number: defaultValue as number, value_text: null, value_bool: null, description: def.description, group: def.group },
      create: { key, type: 'number', value_number: defaultValue as number, description: def.description, group: def.group },
    })
  } else {
    await prisma.setting.upsert({
      where: { key },
      update: { type: 'text', value_text: defaultValue as string, value_number: null, value_bool: null, description: def.description, group: def.group },
      create: { key, type: 'text', value_text: defaultValue as string, description: def.description, group: def.group },
    })
  }
  invalidateSettingsCache()
  revalidatePath('/admin/regras')
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

  const groups: RowDef['group'][] = ['prazo', 'score', 'mensagens']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regras de negócio</h1>
        <p className="mt-1 text-sm text-slate-600">
          Comportamento do funil sem precisar mexer no código. Alterações entram em vigor em até 60s (cache).
        </p>
      </div>

      {searchParams.saved && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✓ Alterações salvas. Cache invalidado.
        </p>
      )}

      <form action={salvarRegras} className="space-y-8">
        {groups.map((g) => (
          <div key={g} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{GROUP_LABELS[g]}</h2>
            <div className="mt-4 space-y-5">
              {ROW_DEFS.filter((d) => d.group === g).map((def) => (
                <div key={def.key} className="grid gap-3 sm:grid-cols-[1fr,minmax(0,300px)] sm:items-start">
                  <div>
                    <label htmlFor={def.key} className="text-sm font-medium text-slate-800">
                      {def.label}
                    </label>
                    <p className="text-xs text-slate-500">{def.description}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Padrão: <code>{String(DEFAULT_SETTINGS[def.key])}</code>
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {def.type === 'number' ? (
                      <input
                        id={def.key}
                        name={def.key}
                        type="number"
                        defaultValue={String(current[def.key])}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                      />
                    ) : (
                      <textarea
                        id={def.key}
                        name={def.key}
                        rows={def.rows ?? 3}
                        defaultValue={String(current[def.key])}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <button
            type="submit"
            formAction={async (fd) => {
              'use server'
              await salvarRegras(fd)
            }}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Salvar regras
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Restaurar valor padrão por chave</h2>
        <p className="mt-1 text-xs text-slate-500">Útil se você mudou algo e quer voltar ao default.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ROW_DEFS.map((d) => (
            <form key={d.key} action={restaurarPadrao}>
              <input type="hidden" name="key" value={d.key} />
              <button className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50">
                {d.label} → default
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  )
}
