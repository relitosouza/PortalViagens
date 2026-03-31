'use client'

import Link from 'next/link'
import { NotificationBell } from './NotificationBell'

type HeaderProps = {
  userName: string
  roleLabel: string
  initials: string
  onMenuOpen: () => void
}

export function Header({ userName, roleLabel, initials, onMenuOpen }: HeaderProps) {
  return (
    <header className="flex flex-col border-b border-slate-200 bg-white sticky top-0 z-20 shadow-sm">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 md:px-8 py-3 gap-3">
        {/* Hambúrguer — visível apenas no mobile */}
        <button
          onClick={onMenuOpen}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Abrir menu"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-sm md:text-lg font-black text-slate-900 leading-none tracking-tight truncate">
            SISTEMA DE APROVAÇÃO DE VIAGENS
          </h1>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <NotificationBell />
          <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-tight">{userName}</p>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{roleLabel}</p>
            </div>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-600 border-2 border-blue-100 flex items-center justify-center text-white text-sm font-black shadow-sm flex-shrink-0">
              {initials}
            </div>
          </div>
        </div>
      </div>

      {/* Nav Bar */}
      <div className="flex items-center px-4 md:px-8 border-t border-slate-100 bg-slate-50/50 overflow-x-auto">
        <nav className="flex gap-4 md:gap-8">
          <Link
            href="/dashboard"
            className="py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Início
          </Link>
          <Link
            href="/dashboard"
            className="py-3 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">travel</span>
            Minhas Viagens
          </Link>
        </nav>
      </div>
    </header>
  )
}
