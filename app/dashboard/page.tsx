import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { handleSignOut } from './actions'
import { AlertasPrestacao } from '@/components/AlertasPrestacao'

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
  RASCUNHO: 'bg-gray-100 text-gray-600',
  AGUARDANDO_COTACAO: 'bg-yellow-100 text-yellow-700',
  AGUARDANDO_VIABILIDADE: 'bg-orange-100 text-orange-700',
  AGUARDANDO_EMISSAO: 'bg-blue-100 text-blue-700',
  AGUARDANDO_EXECUCAO: 'bg-purple-100 text-purple-700',
  CONCLUIDA: 'bg-green-100 text-green-700',
  REPROVADA: 'bg-red-100 text-red-700',
}

const ROLE_LABELS: Record<string, string> = {
  DEMANDANTE: 'Secretaria Demandante',
  SECOL: 'SECOL / DRP',
  SEGOV: 'SEGOV — Gabinete',
  SF: 'Secretaria de Finanças',
}

const ROLE_STATUS_MAP: Record<string, string[]> = {
  DEMANDANTE: ['RASCUNHO', 'AGUARDANDO_COTACAO', 'AGUARDANDO_VIABILIDADE', 'AGUARDANDO_EMISSAO', 'AGUARDANDO_EXECUCAO', 'CONCLUIDA', 'REPROVADA'],
  SECOL: ['AGUARDANDO_COTACAO', 'AGUARDANDO_EMISSAO'],
  SEGOV: ['AGUARDANDO_VIABILIDADE'],
  SF: ['AGUARDANDO_EXECUCAO'],
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user
  const role: string = user.role
  const userId: string = user.id

  const where = role === 'DEMANDANTE'
    ? { userId, status: { in: ROLE_STATUS_MAP[role] } }
    : { status: { in: ROLE_STATUS_MAP[role] ?? [] } }

  const solicitacoes = await prisma.solicitacao.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { name: true } } }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-800 text-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-bold text-lg">Aprovação de Viagens — Osasco</h1>
            <p className="text-blue-200 text-xs">{ROLE_LABELS[role] ?? role} · {session.user?.name}</p>
          </div>
          <form action={handleSignOut}>
            <button type="submit" className="text-blue-200 hover:text-white text-sm transition">
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {role === 'DEMANDANTE' ? 'Minhas Solicitações' : 'Fila de Aprovação'}
          </h2>
          {role === 'DEMANDANTE' && (
            <Link
              href="/solicitacoes/nova"
              className="bg-blue-700 text-white px-5 py-2 rounded-lg hover:bg-blue-800 transition text-sm font-semibold shadow-sm"
            >
              + Nova Solicitação
            </Link>
          )}
        </div>

        {role === 'DEMANDANTE' && <AlertasPrestacao userId={userId} />}

        <div className="space-y-3">
          {solicitacoes.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm">
              <p className="text-lg">Nenhuma solicitação na fila</p>
              {role === 'DEMANDANTE' && (
                <p className="text-sm mt-2">Clique em &quot;+ Nova Solicitação&quot; para começar</p>
              )}
            </div>
          )}
          {solicitacoes.map(s => (
            <Link key={s.id} href={`/solicitacoes/${s.id}`}>
              <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                    {s.nomeCompleto}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {s.destino} · {new Date(s.dataIda).toLocaleDateString('pt-BR')} → {new Date(s.dataVolta).toLocaleDateString('pt-BR')}
                  </p>
                  {role !== 'DEMANDANTE' && (
                    <p className="text-xs text-gray-400 mt-1">Solicitado por: {s.user.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_CORES[s.status] ?? 'bg-gray-100'}`}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  <span className="text-gray-300 group-hover:text-blue-500 transition-colors">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
