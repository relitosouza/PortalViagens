'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface VencidaItem {
  id: string
  solicitacaoId: string
  prazoFinal: string
  diasAtraso: number
  destino: string
  servidor: string
  email: string
}

interface CpfBloqueadoItem {
  id: string
  name: string
  email: string
  createdAt: string
}

interface Props {
  vencidas: VencidaItem[]
  cpfsBloqueados: CpfBloqueadoItem[]
}

export function PrestacoesClient({ vencidas, cpfsBloqueados }: Props) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'vencidas' | 'bloqueados'>('vencidas')

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === cpfsBloqueados.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(cpfsBloqueados.map(u => u.id)))
    }
  }

  async function desbloquear(userIds: string[]) {
    if (userIds.length === 0) return
    setLoading(true)
    try {
      await fetch('/api/admin/prestacoes/desbloquear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      })
      setSelectedIds(new Set())
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-blue-600 text-[28px]">assignment_late</span>
          <h1 className="text-2xl font-bold text-slate-900">Monitoramento de Prestações</h1>
        </div>
        <p className="text-slate-500 text-sm mb-5">
          Acompanhe prestações de contas vencidas e gerencie bloqueios de CPF.
        </p>

        {/* Summary stats */}
        <div className="flex gap-4">
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-3">
            <div className="bg-red-100 rounded-full p-2">
              <span className="material-symbols-outlined text-red-600 text-[20px]">warning</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{vencidas.length}</p>
              <p className="text-xs text-slate-500">Prestações vencidas</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-3">
            <div className="bg-orange-100 rounded-full p-2">
              <span className="material-symbols-outlined text-orange-600 text-[20px]">block</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{cpfsBloqueados.length}</p>
              <p className="text-xs text-slate-500">CPFs bloqueados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('vencidas')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'vencidas'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">schedule</span>
          Prestações Vencidas
          {vencidas.length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
              {vencidas.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('bloqueados')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'bloqueados'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">lock</span>
          CPFs Bloqueados
          {cpfsBloqueados.length > 0 && (
            <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
              {cpfsBloqueados.length}
            </span>
          )}
        </button>
      </div>

      {/* Section A: Prestações Vencidas */}
      {activeTab === 'vencidas' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500 text-[20px]">warning</span>
            <h2 className="font-semibold text-slate-900 text-sm">Prestações de Contas Vencidas</h2>
          </div>

          {vencidas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="bg-green-100 rounded-full p-4">
                <span className="material-symbols-outlined text-green-600 text-[32px]">check_circle</span>
              </div>
              <p className="text-green-700 font-semibold text-sm">Nenhuma prestação vencida</p>
              <p className="text-slate-500 text-xs">Todos os servidores estão em dia com suas prestações de contas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Servidor</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mail</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Destino</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Prazo Final</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dias em Atraso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vencidas.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                            {item.servidor.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900">{item.servidor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{item.email}</td>
                      <td className="px-6 py-4 text-slate-600">{item.destino}</td>
                      <td className="px-6 py-4 text-slate-600">{formatDate(item.prazoFinal)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          {item.diasAtraso}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Section B: CPFs Bloqueados */}
      {activeTab === 'bloqueados' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500 text-[20px]">lock</span>
              <h2 className="font-semibold text-slate-900 text-sm">CPFs Bloqueados Automaticamente</h2>
            </div>

            {cpfsBloqueados.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => desbloquear(Array.from(selectedIds))}
                  disabled={selectedIds.size === 0 || loading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">lock_open</span>
                  Desbloquear Selecionados
                  {selectedIds.size > 0 && (
                    <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                      {selectedIds.size}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => desbloquear(cpfsBloqueados.map(u => u.id))}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">lock_open</span>
                  )}
                  Desbloquear Todos
                </button>
              </div>
            )}
          </div>

          {cpfsBloqueados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="bg-green-100 rounded-full p-4">
                <span className="material-symbols-outlined text-green-600 text-[32px]">check_circle</span>
              </div>
              <p className="text-green-700 font-semibold text-sm">Nenhum CPF bloqueado</p>
              <p className="text-slate-500 text-xs">Não há servidores com CPF bloqueado no momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === cpfsBloqueados.length && cpfsBloqueados.length > 0}
                        onChange={toggleAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mail</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bloqueado desde</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cpfsBloqueados.map(user => (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.has(user.id) ? 'bg-blue-50' : ''}`}
                      onClick={() => toggleSelect(user.id)}
                    >
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(user.id)}
                          onChange={() => toggleSelect(user.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs flex-shrink-0">
                            {user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{user.email}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{formatDate(user.createdAt)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
                          <span className="material-symbols-outlined text-[14px]">block</span>
                          Bloqueado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
