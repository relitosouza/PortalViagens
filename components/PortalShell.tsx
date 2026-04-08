'use client'
import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

type PortalShellProps = {
  role: string
  userName: string
  roleLabel: string
  initials: string
  children: React.ReactNode
}

export function PortalShell({ role, userName, roleLabel, initials, children }: PortalShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden print:overflow-visible bg-background-light text-slate-900">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: drawer no mobile, fixo no desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-40 lg:static lg:z-auto transition-transform duration-300 ease-in-out print:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar role={role} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="print:hidden">
          <Header
            userName={userName}
            roleLabel={roleLabel}
            initials={initials}
            onMenuOpen={() => setSidebarOpen(true)}
          />
        </div>
        <main className="flex-1 overflow-y-auto print:overflow-visible @container">
          {children}
        </main>
      </div>
    </div>
  )
}
