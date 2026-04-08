'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type NotificationItem = {
  id: string
  titulo: string
  descricao: string | null
  tipo: string
  lido: boolean
  createdAt: string
  solicitacaoId: string | null
  solicitacao: { destino: string; nomeCompleto: string } | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

const TIPO_ICON: Record<string, { icon: string; color: string }> = {
  APROVADO: { icon: 'check_circle', color: 'text-emerald-500' },
  REPROVADO: { icon: 'cancel', color: 'text-rose-500' },
  AJUSTE: { icon: 'edit_note', color: 'text-amber-500' },
  LEMBRETE: { icon: 'schedule', color: 'text-blue-400' },
  URGENTE: { icon: 'warning', color: 'text-orange-500' },
  DEFAULT: { icon: 'notifications', color: 'text-slate-400' },
}

function getTipoIcon(tipo: string) {
  for (const key of Object.keys(TIPO_ICON)) {
    if (tipo.includes(key)) return TIPO_ICON[key]
  }
  return TIPO_ICON.DEFAULT
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setCount(data.count)
      setItems(data.items)
    } catch {
      // silent
    }
  }, [])

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleOpen() {
    setOpen(prev => !prev)
  }

  async function markAll() {
    setLoading(true)
    try {
      await fetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({}) })
      setCount(0)
      setItems(prev => prev.map(n => ({ ...n, lido: true })))
    } finally {
      setLoading(false)
    }
  }

  async function markOne(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setItems(prev => prev.map(n => n.id === id ? { ...n, lido: true } : n))
    setCount(prev => Math.max(0, prev - 1))
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        aria-label={`Notificações, ${count || 'nenhuma'} nova${count > 0 ? 's' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[22px]" aria-hidden="true">notifications</span>
        {count > 0 && (
          <span 
            role="status"
            className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center leading-none"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-900">Notificações</span>
            {count > 0 && (
              <button
                onClick={markAll}
                disabled={loading}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <span className="material-symbols-outlined text-[36px] mb-2">notifications_off</span>
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              items.map(item => {
                const { icon, color } = getTipoIcon(item.tipo)
                const content = (
                  <div
                    key={item.id}
                    className={`flex gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${!item.lido ? 'bg-blue-50/50' : ''}`}
                    onClick={() => !item.lido && markOne(item.id)}
                  >
                    <span className={`material-symbols-outlined text-[20px] mt-0.5 flex-shrink-0 ${color}`}>
                      {icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!item.lido ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {item.titulo}
                      </p>
                      {item.descricao && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{item.descricao}</p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1">{timeAgo(item.createdAt)}</p>
                    </div>
                    {!item.lido && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                )

                return item.solicitacaoId ? (
                  <Link
                    key={item.id}
                    href={`/solicitacoes/${item.solicitacaoId}`}
                    onClick={() => { setOpen(false); if (!item.lido) markOne(item.id) }}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 text-center">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="text-xs text-blue-600 hover:underline"
              >
                Ver todas no dashboard
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
