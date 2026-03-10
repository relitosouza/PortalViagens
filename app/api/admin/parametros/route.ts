import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = await prisma.configuracaoSistema.findMany({ orderBy: { chave: 'asc' } })
  return NextResponse.json(params)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: { chave: string; valor: string }[] = await req.json()

  for (const { chave, valor } of updates) {
    await prisma.configuracaoSistema.update({ where: { chave }, data: { valor } })
  }

  return NextResponse.json({ ok: true })
}
