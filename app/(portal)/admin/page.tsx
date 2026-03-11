import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import UsuariosSection from './components/UsuariosSection'
import ParametrosSection from './components/ParametrosSection'

type EmailLog = { id: string; para: string; assunto: string; corpo: string; timestamp: string; tipo: string }

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-primary/10 text-primary',
  SECOL: 'bg-green-100 text-green-700',
  SEGOV: 'bg-purple-100 text-purple-700',
  SF: 'bg-orange-100 text-orange-700',
  DEMANDANTE: 'bg-blue-100 text-blue-700',
}

const ETAPA_LABELS: Record<string, string> = {
  COTACAO: 'Cotação',
  VIABILIDADE: 'Análise de Viabilidade',
  EMISSAO: 'Emissão OS',
  EXECUCAO: 'Execução Orçamentária',
}

export default async function AdminPage() {
  // ... (data fetching stays same)
  const [usuarios, cpfsBloqueados, prestacoesPendentes, parametros, workflowSteps, totalSolicitacoes] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, role: true, cpfBloqueado: true, ativo: true, createdAt: true } }),
    prisma.user.findMany({ where: { cpfBloqueado: true }, select: { id: true, name: true, email: true, role: true } }),
    prisma.prestacao.findMany({
      where: { enviadoEm: null, prazoFinal: { lt: new Date() } },
      include: { solicitacao: { select: { nomeCompleto: true, destino: true, dataVolta: true } } },
      orderBy: { prazoFinal: 'asc' },
      take: 10,
    }),
    prisma.configuracaoSistema.findMany({ orderBy: { chave: 'asc' } }),
    prisma.workflowStep.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { solicitacao: { select: { destino: true, nomeCompleto: true } } } }),
    prisma.solicitacao.count(),
  ])

  // Email logs
  const logPath = path.join(process.cwd(), 'email-logs.json')
  let emailLogs: EmailLog[] = []
  try {
    if (fs.existsSync(logPath)) {
      emailLogs = JSON.parse(fs.readFileSync(logPath, 'utf-8')).slice(0, 5)
    }
  } catch { emailLogs = [] }

  const hoje = new Date()
  const totalUsuarios = usuarios.length
  const totalCpfsBloqueados = cpfsBloqueados.length

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-8 px-8 -mt-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 leading-none">Painel de Administração</h2>
          <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest">
            Acesso Restrito
          </span>
        </div>
      </header>

      {/* System Status Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6" id="status">
          <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center gap-4">
            <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined">group</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total de Usuários</p>
              <p className="text-lg font-bold text-slate-900">{totalUsuarios} <span className="text-[10px] font-normal px-2 py-0.5 bg-green-100 text-green-700 rounded-full ml-1 uppercase">Ativos</span></p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center gap-4">
            <div className="size-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <span className="material-symbols-outlined">sync</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">CPFs Bloqueados</p>
              <p className="text-lg font-bold text-slate-900">
                {totalCpfsBloqueados}
                {totalCpfsBloqueados > 0 && (
                  <span className="text-[10px] font-normal px-2 py-0.5 bg-red-100 text-red-700 rounded-full ml-1 uppercase">Crítico</span>
                )}
              </p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center gap-4">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">database</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total de Solicitações</p>
              <p className="text-lg font-bold text-slate-900">{totalSolicitacoes} <span className="text-[10px] font-normal text-slate-400 ml-1">no banco</span></p>
            </div>
          </div>
        </section>

        {/* User Management */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" id="users">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">group</span>
              <h2 className="text-lg font-bold text-slate-900">Gestão de Usuários</h2>
              <span className="text-xs text-slate-400 font-medium">{totalUsuarios} registros</span>
            </div>
          </div>
          <UsuariosSection usuarios={usuarios} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Blocked CPFs Section */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm h-full" id="blocks">
            <div className="px-6 py-5 border-b border-slate-100 bg-red-50/30 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-red-500">warning</span>
                <h2 className="text-lg font-bold text-slate-900">Bloqueios Art. 4</h2>
              </div>
              {totalCpfsBloqueados > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">Crítico</span>
              )}
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-6">
                Servidores bloqueados por pendência na prestação de contas (&gt; 5 dias úteis).
              </p>
              {cpfsBloqueados.length === 0 && prestacoesPendentes.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <span className="material-symbols-outlined text-[36px] block mb-2">check_circle</span>
                  <p className="text-sm">Nenhum bloqueio ativo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prestacoesPendentes.map((p: any) => {
                    const diasAtraso = Math.floor((hoje.getTime() - new Date(p.prazoFinal).getTime()) / 86400000)
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50/20">
                        <div className="flex items-center gap-3">
                          <div className="size-9 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold text-xs uppercase">CPF</div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{p.solicitacao.nomeCompleto}</p>
                            <p className="text-[11px] text-slate-500">{p.solicitacao.destino} | Atraso: {diasAtraso} dia{diasAtraso !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-red-600 font-bold uppercase px-2 py-0.5 bg-red-100 rounded">Bloqueado</span>
                      </div>
                    )
                  })}
                  {cpfsBloqueados.filter((u: any) => !prestacoesPendentes.some((p: any) => p.solicitacao.nomeCompleto === u.name)).map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50/20">
                      <div className="flex items-center gap-3">
                        <div className="size-9 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold text-xs uppercase">CPF</div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-slate-500">{u.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-red-600 font-bold uppercase px-2 py-0.5 bg-red-100 rounded">Bloqueado</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Operational Parameters */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm h-full" id="params">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">calendar_month</span>
                <h2 className="text-lg font-bold text-slate-900">Parâmetros de Prazos</h2>
              </div>
            </div>
            <ParametrosSection parametros={parametros} />
          </section>
        </div>

        {/* Email Logs */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" id="emails">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">mail_lock</span>
              <h2 className="text-lg font-bold text-slate-900">Histórico de Notificações</h2>
            </div>
            <span className="text-xs text-slate-400">{emailLogs.length} recentes</span>
          </div>
          <div className="overflow-x-auto">
            {emailLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <span className="material-symbols-outlined text-[36px] block mb-2">mail_outline</span>
                <p className="text-sm">Nenhum e-mail registrado</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50/30">
                  <tr className="text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100">
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Destinatário</th>
                    <th className="px-6 py-3">Assunto / Tipo</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {emailLogs.map(log => (
                    <tr key={log.id} className="text-sm">
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                        {new Date(log.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">{log.para}</td>
                      <td className="px-6 py-4">
                        <p className="text-slate-900 font-semibold text-sm">{log.assunto}</p>
                        <p className="text-[10px] text-primary uppercase font-bold tracking-tight">{log.tipo}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-green-600 flex items-center gap-1 font-bold text-xs">
                          <span className="material-symbols-outlined text-sm">done_all</span> Registrado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Workflow Audit */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" id="audit">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">analytics</span>
              <h2 className="text-lg font-bold text-slate-900">Auditoria do Workflow</h2>
            </div>
          </div>
          <div className="p-6">
            {workflowSteps.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-[36px] block mb-2">history</span>
                <p className="text-sm">Nenhum evento registrado ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workflowSteps.map((step: any) => (
                  <div key={step.id} className={`p-4 rounded-xl bg-slate-50 border-l-4 ${step.decisao === 'REPROVADO' ? 'border-red-400' : 'border-primary'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs font-bold uppercase ${step.decisao === 'REPROVADO' ? 'text-red-500' : 'text-primary'}`}>
                        {ETAPA_LABELS[step.etapa] ?? step.etapa} — {step.decisao ?? 'Pendente'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{step.atorRole}</span>
                    </div>
                    <p className="text-sm text-slate-700">
                      <strong>{step.atorNome}</strong> processou a viagem para{' '}
                      <strong>{step.solicitacao.destino}</strong>
                      {step.decisao === 'REPROVADO' && step.observacao && ` — Motivo: "${step.observacao}"`}
                    </p>
                    <div className="mt-2 flex items-center gap-4">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        {new Date(step.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

    </div>
  )
}
