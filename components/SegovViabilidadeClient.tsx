'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BudgetTetoInfo from './BudgetTetoInfo'
import { parsePreco, calcularNoites } from '@/lib/utils/budget-utils'

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
  budgetData?: {
    numeroEmpenho?: string
    valorEmpenho?: string
    saldoEmpenho?: string
  }
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


export function SegovViabilidadeClient({ sol, userName, budgetData }: Props) {
  const router = useRouter()
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const cotacaoStep = sol.steps.find(s => s.etapa === 'COTACAO')
  const noites = calcularNoites(sol.dataIda, sol.dataVolta)
  const dias = noites + 1

  async function executar(decisao: string) {
    if (!observacao.trim() && decisao !== 'APROVADO') {
      setErro('Informe o parecer ou os motivos do ajuste/reprovação antes de prosseguir.')
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
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-8 px-8 -mt-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 leading-none">Análise de Viabilidade</h2>
          <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest">
            Aguardando SEGOV
          </span>
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
            <div className="space-y-6">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Etapa 2: Avaliação Política e Financeira</h3>
                <p className="text-slate-500 mt-1">Decisão baseada em Conveniência e Oportunidade do interesse público.</p>
              </div>

              {/* Painel OrçamentárioDashboard Único */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Card Unificado de Orçamento */}
                <div className="col-span-1 md:col-span-2 bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden group">
                  {/* Efeito de brilho no fundo */}
                  <div className="absolute -right-4 -top-4 w-32 h-32 bg-red-600/10 blur-3xl rounded-full group-hover:bg-red-600/20 transition-all pointer-events-none"></div>
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Saldo Atual de Empenho</p>
                        <p className="text-3xl font-black text-white tracking-tight">
                          <span className="text-red-500">R$</span> {parseFloat(budgetData?.saldoEmpenho || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Teto Orçamentário</p>
                        <p className="text-sm font-bold text-slate-300">
                          R$ {parseFloat(budgetData?.valorEmpenho || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Barra de Progresso: Linha Branca (Fundo) e Linha Vermelha (Saldo) */}
                    <div className="relative">
                      <div className="h-3 bg-white/10 rounded-full w-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all duration-1000 ease-out"
                          style={{ width: `${Math.min(100, (parseFloat(budgetData?.saldoEmpenho || '0') / parseFloat(budgetData?.valorEmpenho || '1')) * 100)}%` }}
                        />
                      </div>
                      
                      <div className="flex justify-between items-center mt-3">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-red-500 animate-pulse"></div>
                          <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                            Empenho Nº {budgetData?.numeroEmpenho}
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pt-0.5">
                          {((parseFloat(budgetData?.saldoEmpenho || '0') / parseFloat(budgetData?.valorEmpenho || '1')) * 100).toFixed(1)}% Disponível
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Duração Total */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Duração Total</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-slate-900 leading-none">{dias}</p>
                    <p className="text-sm font-bold text-slate-500 uppercase">Dias</p>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">{noites} Noites Planejadas</p>
                </div>

                {/* Custo Estimado */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Custo Estimado</p>
                  <p className="text-xl font-black text-blue-600 leading-none mb-1">
                    <span className="text-xs mr-0.5">R$</span> {parsePreco(cotacaoStep?.observacao ?? null, dias).total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-3">Impacto no Saldo</p>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <button
                      onClick={() => executar('APROVADO')}
                      disabled={loading !== null}
                      className="md:col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">check_circle</span>
                      {loading === 'APROVADO' ? 'Aprovando...' : 'Aprovar Solicitação'}
                    </button>
                    
                    <button
                      onClick={() => executar('AJUSTE_SECOL')}
                      disabled={loading !== null}
                      className="bg-white border border-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-blue-600">replay</span>
                      {loading === 'AJUSTE_SECOL' ? 'Enviando...' : 'Voltar para SECOL'}
                    </button>

                    <button
                      onClick={() => executar('AJUSTE_DEMANDANTE')}
                      disabled={loading !== null}
                      className="bg-white border border-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-amber-600">person_search</span>
                      {loading === 'AJUSTE_DEMANDANTE' ? 'Enviando...' : 'Voltar para Demandante'}
                    </button>

                    <button
                      onClick={() => executar('REPROVADO')}
                      disabled={loading !== null}
                      className="md:col-span-2 bg-white border-2 border-red-500 text-red-600 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">cancel</span>
                      {loading === 'REPROVADO' ? 'Reprovando...' : 'Reprovar Definitivamente'}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column */}
            <div className="col-span-12 lg:col-span-4 space-y-6">

              {/* Detalhamento de Custos */}
              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
                  <span className="material-symbols-outlined text-blue-600">inventory_2</span>
                  <h4 className="font-bold text-slate-800 uppercase tracking-tight text-sm">
                    Detalhamento de Custos
                  </h4>
                </div>
                <div className="p-5 space-y-4">
                  {/* Passagem */}
                  <div className="p-4 rounded-xl border border-blue-50 bg-white shadow-sm flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Passagem Aérea</p>
                      <p className="text-sm font-bold text-slate-900 leading-none mb-1">LATAM - Voo Direto</p>
                      <p className="text-[10px] text-slate-500">CGH &gt; BSB (Ida e Volta)</p>
                    </div>
                    <p className="text-lg font-black text-slate-900">
                      R$ {parsePreco(cotacaoStep?.observacao ?? null, dias).voo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Hospedagem */}
                  <div className="p-4 rounded-xl border border-blue-50 bg-white shadow-sm flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Hospedagem</p>
                      <p className="text-sm font-bold text-slate-900 leading-none mb-1">Quality Hotel Brasília</p>
                      <p className="text-[10px] text-slate-500">{noites} Diárias - Café incluso</p>
                    </div>
                    <p className="text-lg font-black text-slate-900">
                      R$ {parsePreco(cotacaoStep?.observacao ?? null, dias).hotel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Diárias */}
                  <div className="p-4 rounded-xl border border-blue-50 bg-white shadow-sm flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Diárias &amp; Ajuda Custo</p>
                      <p className="text-sm font-bold text-slate-900 leading-none mb-1">Padrão Tabela Municipal</p>
                      <p className="text-[10px] text-slate-500">Conforme Decreto 12.345/2023</p>
                    </div>
                    <p className="text-lg font-black text-slate-900">
                      R$ {parsePreco(cotacaoStep?.observacao ?? null, dias).diarias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </section>

              {/* Cotação da SECOL Original (Opcional ou Minimizada) */}
              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h4 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wide">
                    <span className="material-symbols-outlined text-blue-600 text-lg">receipt_long</span>
                    Observações Técnicas SECOL
                  </h4>
                </div>
                <div className="p-6">
                  {cotacaoStep?.observacao ? (
                    <pre className="text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100 font-sans">
                      {cotacaoStep.observacao}
                    </pre>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Nenhuma observação registrada.</p>
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
    </div>
  )
}
