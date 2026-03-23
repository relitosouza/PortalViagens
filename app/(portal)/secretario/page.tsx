import React from 'react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = {
  AGUARDANDO_SECRETARIO: 'Aguardando Secretario',
  DEVOLVIDO_SECRETARIO: 'Devolvido - Correcao',
  REPROVADO_SECRETARIO: 'Reprovado',
  AGUARDANDO_COTACAO: 'Cotacao',
  AGUARDANDO_VIABILIDADE: 'Viabilidade',
  AGUARDANDO_EMISSAO: 'Emissao OS',
  AGUARDANDO_EXECUCAO: 'Execucao',
  CONCLUIDA: 'Concluida',
  REPROVADA: 'Reprovada',
}

const STATUS_BADGE: Record<string, string> = {
  AGUARDANDO_SECRETARIO: 'bg-violet-100 text-violet-800',
  DEVOLVIDO_SECRETARIO: 'bg-amber-100 text-amber-800',
  REPROVADO_SECRETARIO: 'bg-rose-100 text-rose-800',
  AGUARDANDO_COTACAO: 'bg-amber-100 text-amber-800',
  AGUARDANDO_VIABILIDADE: 'bg-orange-100 text-orange-800',
  CONCLUIDA: 'bg-emerald-100 text-emerald-800',
  REPROVADA: 'bg-rose-100 text-rose-800',
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default async function SecretarioDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; role: string; secretariaId?: string }

  if (user.role !== 'SECRETARIO' && user.role !== 'ADMIN') {
    redirect('/portal/dashboard')
  }

  const secretariaId = user.secretariaId
  if (!secretariaId && user.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="font-medium">Sua conta nao possui secretaria vinculada. Contate o administrador.</p>
      </div>
    )
  }

  const hoje = new Date()

  const [aguardando, historico, devolvidos] = await Promise.all([
    prisma.solicitacao.findMany({
      where: {
        status: 'AGUARDANDO_SECRETARIO',
        ...(secretariaId ? { user: { secretariaId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true } } },
    }),

    prisma.solicitacao.findMany({
      where: {
        status: { notIn: ['RASCUNHO', 'AGUARDANDO_SECRETARIO', 'DEVOLVIDO_SECRETARIO', 'REPROVADO_SECRETARIO'] },
        ...(secretariaId ? { user: { secretariaId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { name: true } },
        prestacao: { select: { enviadoEm: true, prazoFinal: true } },
      },
    }),

    prisma.solicitacao.findMany({
      where: {
        status: { in: ['DEVOLVIDO_SECRETARIO', 'REPROVADO_SECRETARIO'] },
        ...(secretariaId ? { user: { secretariaId } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { name: true } },
        steps: { where: { etapa: 'SECRETARIO' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
  ])

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <header className="flex items-center gap-4 border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-4 md:-mx-8 px-4 md:px-8 -mt-4 md:-mt-8">
        <h2 className="text-xl font-bold text-slate-900">Painel do Secretario</h2>
        <span className="px-2 py-1 rounded bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-widest">
          SECRETARIO
        </span>
      </header>

      {/* Block 1: Awaiting approval */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-900">Aguardando Aprovacao</h3>
          {aguardando.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-violet-600 text-white text-xs font-bold">{aguardando.length}</span>
          )}
        </div>
        {aguardando.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <span className="material-symbols-outlined text-[40px] mb-2 block">check_circle</span>
            <p>Nenhuma solicitacao aguardando aprovacao</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Funcionario</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Datas</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Solicitado em</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aguardando.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.user.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.destino}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(s.dataIda)} - {formatDate(s.dataVolta)}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{formatDate(s.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/portal/solicitacoes/${s.id}`} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">
                        Analisar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Block 2: History */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="font-bold text-lg text-slate-900">Viagens em Andamento / Historico</h3>
        </div>
        {historico.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Nenhuma viagem no historico</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Funcionario</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Datas</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Prestacao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historico.map(s => {
                  const p = s.prestacao
                  let prestacaoCell: React.ReactNode = <span className="text-slate-300 text-sm">-</span>
                  if (p) {
                    if (p.enviadoEm) {
                      prestacaoCell = <span className="text-emerald-600 text-sm font-medium">Entregue</span>
                    } else if (new Date(p.prazoFinal) < hoje) {
                      prestacaoCell = (
                        <Link href={`/portal/solicitacoes/${s.id}/prestacao`} className="text-red-600 text-sm font-bold hover:underline">
                          Em atraso
                        </Link>
                      )
                    } else {
                      prestacaoCell = (
                        <Link href={`/portal/solicitacoes/${s.id}/prestacao`} className="text-amber-600 text-sm font-medium hover:underline">
                          Pendente
                        </Link>
                      )
                    }
                  }
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50 ${p && !p.enviadoEm && new Date(p.prazoFinal) < hoje ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.user.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{s.destino}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(s.dataIda)} - {formatDate(s.dataVolta)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{prestacaoCell}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Block 3: Devolvidos / Reprovados */}
      {devolvidos.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="font-bold text-lg text-slate-900">Devolvidos / Reprovados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Funcionario</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Motivo</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devolvidos.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.user.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.destino}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">
                      {s.steps[0]?.observacao ?? '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{formatDate(s.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
