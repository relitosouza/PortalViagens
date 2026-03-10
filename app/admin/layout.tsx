import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/admin/usuarios', icon: 'manage_accounts', label: 'Gestão de Usuários' },
  { href: '/admin/prestacoes', icon: 'assignment_late', label: 'Monit. Prestações' },
  { href: '/admin/parametros', icon: 'tune', label: 'Parâmetros' },
  { href: '/admin/emails', icon: 'mail', label: 'Log de E-mails' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/dashboard')

  const iniciais = (session.user.name ?? 'A')
    .split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f6f8]">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">
        <div className="p-6 flex flex-col gap-6 h-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/10 rounded-full p-2">
              <span className="material-symbols-outlined text-blue-600">admin_panel_settings</span>
            </div>
            <div>
              <h1 className="text-slate-900 text-sm font-bold leading-tight">Painel Admin</h1>
              <p className="text-slate-500 text-xs">Portal de Viagens</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-1 grow">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors text-sm font-medium"
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors text-sm">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              Voltar ao Dashboard
            </Link>
            <div className="flex items-center gap-3 mt-3 px-3">
              <div className="size-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                {iniciais}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 truncate max-w-[140px]">{session.user.name}</p>
                <p className="text-xs text-slate-400">Administrador</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
