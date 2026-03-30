import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSolicitacoesPorStatus, getTempoMedioAprovacaoPorEtapa } from '@/lib/reports/queries'
import { prisma } from '@/lib/prisma'
import { STATUS_LABELS } from '@/lib/reports/constants'

const ETAPA_LABELS: Record<string, string> = {
  SECRETARIO: 'Gabinete do Secretário',
  COTACAO: 'SECOL — Cotação',
  VIABILIDADE: 'SEGOV — Viabilidade',
  EMISSAO: 'SECOL — Emissão OS',
  EXECUCAO: 'SF — Execução',
}

export default async function WorkflowPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = session.user.role as string
  if (!['ADMIN', 'SECRETARIO', 'SECOL', 'SEGOV', 'SF'].includes(role)) redirect('/relatorios')

  const dbUser = role === 'SECRETARIO'
    ? await prisma.user.findUnique({ where: { id: session.user.id as string } })
    : null

  const [porStatus, tempoMedio, rejeitadas, urgencia] = await Promise.all([
    getSolicitacoesPorStatus(dbUser?.secretariaId ?? undefined),
    getTempoMedioAprovacaoPorEtapa(),
    prisma.workflowStep.findMany({
      where: { decisao: 'REPROVADO' },
      include: {
        solicitacao: {
          select: {
            destino: true,
            nomeCompleto: true,
            secretaria: { select: { nome: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.solicitacao.findMany({
      where: {
        status: { notIn: ['CONCLUIDA', 'REPROVADA', 'RASCUNHO'] },
        dataIda: { lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, destino: true, nomeCompleto: true, dataIda: true, status: true },
      orderBy: { dataIda: 'asc' },
    }),
  ])

  const total = porStatus.reduce((s, r) => s + r.count, 0)

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <a href="/relatorios" className="text-slate-400 hover:text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </a>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Workflow / Operacional</h2>
          <p className="text-slate-500 text-sm mt-0.5">Filas, prazos e histórico do fluxo de aprovação</p>
        </div>
      </div>

      {/* W1 — Por Status */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          
          <h3 className="font-bold text-slate-900">Solicitações por Status</h3>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {porStatus.map(r => (
            <div key={r.status} className="border border-slate-100 rounded-lg p-3 text-center">
              <p className="text-2xl font-black text-slate-900">{r.count}</p>
              <p className="text-xs text-slate-500 mt-1">{STATUS_LABELS[r.status] ?? r.status}</p>
              <div className="w-full bg-slate-100 rounded-full h-1 mt-2">
                <div
                  className="bg-indigo-500 h-1 rounded-full"
                  style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
          {porStatus.length === 0 && (
            <p className="text-slate-400 text-sm col-span-4 text-center py-4">Nenhuma solicitação encontrada.</p>
          )}
        </div>
      </section>

      {/* W3 — Tempo Médio */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          
          <h3 className="font-bold text-slate-900">Tempo Médio de Aprovação por Etapa (dias)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Etapa</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Média (dias)</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Indicador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tempoMedio.map(t => (
                <tr key={t.etapa} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{ETAPA_LABELS[t.etapa] ?? t.etapa}</td>
                  <td className="px-5 py-3 text-sm text-right font-bold text-slate-900">{t.mediaDias}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.mediaDias <= 2
                        ? 'bg-emerald-100 text-emerald-700'
                        : t.mediaDias <= 5
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {t.mediaDias <= 2 ? 'Rápido' : t.mediaDias <= 5 ? 'Normal' : 'Lento'}
                    </span>
                  </td>
                </tr>
              ))}
              {tempoMedio.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-400 text-sm">Sem dados de aprovação ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* W4 — Rejeitadas */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          
          <h3 className="font-bold text-slate-900">Solicitações Rejeitadas / Devolvidas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Servidor</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Destino</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Etapa</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rejeitadas.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm text-slate-900">{r.solicitacao.nomeCompleto}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{r.solicitacao.destino}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full">
                      {ETAPA_LABELS[r.etapa] ?? r.etapa}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500 max-w-xs truncate">{r.observacao ?? '—'}</td>
                </tr>
              ))}
              {rejeitadas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">Nenhuma rejeição registrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* W6 — Urgência */}
      {urgencia.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-amber-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">warning</span>
            <div>
              
              <h3 className="font-bold text-amber-900">Solicitações com Urgência (viagem em até 3 dias)</h3>
            </div>
          </div>
          <div className="p-5 space-y-2">
            {urgencia.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-100 px-4 py-2">
                <div>
                  <p className="font-medium text-sm text-slate-900">{u.nomeCompleto} → {u.destino}</p>
                  <p className="text-xs text-slate-500">{STATUS_LABELS[u.status] ?? u.status}</p>
                </div>
                <p className="text-sm font-bold text-amber-700">{new Date(u.dataIda).toLocaleDateString('pt-BR')}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
