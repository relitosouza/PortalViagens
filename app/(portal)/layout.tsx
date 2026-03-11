import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

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
    <div className="flex h-screen overflow-hidden bg-[#f6f6f8] text-slate-900">
      <Sidebar role={role} />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <Header userName={nomeUsuario} roleLabel={roleLabel} initials={iniciais} />
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
