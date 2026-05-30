import Link from 'next/link'
import { getSession } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const loggedIn = !!session

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href={loggedIn ? '/admin' : '/admin/login'} className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded bg-slate-900" />
            <span className="font-semibold">Zero Multas · Admin</span>
          </Link>
          {loggedIn && (
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin" className="text-slate-600 hover:text-slate-900">Dashboard</Link>
              <Link href="/admin/pedidos" className="text-slate-600 hover:text-slate-900">Pedidos</Link>
              <Link href="/admin/precos" className="text-slate-600 hover:text-slate-900">Preços</Link>
              <Link href="/admin/prompts" className="text-slate-600 hover:text-slate-900">Prompts</Link>
              <Link href="/admin/metricas" className="text-slate-600 hover:text-slate-900">Métricas</Link>
              <Link href="/admin/perfil" className="text-slate-600 hover:text-slate-900">Perfil</Link>
              <form action="/api/admin/logout" method="post">
                <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50">
                  Sair
                </button>
              </form>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
