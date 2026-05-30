import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { recurso: true },
  })
  if (!order?.recurso) return NextResponse.json({ error: 'Recurso não disponível' }, { status: 404 })

  let pdf: Buffer
  try {
    pdf = await fs.readFile(order.recurso.pdf_path)
  } catch {
    return NextResponse.json({ error: 'Arquivo indisponível em disco' }, { status: 500 })
  }

  return new NextResponse(pdf as never, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recurso-${params.id.slice(0, 8)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
