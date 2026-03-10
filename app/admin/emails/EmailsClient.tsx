'use client'

import { useState, useEffect, useCallback } from 'react'

interface EmailLog {
  id: string
  para: string
  assunto: string
  corpo: string
  timestamp: string
  tipo: string
}

const TIPO_LABELS: Record<string, string> = {
  VOUCHER_APROVACAO: 'Voucher Aprovado',
  REPROVACAO: 'Reprovado',
  COTACAO_CONCLUIDA: 'Cotação Concluída',
  PRESTACAO_RECEBIDA: 'Prestação Recebida',
  BLOQUEIO_CPF: 'CPF Bloqueado',
  ALERTA_PRAZO: 'Alerta de Prazo',
}

const TIPO_COLORS: Record<string, string> = {
  VOUCHER_APROVACAO: 'bg-green-100 text-green-700',
  REPROVACAO: 'bg-red-100 text-red-700',
  COTACAO_CONCLUIDA: 'bg-blue-100 text-blue-700',
  PRESTACAO_RECEBIDA: 'bg-emerald-100 text-emerald-700',
  BLOQUEIO_CPF: 'bg-orange-100 text-orange-700',
  ALERTA_PRAZO: 'bg-amber-100 text-amber-700',
}

const TIPOS = Object.keys(TIPO_LABELS)

const PAGE_SIZE = 50

export function EmailsClient() {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [tipoFilter, setTipoFilter] = useState('')
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tipoFilter) params.set('tipo', tipoFilter)
      if (busca.trim()) params.set('busca', busca.trim())
      const res = await fetch(`/api/admin/emails?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
        setPage(1)
      }
    } catch {
      // silently fail — stale state remains visible
    } finally {
      setLoading(false)
    }
  }, [tipoFilter, busca])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  async function handleClear() {
    if (!confirm('Tem certeza que deseja limpar todos os logs de e-mail? Esta ação não pode ser desfeita.')) return
    setClearing(true)
    try {
      const res = await fetch('/api/admin/emails', { method: 'DELETE' })
      if (res.ok) {
        setLogs([])
        setPage(1)
      }
    } catch {
      // silently fail
    } finally {
      setClearing(false)
    }
  }

  function formatDateTime(ts: string) {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE))
  const paginated = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Log de Notificações</h2>
          <span className="bg-blue-100 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full">
            {logs.length}
          </span>
        </div>
        <button
          onClick={handleClear}
          disabled={clearing || logs.length === 0}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {clearing ? (
            <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
            </svg>
          ) : (
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
          )}
          Limpar Logs
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500 transition">
          <span className="material-symbols-outlined text-slate-400 text-[18px]">filter_list</span>
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="text-sm text-slate-700 bg-transparent outline-none"
          >
            <option value="">Todos os tipos</option>
            {TIPOS.map(t => (
              <option key={t} value={t}>{TIPO_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500 transition flex-1 min-w-[200px]">
          <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            placeholder="Buscar por e-mail ou assunto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="text-sm text-slate-700 bg-transparent outline-none w-full placeholder:text-slate-400"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        <button
          onClick={fetchLogs}
          title="Atualizar"
          className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium px-3 py-2 rounded-lg transition-colors bg-white"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Atualizar
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
            <svg className="animate-spin size-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
            </svg>
            Carregando logs...
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Data / Hora</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Destinatário</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assunto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-16 text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-[40px] text-slate-300">mail_off</span>
                        <span>Nenhum email registrado</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap font-mono text-xs">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TIPO_COLORS[log.tipo] ?? 'bg-gray-100 text-gray-500'}`}>
                          {TIPO_LABELS[log.tipo] ?? log.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 truncate max-w-[220px]">
                        {log.para}
                      </td>
                      <td className="px-6 py-4 text-slate-600 truncate max-w-[320px]">
                        {log.assunto}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Footer: pagination info */}
            {logs.length > 0 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/60">
                <span className="text-xs text-slate-500">
                  Exibindo {Math.min((page - 1) * PAGE_SIZE + 1, logs.length)}–{Math.min(page * PAGE_SIZE, logs.length)} de {logs.length} resultado{logs.length !== 1 ? 's' : ''}
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                    </button>
                    <span className="px-3 py-1 text-xs text-slate-600">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
