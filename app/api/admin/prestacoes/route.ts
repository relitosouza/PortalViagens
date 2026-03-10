import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const agora = new Date()

  // Overdue prestações (prazoFinal passed, not submitted)
  const vencidas = await prisma.prestacao.findMany({
    where: { prazoFinal: { lt: agora }, enviadoEm: null },
    include: { solicitacao: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { prazoFinal: 'asc' }
  })

  // Blocked CPFs
  const cpfsBloqueados = await prisma.user.findMany({
    where: { cpfBloqueado: true },
    select: { id: true, name: true, email: true, createdAt: true }
  })

  return NextResponse.json({
    vencidas: vencidas.map(p => ({
      id: p.id,
      solicitacaoId: p.solicitacaoId,
      prazoFinal: p.prazoFinal,
      diasAtraso: Math.floor((agora.getTime() - p.prazoFinal.getTime()) / 86400000),
      destino: p.solicitacao.destino,
      servidor: p.solicitacao.user.name,
      email: p.solicitacao.user.email,
    })),
    cpfsBloqueados
  })
}
