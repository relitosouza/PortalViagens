import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { UsuariosClient } from './UsuariosClient'

export default async function AdminUsuariosPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/dashboard')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, cpfBloqueado: true, createdAt: true }
  })

  return <UsuariosClient users={users} />
}
