'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { handleSignOut } from '@/app/(portal)/dashboard/actions'

type SidebarProps = {
  role: string
  onClose?: () => void
}

export function Sidebar({ role, onClose }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white h-screen sticky top-0">
      <div className="p-6 flex flex-col gap-6 h-full">
        {/* Logo + botão fechar no mobile */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/brasao-osasco.png"
              alt="Logo Osasco"
              className="w-10 h-10 object-contain flex-shrink-0"
            />
            <h1 className="text-slate-900 text-[10px] font-black leading-tight tracking-tight uppercase">
              Prefeitura do Município de Osasco
            </h1>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors flex-shrink-0"
              aria-label="Fechar menu"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 grow">
          <Link
            href="/dashboard"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive('/dashboard')
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            <span className="text-sm font-medium">Dashboard</span>
          </Link>

          <Link
            href="/dashboard"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive('/solicitacoes')
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
            <span className="text-sm font-medium">Solicitações</span>
          </Link>

          <Link
            href="/relatorios"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive('/relatorios')
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">bar_chart</span>
            <span className="text-sm font-medium">Relatórios</span>
          </Link>

          <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 cursor-not-allowed" href="#">
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span className="text-sm font-medium">Configurações</span>
          </a>

          {role === 'ADMIN' && (
            <Link
              href="/admin"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 mt-4 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
              <span className="text-sm font-bold">Painel Admin</span>
            </Link>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="mt-auto pt-6 border-t border-slate-200 flex flex-col gap-3">
          {(role === 'DEMANDANTE' || role === 'ADMIN') && (
            <Link
              href="/solicitacoes/nova"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-bold transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Nova Viagem</span>
            </Link>
          )}
          <form action={handleSignOut}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg py-2 text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>Sair</span>
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
