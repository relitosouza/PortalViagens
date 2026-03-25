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
  sentido: 'ida' | 'volta' // Novo campo
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

  const handlePassagChange = (vooId: string, tarifaId: string, newValStr: string) => {
    const val = parseInt(newValStr);
    if (isNaN(val) || val < 1) return;

    setVoos(prev => prev.map(v => {
      if (v.id !== vooId) return v;
      
      const newTarifas = v.tarifas.map(t => {
        if (t.id !== tarifaId) return t;
        
        const parseMoney = (m: string) => parseFloat(m.replace(/\./g, '').replace(',', '.'));
        const formatMoney = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const trf = parseMoney(t.valorTarifa) || 0;
        const tx = parseMoney(t.taxaEmbarque) || 0;
        const newTotal = (trf + tx) * val;
        
        return {
          ...t,
          passag: val,
          valorTotal: formatMoney(newTotal)
        };
      });
      return { ...v, tarifas: newTarifas };
    }));
  }

  const handleConfirm = () => {
    const toImport: any[] = []
    
    for (const voo of voos) {
      for (const t of voo.tarifas) {
        if (selecionados.has(t.id)) {
          toImport.push({
            companhia: `${voo.companhia} (${t.familia})`,
            numeroVoo: `${voo.numeroVoo} [${voo.sentido.toUpperCase()}]`,
            origem: voo.origem,
            destino: voo.destino,
            horario: `${voo.partida.split(' ')[1]} - ${voo.chegada.split(' ')[1]} (${voo.duracao})`,
            preco: t.valorTarifa,
            taxa: t.taxaEmbarque,
            passag: t.passag,
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
              <p className="text-sm text-slate-500">Selecione os voos extraídos do PDF da agência</p>
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

              <div className="bg-white border rounded-xl overflow-hidden shadow-sm border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] text-left">
                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 w-10"></th>
                        <th className="px-3 py-3 font-bold w-20">Sentido</th>
                        <th className="px-4 py-3 font-bold">Cia / Voo / Detalhes</th>
                        <th className="px-3 py-3 font-bold text-right w-24">Tarifa (R$)</th>
                        <th className="px-3 py-3 font-bold text-right w-24">Taxa (R$)</th>
                        <th className="px-3 py-3 font-bold text-center w-24">Passag.</th>
                        <th className="px-4 py-3 font-bold text-right w-28">Total (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {voos.map(voo => {
                        const isIda = voo.sentido === 'ida';
                        const rowBg = isIda ? 'bg-blue-50/60 hover:bg-blue-100/40' : 'bg-red-50/60 hover:bg-red-100/40';
                        const tagClasses = isIda 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-red-500 text-white';

                        return voo.tarifas.map(t => {
                          const isSelected = selecionados.has(t.id);
                          return (
                            <tr key={t.id} className={`transition-colors ${rowBg}`}>
                              <td className="px-4 py-4" onClick={() => toggleSelect(t.id)}>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-400'}`}>
                                  {isSelected && <span className="material-symbols-outlined text-[12px] font-bold">check</span>}
                                </div>
                              </td>
                              
                              <td className="px-3 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${tagClasses}`}>
                                  {voo.sentido}
                                </span>
                              </td>

                              <td className="px-4 py-4">
                                <span className="block font-bold text-slate-800 text-sm">
                                  {voo.companhia} {voo.numeroVoo} <span className="text-slate-500 font-normal">({t.familia})</span>
                                </span>
                                <span className="block text-[11px] text-slate-600 mt-0.5">
                                  {voo.origem} → {voo.destino} | {voo.partida.split(' ')[1]} - {voo.chegada.split(' ')[1]} | <span className="material-symbols-outlined text-[12px] align-middle">luggage</span> {t.bagagens}
                                </span>
                              </td>

                              <td className="px-3 py-4 text-right text-slate-700 font-mono">
                                R$ {t.valorTarifa}
                              </td>

                              <td className="px-3 py-4 text-right text-slate-600 font-mono text-[11px]">
                                R$ {t.taxaEmbarque}
                              </td>

                              <td className="px-3 py-4 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  value={t.passag}
                                  onChange={(e) => handlePassagChange(voo.id, t.id, e.target.value)}
                                  className="w-16 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                />
                              </td>

                              <td className="px-4 py-4 font-black tracking-tight text-right text-slate-800 font-mono">
                                R$ {t.valorTotal}
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
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
