import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { formatBRL } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

async function updateTier(formData: FormData) {
  'use server'
  const id = Number(formData.get('id'))
  await prisma.priceTier.update({
    where: { id },
    data: {
      faixa: String(formData.get('faixa')),
      valor_multa_min_centavos: Number(formData.get('min')) * 100,
      valor_multa_max_centavos: Number(formData.get('max')) * 100,
      preco_centavos: Number(formData.get('preco')) * 100,
      ativo: formData.get('ativo') === 'on',
    },
  })
  revalidatePath('/admin/precos')
}

async function createTier(formData: FormData) {
  'use server'
  await prisma.priceTier.create({
    data: {
      faixa: String(formData.get('faixa')),
      valor_multa_min_centavos: Number(formData.get('min')) * 100,
      valor_multa_max_centavos: Number(formData.get('max')) * 100,
      preco_centavos: Number(formData.get('preco')) * 100,
      ativo: true,
    },
  })
  revalidatePath('/admin/precos')
}

async function deleteTier(formData: FormData) {
  'use server'
  const id = Number(formData.get('id'))
  await prisma.priceTier.delete({ where: { id } })
  revalidatePath('/admin/precos')
}

export default async function PrecosPage() {
  const tiers = await prisma.priceTier.findMany({ orderBy: { valor_multa_min_centavos: 'asc' } })
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faixas de preço</h1>
        <p className="text-sm text-slate-600">Valores em REAIS (não centavos). Os mínimos/máximos definem em qual faixa cada multa cai.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Faixa</th>
              <th className="p-3">Min (R$)</th>
              <th className="p-3">Max (R$)</th>
              <th className="p-3">Preço (R$)</th>
              <th className="p-3">Ativo</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tiers.map((t) => (
              <tr key={t.id}>
                <td className="p-2">
                  <form id={`f${t.id}`} action={updateTier} className="contents">
                    <input type="hidden" name="id" value={t.id} />
                    <input
                      name="faixa"
                      defaultValue={t.faixa}
                      className="w-full rounded border border-slate-300 px-2 py-1"
                    />
                  </form>
                </td>
                <td className="p-2">
                  <input
                    form={`f${t.id}`}
                    name="min"
                    type="number"
                    step="0.01"
                    defaultValue={(t.valor_multa_min_centavos / 100).toFixed(2)}
                    className="w-24 rounded border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="p-2">
                  <input
                    form={`f${t.id}`}
                    name="max"
                    type="number"
                    step="0.01"
                    defaultValue={(t.valor_multa_max_centavos / 100).toFixed(2)}
                    className="w-28 rounded border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="p-2">
                  <input
                    form={`f${t.id}`}
                    name="preco"
                    type="number"
                    step="0.01"
                    defaultValue={(t.preco_centavos / 100).toFixed(2)}
                    className="w-24 rounded border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="p-2 text-center">
                  <input form={`f${t.id}`} name="ativo" type="checkbox" defaultChecked={t.ativo} />
                </td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button form={`f${t.id}`} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                      Salvar
                    </button>
                    <form action={deleteTier}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                        Excluir
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Nova faixa</h2>
        <form action={createTier} className="mt-3 grid gap-3 sm:grid-cols-5">
          <input name="faixa" placeholder="Nome (ex: Grave)" required className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input name="min" type="number" step="0.01" placeholder="Min R$" required className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input name="max" type="number" step="0.01" placeholder="Max R$" required className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <input name="preco" type="number" step="0.01" placeholder="Preço R$" required className="rounded border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Adicionar</button>
        </form>
      </div>

      <p className="text-xs text-slate-500">
        Exemplo da formatação: R$ 147,00 = {formatBRL(14700)}
      </p>
    </div>
  )
}
