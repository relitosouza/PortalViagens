import { auth } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function getInitials(name: string | null | undefined): string {
  if (!name) return 'A'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; role: string; name?: string | null }
  if (user.role !== 'ADMIN') redirect('/dashboard')

  const nomeAdmin = user.name ?? 'Admin'
  const iniciais = getInitials(user.name)

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background-light text-slate-900">
      <div className="layout-container flex h-full grow flex-col">

        {/* Institutional Header */}
        <header className="flex items-center justify-between whitespace-nowrap border-b border-slate-200 bg-white px-10 py-3 sticky top-0 z-50">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4 text-primary">
              <div className="size-8 flex items-center justify-center bg-primary/10 rounded-lg">
                <span className="material-symbols-outlined text-primary">travel_explore</span>
              </div>
              <h2 className="text-slate-900 text-lg font-bold leading-tight tracking-tight">Osasco Travel</h2>
            </div>
            <nav className="flex items-center gap-6">
              <Link className="text-slate-600 text-sm font-medium hover:text-primary transition-colors" href="/dashboard">
                Dashboard
              </Link>
              <Link className="text-slate-600 text-sm font-medium hover:text-primary transition-colors" href="/solicitacoes">
                Viagens
              </Link>
              <a className="text-slate-400 text-sm font-medium cursor-not-allowed" href="#">Relatórios</a>
              <a className="text-primary text-sm font-bold border-b-2 border-primary py-1" href="/admin">
                Configurações
              </a>
            </nav>
          </div>
          <div className="flex flex-1 justify-end gap-6 items-center">
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900">{nomeAdmin}</p>
                <p className="text-[10px] text-slate-500">Superusuário</p>
              </div>
              <div className="bg-primary/20 rounded-full size-10 flex items-center justify-center border border-primary/30 text-primary font-bold text-sm">
                {iniciais}
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          {/* Sidebar Navigation */}
          <aside className="w-72 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-3">Administração</h3>
              <nav className="flex flex-col gap-1">
                <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors" href="#users">
                  <span className="material-symbols-outlined">group</span>
                  <span className="text-sm">Usuários</span>
                </a>
                <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors" href="#blocks">
                  <span className="material-symbols-outlined">block</span>
                  <span className="text-sm">Monitoramento (Art. 4)</span>
                </a>
                <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors" href="#params">
                  <span className="material-symbols-outlined">settings_suggest</span>
                  <span className="text-sm">Parâmetros de Prazos</span>
                </a>
              </nav>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-3">Logs e Auditoria</h3>
              <nav className="flex flex-col gap-1">
                <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors" href="#emails">
                  <span className="material-symbols-outlined">mail</span>
                  <span className="text-sm">Logs de E-mail</span>
                </a>
                <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors" href="#audit">
                  <span className="material-symbols-outlined">history_edu</span>
                  <span className="text-sm">Auditoria Workflow</span>
                </a>
              </nav>
            </div>
            <div className="mt-auto">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Voltar ao Dashboard
              </Link>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto bg-background-light">
            {children}
            {/* Institutional Footer */}
            <footer className="mt-16 pt-8 border-t border-slate-200 pb-10 px-8">
              <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-2 rounded">
                    <span className="material-symbols-outlined text-primary">location_city</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Prefeitura de Osasco</p>
                    <p className="text-[11px] text-slate-500 uppercase">Secretaria de Planejamento e Gestão</p>
                  </div>
                </div>
                <div className="flex gap-8">
                  <a className="text-xs text-slate-500 hover:text-primary font-medium transition-colors" href="#">Termos de Uso</a>
                  <a className="text-xs text-slate-500 hover:text-primary font-medium transition-colors" href="#">Política de Privacidade</a>
                  <a className="text-xs text-slate-500 hover:text-primary font-medium transition-colors" href="#">Suporte Técnico (TI)</a>
                </div>
                <p className="text-[10px] text-slate-400">© 2025 Osasco Travel Management. Todos os direitos reservados.</p>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}
