'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BudgetTetoInfo from './BudgetTetoInfo'

type WorkflowStep = {
  etapa: string
  atorNome: string
  decisao: string | null
  createdAt: string
}

type Solicitacao = {
  id: string
  nomeCompleto: string
  cpf: string
  destino: string
  dataIda: string
  dataVolta: string
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

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function mascaraCpf(cpf: string) {
  // Mostra apenas parte do CPF
  if (cpf.length >= 11) return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`
  return cpf
}

export function SfExecucaoClient({ sol, userName, budgetData }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const viabilidadeStep = sol.steps.find(s => s.etapa === 'VIABILIDADE' && s.decisao === 'APROVADO')
  const emissaoStep = sol.steps.find(s => s.etapa === 'EMISSAO' && s.decisao === 'APROVADO')

  const protocolo = sol.id.slice(-8).toUpperCase()
  const brsNum = `BRS-${new Date().getFullYear()}-${sol.id.slice(-5).toUpperCase()}`

  async function autorizar() {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch(`/api/workflow/${sol.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisao: 'APROVADO',
          observacao: `Execução orçamentária confirmada por ${userName}. BRS: ${brsNum}. Ficha: ${sol.fichaOrcamentaria}.`,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao processar')
        setLoading(false)
        return
      }
      router.push('/dashboard')
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/dashboard" className="hover:text-blue-600 transition-colors">Processos</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-slate-900 font-medium font-bold uppercase tracking-tight">Etapa 4: Execução Orçamentária</span>
      </nav>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Etapa 4: Execução Orçamentária e Liquidação
            </h2>
            <p className="text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span className="bg-blue-600/10 text-blue-600 px-2 py-0.5 rounded text-xs font-bold uppercase">Protocolo</span>
              #{protocolo} — {sol.nomeCompleto}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-sm">print</span>
              Imprimir Documentação
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-sm">visibility</span>
              Visualizar Nota de Empenho
            </button>
            <button
              onClick={autorizar}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-shadow shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">check_circle</span>
              {loading ? 'Processando...' : 'Autorizar Pagamento e Liquidar'}
            </button>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Status do Processo</h3>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${viabilidadeStep ? 'bg-green-500' : 'bg-slate-300'}`}>
                  <span className="material-symbols-outlined text-lg">{viabilidadeStep ? 'check' : 'schedule'}</span>
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-900 leading-none">Aprovação SEGOV</p>
                <p className="text-xs text-slate-500 mt-1">
                  {viabilidadeStep ? `Concluído em ${fmt(viabilidadeStep.createdAt)}` : 'Pendente'}
                </p>
              </div>
            </div>
            <div className="flex-1 flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${emissaoStep ? 'bg-green-500' : 'bg-slate-300'}`}>
                  <span className="material-symbols-outlined text-lg">{emissaoStep ? 'check' : 'schedule'}</span>
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-900 leading-none">Formalização SECOL</p>
                <p className="text-xs text-slate-500 mt-1">
                  {emissaoStep ? `Concluído em ${fmt(emissaoStep.createdAt)}` : 'Pendente'}
                </p>
              </div>
            </div>
            <div className="flex-1 flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-lg">hourglass_empty</span>
                </div>
              </div>
              <div>
                <p className="font-bold text-blue-600 leading-none">Execução Financeira</p>
                <p className="text-xs text-slate-500 mt-1">Aguardando Liquidação</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* BRS */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">receipt_long</span>
                Detalhamento da Reserva (BRS)
              </h3>
              <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">REF: {protocolo}</span>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Número da Reserva</p>
                  <p className="text-lg font-bold text-slate-900">{brsNum}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Data da Emissão</p>
                  <p className="text-lg font-bold text-slate-900">{emissaoStep ? fmt(emissaoStep.createdAt) : fmt(new Date().toISOString())}</p>
                </div>
                <div className="col-span-2 p-4 bg-blue-600/5 rounded-lg border border-blue-600/10">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-slate-600">Ficha Orçamentária</p>
                    <p className="text-lg font-black text-blue-600 font-mono">{sol.fichaOrcamentaria}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Budget */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">account_balance_wallet</span>
                Dados Orçamentários
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between border-b border-slate-50 pb-3">
                <span className="text-sm text-slate-500">Ficha / Dotação</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{sol.fichaOrcamentaria}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-3">
                <span className="text-sm text-slate-500">Elemento de Despesa</span>
                <span className="text-sm font-bold text-slate-900">3.3.90.14 - DIÁRIAS - CIVIL</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-3">
                <span className="text-sm text-slate-500">Solicitante</span>
                <span className="text-sm font-bold text-slate-900">{sol.nomeCompleto}</span>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                <p className="text-xs text-amber-700 font-medium">
                  Verificar saldo disponível no sistema SEFIN antes de autorizar
                </p>
              </div>
            </div>
          </section>

          {/* Additional Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <span className="material-symbols-outlined text-slate-600">person</span>
                </div>
                <h4 className="text-sm font-bold">Favorecido</h4>
              </div>
              <p className="text-sm font-medium">{sol.nomeCompleto}</p>
              <p className="text-xs text-slate-500">CPF: {mascaraCpf(sol.cpf)}</p>
              <p className="text-xs text-slate-500 mt-1">{sol.user.name}</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <span className="material-symbols-outlined text-slate-600">event_repeat</span>
                </div>
                <h4 className="text-sm font-bold">Período da Viagem</h4>
              </div>
              <p className="text-sm font-medium">
                {fmt(sol.dataIda)} — {fmt(sol.dataVolta)}
              </p>
              <p className="text-xs text-slate-500">Destino: {sol.destino}</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <span className="material-symbols-outlined text-slate-600">fact_check</span>
                </div>
                <h4 className="text-sm font-bold">Conformidade</h4>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-sm font-medium">Documentação Regular</p>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Aprovado por SECOL e SEGOV
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {erro && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex gap-2">
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
            {erro}
          </div>
        )}

        {/* Warning Footer */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 items-start">
          <span className="material-symbols-outlined text-amber-600 flex-shrink-0">info</span>
          <p className="text-sm text-amber-800">
            Ao clicar em <span className="font-bold">Autorizar Pagamento e Liquidar</span>, o sistema registrará
            a execução orçamentária, notificará o servidor sobre a conclusão do processo e abrirá o prazo de
            prestação de contas (5 dias úteis após o retorno).
          </p>
        </div>
    </div>
  )
}
