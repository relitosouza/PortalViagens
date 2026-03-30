import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPrestacoesPendentes, getPrestacoesEmAtraso } from '@/lib/reports/queries'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

const fmtData = (d: Date) => new Date(d).toLocaleDateString('pt-BR')

function diasRestantes(prazo: Date) {
  return Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000)
}

export default async function PrestacaoRelatorioPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = session.user.role as string
  if (!['ADMIN', 'SECRETARIO', 'SF', 'DEMANDANTE'].includes(role)) redirect('/relatorios')

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id as string } })

  const userId = role === 'DEMANDANTE' ? session.user.id as string : undefined
  const secretariaId = role === 'SECRETARIO' ? dbUser?.secretariaId ?? undefined : undefined

  const pendentes = await getPrestacoesPendentes(userId, secretariaId)
  const atrasadas = role !== 'DEMANDANTE' ? await getPrestacoesEmAtraso() : []
  const vencendo = pendentes.filter(x => {
    const dias = diasRestantes(x.prazoFinal)
    return dias >= 0 && dias <= 10
  })

  const totalEnviadas = await prisma.prestacao.count({
    where: {
      enviadoEm: { not: null },
      ...(userId ? { solicitacao: { userId } } : {}),
      ...(secretariaId ? { solicitacao: { secretariaId } } : {}),
    },
  })

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <a href="/relatorios" className="text-slate-400 hover:text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </a>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Prestação de Contas</h2>
          <p className="text-slate-500 text-sm mt-0.5">Monitoramento de prazos e comprovações</p>
        </div>
      </div>

      {/* P3 — Resumo por Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Pendentes', value: pendentes.length, icon: 'pending', alerta: pendentes.length > 0, color: 'amber' },
          { label: 'Em Atraso', value: atrasadas.length, icon: 'assignment_late', alerta: atrasadas.length > 0, color: 'rose' },
          { label: 'Enviadas', value: totalEnviadas, icon: 'task_alt', alerta: false, color: 'emerald' },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-xl border ${k.alerta ? 'border-rose-200' : 'border-slate-200'} shadow-sm p-5`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`material-symbols-outlined text-[24px] text-${k.color}-600`}>{k.icon}</span>
              <p className="text-slate-500 text-sm font-medium">{k.label}</p>
            </div>
            <p className={`text-3xl font-black ${k.alerta ? 'text-rose-600' : 'text-slate-900'}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* P5 — Vencimento Próximo */}
      {vencendo.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-amber-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">timer</span>
            <div>
              <span className="text-xs font-black text-amber-700 uppercase tracking-wider">P5</span>
              <h3 className="font-bold text-amber-900">Vencendo em até 10 dias</h3>
            </div>
          </div>
          <div className="p-5 space-y-2">
            {vencendo.map(p => {
              const dias = diasRestantes(p.prazoFinal)
              return (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-100 px-4 py-2">
                  <div>
                    <p className="font-medium text-sm text-slate-900">{p.solicitacao.nomeCompleto} → {p.solicitacao.destino}</p>
                    <p className="text-xs text-slate-500">{p.solicitacao.secretaria?.nome ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${dias <= 3 ? 'text-rose-600' : 'text-amber-700'}`}>
                      {dias === 0 ? 'Vence hoje' : `${dias} dia${dias !== 1 ? 's' : ''}`}
                    </p>
                    <p className="text-xs text-slate-400">{fmtData(p.prazoFinal)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* P1 — Em Atraso */}
      {role !== 'DEMANDANTE' && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500 text-[20px]">assignment_late</span>
            <div>
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider">P1</span>
              <h3 className="font-bold text-slate-900">Prestações em Atraso</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Servidor</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Destino</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Secretaria</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Prazo Vencido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {atrasadas.map(p => (
                  <tr key={p.id} className="hover:bg-rose-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{p.solicitacao.nomeCompleto}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{p.solicitacao.destino}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{p.solicitacao.secretaria?.nome ?? '—'}</td>
                    <td className="px-5 py-3 text-sm font-bold text-rose-600 text-right">{fmtData(p.prazoFinal)}</td>
                  </tr>
                ))}
                {atrasadas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">Nenhuma prestação em atraso.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* P2 — Pendentes */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-amber-600 uppercase tracking-wider">P2</span>
          <h3 className="font-bold text-slate-900">Prestações Pendentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Servidor</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Destino</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Prazo Final</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Dias Restantes</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendentes.map(p => {
                const dias = diasRestantes(p.prazoFinal)
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{p.solicitacao.nomeCompleto}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{p.solicitacao.destino}</td>
                    <td className="px-5 py-3 text-sm text-slate-600 text-right">{fmtData(p.prazoFinal)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        dias < 0
                          ? 'bg-rose-100 text-rose-700'
                          : dias <= 5
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {dias < 0 ? `${Math.abs(dias)}d atrasado` : `${dias}d`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/solicitacoes/${p.solicitacaoId}/prestacao`} className="text-blue-600 hover:underline text-xs font-medium">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {pendentes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">Nenhuma prestação pendente.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
