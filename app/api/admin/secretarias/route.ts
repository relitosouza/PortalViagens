import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const secretarias = await prisma.secretaria.findMany({
    orderBy: { nome: 'asc' },
    include: {
      _count: { select: { users: { where: { ativo: true } } } },
    },
  })
  return NextResponse.json(secretarias)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  try {
    const secretaria = await prisma.secretaria.create({
      data: { nome: body.nome.trim() },
    })
    return NextResponse.json(secretaria, { status: 201 })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe uma secretaria com esse nome.' }, { status: 409 })
    }
    throw err
  }
}
