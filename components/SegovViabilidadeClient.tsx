'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type WorkflowStep = {
  id: string
  etapa: string
  atorNome: string
  decisao: string | null
  observacao: string | null
  createdAt: string
}

type Solicitacao = {
  id: string
  nomeCompleto: string
  destino: string
  dataIda: string
  dataVolta: string
  justificativaPublica: string
  nexoCargo: string
  fichaOrcamentaria: string
  user: { name: string }
  steps: WorkflowStep[]
}

type Props = {
  sol: Solicitacao
  userName: string
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function calcularNoites(dataIda: string, dataVolta: string): number {
  const d1 = new Date(dataIda)
  const d2 = new Date(dataVolta)
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000))
}

export function SegovViabilidadeClient({ sol, userName }: Props) {
  const router = useRouter()
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const cotacaoStep = sol.steps.find(s => s.etapa === 'COTACAO')
  const noites = calcularNoites(sol.dataIda, sol.dataVolta)
  const dias = noites + 1

  async function executar(decisao: string) {
    if (!observacao.trim() && decisao === 'REPROVADO') {
      setErro('Informe o motivo no campo de parecer antes de reprovar.')
      return
    }
    setLoading(decisao)
    setErro('')
    try {
      const res = await fetch(`/api/workflow/${sol.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, observacao }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao processar')
        setLoading(null)
        return
      }
      router.push('/dashboard')
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setLoading(null)
    }
  }

  const TIMELINE = [
    { etapa: 'COTACAO', label: 'Cotação Técnica (SECOL)' },
    { etapa: 'VIABILIDADE', label: 'Análise de Viabilidade (SEGOV)' },
    { etapa: 'EMISSAO', label: 'Emissão de OS e Vouchers' },
    { etapa: 'EXECUCAO', label: 'Execução Orçamentária (SF)' },
  ]

  return (
    <div className="flex min-h-screen bg-[#f6f6f8]">

      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col fixed h-full z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-blue-600 size-10 rounded-lg flex items-center justify-center text-white">
            <span className="material-symbols-outlined">account_balance</span>
          </div>
          <div>
            <h1 className="text-slate-900 font-bold text-sm leading-tight">Portal de Gestão</h1>
            <p className="text-blue-600 text-xs font-medium">SEGOV - Osasco</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <span className="material-symbols-outlined">description</span>
            <span className="text-sm font-medium">Solicitação</span>
          </Link>
          <a className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors" href="#">
            <span className="material-symbols-outlined">calculate</span>
            <span className="text-sm font-medium">Cotação</span>
          </a>
          <a className="flex items-center gap-3 px-3 py-2 bg-blue-600/10 text-blue-600 rounded-lg" href="#">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="text-sm font-semibold">Viabilidade</span>
          </a>
          <a className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors" href="#">
            <span className="material-symbols-outlined">verified_user</span>
            <span className="text-sm font-medium">Formalização</span>
          </a>
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-1">
          <a className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors" href="#">
            <span className="material-symbols-outlined">settings</span>
            <span className="text-sm font-medium">Configurações</span>
          </a>
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <span className="material-symbols-outlined">logout</span>
            <span className="text-sm font-medium">Sair</span>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-72 flex-1 flex flex-col">

        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-900">Análise de Viabilidade</h2>
            <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
              Aguardando SEGOV
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{userName}</p>
              <p className="text-xs text-slate-500">Gabinete do Secretário</p>
            </div>
            <div className="size-10 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600">person</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8 space-y-6 max-w-6xl">

          {/* Breadcrumb & Title */}
          <div className="space-y-2">
            <nav className="flex text-sm text-slate-500 gap-2">
              <Link href="/dashboard" className="hover:text-blue-600">Gestão de Viagens</Link>
              <span>/</span>
              <span>Protocolo #{sol.id.slice(-8).toUpperCase()}</span>
              <span>/</span>
              <span className="text-blue-600 font-medium">Análise SEGOV</span>
            </nav>
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Etapa 2: Avaliação Política e Financeira</h3>
                <p className="text-slate-500 mt-1">Decisão baseada em Conveniência e Oportunidade do interesse público.</p>
              </div>
              <div className="bg-blue-600/5 border border-blue-600/20 p-4 rounded-xl flex items-center gap-4">
                <div className="bg-blue-600 size-10 rounded-lg flex items-center justify-center text-white">
                  <span className="material-symbols-outlined">payments</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Duração da Missão</p>
                  <p className="text-2xl font-black text-blue-600 leading-none">{dias} dia{dias !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-slate-500">{noites} noite{noites !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">

            {/* Left Column */}
            <div className="col-span-12 lg:col-span-8 space-y-6">

              {/* Request Summary */}
              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                  <h4 className="font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">info</span>
                    Resumo da Solicitação
                  </h4>
                  <span className="text-xs font-mono text-slate-500">#{sol.id.slice(-8).toUpperCase()}</span>
                </div>
                <div className="p-6 grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Solicitante</p>
                    <p className="text-sm font-semibold">{sol.nomeCompleto}</p>
                    <p className="text-xs text-slate-500">{sol.user.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Destino</p>
                    <p className="text-sm font-semibold">{sol.destino}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Período</p>
                    <p className="text-sm font-semibold">{formatarData(sol.dataIda)} a {formatarData(sol.dataVolta)}</p>
                    <p className="text-xs text-slate-500">{dias} dia{dias !== 1 ? 's' : ''} / {noites} noite{noites !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </section>

              {/* Fundamentação */}
              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h4 className="font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">psychology</span>
                    Fundamentação do Demandante
                  </h4>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Justificativa do Interesse Público</p>
                    <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                      {sol.justificativaPublica}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Nexo com o Cargo / Atribuições</p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {sol.nexoCargo}
                    </p>
                  </div>
                </div>
              </section>

              {/* Decision Panel */}
              <section className="bg-white rounded-xl border-2 border-blue-600/20 shadow-xl shadow-blue-600/5 overflow-hidden">
                <div className="px-6 py-4 bg-blue-600 text-white">
                  <h4 className="font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined">gavel</span>
                    Painel de Decisão SEGOV
                  </h4>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Parecer da SEGOV (Observações Oficiais)
                    </label>
                    <textarea
                      className="w-full rounded-lg border-slate-200 text-sm focus:border-blue-600 focus:ring-blue-600 bg-slate-50"
                      rows={4}
                      placeholder="Descreva aqui os motivos da aprovação, reprovação ou necessidade de ajustes..."
                      value={observacao}
                      onChange={e => setObservacao(e.target.value)}
                    />
                  </div>

                  {erro && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex gap-2">
                      <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
                      {erro}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 pt-2">
                    <button
                      onClick={() => executar('APROVADO')}
                      disabled={loading !== null}
                      className="flex-1 min-w-[160px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">check_circle</span>
                      {loading === 'APROVADO' ? 'Aprovando...' : 'Aprovar Solicitação'}
                    </button>
                    <button
                      onClick={() => executar('REPROVADO')}
                      disabled={loading !== null}
                      className="flex-1 min-w-[160px] bg-white border border-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">edit_note</span>
                      {loading === 'REPROVADO' ? 'Processando...' : 'Solicitar Ajustes'}
                    </button>
                    <button
                      onClick={() => executar('REPROVADO')}
                      disabled={loading !== null}
                      className="flex-1 min-w-[160px] bg-white border-2 border-red-500 text-red-600 font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">cancel</span>
                      Reprovar
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column */}
            <div className="col-span-12 lg:col-span-4 space-y-6">

              {/* Cotação da SECOL */}
              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h4 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wide">
                    <span className="material-symbols-outlined text-blue-600 text-lg">receipt_long</span>
                    Cotação Técnica (SECOL)
                  </h4>
                </div>
                <div className="p-6">
                  {cotacaoStep?.observacao ? (
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100 font-sans">
                      {cotacaoStep.observacao}
                    </pre>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Nenhuma observação registrada pela SECOL.</p>
                  )}
                </div>
              </section>

              {/* Budget */}
              <section className="bg-slate-900 text-white rounded-xl border border-slate-800 p-6 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-base">account_balance_wallet</span>
                  Ficha Orçamentária
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Ficha / Dotação</span>
                    <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-white">{sol.fichaOrcamentaria}</span>
                  </div>
                  <div className="h-px bg-slate-800" />
                  <p className="text-[10px] text-slate-500 italic text-center">
                    Verificar saldo junto à Secretaria de Finanças
                  </p>
                </div>
              </section>

              {/* Workflow History */}
              <section className="p-4 bg-white rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-4">Fluxo do Processo</h4>
                <div className="space-y-4 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                  {TIMELINE.map(({ etapa, label }) => {
                    const step = sol.steps.find(s => s.etapa === etapa)
                    const done = step?.decisao === 'APROVADO'
                    const isCurrent = etapa === 'VIABILIDADE'
                    return (
                      <div key={etapa} className="relative pl-7">
                        <div className={`absolute left-0 top-1 size-[18px] rounded-full flex items-center justify-center border-4 border-white shadow-sm
                          ${done ? 'bg-green-500' : isCurrent ? 'bg-blue-600' : 'bg-slate-300'}`}>
                          <span className="material-symbols-outlined text-[10px] text-white">
                            {done ? 'check' : isCurrent ? 'schedule' : 'more_horiz'}
                          </span>
                        </div>
                        <p className={`text-xs font-bold ${isCurrent ? 'text-blue-600' : done ? 'text-slate-700' : 'text-slate-400'}`}>
                          {label}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {step ? formatarDataHora(step.createdAt) + (step.atorNome ? ` — ${step.atorNome}` : '') : isCurrent ? 'Aguardando decisão' : '—'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </section>

            </div>
          </div>
        </div>

        <footer className="mt-auto py-6 px-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">
            Prefeitura Municipal de Osasco - Gabinete do Secretário de Governo (SEGOV) © {new Date().getFullYear()}
          </p>
        </footer>
      </main>
    </div>
  )
}
