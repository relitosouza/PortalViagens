'use client'

type HeaderProps = {
  userName: string
  roleLabel: string
  initials: string
}

export function Header({ userName, roleLabel, initials }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-slate-900">Portal de Viagens</h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-8 w-px bg-slate-200"></div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900">{userName}</p>
            <p className="text-xs text-slate-500">{roleLabel}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-blue-200 flex items-center justify-center text-white text-sm font-bold shadow-inner">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
