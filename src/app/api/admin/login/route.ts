import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { signSession, setSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { login, senha } = await req.json()
    if (typeof login !== 'string' || typeof senha !== 'string') {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    const user = await prisma.adminUser.findUnique({ where: { login } })
    if (!user) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    const ok = await bcrypt.compare(senha, user.senha_hash)
    if (!ok) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })

    const token = await signSession({ sub: user.login, uid: user.id })
    await setSessionCookie(token)
    await prisma.adminUser.update({ where: { id: user.id }, data: { last_login_at: new Date() } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
