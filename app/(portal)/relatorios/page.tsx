import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ROLES_RELATORIOS } from '@/lib/reports/constants'

const CATEGORIAS = [
  {
    slug: 'financeiro',
    label: 'Financeiro / Orçamentário',
    icon: 'payments',
    color: 'blue',
    descricao: 'Gastos por secretaria, orçado vs executado, ficha orçamentária',
    relatorios: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'],
  },
  {
    slug: 'workflow',
    label: 'Workflow / Operacional',
    icon: 'account_tree',
    color: 'indigo',
    descricao: 'Filas, SLA, rejeições, histórico de etapas',
    relatorios: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
  },
  {
    slug: 'servidores',
    label: 'Servidores / Viajantes',
    icon: 'group',
    color: 'violet',
    descricao: 'Ranking de viajantes, destinos, CPFs bloqueados',
    relatorios: ['S1', 'S2', 'S3', 'S4', 'S5'],
  },
  {
    slug: 'prestacao',
    label: 'Prestação de Contas',
    icon: 'receipt_long',
    color: 'amber',
    descricao: 'Prestações em atraso, pendentes, vencimento próximo',
    relatorios: ['P1', 'P2', 'P3', 'P4', 'P5'],
  },
  {
    slug: 'auditoria',
    label: 'Auditoria / Compliance',
    icon: 'policy',
    color: 'rose',
    descricao: 'Logs de ações, exceções orçamentárias, gargalos',
    relatorios: ['A1', 'A2', 'A3', 'A4', 'A5'],
  },
]

const COLOR_MAP: Record<string, { bg: string; icon: string; badge: string }> = {
  blue: { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  indigo: { bg: 'bg-indigo-50 border-indigo-200', icon: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
  violet: { bg: 'bg-violet-50 border-violet-200', icon: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
  amber: { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  rose: { bg: 'bg-rose-50 border-rose-200', icon: 'text-rose-600', badge: 'bg-rose-100 text-rose-700' },
}

export default async function RelatoriosPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = session.user.role as string

  const categoriasVisiveis = CATEGORIAS.filter(c =>
    ROLES_RELATORIOS[c.slug]?.includes(role)
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Relatórios</h2>
        <p className="text-slate-500 text-sm mt-1">Selecione uma categoria para acessar os relatórios disponíveis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoriasVisiveis.map(cat => {
          const colors = COLOR_MAP[cat.color]
          return (
            <Link
              key={cat.slug}
              href={`/relatorios/${cat.slug}`}
              className={`p-5 rounded-xl border ${colors.bg} hover:shadow-md transition-all group`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className={`material-symbols-outlined text-[28px] ${colors.icon}`}>{cat.icon}</span>
                <h3 className="font-bold text-slate-900 text-sm">{cat.label}</h3>
              </div>
              <p className="text-xs text-slate-600">{cat.descricao}</p>
            </Link>
          )
        })}
      </div>

      {categoriasVisiveis.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <span className="material-symbols-outlined text-[48px] block mb-2">bar_chart</span>
          <p>Nenhum relatório disponível para o seu perfil.</p>
        </div>
      )}
    </div>
  )
}
