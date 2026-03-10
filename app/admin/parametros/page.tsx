import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ParametrosClient } from './ParametrosClient'

export default async function AdminParametrosPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/dashboard')

  const parametros = await prisma.configuracaoSistema.findMany({ orderBy: { chave: 'asc' } })

  return <ParametrosClient parametros={parametros.map(p => ({ ...p, updatedAt: p.updatedAt.toISOString() }))} />
}
