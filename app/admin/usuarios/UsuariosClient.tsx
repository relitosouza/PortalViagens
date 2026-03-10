'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Role = 'DEMANDANTE' | 'SECOL' | 'SEGOV' | 'SF' | 'ADMIN' | 'INATIVO'

interface User {
  id: string
  name: string | null
  email: string
  role: string
  cpfBloqueado: boolean
  createdAt: string | Date
}

const ROLE_LABELS: Record<string, string> = {
  DEMANDANTE: 'Demandante',
  SECOL: 'SECOL',
  SEGOV: 'SEGOV',
  SF: 'Finanças',
  ADMIN: 'Admin',
  INATIVO: 'Inativo',
}

const ROLE_COLORS: Record<string, string> = {
  DEMANDANTE: 'bg-slate-100 text-slate-700',
  SECOL: 'bg-blue-100 text-blue-700',
  SEGOV: 'bg-purple-100 text-purple-700',
  SF: 'bg-green-100 text-green-700',
  ADMIN: 'bg-red-100 text-red-700',
  INATIVO: 'bg-gray-100 text-gray-400',
}

const ROLES: Role[] = ['DEMANDANTE', 'SECOL', 'SEGOV', 'SF', 'ADMIN']

interface ModalState {
  open: boolean
  mode: 'create' | 'edit'
  user?: User
}

interface FormData {
  name: string
  email: string
  password: string
  role: Role
}

const defaultForm: FormData = {
  name: '',
  email: '',
  password: '',
  role: 'DEMANDANTE',
}

export function UsuariosClient({ users }: { users: User[] }) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create' })
  const [form, setForm] = useState<FormData>(defaultForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openCreate() {
    setForm(defaultForm)
    setError('')
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(user: User) {
    setForm({
      name: user.name ?? '',
      email: user.email,
      password: '',
      role: (user.role as Role) in ROLE_LABELS ? (user.role as Role) : 'DEMANDANTE',
    })
    setError('')
    setModal({ open: true, mode: 'edit', user })
  }

  function closeModal() {
    setModal({ open: false, mode: 'create' })
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (modal.mode === 'create') {
        const res = await fetch('/api/admin/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Erro ao criar usuário')
          setLoading(false)
          return
        }
      } else if (modal.mode === 'edit' && modal.user) {
        const payload: Partial<FormData> = {
          name: form.name,
          role: form.role,
        }
        if (form.password) payload.password = form.password
        const res = await fetch(`/api/admin/usuarios/${modal.user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Erro ao atualizar usuário')
          setLoading(false)
          return
        }
      }
      closeModal()
      router.refresh()
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  async function handleUnlockCpf(userId: string) {
    try {
      await fetch(`/api/admin/usuarios/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpfBloqueado: false }),
      })
      router.refresh()
    } catch {
      // silently fail — UI will show stale state until next refresh
    }
  }

  async function handleDeactivate(userId: string) {
    if (!confirm('Deseja realmente desativar este usuário?')) return
    try {
      await fetch(`/api/admin/usuarios/${userId}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      // silently fail
    }
  }

  function formatDate(date: string | Date) {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Gestão de Usuários</h2>
          <span className="bg-blue-100 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full">
            {users.length}
          </span>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Novo Usuário
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">E-mail</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Papel</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">CPF Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Criado em</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                      {(user.name ?? user.email).slice(0, 2).toUpperCase()}
                    </div>
                    <span className="truncate max-w-[160px]">{user.name ?? '—'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-500'}`}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.cpfBloqueado ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                        Bloqueado
                      </span>
                      <button
                        onClick={() => handleUnlockCpf(user.id)}
                        title="Desbloquear CPF"
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">lock_open</span>
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      OK
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-500">{formatDate(user.createdAt)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(user)}
                      title="Editar usuário"
                      className="flex items-center gap-1 text-slate-600 hover:text-blue-600 text-xs font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Editar
                    </button>
                    {user.role !== 'INATIVO' && (
                      <button
                        onClick={() => handleDeactivate(user.id)}
                        title="Desativar usuário"
                        className="flex items-center gap-1 text-slate-500 hover:text-red-600 text-xs font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">person_off</span>
                        Desativar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-blue-600/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-600 text-[20px]">
                    {modal.mode === 'create' ? 'person_add' : 'manage_accounts'}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {modal.mode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {error}
                </div>
              )}

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nome completo</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Maria Silva"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">E-mail</label>
                <input
                  type="email"
                  required
                  disabled={modal.mode === 'edit'}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Senha{modal.mode === 'edit' && <span className="font-normal text-slate-400 ml-1">(deixe em branco para manter)</span>}
                </label>
                <input
                  type="password"
                  required={modal.mode === 'create'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={modal.mode === 'create' ? 'Senha de acesso' : 'Nova senha (opcional)'}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                />
              </div>

              {/* Role */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Papel</label>
                <select
                  required
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition bg-white"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              {/* Footer */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading && (
                    <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                  )}
                  {modal.mode === 'create' ? 'Criar Usuário' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
