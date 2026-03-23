import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const secretarias = await prisma.secretaria.findMany({
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: { users: true }
        }
      }
    })
    return NextResponse.json(secretarias)
  } catch (error) {
    console.error('Erro ao buscar secretarias:', error)
    return NextResponse.json({ error: 'Erro ao buscar secretarias' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { nome } = await req.json()
    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const secretaria = await prisma.secretaria.create({
      data: { nome }
    })

    return NextResponse.json(secretaria)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe uma secretaria com este nome' }, { status: 400 })
    }
    console.error('Erro ao criar secretaria:', error)
    return NextResponse.json({ error: 'Erro ao criar secretaria' }, { status: 500 })
  }
}
