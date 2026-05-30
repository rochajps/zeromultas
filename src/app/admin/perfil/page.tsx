import { redirect } from 'next/navigation'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function trocarSenha(formData: FormData) {
  'use server'
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const atual = String(formData.get('senha_atual') ?? '')
  const nova = String(formData.get('nova_senha') ?? '')
  const confirma = String(formData.get('confirma_senha') ?? '')

  if (nova.length < 8) {
    redirect('/admin/perfil?msg=' + encodeURIComponent('Nova senha precisa ter pelo menos 8 caracteres.'))
  }
  if (nova !== confirma) {
    redirect('/admin/perfil?msg=' + encodeURIComponent('Confirmação não bate com a nova senha.'))
  }

  const user = await prisma.adminUser.findUnique({ where: { id: session.uid } })
  if (!user) redirect('/admin/login')
  const ok = await bcrypt.compare(atual, user.senha_hash)
  if (!ok) {
    redirect('/admin/perfil?msg=' + encodeURIComponent('Senha atual incorreta.'))
  }

  const hash = await bcrypt.hash(nova, 10)
  await prisma.adminUser.update({ where: { id: user.id }, data: { senha_hash: hash } })
  redirect('/admin/perfil?msg=' + encodeURIComponent('Senha trocada com sucesso.'))
}

export default async function PerfilPage({ searchParams }: { searchParams: { msg?: string } }) {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  const user = await prisma.adminUser.findUnique({
    where: { id: session.uid },
    select: { login: true, nome: true, last_login_at: true, created_at: true },
  })

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Perfil</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Conta</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-500">Login</dt><dd className="font-medium">{user?.login}</dd></div>
          <div><dt className="text-slate-500">Nome</dt><dd className="font-medium">{user?.nome ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Criado em</dt><dd>{user?.created_at.toLocaleString('pt-BR')}</dd></div>
          <div><dt className="text-slate-500">Último login</dt><dd>{user?.last_login_at?.toLocaleString('pt-BR') ?? '—'}</dd></div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Trocar senha</h2>
        {searchParams.msg && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${searchParams.msg.toLowerCase().includes('sucesso') ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            {searchParams.msg}
          </p>
        )}
        <form action={trocarSenha} className="mt-4 space-y-3">
          <div>
            <label className="text-sm">Senha atual</label>
            <input type="password" name="senha_atual" required className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" autoComplete="current-password" />
          </div>
          <div>
            <label className="text-sm">Nova senha (mín. 8 caracteres)</label>
            <input type="password" name="nova_senha" required minLength={8} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" autoComplete="new-password" />
          </div>
          <div>
            <label className="text-sm">Confirmar nova senha</label>
            <input type="password" name="confirma_senha" required minLength={8} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" autoComplete="new-password" />
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Trocar senha
          </button>
        </form>
      </div>
    </div>
  )
}
