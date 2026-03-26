'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcularNoites, parseCurrency } from '@/lib/utils/budget-utils'

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

type OpcaoVoo = {
  id: string
  companhia: string
  numeroVoo: string
  origem: string
  destino: string
  horario: string
  preco: string
  taxa: string
  passag: number
  sentido: 'ida' | 'volta'
}

type OpcaoHotel = {
  id: string
  nome: string
  quarto: string
  regime: string
  noites: number
  precoPorNoite: string
  total: number
}

type Props = {
  sol: Solicitacao
  userName: string
  budgetData?: {
    numeroEmpenho?: string
    valorEmpenho?: string
    saldoEmpenho?: string
    numeroEmpenhoPassagem?: string
    valorEmpenhoPassagem?: string
    saldoEmpenhoPassagem?: string
    numeroEmpenhoHospedagem?: string
    valorEmpenhoHospedagem?: string
    saldoEmpenhoHospedagem?: string
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

function extrairOpcoesVoo(obs: string | null): OpcaoVoo[] {
  if (!obs) return []
  const voos: OpcaoVoo[] = []
  const section = obs.match(/=== OPÇÕES DE VOO ===([\s\S]*?)(?:===|$)/)
  if (!section) return []

  const lines = section[1].trim().split('\n')
  lines.forEach((line, idx) => {
    const trimmedLine = line.trim()
    if (trimmedLine.startsWith('[')) {
      if (trimmedLine.includes('|')) {
        const parts = trimmedLine.split('|').map(s => s.trim())
        const header = parts[0].replace(/\[\d+\]\s+/, '')
        const sentido: 'ida' | 'volta' = header.toUpperCase().includes('[VOLTA]') ? 'volta' : 'ida'
        const compNum = header.replace(/\[(IDA|VOLTA)\]/gi, '').trim()
        const [comp, ...numArr] = compNum.split(' ')
        
        const rotaMatch = trimmedLine.match(/([^|]+)\s→\s([^|]+)/)
        const tarifaMatch = trimmedLine.match(/Tarifa: R\$\s?([\d.,]+)/)
        const taxaMatch = trimmedLine.match(/Taxa: R\$\s?([\d.,]+)/)
        const qtdeMatch = trimmedLine.match(/Qtde:\s?(\d+)/)
        const horario = parts[2] || ''

        voos.push({
          id: `v-${idx}`,
          companhia: comp || '',
          numeroVoo: numArr.join(' ') || '',
          origem: rotaMatch?.[1]?.trim() || '',
          destino: rotaMatch?.[2]?.trim() || '',
          horario: horario.includes('→') ? (parts[3] || '') : horario, // fallback se a rota estiver no index 2
          preco: tarifaMatch ? tarifaMatch[1] : '0,00',
          taxa: taxaMatch ? taxaMatch[1] : '0,00',
          passag: qtdeMatch ? parseInt(qtdeMatch[1]) : 1,
          sentido
        })
      }
    }
  })
  return voos
}

function extrairOpcoesHotel(obs: string | null): OpcaoHotel[] {
  if (!obs) return []
  const hoteis: OpcaoHotel[] = []
  const section = obs.match(/=== OPÇÕES DE HOSPEDAGEM ===([\s\S]*?)(?:===|$)/)
  if (!section) return []

  const lines = section[1].trim().split('\n')
  lines.forEach((line, idx) => {
    const trimmedLine = line.trim()
    if (trimmedLine.startsWith('[')) {
      const parts = trimmedLine.split('|').map(s => s.trim())
      if (parts.length >= 3) {
        const nome = parts[0].replace(/\[\d+\]\s+/, '')
        let quarto = parts[1]
        let regime = '-'

        // Tenta extrair regime se estiver entre parênteses no campo quarto
        const regimeMatch = quarto.match(/\((.*?)\)/)
        if (regimeMatch) {
          regime = regimeMatch[1]
          quarto = quarto.replace(/\s?\(.*?\)/, '').trim()
        }

        const logistica = parts[2].split('×')
        const noitesMatch = logistica[0]?.match(/\d+/)
        const precoMatch = logistica[1]?.split('=')[0]?.match(/R\$\s?([\d.,]+)/)
        const totalMatch = logistica[1]?.split('=')[1]?.match(/R\$\s?([\d.,]+)/)

        hoteis.push({
          id: `h-${idx}`,
          nome,
          quarto,
          regime,
          noites: noitesMatch ? parseInt(noitesMatch[0]) : 1,
          precoPorNoite: precoMatch ? precoMatch[1] : '0,00',
          total: totalMatch ? parseCurrency(totalMatch[1]) : 0
        })
      }
    }
  })
  return hoteis
}

export function SegovViabilidadeClient({ sol, userName, budgetData }: Props) {
  const router = useRouter()
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const cotacaoStep = [...sol.steps].reverse().find(s => s.etapa === 'COTACAO')
  const [voos, setVoos] = useState<OpcaoVoo[]>(() => extrairOpcoesVoo(cotacaoStep?.observacao ?? null))
  const [hoteis, setHoteis] = useState<OpcaoHotel[]>(() => extrairOpcoesHotel(cotacaoStep?.observacao ?? null))
  
  const noites = calcularNoites(sol.dataIda, sol.dataVolta)
  const dias = noites + 1
  
  const custoVoo = voos.reduce((acc, v) => acc + (parseCurrency(v.preco) + parseCurrency(v.taxa)) * v.passag, 0)
  const custoHotel = hoteis.reduce((acc, h) => acc + h.total, 0)
  const custoTotal = custoVoo + custoHotel

  function formatarObservacaoEnvio(obsOriginal: string): string {
    const partes: string[] = []
    if (voos.length > 0) {
      partes.push('=== OPÇÕES DE VOO SELECIONADAS ===')
      voos.forEach((v, i) => {
        partes.push(`[${i + 1}] ${v.companhia} ${v.numeroVoo} [${v.sentido.toUpperCase()}] | ${v.origem} → ${v.destino} | ${v.horario} | R$ ${v.preco} + R$ ${v.taxa} | Qtde: ${v.passag}`)
      })
    }
    if (hoteis.length > 0) {
      partes.push('=== OPÇÕES DE HOSPEDAGEM SELECIONADAS ===')
      hoteis.forEach((h, i) => {
        const regimeStr = h.regime && h.regime !== '-' ? ` (${h.regime})` : ''
        partes.push(`[${i + 1}] ${h.nome} | ${h.quarto}${regimeStr} | ${h.noites} noite(s) × R$ ${h.precoPorNoite} = R$ ${h.total.toFixed(2).replace('.', ',')}`)
      })
    }
    partes.push('=== PARECER SEGOV ===')
    partes.push(observacao)
    return partes.join('\n')
  }

  async function executar(decisao: string) {
    if (!observacao.trim() && decisao !== 'APROVADO') {
      setErro('Informe o parecer ou os motivos do ajuste/reprovação antes de prosseguir.')
      return
    }
    
    if (decisao === 'APROVADO' && voos.length === 0 && hoteis.length === 0) {
      setErro('Não é possível aprovar uma solicitação sem nenhuma opção de voo ou hotel selecionada.')
      return
    }

    setLoading(decisao)
    setErro('')
    try {
      const res = await fetch(`/api/workflow/${sol.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          decisao, 
          observacao: formatarObservacaoEnvio(observacao),
          valorPassagem: custoVoo,
          valorHospedagem: custoHotel
        }),
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

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <nav className="flex text-sm text-slate-500 gap-2">
            <Link href="/dashboard" className="hover:text-blue-600">Gestão de Viagens</Link>
            <span>/</span>
            <span>Protocolo #{sol.id.slice(-8).toUpperCase()}</span>
            <span>/</span>
            <span className="text-blue-600 font-medium">Análise SEGOV</span>
          </nav>
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Etapa 2: Avaliação Política e Financeira</h3>
            <p className="text-slate-500 mt-1">Decisão baseada em Conveniência e Oportunidade do interesse público.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Duração Total</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-slate-900 leading-none">{dias}</p>
              <p className="text-sm font-bold text-slate-500 uppercase">Dias</p>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">{noites} Noites Planejadas</p>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Custo Estimado</p>
            <p className="text-xl font-black text-blue-600 leading-none mb-1">
              <span className="text-xs mr-0.5">R$</span> {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-3">Impacto no Saldo</p>
          </div>
        </div>

        {(budgetData?.saldoEmpenhoPassagem || budgetData?.saldoEmpenhoHospedagem) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgetData?.saldoEmpenhoPassagem && (
              <div className="bg-emerald-900 p-6 rounded-3xl shadow-xl border border-emerald-700 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-emerald-400 text-[18px]">flight</span>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Empenho Passagens</p>
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight">
                      <span className="text-emerald-400">R$</span> {parseFloat(budgetData.saldoEmpenhoPassagem || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">Teto</p>
                    <p className="text-sm font-bold text-emerald-300">
                      R$ {parseFloat(budgetData.valorEmpenhoPassagem || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (parseFloat(budgetData.saldoEmpenhoPassagem || '0') / parseFloat(budgetData.valorEmpenhoPassagem || '1')) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-2">
                  Nº {budgetData.numeroEmpenhoPassagem}
                </p>
              </div>
            )}
            {budgetData?.saldoEmpenhoHospedagem && (
              <div className="bg-orange-900 p-6 rounded-3xl shadow-xl border border-orange-700 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-orange-400 text-[18px]">hotel</span>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Empenho Hospedagem</p>
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight">
                      <span className="text-orange-400">R$</span> {parseFloat(budgetData.saldoEmpenhoHospedagem || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Teto</p>
                    <p className="text-sm font-bold text-orange-300">
                      R$ {parseFloat(budgetData.valorEmpenhoHospedagem || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-400 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (parseFloat(budgetData.saldoEmpenhoHospedagem || '0') / parseFloat(budgetData.valorEmpenhoHospedagem || '1')) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-2">
                  Nº {budgetData.numeroEmpenhoHospedagem}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 space-y-6">
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

            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">flight_takeoff</span>
                  <h4 className="font-bold text-slate-800 uppercase tracking-tight text-sm">Opções de Voos</h4>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3">Cia / Voo</th>
                      <th className="px-6 py-3">Horários</th>
                      <th className="px-6 py-3 text-right">Tarifa (R$)</th>
                      <th className="px-6 py-3 text-right">Taxa (R$)</th>
                      <th className="px-6 py-3 text-center">Qtde.</th>
                      <th className="px-6 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {voos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">Nenhum voo selecionado.</td>
                      </tr>
                    ) : (
                      voos.map((v) => (
                        <tr key={v.id} className={`hover:bg-slate-50 transition-colors border-l-4 ${v.sentido === 'ida' ? 'border-l-blue-500' : 'border-l-red-500'}`}>
                          <td className="px-6 py-4">
                            <p className="font-bold">{v.companhia} {v.numeroVoo}</p>
                            <span className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${v.sentido === 'ida' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                              {v.sentido}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-600">{v.horario}</p>
                            <p className="text-[10px] text-slate-400">{v.origem} → {v.destino}</p>
                          </td>
                          <td className="px-6 py-4 text-right font-mono">R$ {v.preco}</td>
                          <td className="px-6 py-4 text-right font-mono text-slate-500 text-[11px]">R$ {v.taxa}</td>
                          <td className="px-6 py-4 text-center font-bold">{v.passag}x</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => setVoos(vs => vs.filter(x => x.id !== v.id))} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">hotel</span>
                  <h4 className="font-bold text-slate-800 uppercase tracking-tight text-sm">Opções de Hospedagem</h4>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#f0f9f1] text-[10px] font-black text-emerald-700 uppercase tracking-widest border-b border-emerald-100">
                    <tr>
                      <th className="px-6 py-3">Hotel / Acomodação</th>
                      <th className="px-6 py-3">Regime</th>
                      <th className="px-6 py-3 text-center">Diárias/Qtde</th>
                      <th className="px-6 py-3 text-right">Total (R$)</th>
                      <th className="px-6 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hoteis.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">Nenhuma hospedagem selecionada.</td>
                      </tr>
                    ) : (
                      hoteis.map((h) => (
                        <tr key={h.id} className="hover:bg-green-50/50 bg-green-50 transition-colors border-l-4 border-l-emerald-500 border-b border-emerald-100/50">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900">{h.nome}</p>
                            <p className="text-[11px] text-slate-500">{h.quarto}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                              {h.regime}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <p className="font-bold">{h.noites}x</p>
                            <p className="text-[10px] text-slate-400">R$ {h.precoPorNoite}</p>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-black text-slate-800">
                            R$ {h.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => setHoteis(hs => hs.filter(x => x.id !== h.id))} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white rounded-xl border-2 border-blue-600/20 shadow-xl shadow-blue-600/5 overflow-hidden">
              <div className="px-6 py-4 bg-blue-600 text-white">
                <h4 className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">gavel</span>
                  Painel de Decisão SEGOV
                </h4>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Parecer da SEGOV</label>
                  <textarea
                    className="w-full rounded-xl border-slate-200 text-sm focus:ring-blue-600 focus:border-blue-600 p-4 min-h-[120px]"
                    placeholder="Descreva aqui os motivos da sua decisão..."
                    value={observacao}
                    onChange={e => setObservacao(e.target.value)}
                  />
                </div>

                {erro && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{erro}</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => executar('APROVADO')}
                    disabled={loading !== null}
                    className="md:col-span-2 bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    {loading === 'APROVADO' ? 'Aprovando...' : 'Aprovar Solicitação'}
                  </button>
                  <button onClick={() => executar('AJUSTE_SECOL')} disabled={loading !== null} className="border border-slate-200 py-3 rounded-xl font-bold">Voltar para SECOL</button>
                  <button onClick={() => executar('AJUSTE_DEMANDANTE')} disabled={loading !== null} className="border border-slate-200 py-3 rounded-xl font-bold">Voltar para Demandante</button>
                  <button onClick={() => executar('REPROVADO')} disabled={loading !== null} className="md:col-span-2 border-2 border-red-500 text-red-500 py-3 rounded-xl font-bold">Reprovar Definitivamente</button>
                </div>
              </div>
            </section>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-6">
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h4 className="font-bold flex items-center gap-2 text-sm uppercase">Cotação SECOL Original</h4>
              </div>
              <div className="p-6">
                <pre className="text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3 font-sans">
                  {cotacaoStep?.observacao || 'Nenhuma observação.'}
                </pre>
              </div>
            </section>

            <section className="bg-slate-900 text-white rounded-xl p-6 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Fluxo do Processo</h4>
              <div className="space-y-4">
                {TIMELINE.map(({ etapa, label }) => {
                  const step = sol.steps.find(s => s.etapa === etapa)
                  return (
                    <div key={etapa} className="flex gap-3">
                      <div className={`size-4 rounded-full mt-0.5 ${step ? 'bg-green-500' : etapa === 'VIABILIDADE' ? 'bg-blue-600' : 'bg-slate-700'}`} />
                      <div>
                        <p className="text-xs font-bold">{label}</p>
                        <p className="text-[10px] text-slate-500">{step ? formatarDataHora(step.createdAt) : '—'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </div>

      <footer className="mt-8 py-6 border-t border-slate-200 text-center text-xs text-slate-400">
        Prefeitura Municipal de Osasco © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
