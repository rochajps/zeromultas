import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST() {
  await clearSessionCookie()
  return NextResponse.redirect(new URL('/admin/login', process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001'))
}
