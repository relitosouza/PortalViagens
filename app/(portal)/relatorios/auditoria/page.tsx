import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getLogsAcoes, getSolicitacoesPorStatus, getTempoMedioAprovacaoPorEtapa } from '@/lib/reports/queries'
import { prisma } from '@/lib/prisma'

const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDateTime = (d: Date) => new Date(d).toLocaleString('pt-BR')

const ETAPA_LABELS: Record<string, string> = {
  SECRETARIO: 'Gabinete do Secretário',
  COTACAO: 'SECOL — Cotação',
  VIABILIDADE: 'SEGOV — Viabilidade',
  EMISSAO: 'SECOL — Emissão OS',
  EXECUCAO: 'SF — Execução',
}

export default async function AuditoriaPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/relatorios')

  const parametros = await prisma.configuracaoSistema.findMany({
    where: { chave: { in: ['VALOR_EMPENHO_PASSAGEM', 'VALOR_EMPENHO_HOSPEDAGEM'] } }
  })
  const tetoPassagem = parseFloat(parametros.find(p => p.chave === 'VALOR_EMPENHO_PASSAGEM')?.valor ?? '0')
  const tetoHospedagem = parseFloat(parametros.find(p => p.chave === 'VALOR_EMPENHO_HOSPEDAGEM')?.valor ?? '0')

  const [logs, porStatus, tempoMedio] = await Promise.all([
    getLogsAcoes(),
    getSolicitacoesPorStatus(),
    getTempoMedioAprovacaoPorEtapa(),
  ])

  // A2 — aprovações acima do teto orçamentário
  const whereAcimaTeto: {
    etapa: string
    decisao: string
    OR?: Array<{ valorPassagem?: { gt: number }; valorHospedagem?: { gt: number } }>
  } = {
    etapa: 'VIABILIDADE',
    decisao: 'APROVADO',
  }
  const orConditions: Array<{ valorPassagem?: { gt: number }; valorHospedagem?: { gt: number } }> = []
  if (tetoPassagem > 0) orConditions.push({ valorPassagem: { gt: tetoPassagem } })
  if (tetoHospedagem > 0) orConditions.push({ valorHospedagem: { gt: tetoHospedagem } })
  if (orConditions.length > 0) whereAcimaTeto.OR = orConditions

  const acimaDoTeto = orConditions.length > 0
    ? await prisma.workflowStep.findMany({
        where: whereAcimaTeto,
        include: {
          solicitacao: {
            select: { destino: true, nomeCompleto: true, secretaria: { select: { nome: true } } },
          },
        },
      })
    : []

  const atividadePorAtor = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.atorRole] = (acc[l.atorRole] ?? 0) + 1
    return acc
  }, {})

  const total = porStatus.reduce((s, r) => s + r.count, 0)
  const concluidas = porStatus.find(r => r.status === 'CONCLUIDA')?.count ?? 0
  const reprovadas = porStatus.find(r => r.status === 'REPROVADA')?.count ?? 0

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <a href="/relatorios" className="text-slate-400 hover:text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </a>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Auditoria / Compliance</h2>
          <p className="text-slate-500 text-sm mt-0.5">Logs de ações, exceções e análise de gargalos</p>
        </div>
      </div>

      {/* A4 — Funil */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        
        <h3 className="font-bold text-slate-900 mb-4">Funil do Workflow</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Total Criadas', value: total, rose: false, emerald: false },
            { label: 'Concluídas', value: concluidas, rose: false, emerald: true },
            { label: 'Reprovadas', value: reprovadas, rose: true, emerald: false },
          ].map(f => (
            <div key={f.label} className="border border-slate-100 rounded-lg p-4">
              <p className={`text-3xl font-black ${f.rose ? 'text-rose-600' : f.emerald ? 'text-emerald-600' : 'text-slate-900'}`}>
                {f.value}
              </p>
              <p className="text-xs text-slate-500 mt-1">{f.label}</p>
              {total > 0 && <p className="text-xs text-slate-400 mt-0.5">{((f.value / total) * 100).toFixed(1)}%</p>}
            </div>
          ))}
        </div>
      </section>

      {/* A3 — Atividade por perfil */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        
        <h3 className="font-bold text-slate-900 mb-4">Atividade por Perfil</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(atividadePorAtor)
            .sort((a, b) => b[1] - a[1])
            .map(([role, count]) => (
              <div key={role} className="border border-slate-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-black text-slate-900">{count}</p>
                <p className="text-xs text-slate-500 mt-1">{role}</p>
              </div>
            ))}
          {Object.keys(atividadePorAtor).length === 0 && (
            <p className="text-slate-400 text-sm col-span-4 text-center py-4">Nenhuma ação registrada.</p>
          )}
        </div>
      </section>

      {/* A5 — Gargalos */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          
          <h3 className="font-bold text-slate-900">Gargalos por Etapa (Tempo Médio)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Etapa</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Média (dias)</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Classificação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...tempoMedio].sort((a, b) => b.mediaDias - a.mediaDias).map(t => (
                <tr key={t.etapa} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{ETAPA_LABELS[t.etapa] ?? t.etapa}</td>
                  <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">{t.mediaDias}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.mediaDias > 7
                        ? 'bg-rose-100 text-rose-700'
                        : t.mediaDias > 3
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {t.mediaDias > 7 ? 'Gargalo' : t.mediaDias > 3 ? 'Atenção' : 'Normal'}
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

      {/* A2 — Acima do Teto */}
      {acimaDoTeto.length > 0 && (
        <section className="bg-rose-50 border border-rose-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-rose-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-600">gpp_bad</span>
            <div>
              
              <h3 className="font-bold text-rose-900">Aprovações Acima do Teto Orçamentário</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-rose-100/50">
                  <th className="px-5 py-3 text-xs font-bold text-rose-700 uppercase">Servidor</th>
                  <th className="px-5 py-3 text-xs font-bold text-rose-700 uppercase">Destino</th>
                  <th className="px-5 py-3 text-xs font-bold text-rose-700 uppercase text-right">Passagem</th>
                  <th className="px-5 py-3 text-xs font-bold text-rose-700 uppercase text-right">Hospedagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {acimaDoTeto.map(s => (
                  <tr key={s.id} className="hover:bg-rose-100/30">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{s.solicitacao.nomeCompleto}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{s.solicitacao.destino}</td>
                    <td className="px-5 py-3 text-sm font-bold text-rose-700 text-right">{fmtMoeda(s.valorPassagem ?? 0)}</td>
                    <td className="px-5 py-3 text-sm font-bold text-rose-700 text-right">{fmtMoeda(s.valorHospedagem ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* A1 — Log de Ações */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          
          <h3 className="font-bold text-slate-900">Log de Ações (últimas 100)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Data/Hora</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Ator</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Perfil</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Etapa</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Decisão</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Destino</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.slice(0, 100).map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-5 py-3 text-sm text-slate-900">{l.atorNome}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{l.atorRole}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">{ETAPA_LABELS[l.etapa] ?? l.etapa}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      l.decisao === 'APROVADO'
                        ? 'bg-emerald-100 text-emerald-700'
                        : l.decisao === 'REPROVADO'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {l.decisao ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">{l.solicitacao.destino}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">Nenhuma ação registrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
