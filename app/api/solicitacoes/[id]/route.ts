import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const user = session.user as { id: string; role: string }

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      steps: { orderBy: { createdAt: 'asc' } },
      anexos: { orderBy: { createdAt: 'asc' } },
      prestacao: true,
    },
  })

  if (!sol) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  // DEMANDANTE só pode ver suas próprias
  if (user.role === 'DEMANDANTE' && sol.userId !== user.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  return NextResponse.json(sol)
}
