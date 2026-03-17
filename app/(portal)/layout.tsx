import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/PortalShell'

const ROLE_LABELS: Record<string, string> = {
  DEMANDANTE: 'Secretaria Demandante',
  SECOL: 'SECOL / DRP',
  SEGOV: 'SEGOV — Gabinete',
  SF: 'Secretaria de Finanças',
  ADMIN: 'Administrador do Sistema',
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user
  const role: string = user.role
  const nomeUsuario = user.name ?? 'Usuário'
  const iniciais = getInitials(user.name)
  const roleLabel = ROLE_LABELS[role] ?? role

  return (
    <PortalShell
      role={role}
      userName={nomeUsuario}
      roleLabel={roleLabel}
      initials={iniciais}
    >
      {children}
    </PortalShell>
  )
}
