'use client'

import Link from 'next/link'
import Image from 'next/image'

type HeaderProps = {
  userName: string
  roleLabel: string
  initials: string
}

export function Header({ userName, roleLabel, initials }: HeaderProps) {
  return (
    <header className="flex flex-col border-b border-slate-200 bg-white sticky top-0 z-20 shadow-sm">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-8 py-3">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-slate-900 leading-none tracking-tight">SISTEMA DE APROVAÇÃO DE VIAGENS</h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-tight">{userName}</p>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{roleLabel}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-blue-100 flex items-center justify-center text-white text-sm font-black shadow-sm">
              {initials}
            </div>
          </div>
        </div>
      </div>

      {/* Nav Bar (Unified) */}
      <div className="flex items-center px-8 border-t border-slate-100 bg-slate-50/50">
        <nav className="flex gap-8">
          <Link 
            href="/dashboard" 
            className="py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Início
          </Link>
          <Link 
            href="/dashboard" 
            className="py-3 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">travel</span>
            Minhas Viagens
          </Link>
        </nav>
      </div>
    </header>
  )
}
