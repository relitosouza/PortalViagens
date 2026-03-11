'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { handleSignOut } from '@/app/(portal)/dashboard/actions'

type SidebarProps = {
  role: string
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white h-screen sticky top-0">
      <div className="p-6 flex flex-col gap-6 h-full">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img 
            src="/brasao-osasco.png" 
            alt="Logo Osasco" 
            className="w-10 h-10 object-contain"
          />
          <div className="flex flex-col">
            <h1 className="text-slate-900 text-[10px] font-black leading-tight tracking-tight uppercase">Prefeitura do Município de Osasco</h1>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 grow">
          <Link 
            href="/dashboard"
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
            href="/dashboard" /* Mantendo como /dashboard por enquanto já que unificamos */
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive('/solicitacoes') 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
            <span className="text-sm font-medium">Solicitações</span>
          </Link>

          <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 cursor-not-allowed" href="#">
            <span className="material-symbols-outlined text-[20px]">description</span>
            <span className="text-sm font-medium">Relatórios</span>
          </a>
          
          <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 cursor-not-allowed" href="#">
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span className="text-sm font-medium">Configurações</span>
          </a>

          {role === 'ADMIN' && (
            <Link 
              href="/admin"
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
