import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  const user = session.user as { role: string }
  if (user.role !== 'ADMIN') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const params = await prisma.configuracaoSistema.findMany({ orderBy: { chave: 'asc' } })
  return NextResponse.json(params)
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { chave, valor } = await req.json()

  if (!chave || valor === undefined) {
    return NextResponse.json({ error: 'chave e valor são obrigatórios' }, { status: 400 })
  }

  const existing = await prisma.configuracaoSistema.findUnique({ where: { chave } })
  if (!existing) {
    return NextResponse.json({ error: 'Parâmetro não encontrado' }, { status: 404 })
  }

  const updated = await prisma.configuracaoSistema.update({
    where: { chave },
    data: { valor: String(valor) },
  })

  return NextResponse.json(updated)
}
