'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type OpcaoVoo = {
  id: number
  companhia: string
  numeroVoo: string
  origem: string
  destino: string
  horario: string
  preco: string
}

type OpcaoHotel = {
  id: number
  nome: string
  quarto: string
  noites: number
  precoPorNoite: string
}

type Solicitacao = {
  id: string
  nomeCompleto: string
  destino: string
  dataIda: string
  dataVolta: string
  justificativaPublica: string
  nexoCargo: string
  indicacaoVoo?: string | null
  indicacaoHospedagem?: string | null
  user: { name: string }
}

type Props = {
  sol: Solicitacao
  userName: string
}

const EMPTY_VOO: Omit<OpcaoVoo, 'id'> = { companhia: '', numeroVoo: '', origem: '', destino: '', horario: '', preco: '' }
const EMPTY_HOTEL: Omit<OpcaoHotel, 'id'> = { nome: '', quarto: '', noites: 1, precoPorNoite: '' }

export function SecolCotacaoClient({ sol, userName }: Props) {
  const router = useRouter()
  const [voos, setVoos] = useState<OpcaoVoo[]>([])
  const [hoteis, setHoteis] = useState<OpcaoHotel[]>([])
  const [addingVoo, setAddingVoo] = useState(false)
  const [addingHotel, setAddingHotel] = useState(false)
  const [novoVoo, setNovoVoo] = useState({ ...EMPTY_VOO })
  const [novoHotel, setNovoHotel] = useState({ ...EMPTY_HOTEL })
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [showJustificativa, setShowJustificativa] = useState(false)

  const dataIda = new Date(sol.dataIda).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  const dataVolta = new Date(sol.dataVolta).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  function adicionarVoo() {
    if (!novoVoo.companhia || !novoVoo.preco) return
    setVoos(v => [...v, { ...novoVoo, id: Date.now() }])
    setNovoVoo({ ...EMPTY_VOO })
    setAddingVoo(false)
  }

  function adicionarHotel() {
    if (!novoHotel.nome || !novoHotel.precoPorNoite) return
    setHoteis(h => [...h, { ...novoHotel, id: Date.now() }])
    setNovoHotel({ ...EMPTY_HOTEL })
    setAddingHotel(false)
  }

  function formatarObservacao(): string {
    const partes: string[] = []
    if (voos.length > 0) {
      partes.push('=== OPÇÕES DE VOO ===')
      voos.forEach((v, i) => {
        partes.push(`[${i + 1}] ${v.companhia} ${v.numeroVoo} | ${v.origem} → ${v.destino} | ${v.horario} | R$ ${v.preco}`)
      })
    }
    if (hoteis.length > 0) {
      partes.push('=== OPÇÕES DE HOSPEDAGEM ===')
      hoteis.forEach((h, i) => {
        const total = (parseFloat(h.precoPorNoite) * h.noites).toFixed(2)
        partes.push(`[${i + 1}] ${h.nome} | ${h.quarto} | ${h.noites} noite(s) × R$ ${h.precoPorNoite} = R$ ${total}`)
      })
    }
    if (observacao.trim()) {
      partes.push('=== OBSERVAÇÕES TÉCNICAS ===')
      partes.push(observacao)
    }
    return partes.join('\n')
  }

  async function enviar() {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch(`/api/workflow/${sol.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao: 'APROVADO', observacao: formatarObservacao() }),
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

  async function salvarRascunho() {
    setSalvando(true)
    // Just saves observacao locally — user can note it in the obs field
    // In a future iteration, this could persist to the DB
    setSalvando(false)
  }

  return (
    <div className="p-8">


        {/* Breadcrumb & Header */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 text-sm text-slate-500 mb-4">
            <Link href="/dashboard" className="hover:text-blue-600">Painel</Link>
            <span>/</span>
            <Link href="/dashboard" className="hover:text-blue-600">Solicitações</Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">Cotação Técnica</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight mb-2">Cotação Técnica de Viagem</h1>
              <p className="text-slate-500">Gestão de opções de transporte e hospedagem para análise de viabilidade.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={salvarRascunho}
                disabled={salvando}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                {salvando ? 'Salvando...' : 'Salvar Rascunho'}
              </button>
              <button
                onClick={enviar}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                {loading ? 'Enviando...' : 'Enviar para Análise'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column — Request Details */}
          <div className="lg:col-span-1 space-y-6">

            <section className="bg-white p-6 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-4 text-blue-600">
                <span className="material-symbols-outlined">info</span>
                <h3 className="font-bold text-lg text-slate-900">Detalhes da Solicitação</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Protocolo</p>
                  <p className="font-mono text-blue-600 font-bold">#{sol.id.slice(-8).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Solicitante</p>
                  <p className="font-medium">{sol.nomeCompleto}</p>
                  <p className="text-sm text-slate-500">{sol.user.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Destino</p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
                    <p className="font-medium">{sol.destino}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Partida</p>
                    <p className="font-medium">{dataIda}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Retorno</p>
                    <p className="font-medium">{dataVolta}</p>
                  </div>
                </div>

                {(sol.indicacaoVoo || sol.indicacaoHospedagem) && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    {sol.indicacaoVoo && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Preferência de Voo</p>
                        <p className="text-sm text-slate-700 bg-blue-50 rounded-lg px-3 py-2">{sol.indicacaoVoo}</p>
                      </div>
                    )}
                    {sol.indicacaoHospedagem && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Preferência de Hospedagem</p>
                        <p className="text-sm text-slate-700 bg-blue-50 rounded-lg px-3 py-2">{sol.indicacaoHospedagem}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setShowJustificativa(v => !v)}
                    className="w-full flex items-center justify-center gap-2 text-blue-600 text-sm font-bold py-2 bg-blue-600/5 rounded-lg hover:bg-blue-600/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    {showJustificativa ? 'Ocultar' : 'Ver'} Justificativa Completa
                  </button>
                  {showJustificativa && (
                    <div className="mt-3 space-y-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Interesse Público</p>
                        <p className="text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">{sol.justificativaPublica}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Nexo com o Cargo</p>
                        <p className="text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">{sol.nexoCargo}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="bg-blue-600/5 border border-blue-600/20 p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-4 text-blue-600">
                <span className="material-symbols-outlined">description</span>
                <h3 className="font-bold text-lg text-slate-900">Ata de Registro de Preços</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">Consulte as condições vigentes na Ata para emissão de passagens e reservas.</p>
              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Ata_Vigente_2024.pdf</span>
                <span className="material-symbols-outlined text-blue-600 text-sm">download</span>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Flight Options */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">flight_takeoff</span>
                  <h3 className="font-bold text-lg">Opções de Voos</h3>
                </div>
                <button
                  onClick={() => setAddingVoo(v => !v)}
                  className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:underline"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Adicionar Opção
                </button>
              </div>

              {addingVoo && (
                <div className="p-6 border-b border-slate-200 bg-blue-50/30">
                  <p className="text-sm font-bold text-slate-700 mb-3">Nova opção de voo</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Companhia (ex: LATAM)" value={novoVoo.companhia} onChange={e => setNovoVoo(v => ({ ...v, companhia: e.target.value }))} />
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nº Voo (ex: LA3450)" value={novoVoo.numeroVoo} onChange={e => setNovoVoo(v => ({ ...v, numeroVoo: e.target.value }))} />
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Origem (ex: GRU)" value={novoVoo.origem} onChange={e => setNovoVoo(v => ({ ...v, origem: e.target.value }))} />
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Destino (ex: BSB)" value={novoVoo.destino} onChange={e => setNovoVoo(v => ({ ...v, destino: e.target.value }))} />
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Horário (ex: 08:30 - 10:15)" value={novoVoo.horario} onChange={e => setNovoVoo(v => ({ ...v, horario: e.target.value }))} />
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Preço (ex: 1240,50)" value={novoVoo.preco} onChange={e => setNovoVoo(v => ({ ...v, preco: e.target.value }))} />
                  </div>
                  <div className="flex gap-3 mt-3">
                    <button onClick={adicionarVoo} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors">Confirmar</button>
                    <button onClick={() => { setAddingVoo(false); setNovoVoo({ ...EMPTY_VOO }) }} className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold">
                      <th className="px-6 py-4">Companhia / Voo</th>
                      <th className="px-6 py-4">Horários</th>
                      <th className="px-6 py-4">Preço (R$)</th>
                      <th className="px-6 py-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {voos.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">
                          Nenhuma opção de voo adicionada. Clique em &quot;Adicionar Opção&quot; para incluir.
                        </td>
                      </tr>
                    )}
                    {voos.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                              <span className="material-symbols-outlined text-slate-400 text-sm">flight</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm">{v.companhia}{v.numeroVoo ? ` - ${v.numeroVoo}` : ''}</p>
                              <p className="text-xs text-slate-500 italic">Classe Econômica</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p>{v.origem} <span className="text-blue-600 font-bold">→</span> {v.destino}</p>
                            {v.horario && <p className="text-xs text-slate-500">{v.horario}</p>}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold">R$ {v.preco}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setVoos(vs => vs.filter(x => x.id !== v.id))} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Hotel Options */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">hotel</span>
                  <h3 className="font-bold text-lg">Opções de Hospedagem</h3>
                </div>
                <button
                  onClick={() => setAddingHotel(v => !v)}
                  className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:underline"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Adicionar Opção
                </button>
              </div>

              {addingHotel && (
                <div className="p-6 border-b border-slate-200 bg-blue-50/30">
                  <p className="text-sm font-bold text-slate-700 mb-3">Nova opção de hospedagem</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm md:col-span-2" placeholder="Nome do hotel" value={novoHotel.nome} onChange={e => setNovoHotel(h => ({ ...h, nome: e.target.value }))} />
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm md:col-span-2" placeholder="Tipo de quarto (ex: Standard c/ Café)" value={novoHotel.quarto} onChange={e => setNovoHotel(h => ({ ...h, quarto: e.target.value }))} />
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" type="number" min={1} placeholder="Noites" value={novoHotel.noites} onChange={e => setNovoHotel(h => ({ ...h, noites: parseInt(e.target.value) || 1 }))} />
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Preço/noite (ex: 450,00)" value={novoHotel.precoPorNoite} onChange={e => setNovoHotel(h => ({ ...h, precoPorNoite: e.target.value }))} />
                  </div>
                  <div className="flex gap-3 mt-3">
                    <button onClick={adicionarHotel} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors">Confirmar</button>
                    <button onClick={() => { setAddingHotel(false); setNovoHotel({ ...EMPTY_HOTEL }) }} className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold">
                      <th className="px-6 py-4">Hotel / Acomodação</th>
                      <th className="px-6 py-4">Diárias</th>
                      <th className="px-6 py-4">Total (R$)</th>
                      <th className="px-6 py-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hoteis.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">
                          Nenhuma opção de hospedagem adicionada. Clique em &quot;Adicionar Opção&quot; para incluir.
                        </td>
                      </tr>
                    )}
                    {hoteis.map(h => {
                      const preco = parseFloat(h.precoPorNoite.replace(',', '.')) || 0
                      const total = (preco * h.noites).toFixed(2).replace('.', ',')
                      return (
                        <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                                <span className="material-symbols-outlined text-slate-400 text-sm">apartment</span>
                              </div>
                              <div>
                                <p className="font-bold text-sm">{h.nome}</p>
                                {h.quarto && <p className="text-xs text-slate-500">{h.quarto}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {h.noites} noite{h.noites !== 1 ? 's' : ''}{' '}
                            <span className="text-slate-400 text-xs">(R$ {h.precoPorNoite}/dia)</span>
                          </td>
                          <td className="px-6 py-4 font-bold">R$ {total}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => setHoteis(hs => hs.filter(x => x.id !== h.id))} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Conclusion */}
            <section className="bg-white p-6 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-6 text-blue-600">
                <span className="material-symbols-outlined">fact_check</span>
                <h3 className="font-bold text-lg text-slate-900">Conclusão da Análise Técnica</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Responsável pela Cotação</label>
                  <input
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-500 cursor-not-allowed"
                    disabled
                    value={userName}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Observações Técnicas</label>
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    rows={4}
                    placeholder="Insira observações relevantes sobre as cotações obtidas..."
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

                <div className="pt-4 flex flex-col md:flex-row justify-end gap-4">
                  <Link href="/dashboard" className="px-6 py-3 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors text-center">
                    Cancelar
                  </Link>
                  <button
                    onClick={enviar}
                    disabled={loading}
                    className="px-10 py-3 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Finalizando...' : 'Finalizar e Enviar para SEGOV'}
                  </button>
                </div>
              </div>
            </section>

          </div>
        </div>
    </div>
  )
}
