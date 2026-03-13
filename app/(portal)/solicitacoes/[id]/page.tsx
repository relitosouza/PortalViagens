import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { WorkflowTimeline } from '@/components/WorkflowTimeline'
import { AcoesWorkflow } from '@/components/AcoesWorkflow'
import { SecolCotacaoClient } from '@/components/SecolCotacaoClient'
import { SegovViabilidadeClient } from '@/components/SegovViabilidadeClient'
import { SecolEmissaoClient } from '@/components/SecolEmissaoClient'
import { SfExecucaoClient } from '@/components/SfExecucaoClient'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_COTACAO: 'Aguardando Cotação',
  AGUARDANDO_VIABILIDADE: 'Análise de Viabilidade',
  AGUARDANDO_EMISSAO: 'Aguardando Emissão OS',
  AGUARDANDO_EXECUCAO: 'Execução Orçamentária',
  CONCLUIDA: 'Concluída',
  REPROVADA: 'Reprovada',
}

const STATUS_CORES: Record<string, string> = {
  AGUARDANDO_COTACAO: 'bg-yellow-100 text-yellow-700',
  AGUARDANDO_VIABILIDADE: 'bg-orange-100 text-orange-700',
  AGUARDANDO_EMISSAO: 'bg-blue-100 text-blue-700',
  AGUARDANDO_EXECUCAO: 'bg-purple-100 text-purple-700',
  CONCLUIDA: 'bg-green-100 text-green-700',
  REPROVADA: 'bg-red-100 text-red-700',
}

import { SolicitacaoFormClient } from '@/components/SolicitacaoFormClient'

export default async function DetalheSolicitacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id } = await params
  const role: string = session.user.role
  const userId: string = session.user.id

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      steps: { orderBy: { createdAt: 'asc' } },
      anexos: { orderBy: { createdAt: 'asc' } },
      prestacao: { include: { anexos: true } },
    },
  })

  if (!sol) notFound()
  
  // Buscar parâmetros de empenho para alertar SegoV, Secol e Finanças
  const budgetParams = await prisma.configuracaoSistema.findMany({
    where: { chave: { in: ['NUMERO_EMPENHO', 'VALOR_EMPENHO', 'SALDO_EMPENHO'] } }
  })
  
  const budgetData = {
    numeroEmpenho: budgetParams.find(p => p.chave === 'NUMERO_EMPENHO')?.valor,
    valorEmpenho: budgetParams.find(p => p.chave === 'VALOR_EMPENHO')?.valor,
    saldoEmpenho: budgetParams.find(p => p.chave === 'SALDO_EMPENHO')?.valor,
  }

  // DEMANDANTE só pode ver suas próprias solicitações
  if (role === 'DEMANDANTE' && sol.userId !== userId) notFound()

  // DEMANDANTE em RASCUNHO — formulário de edição
  if (sol.status === 'RASCUNHO' && (role === 'DEMANDANTE' || role === 'ADMIN')) {
    return (
      <div className="p-8">
        <SolicitacaoFormClient 
          userName={session.user.name ?? ''}
          initialData={{
            id: sol.id,
            nomeCompleto: sol.nomeCompleto,
            matricula: sol.matricula,
            cpf: sol.cpf,
            dataNascimento: sol.dataNascimento.toISOString().split('T')[0],
            celular: sol.celular,
            emailServidor: sol.emailServidor,
            justificativaPublica: sol.justificativaPublica,
            nexoCargo: sol.nexoCargo,
            destino: sol.destino,
            dataIda: sol.dataIda.toISOString().split('T')[0],
            dataVolta: sol.dataVolta.toISOString().split('T')[0],
            justificativaLocal: sol.justificativaLocal,
            fichaOrcamentaria: sol.fichaOrcamentaria,
            indicacaoVoo: sol.indicacaoVoo ?? '',
            indicacaoHospedagem: sol.indicacaoHospedagem ?? '',
          }}
        />
      </div>
    )
  }

  // SEGOV viabilidade — layout dedicado (ADMIN também acessa)
  if ((role === 'SEGOV' || role === 'ADMIN') && sol.status === 'AGUARDANDO_VIABILIDADE') {
    return (
      <SegovViabilidadeClient
        sol={{
          id: sol.id,
          nomeCompleto: sol.nomeCompleto,
          destino: sol.destino,
          dataIda: sol.dataIda.toISOString(),
          dataVolta: sol.dataVolta.toISOString(),
          justificativaPublica: sol.justificativaPublica,
          nexoCargo: sol.nexoCargo,
          fichaOrcamentaria: sol.fichaOrcamentaria,
          user: { name: sol.user.name ?? '' },
          steps: sol.steps.map(s => ({
            id: s.id,
            etapa: s.etapa,
            atorNome: s.atorNome,
            decisao: s.decisao,
            observacao: s.observacao,
            createdAt: s.createdAt.toISOString(),
          })),
        }}
        userName={session.user.name ?? 'SEGOV'}
        budgetData={budgetData}
      />
    )
  }

  // SF execução orçamentária — layout dedicado (ADMIN também acessa)
  if ((role === 'SF' || role === 'ADMIN') && sol.status === 'AGUARDANDO_EXECUCAO') {
    return (
      <SfExecucaoClient
        sol={{
          id: sol.id,
          nomeCompleto: sol.nomeCompleto,
          cpf: sol.cpf,
          destino: sol.destino,
          dataIda: sol.dataIda.toISOString(),
          dataVolta: sol.dataVolta.toISOString(),
          fichaOrcamentaria: sol.fichaOrcamentaria,
          user: { name: sol.user.name ?? '' },
          steps: sol.steps.map(s => ({
            etapa: s.etapa,
            atorNome: s.atorNome,
            decisao: s.decisao,
            createdAt: s.createdAt.toISOString(),
          })),
        }}
        userName={session.user.name ?? 'SF'}
        budgetData={budgetData}
      />
    )
  }

  // SECOL emissão OS — layout dedicado (ADMIN também acessa)
  if ((role === 'SECOL' || role === 'ADMIN') && sol.status === 'AGUARDANDO_EMISSAO') {
    return (
      <SecolEmissaoClient
        sol={{
          id: sol.id,
          nomeCompleto: sol.nomeCompleto,
          destino: sol.destino,
          dataIda: sol.dataIda.toISOString(),
          dataVolta: sol.dataVolta.toISOString(),
          fichaOrcamentaria: sol.fichaOrcamentaria,
          emailServidor: sol.emailServidor,
          user: { name: sol.user.name ?? '' },
          steps: sol.steps.map(s => ({
            etapa: s.etapa,
            atorNome: s.atorNome,
            decisao: s.decisao,
            observacao: s.observacao,
            createdAt: s.createdAt.toISOString(),
          })),
        }}
        userName={session.user.name ?? 'SECOL'}
      />
    )
  }

  // SECOL cotação — layout dedicado (ADMIN também acessa)
  if ((role === 'SECOL' || role === 'ADMIN') && sol.status === 'AGUARDANDO_COTACAO') {
    const cotacaoAnterior = sol.steps.find(s => s.etapa === 'COTACAO')
    return (
      <SecolCotacaoClient
        sol={{
          id: sol.id,
          nomeCompleto: sol.nomeCompleto,
          destino: sol.destino,
          dataIda: sol.dataIda.toISOString(),
          dataVolta: sol.dataVolta.toISOString(),
          justificativaPublica: sol.justificativaPublica,
          nexoCargo: sol.nexoCargo,
          indicacaoVoo: sol.indicacaoVoo,
          indicacaoHospedagem: sol.indicacaoHospedagem,
          user: { name: sol.user.name ?? '' },
        }}
        userName={session.user.name ?? 'SECOL'}
        initialQuotes={cotacaoAnterior?.observacao}
        budgetData={budgetData}
      />
    )
  }

  const statusCor = STATUS_CORES[sol.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <main className="p-8 space-y-6 max-w-4xl mx-auto w-full">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-8 px-8 -mt-8">
        <div className="flex flex-col">
          <nav className="flex items-center gap-2 text-[10px] text-slate-500 mb-0.5 uppercase tracking-tighter">
            <Link href="/dashboard" className="hover:text-blue-600 transition-colors">Processos</Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-slate-900 font-bold">Protocolo #{sol.id.slice(-8).toUpperCase()}</span>
          </nav>
          <h2 className="text-xl font-bold text-slate-900 leading-none">Detalhes da Solicitação</h2>
        </div>
        <div className={`px-2 py-1 rounded border font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 ${statusCor}`}>
          <span className="material-symbols-outlined text-[14px]">info</span>
          {STATUS_LABELS[sol.status] ?? sol.status}
        </div>
      </header>
        {/* Dados do Servidor */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 border-b pb-2 mb-4">Dados do Servidor</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <span className="text-gray-500 block text-xs">Nome Completo</span>
              <span className="font-medium text-gray-800">{sol.nomeCompleto}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Matrícula</span>
              <span className="font-medium text-gray-800">{sol.matricula}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">CPF</span>
              <span className="font-medium text-gray-800">{sol.cpf}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Celular</span>
              <span className="font-medium text-gray-800">{sol.celular}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 block text-xs">E-mail</span>
              <span className="font-medium text-gray-800">{sol.emailServidor}</span>
            </div>
          </div>
        </section>

        {/* A Missão */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 border-b pb-2 mb-4">A Missão</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500 block text-xs mb-1">Justificativa do Interesse Público</span>
              <p className="text-gray-800 bg-gray-50 rounded-lg p-3 leading-relaxed">{sol.justificativaPublica}</p>
            </div>
            <div>
              <span className="text-gray-500 block text-xs mb-1">Nexo com o Cargo</span>
              <p className="text-gray-800 bg-gray-50 rounded-lg p-3 leading-relaxed">{sol.nexoCargo}</p>
            </div>
          </div>
        </section>

        {/* Logística */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 border-b pb-2 mb-4">Logística</h2>
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <span className="text-gray-500 block text-xs">Destino</span>
              <span className="font-semibold text-gray-800">{sol.destino}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Data de Ida</span>
              <span className="font-medium text-gray-800">
                {new Date(sol.dataIda).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Data de Volta</span>
              <span className="font-medium text-gray-800">
                {new Date(sol.dataVolta).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500 block text-xs mb-1">Justificativa de Localização</span>
              <p className="text-gray-800 bg-gray-50 rounded-lg p-3">{sol.justificativaLocal}</p>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Ficha Orçamentária</span>
              <span className="font-mono text-gray-800 bg-gray-100 rounded px-2 py-0.5 text-xs">
                {sol.fichaOrcamentaria}
              </span>
            </div>
          </div>
        </section>

        {/* Documentos Anexados */}
        {sol.anexos.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-700 border-b pb-2 mb-4">Documentos Anexados</h2>
            <div className="space-y-2">
              {sol.anexos.map(a => (
                <a
                  key={a.id}
                  href={`/api/files/${a.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg p-2 transition-colors"
                >
                  <span className="text-lg">📎</span>
                  <span className="flex-1 truncate">{a.nome}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{a.tipo}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Fluxo de Aprovação */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 border-b pb-2 mb-4">Fluxo de Aprovação</h2>
          <WorkflowTimeline status={sol.status} steps={sol.steps} />
        </section>

        <AcoesWorkflow solicitacaoId={sol.id} status={sol.status} userRole={role} />

        {/* Prestação de Contas — para DEMANDANTE ou ADMIN após conclusão */}
        {sol.status === 'CONCLUIDA' && (role === 'DEMANDANTE' || role === 'ADMIN') && (
          <section className={`rounded-2xl p-6 border-2 ${sol.prestacao?.enviadoEm ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-300'}`}>
            <h2 className="font-semibold text-amber-800 mb-3">Prestação de Contas — Art. 4º</h2>
            {sol.prestacao?.enviadoEm ? (
              <div className="flex items-center gap-2 text-green-700">
                <span className="text-xl">✅</span>
                <span className="text-sm font-medium">
                  Enviada em {new Date(sol.prestacao.enviadoEm).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ) : (
              <div>
                <p className="text-amber-700 text-sm mb-4">
                  Prazo: <strong>
                    {sol.prestacao?.prazoFinal
                      ? new Date(sol.prestacao.prazoFinal).toLocaleDateString('pt-BR')
                      : 'A definir'}
                  </strong> (5 dias úteis após retorno)
                </p>
                <Link
                  href={`/solicitacoes/${sol.id}/prestacao`}
                  className="bg-amber-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-amber-700 transition font-semibold"
                >
                  Enviar Prestação de Contas →
                </Link>
              </div>
            )}
          </section>
        )}

        {/* Solicitação criada por */}
        <p className="text-xs text-gray-400 text-center">
          Solicitação criada em {new Date(sol.createdAt).toLocaleDateString('pt-BR')} por {sol.user.name}
        </p>
      </main>
  )
}
