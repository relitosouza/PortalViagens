'use client'
import { useState, useRef } from 'react'

export type TarifaParsed = {
  id: string
  tipo: string
  familia: string
  bagagens: number
  valorTarifa: string
  taxaEmbarque: string
  passag: number // Novo campo
  valorTotal: string
}

export type VooParsed = {
  id: string
  companhia: string
  numeroVoo: string
  origem: string
  destino: string
  partida: string
  chegada: string
  duracao: string
  escalas: number
  tarifas: TarifaParsed[]
}

type Props = {
  onImport: (selecionados: any[]) => void
  onClose: () => void
}

export default function PdfQuoteImport({ onImport, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [voos, setVoos] = useState<VooParsed[]>([])
  const [error, setError] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleProcessPdf = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/quote-parse', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar PDF')
      }

      setVoos(data.voos || [])
      setSelecionados(new Set()) // Limpa selecoes antigas
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (tarifaId: string) => {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(tarifaId)) {
        next.delete(tarifaId)
      } else {
        next.add(tarifaId)
      }
      return next
    })
  }

  const handleConfirm = () => {
    const toImport: any[] = []
    
    for (const voo of voos) {
      for (const t of voo.tarifas) {
        if (selecionados.has(t.id)) {
          toImport.push({
            companhia: `${voo.companhia} (${t.familia})`,
            numeroVoo: voo.numeroVoo,
            origem: voo.origem,
            destino: voo.destino,
            horario: `${voo.partida.split(' ')[1]} - ${voo.chegada.split(' ')[1]} (${voo.duracao})`,
            preco: t.valorTarifa,
            taxa: t.taxaEmbarque,
            passag: t.passag, // Passando o novo campo
            total: t.valorTotal
          })
        }
      }
    }

    onImport(toImport)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined">document_scanner</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Importação Inteligente de Cotação</h2>
              <p className="text-sm text-slate-500">Leia os voos diretamente do PDF enviado pela agência</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
          
          {/* Upload Area se ainda não processou voos */}
          {voos.length === 0 ? (
            <form onSubmit={handleProcessPdf} className="space-y-6">
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-blue-50/50 hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  accept=".pdf" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
                <span className="material-symbols-outlined text-4xl text-blue-600 mb-4">upload_file</span>
                {file ? (
                  <div>
                    <p className="font-bold text-slate-800 mb-1">{file.name}</p>
                    <p className="text-slate-500 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-slate-800 mb-1">Clique para selecionar</p>
                    <p className="text-slate-500 text-sm">Envie o arquivo PDF com as opções de voos</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-[20px]">error</span>
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!file || loading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      Processando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">search</span>
                      Analisar Documento
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Results Area */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-blue-800 text-sm">Extração Concluída</p>
                  <p className="text-blue-600 text-xs">Selecione as tarifas que deseja adicionar à avaliação técnica.</p>
                </div>
                <button onClick={() => { setVoos([]); setFile(null) }} className="text-sm font-bold text-blue-700 hover:text-blue-900 underline">
                  Analisar outro arquivo
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {voos.map(voo => (
                  <div key={voo.id} className="bg-white border text-left border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Infos Voo */}
                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-y-4 items-center justify-between">
                      <div className="flex items-center gap-4 min-w-[300px]">
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-slate-400">flight</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-slate-900">{voo.companhia}</span>
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-full">
                              {voo.numeroVoo}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="font-bold">{voo.origem}</span>
                            <span className="material-symbols-outlined text-[16px] text-blue-500">trending_flat</span>
                            <span className="font-bold">{voo.destino}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-8 text-sm">
                        <div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Horário</p>
                          <p className="font-medium text-slate-800">{voo.partida.split(' ')[1]} - {voo.chegada.split(' ')[1]}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Duração</p>
                          <p className="font-medium text-slate-800">{voo.duracao}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Escalas</p>
                          <p className="font-medium text-slate-800">{voo.escalas} Paradas</p>
                        </div>
                      </div>
                    </div>

                    {/* Tarifas */}
                    <div className="p-0">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-5 py-3 font-bold w-12"></th>
                            <th className="px-5 py-3 font-bold">Tipo / Família</th>
                            <th className="px-3 py-3 font-bold text-center">Bag.</th>
                            <th className="px-3 py-3 font-bold text-right">Tarifa (R$)</th>
                            <th className="px-3 py-3 font-bold text-right">Taxa (R$)</th>
                            <th className="px-3 py-3 font-bold text-center">Passag.</th>
                            <th className="px-3 py-3 font-bold text-right">Total (R$)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {voo.tarifas.map(t => (
                            <tr 
                              key={t.id} 
                              onClick={() => toggleSelect(t.id)}
                              className={`cursor-pointer transition-colors hover:bg-slate-50 ${selecionados.has(t.id) ? 'bg-blue-50/50' : ''}`}
                            >
                              <td className="px-5 py-4">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selecionados.has(t.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                                  {selecionados.has(t.id) && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <span className="font-bold text-slate-700 mr-2">{t.familia}</span>
                                <span className="text-xs text-slate-500">{t.tipo}</span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <div className="flex items-center justify-center gap-1 text-slate-600">
                                  <span className="material-symbols-outlined text-[16px]">luggage</span>
                                  <span>{t.bagagens}</span>
                                </div>
                              </td>
                              <td className="px-3 py-4 text-right text-slate-600 font-mono">R$ {t.valorTarifa}</td>
                              <td className="px-3 py-4 text-right text-slate-500 font-mono text-xs">R$ {t.taxaEmbarque}</td>
                              <td className="px-3 py-4 text-center">
                                <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full text-xs">
                                  {t.passag}x
                                </span>
                              </td>
                              <td className="px-3 py-4 font-black tracking-tight text-right text-blue-700 font-mono">R$ {t.valorTotal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {voos.length > 0 && (
          <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-between">
            <p className="text-sm font-bold text-slate-600">
              <span className="text-blue-600">{selecionados.size}</span> tarifa(s) selecionada(s)
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button 
                onClick={handleConfirm}
                disabled={selecionados.size === 0}
                className="px-6 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20"
              >
                Importar {selecionados.size} Selecionados
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
