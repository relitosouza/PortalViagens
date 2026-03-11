'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Evidencia = { icon: string; label: string; desc: string; tipo: string }

const EVIDENCIAS: Evidencia[] = [
  { icon: 'image', label: 'Fotos da Missão', desc: 'Imagens que registram sua participação', tipo: 'FOTO' },
  { icon: 'card_membership', label: 'Certificados/Diplomas', desc: 'Certificado de conclusão ou participação', tipo: 'CERTIFICADO' },
  { icon: 'assignment_ind', label: 'Lista de Presença/Pauta', desc: 'Documento de presença no evento', tipo: 'LISTA' },
]

type Props = {
  solicitacaoId: string
  destino: string
  dataIda: string
  dataVolta: string
  prazoFinal: string | null
  jaEnviada: boolean
  iniciais: string
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diasRestantes(prazo: string | null): number | null {
  if (!prazo) return null
  return Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000)
}

export function PrestacaoFormClient({ solicitacaoId, destino, dataIda, dataVolta, prazoFinal, jaEnviada, iniciais }: Props) {
  const router = useRouter()
  const [relatorio, setRelatorio] = useState('')
  const [arquivos, setArquivos] = useState<{ file: File; tipo: string }[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const dias = diasRestantes(prazoFinal)
  const vencido = dias !== null && dias < 0
  const protocolo = solicitacaoId.slice(-8).toUpperCase()

  function handleFile(tipo: string, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setArquivos(prev => {
      const sem = prev.filter(a => a.tipo !== tipo)
      return [...sem, ...files.map(f => ({ file: f, tipo }))]
    })
  }

  async function enviar(rascunho = false) {
    if (!rascunho && relatorio.trim().length < 50) {
      setErro('O relatório deve ter ao menos 50 caracteres.')
      return
    }
    setEnviando(true)
    setErro('')

    const res = await fetch(`/api/prestacao/${solicitacaoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relatorio }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErro(data.error ?? 'Erro ao enviar prestação')
      setEnviando(false)
      return
    }

    if (arquivos.length > 0) {
      const fd = new FormData()
      arquivos.forEach(a => fd.append('files', a.file))
      fd.append('solicitacaoId', solicitacaoId)
      fd.append('prestacaoId', data.prestacaoId)
      fd.append('tipo', 'EVIDENCIA')
      await fetch('/api/upload', { method: 'POST', body: fd })
    }

    router.push('/dashboard')
  }

  if (jaEnviada) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center max-w-md w-full shadow-sm">
          <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-emerald-600 text-4xl">check_circle</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Prestação já enviada</h2>
          <p className="text-slate-500 text-sm mb-6">A prestação de contas desta viagem já foi enviada com sucesso.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8 max-w-[960px] mx-auto w-full">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-8 px-8 -mt-8">
        <div className="flex flex-col">
          <nav className="flex items-center gap-2 text-[10px] text-slate-500 mb-0.5 uppercase tracking-tighter">
            <Link href="/dashboard" className="hover:text-blue-600 transition-colors">Processos</Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-slate-900 font-bold">Protocolo #{protocolo}</span>
          </nav>
          <h2 className="text-xl font-bold text-slate-900 leading-none">Relatório de Atividades</h2>
        </div>
        <div className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest">
          Etapa Final
        </div>
      </header>

          {/* Alert */}
          <div className={`border p-4 rounded-xl flex gap-4 items-start ${vencido ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <span className={`material-symbols-outlined ${vencido ? 'text-red-600' : 'text-amber-600'}`}>
              {vencido ? 'error' : 'warning'}
            </span>
            <p className={`text-sm font-medium ${vencido ? 'text-red-800' : 'text-amber-800'}`}>
              {vencido
                ? <><span className="font-bold">Prazo vencido!</span> Seu CPF pode estar bloqueado para novas solicitações. Envie o relatório imediatamente para desbloquear.</>
                : <><span className="font-bold">Atenção:</span> O não envio deste relatório em até 5 dias úteis resultará no bloqueio automático do seu CPF para novas solicitações (Art. 4º da normativa).
                  {dias !== null && dias >= 0 && <> Prazo: <strong>{fmt(prazoFinal!)} ({dias} dia{dias !== 1 ? 's' : ''})</strong>.</>}
                </>
              }
            </p>
          </div>

          {/* Trip Summary */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 text-lg font-bold">Dados da Viagem de Origem</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Destino</span>
                <div className="flex items-center gap-2 text-slate-900">
                  <span className="material-symbols-outlined text-blue-600 text-sm">location_on</span>
                  <p className="font-medium">{destino}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Período Realizado</span>
                <div className="flex items-center gap-2 text-slate-900">
                  <span className="material-symbols-outlined text-blue-600 text-sm">calendar_today</span>
                  <p className="font-medium">{fmt(dataIda)} a {fmt(dataVolta)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ID da Solicitação</span>
                <p className="text-slate-900 font-medium font-mono">#{protocolo}</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</span>
                <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600/10 text-blue-600">
                  Aguardando Relatório
                </span>
              </div>
            </div>
          </section>

          {/* Form */}
          <div className="flex flex-col gap-8">

            {/* Relatório */}
            <div className="flex flex-col gap-4">
              <label className="text-slate-900 text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">edit_note</span>
                Relatório Detalhado de Atividades
              </label>
              <textarea
                className="w-full min-h-[200px] rounded-xl border-slate-200 bg-white text-slate-900 focus:border-blue-600 focus:ring-blue-600 p-4 text-sm"
                placeholder="Descreva detalhadamente as atividades realizadas, reuniões, metas atingidas e resultados obtidos durante o período da viagem..."
                value={relatorio}
                onChange={e => setRelatorio(e.target.value)}
              />
              <p className={`text-xs ${relatorio.length >= 50 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {relatorio.length} caracteres {relatorio.length < 50 ? `(mínimo 50)` : '✓'}
              </p>
            </div>

            {/* Evidências */}
            <div className="flex flex-col gap-4">
              <label className="text-slate-900 text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">attach_file</span>
                Documentos Comprobatórios
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {EVIDENCIAS.map(ev => {
                  const anexado = arquivos.find(a => a.tipo === ev.tipo)
                  return (
                    <label key={ev.tipo} className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-blue-600 transition-colors cursor-pointer bg-white ${anexado ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'}`}>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => handleFile(ev.tipo, e)}
                      />
                      <span className={`material-symbols-outlined mb-2 ${anexado ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {anexado ? 'check_circle' : ev.icon}
                      </span>
                      <p className={`text-sm font-semibold ${anexado ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {ev.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {anexado ? anexado.file.name : ev.desc}
                      </p>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Outros arquivos */}
            {arquivos.length > 0 && (
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Arquivos selecionados</p>
                {arquivos.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-slate-200">
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="material-symbols-outlined text-slate-600 text-sm">picture_as_pdf</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{a.file.name}</p>
                      <p className="text-xs text-slate-500">{(a.file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <span className="material-symbols-outlined text-green-500">check_circle</span>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex gap-2">
                <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
                {erro}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-200">
              <button
                onClick={() => enviar(true)}
                disabled={enviando}
                className="flex-1 px-6 py-3 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
                type="button"
              >
                Salvar Rascunho
              </button>
              <button
                onClick={() => enviar(false)}
                disabled={enviando}
                className="flex-[2] px-6 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
                type="button"
              >
                {enviando ? 'Enviando...' : 'Enviar Relatório Final'}
              </button>
            </div>
          </div>
        <footer className="mt-auto py-8 border-t border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-xs">© {new Date().getFullYear()} Portal do Servidor. Sistema de Gestão de Viagens.</p>
            <div className="flex gap-6">
              <a className="text-slate-400 hover:text-blue-600 text-xs transition-colors" href="#">Manual do Usuário</a>
              <a className="text-slate-400 hover:text-blue-600 text-xs transition-colors" href="#">Suporte Técnico</a>
            </div>
          </div>
        </footer>
    </div>
  )
}
