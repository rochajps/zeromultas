import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'zm_admin'
const ALG = 'HS256'
const EXP = '7d'

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET ausente em env')
  return new TextEncoder().encode(s)
}

export interface Session {
  sub: string // login do admin
  uid: number // id
}

export async function signSession(payload: Session): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXP)
    .sign(secret())
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.sub === 'string' && typeof payload.uid === 'number') {
      return { sub: payload.sub, uid: payload.uid }
    }
    return null
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearSessionCookie() {
  cookies().delete(COOKIE_NAME)
}

export async function getSession(): Promise<Session | null> {
  const c = cookies().get(COOKIE_NAME)
  if (!c?.value) return null
  return verifySession(c.value)
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME
