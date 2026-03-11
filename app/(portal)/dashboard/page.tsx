import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_COTACAO: 'Aguardando Cotação',
  AGUARDANDO_VIABILIDADE: 'Análise de Viabilidade',
  AGUARDANDO_EMISSAO: 'Aguardando Emissão OS',
  AGUARDANDO_EXECUCAO: 'Execução Orçamentária',
  CONCLUIDA: 'Concluída',
  REPROVADA: 'Reprovada',
}

const STATUS_BADGE: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-800',
  AGUARDANDO_COTACAO: 'bg-amber-100 text-amber-800',
  AGUARDANDO_VIABILIDADE: 'bg-orange-100 text-orange-800',
  AGUARDANDO_EMISSAO: 'bg-blue-100 text-blue-800',
  AGUARDANDO_EXECUCAO: 'bg-purple-100 text-purple-800',
  CONCLUIDA: 'bg-emerald-100 text-emerald-800',
  REPROVADA: 'bg-rose-100 text-rose-800',
}

const ROLE_STATUS_MAP: Record<string, string[]> = {
  DEMANDANTE: ['RASCUNHO', 'AGUARDANDO_COTACAO', 'AGUARDANDO_VIABILIDADE', 'AGUARDANDO_EMISSAO', 'AGUARDANDO_EXECUCAO', 'CONCLUIDA', 'REPROVADA'],
  SECOL: ['AGUARDANDO_COTACAO', 'AGUARDANDO_EMISSAO'],
  SEGOV: ['AGUARDANDO_VIABILIDADE'],
  SF: ['AGUARDANDO_EXECUCAO'],
}

function getStatusActionIcon(status: string): string {
  if (status === 'RASCUNHO') return 'edit'
  if (status === 'REPROVADA') return 'info'
  return 'visibility'
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user
  const role: string = user.role
  const userId: string = user.id

  let where: Record<string, unknown> = {}
  if (role === 'DEMANDANTE') {
    where = { userId, status: { in: ROLE_STATUS_MAP[role] } }
  } else if (role !== 'ADMIN') {
    where = { status: { in: ROLE_STATUS_MAP[role] ?? [] } }
  }

  const solicitacoes = await prisma.solicitacao.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { name: true } } }
  })

  const hoje = new Date()
  const ativas = solicitacoes.filter(s => s.status !== 'CONCLUIDA' && s.status !== 'REPROVADA')
  const proximasViagens = solicitacoes.filter(s => new Date(s.dataIda) > hoje && s.status !== 'REPROVADA')

  let pendentesCount = 0
  let pendentes: { id: string; solicitacaoId: string; prazoFinal: Date; solicitacao: { destino: string } }[] = []

  if (role === 'DEMANDANTE') {
    pendentes = await prisma.prestacao.findMany({
      where: { enviadoEm: null, solicitacao: { userId } },
      include: { solicitacao: { select: { destino: true } } },
      orderBy: { prazoFinal: 'asc' },
    })
    pendentesCount = pendentes.length
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-8 px-8 -mt-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 leading-none">Dashboard Principal</h2>
          <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest">
            {role}
          </span>
        </div>
      </header>
      {/* Alert Banner — pending prestações */}
      {role === 'DEMANDANTE' && pendentesCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 p-2 rounded-full">
              <span className="material-symbols-outlined text-amber-600">warning</span>
            </div>
            <div>
              <h4 className="font-bold text-amber-900">Alerta de Pendência</h4>
              <p className="text-amber-700 text-sm">
                {pendentesCount === 1
                  ? `Você tem 1 prestação de contas pendente${pendentes[0] && ` — ${pendentes[0].solicitacao.destino}`}`
                  : `Você tem ${pendentesCount} prestações de contas pendentes`}
                {pendentes[0] && (() => {
                  const dias = Math.ceil((new Date(pendentes[0].prazoFinal).getTime() - hoje.getTime()) / 86400000)
                  return dias <= 0 ? ' (Prazo vencido!)' : ` (Prazo: ${dias} dia${dias === 1 ? '' : 's'})`
                })()}
              </p>
            </div>
          </div>
          <Link
            href={`/solicitacoes/${pendentes[0]?.solicitacaoId}/prestacao`}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            Ver Pendência
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-600/10 rounded-lg">
              <span className="material-symbols-outlined text-blue-600 text-[24px]">pending_actions</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            {role === 'DEMANDANTE' ? 'Solicitações Ativas' : 'Na Fila de Aprovação'}
          </p>
          <p className="text-3xl font-bold mt-1 text-slate-900">{ativas.length}</p>
        </div>

        {role === 'DEMANDANTE' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-rose-100 rounded-lg">
                <span className="material-symbols-outlined text-rose-600 text-[24px]">assignment_late</span>
              </div>
            </div>
            <p className="text-slate-500 text-sm font-medium">Aguardando Prestação</p>
            <p className="text-3xl font-bold mt-1 text-slate-900">{pendentesCount}</p>
          </div>
        )}

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <span className="material-symbols-outlined text-indigo-600 text-[24px]">calendar_month</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">Próximas Viagens</p>
          <p className="text-3xl font-bold mt-1 text-slate-900">{proximasViagens.length}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <span className="material-symbols-outlined text-emerald-600 text-[24px]">check_circle</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">Concluídas</p>
          <p className="text-3xl font-bold mt-1 text-slate-900">
            {solicitacoes.filter(s => s.status === 'CONCLUIDA').length}
          </p>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-900">
            {role === 'DEMANDANTE' ? 'Minhas Solicitações' : 'Fila de Aprovação'}
          </h3>
        </div>

        {solicitacoes.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <span className="material-symbols-outlined text-[48px] mb-3 block">inbox</span>
            <p className="text-lg font-medium">Nenhuma solicitação na fila</p>
            {role === 'DEMANDANTE' && (
              <p className="text-sm mt-1">Clique em &quot;+ Nova Viagem&quot; para começar</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Solicitante</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {solicitacoes.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.user.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-slate-400">location_on</span>
                        <span className="text-sm text-slate-600">{s.destino}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(s.dataIda).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      {' — '}
                      {new Date(s.dataVolta).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.status] ?? 'bg-slate-100 text-slate-800'}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/solicitacoes/${s.id}`} className="text-slate-400 hover:text-blue-600 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">{getStatusActionIcon(s.status)}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Action Cards */}
      {role === 'DEMANDANTE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          <Link
            href="/solicitacoes/nova"
            className="p-6 bg-blue-600/5 rounded-xl border border-blue-600/10 flex items-center justify-between group cursor-pointer hover:border-blue-600/30 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md">
                <span className="material-symbols-outlined">add_circle</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Nova Solicitação</h4>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Iniciar processo de viagem</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-blue-600 group-hover:translate-x-1 transition-transform">chevron_right</span>
          </Link>

          <Link
            href={pendentes[0] ? `/solicitacoes/${pendentes[0].solicitacaoId}/prestacao` : '#'}
            className="p-6 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between group cursor-pointer hover:bg-slate-800 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-white shadow-md">
                <span className="material-symbols-outlined">receipt_long</span>
              </div>
              <div>
                <h4 className="font-bold text-white">Prestação de Contas</h4>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Anexar comprovantes e relatórios</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-white group-hover:translate-x-1 transition-transform">chevron_right</span>
          </Link>
        </div>
      )}
    </div>
  )
}
