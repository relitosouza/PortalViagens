'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type WorkflowStep = {
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
  fichaOrcamentaria: string
  emailServidor: string
  user: { name: string }
  steps: WorkflowStep[]
}

type Props = {
  sol: Solicitacao
  userName: string
}

export function SecolEmissaoClient({ sol, userName }: Props) {
  const router = useRouter()
  const [voucherAereo, setVoucherAereo] = useState<File | null>(null)
  const [voucherHotel, setVoucherHotel] = useState<File | null>(null)
  const [osGerada, setOsGerada] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const viabilidadeStep = sol.steps.find(s => s.etapa === 'VIABILIDADE')
  const cotacaoStep = sol.steps.find(s => s.etapa === 'COTACAO')

  const dataAprovacao = viabilidadeStep
    ? new Date(viabilidadeStep.createdAt).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  function gerarOS() {
    // Simula geração da OS — em produção geraria um PDF
    setOsGerada(true)
    const conteudo = [
      'ORDEM DE SERVIÇO - PREFEITURA DE OSASCO',
      '=' .repeat(40),
      `Protocolo: #${sol.id.slice(-8).toUpperCase()}`,
      `Servidor: ${sol.nomeCompleto}`,
      `Destino: ${sol.destino}`,
      `Período: ${new Date(sol.dataIda).toLocaleDateString('pt-BR')} a ${new Date(sol.dataVolta).toLocaleDateString('pt-BR')}`,
      `Ficha Orçamentária: ${sol.fichaOrcamentaria}`,
      '',
      'Aprovado pela SEGOV',
      viabilidadeStep?.observacao ? `Parecer: ${viabilidadeStep.observacao}` : '',
      '',
      'COTAÇÃO TÉCNICA (SECOL):',
      cotacaoStep?.observacao ?? 'Sem dados de cotação.',
    ].join('\n')
    const blob = new Blob([conteudo], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OS_${sol.id.slice(-8).toUpperCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function finalizar() {
    setErro('')
    if (!voucherAereo) {
      setErro('Anexe o Voucher Aéreo antes de finalizar.')
      return
    }
    if (!voucherHotel) {
      setErro('Anexe o Voucher de Hotel antes de finalizar.')
      return
    }

    setLoading(true)
    try {
      // Upload vouchers
      const fd = new FormData()
      fd.append('files', voucherAereo)
      fd.append('files', voucherHotel)
      fd.append('solicitacaoId', sol.id)
      fd.append('tipo', 'VOUCHER')
      await fetch('/api/upload', { method: 'POST', body: fd })

      // Avançar workflow
      const obs = `Vouchers emitidos por ${userName}. OS gerada em ${new Date().toLocaleDateString('pt-BR')}.`
      const res = await fetch(`/api/workflow/${sol.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao: 'APROVADO', observacao: obs }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao finalizar')
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
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-8 px-8 -mt-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 leading-none">Etapa 3: Formalização e Emissão</h2>
          <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest">
            Aguardando SECOL
          </span>
        </div>
      </header>

        <div className="p-8 max-w-5xl mx-auto w-full space-y-6">

          {/* Title */}
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Etapa 3: Formalização e Emissão</h2>
              <p className="text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                Protocolo <span className="font-mono font-bold text-blue-600">#{sol.id.slice(-8).toUpperCase()}</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded uppercase">
                  {sol.nomeCompleto}
                </span>
              </p>
            </div>
          </div>

          {/* SEGOV Approval Status */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-full bg-emerald-500 flex items-center justify-center text-white flex-shrink-0">
                <span className="material-symbols-outlined">check_circle</span>
              </div>
              <div>
                <p className="text-emerald-900 font-bold">Status de Aprovação SEGOV</p>
                <p className="text-emerald-700 text-sm">
                  {dataAprovacao
                    ? `Aprovado por ${viabilidadeStep?.atorNome} em ${dataAprovacao}`
                    : 'Aprovado pela Secretaria de Governo'}
                </p>
                {viabilidadeStep?.observacao && (
                  <p className="text-emerald-600 text-xs mt-1 italic">&quot;{viabilidadeStep.observacao}&quot;</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">

              {/* Generate OS */}
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">description</span>
                  <h3 className="font-bold">Emissão de Documentos Oficiais</h3>
                </div>
                <div className="p-6">
                  <div className="bg-slate-50 rounded-lg p-6 border border-dashed border-slate-300 text-center">
                    {osGerada ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center">
                          <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                        </div>
                        <p className="text-sm font-bold text-emerald-700">Ordem de Serviço gerada com sucesso!</p>
                        <button
                          onClick={gerarOS}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">download</span>
                          Baixar novamente
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600 mb-4">
                          A Ordem de Serviço (OS) deve ser gerada antes do upload dos vouchers finais.
                        </p>
                        <button
                          onClick={gerarOS}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
                        >
                          <span className="material-symbols-outlined">print</span>
                          Gerar Ordem de Serviço (OS)
                        </button>
                      </>
                    )}
                  </div>

                  {/* Cotação Summary */}
                  {cotacaoStep?.observacao && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Dados da Cotação (SECOL)</p>
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {cotacaoStep.observacao}
                      </pre>
                    </div>
                  )}
                </div>
              </section>

              {/* Voucher Upload */}
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">cloud_upload</span>
                  <h3 className="font-bold">Upload de Vouchers</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Voucher Aéreo */}
                  <div className={`border rounded-lg p-4 hover:border-blue-600/50 transition-colors group ${voucherAereo ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined transition-colors ${voucherAereo ? 'text-emerald-600' : 'text-slate-400 group-hover:text-blue-600'}`}>flight</span>
                        <span className="text-sm font-bold">Voucher Aéreo</span>
                      </div>
                      {voucherAereo
                        ? <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Anexado ✓</span>
                        : <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Obrigatório</span>
                      }
                    </div>
                    {voucherAereo ? (
                      <div className="flex items-center justify-between p-2 bg-white border border-emerald-200 rounded-lg">
                        <span className="text-xs text-slate-600 truncate flex-1">{voucherAereo.name}</span>
                        <button onClick={() => setVoucherAereo(null)} className="text-slate-400 hover:text-red-500 ml-2">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <input className="hidden" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setVoucherAereo(e.target.files?.[0] ?? null)} />
                        <div className="w-full py-4 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center bg-slate-50/50 hover:bg-blue-600/5 transition-colors">
                          <span className="material-symbols-outlined text-slate-300">add_circle</span>
                          <span className="text-xs text-slate-500 mt-1 font-medium">Anexar PDF/Imagem</span>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Voucher Hotel */}
                  <div className={`border rounded-lg p-4 hover:border-blue-600/50 transition-colors group ${voucherHotel ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined transition-colors ${voucherHotel ? 'text-emerald-600' : 'text-slate-400 group-hover:text-blue-600'}`}>hotel</span>
                        <span className="text-sm font-bold">Voucher Hotel</span>
                      </div>
                      {voucherHotel
                        ? <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Anexado ✓</span>
                        : <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Obrigatório</span>
                      }
                    </div>
                    {voucherHotel ? (
                      <div className="flex items-center justify-between p-2 bg-white border border-emerald-200 rounded-lg">
                        <span className="text-xs text-slate-600 truncate flex-1">{voucherHotel.name}</span>
                        <button onClick={() => setVoucherHotel(null)} className="text-slate-400 hover:text-red-500 ml-2">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <input className="hidden" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setVoucherHotel(e.target.files?.[0] ?? null)} />
                        <div className="w-full py-4 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center bg-slate-50/50 hover:bg-blue-600/5 transition-colors">
                          <span className="material-symbols-outlined text-slate-300">add_circle</span>
                          <span className="text-xs text-slate-500 mt-1 font-medium">Anexar PDF/Imagem</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Sidebar Summary */}
            <div className="space-y-6">
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-sm">Resumo da Solicitação</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Servidor</p>
                    <p className="text-xs font-bold">{sol.nomeCompleto}</p>
                    <p className="text-[10px] text-slate-500">{sol.user.name}</p>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Destino</p>
                    <p className="text-xs font-bold">{sol.destino}</p>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Período</p>
                    <p className="text-xs font-bold">
                      {new Date(sol.dataIda).toLocaleDateString('pt-BR')} → {new Date(sol.dataVolta).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ficha Orçamentária</p>
                    <p className="font-mono text-xs text-blue-600">{sol.fichaOrcamentaria}</p>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">E-mail do Servidor</p>
                    <p className="text-[11px] text-slate-700 break-all">{sol.emailServidor}</p>
                  </div>
                </div>
              </section>

              {/* Checklist */}
              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Checklist</h3>
                <div className={`flex items-center gap-2 text-sm ${osGerada ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span className="material-symbols-outlined text-[18px]">{osGerada ? 'check_circle' : 'radio_button_unchecked'}</span>
                  OS gerada
                </div>
                <div className={`flex items-center gap-2 text-sm ${voucherAereo ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span className="material-symbols-outlined text-[18px]">{voucherAereo ? 'check_circle' : 'radio_button_unchecked'}</span>
                  Voucher aéreo anexado
                </div>
                <div className={`flex items-center gap-2 text-sm ${voucherHotel ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span className="material-symbols-outlined text-[18px]">{voucherHotel ? 'check_circle' : 'radio_button_unchecked'}</span>
                  Voucher de hotel anexado
                </div>
              </section>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex gap-2">
                  <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
                  {erro}
                </div>
              )}

              <button
                onClick={finalizar}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 group disabled:opacity-50"
              >
                {loading ? 'Finalizando...' : 'Finalizar e Notificar Servidor'}
                {!loading && (
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">send</span>
                )}
              </button>
              <p className="text-[10px] text-center text-slate-400">
                Ao finalizar, o servidor receberá os vouchers por e-mail e o processo será enviado para execução orçamentária.
              </p>
            </div>
          </div>
        </div>
    </div>
  )
}
