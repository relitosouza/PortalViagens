'use client'

import { useState, useMemo } from 'react'

type BloqueadoEntry = {
  id: string
  name: string
  email: string
}

type SolicitacaoSummary = {
  nomeCompleto: string
  destino: string
  dataVolta: Date | null
  userId: string
}

type PrestacaoPendente = {
  id: string
  enviadoEm: Date | null
  prazoFinal: Date
  solicitacao: SolicitacaoSummary
}

type Props = {
  cpfsBloqueados: { id: string; name: string | null; email: string; role: string }[]
  prestacoesPendentes: PrestacaoPendente[]
}

export default function BloqueiosSection({ cpfsBloqueados, prestacoesPendentes }: Props) {
  const hoje = new Date()

  // Lista unificada: inicia com cpfsBloqueados, adiciona prestações cujo userId não está ainda
  const listaInicial = useMemo<BloqueadoEntry[]>(() => {
    const base: BloqueadoEntry[] = cpfsBloqueados.map(u => ({
      id: u.id,
      name: u.name ?? '',
      email: u.email,
    }))
    const ids = new Set(base.map(u => u.id))

    for (const p of prestacoesPendentes) {
      if (!ids.has(p.solicitacao.userId)) {
        base.push({
          id: p.solicitacao.userId,
          name: p.solicitacao.nomeCompleto,
          email: '',
        })
        ids.add(p.solicitacao.userId)
      }
    }

    return base
  }, [cpfsBloqueados, prestacoesPendentes])

  const [lista, setLista] = useState<BloqueadoEntry[]>(listaInicial)
  const [modalUsuario, setModalUsuario] = useState<BloqueadoEntry | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [erro, setErro] = useState('')

  function abrirModal(u: BloqueadoEntry) {
    setModalUsuario(u)
    setJustificativa('')
    setErro('')
  }

  function fecharModal() {
    setModalUsuario(null)
    setJustificativa('')
    setErro('')
  }

  async function confirmarDesbloqueio() {
    if (!modalUsuario) return
    setLoading(true)
    setErro('')

    try {
      const res = await fetch(`/api/admin/usuarios/${modalUsuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpfBloqueado: false }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErro(data.error ?? 'Erro ao desbloquear. Tente novamente.')
        setLoading(false)
        return
      }

      // Sucesso: remover da lista e fechar modal
      setLista(prev => prev.filter(u => u.id !== modalUsuario.id))
      fecharModal()
      setSuccessMsg(`CPF de ${modalUsuario.name || 'usuário'} desbloqueado.`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch {
      setErro('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Para cada entrada da lista, verificar se veio de prestação (para exibir detalhes extras)
  function getPrestacaoInfo(userId: string): { destino: string; diasAtraso: number } | null {
    const p = prestacoesPendentes.find(p => p.solicitacao.userId === userId)
    if (!p) return null
    const diasAtraso = Math.floor((hoje.getTime() - new Date(p.prazoFinal).getTime()) / 86400000)
    return { destino: p.solicitacao.destino, diasAtraso }
  }

  return (
    <>
      {successMsg && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
          {successMsg}
        </div>
      )}

      <div className="p-6">
        <p className="text-sm text-slate-500 mb-6">
          Servidores bloqueados por pendência na prestação de contas (&gt; 5 dias úteis).
        </p>

        {lista.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <span className="material-symbols-outlined text-[36px] block mb-2">check_circle</span>
            <p className="text-sm">Nenhum bloqueio ativo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map(u => {
              const info = getPrestacaoInfo(u.id)
              return (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50/20">
                  <div className="flex items-center gap-3">
                    <div className="size-9 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold text-xs uppercase">
                      CPF
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{u.name || '—'}</p>
                      <p className="text-[11px] text-slate-500">
                        {info
                          ? `${info.destino} | Atraso: ${info.diasAtraso} dia${info.diasAtraso !== 1 ? 's' : ''}`
                          : u.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => abrirModal(u)}
                    className="text-xs font-bold px-3 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Desbloquear
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {modalUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-500">lock_open</span>
              <h3 className="text-base font-bold text-slate-900">Desbloquear CPF</h3>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-sm font-bold text-slate-900">{modalUsuario.name || '—'}</p>
              {modalUsuario.email && (
                <p className="text-xs text-slate-500">{modalUsuario.email}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Justificativa (opcional)
              </label>
              <textarea
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                placeholder="Ex: Servidor apresentou comprovantes presencialmente."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-200"
                disabled={loading}
              />
            </div>

            {erro && (
              <p className="text-xs text-red-600 font-medium">{erro}</p>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={fecharModal}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDesbloqueio}
                disabled={loading}
                className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {loading && (
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                )}
                Confirmar desbloqueio
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
