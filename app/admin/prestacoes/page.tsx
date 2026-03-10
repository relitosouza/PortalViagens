import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { PrestacoesClient } from './PrestacoesClient'

export default async function AdminPrestacoesPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/dashboard')

  const agora = new Date()

  const vencidas = await prisma.prestacao.findMany({
    where: { prazoFinal: { lt: agora }, enviadoEm: null },
    include: { solicitacao: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { prazoFinal: 'asc' }
  })

  const cpfsBloqueados = await prisma.user.findMany({
    where: { cpfBloqueado: true },
    select: { id: true, name: true, email: true, createdAt: true }
  })

  return (
    <PrestacoesClient
      vencidas={vencidas.map(p => ({
        id: p.id,
        solicitacaoId: p.solicitacaoId,
        prazoFinal: p.prazoFinal.toISOString(),
        diasAtraso: Math.floor((agora.getTime() - p.prazoFinal.getTime()) / 86400000),
        destino: p.solicitacao.destino,
        servidor: p.solicitacao.user.name,
        email: p.solicitacao.user.email,
      }))}
      cpfsBloqueados={cpfsBloqueados.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt.toISOString(),
      }))}
    />
  )
}
