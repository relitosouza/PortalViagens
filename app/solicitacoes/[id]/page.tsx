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

  // DEMANDANTE só pode ver suas próprias solicitações
  if (role === 'DEMANDANTE' && sol.userId !== userId) notFound()

  // SEGOV viabilidade — layout dedicado
  if (role === 'SEGOV' && sol.status === 'AGUARDANDO_VIABILIDADE') {
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
      />
    )
  }

  // SF execução orçamentária — layout dedicado
  if (role === 'SF' && sol.status === 'AGUARDANDO_EXECUCAO') {
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
      />
    )
  }

  // SECOL emissão OS — layout dedicado
  if (role === 'SECOL' && sol.status === 'AGUARDANDO_EMISSAO') {
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

  // SECOL cotação — layout dedicado
  if (role === 'SECOL' && sol.status === 'AGUARDANDO_COTACAO') {
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
      />
    )
  }

  const statusCor = STATUS_CORES[sol.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-800 text-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-blue-200 hover:text-white text-sm transition-colors">
            ← Voltar
          </Link>
          <h1 className="font-bold">Solicitação de Viagem</h1>
          <span className={`ml-auto text-xs px-3 py-1 rounded-full font-medium ${statusCor}`}>
            {STATUS_LABELS[sol.status] ?? sol.status}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-5">
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

        {/* Prestação de Contas — para DEMANDANTE após conclusão */}
        {sol.status === 'CONCLUIDA' && role === 'DEMANDANTE' && (
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
    </div>
  )
}
