'use client'

import { useState } from 'react'

type Usuario = {
  id: string
  name: string
  email: string
  role: string
  cpfBloqueado: boolean | null
  ativo: boolean | null
  createdAt: Date
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-primary/10 text-primary',
  SECOL: 'bg-green-100 text-green-700',
  SEGOV: 'bg-purple-100 text-purple-700',
  SF: 'bg-orange-100 text-orange-700',
  DEMANDANTE: 'bg-blue-100 text-blue-700',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  SECOL: 'SECOL / DRP',
  SEGOV: 'SEGOV',
  SF: 'Secretaria de Finanças',
  DEMANDANTE: 'Demandante',
}

type ModalMode = 'criar' | 'editar' | null

export default function UsuariosSection({ usuarios: initial }: { usuarios: Usuario[] }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(initial)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editTarget, setEditTarget] = useState<Usuario | null>(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'DEMANDANTE', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  function openCriar() {
    setForm({ name: '', email: '', role: 'DEMANDANTE', password: '' })
    setEditTarget(null)
    setModalMode('criar')
    setError('')
  }

  function openEditar(u: Usuario) {
    setForm({ name: u.name, email: u.email, role: u.role, password: '' })
    setEditTarget(u)
    setModalMode('editar')
    setError('')
  }

  function closeModal() {
    setModalMode(null)
    setEditTarget(null)
    setError('')
  }

  async function reloadUsuarios() {
    const res = await fetch('/api/admin/usuarios')
    if (res.ok) setUsuarios(await res.json())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (modalMode === 'criar') {
        const res = await fetch('/api/admin/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
        setSuccessMsg('Usuário criado com sucesso.')
      } else if (modalMode === 'editar' && editTarget) {
        const body: Record<string, unknown> = { name: form.name, role: form.role }
        if (form.password) body.password = form.password
        const res = await fetch(`/api/admin/usuarios/${editTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
        setSuccessMsg('Usuário atualizado.')
      }
      await reloadUsuarios()
      closeModal()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAtivo(u: Usuario) {
    const res = await fetch(`/api/admin/usuarios/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !u.ativo }),
    })
    if (res.ok) await reloadUsuarios()
  }

  async function desbloquearCpf(u: Usuario) {
    const res = await fetch(`/api/admin/usuarios/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpfBloqueado: false }),
    })
    if (res.ok) { await reloadUsuarios(); setSuccessMsg('CPF desbloqueado.'); setTimeout(() => setSuccessMsg(''), 3000) }
  }

  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  return (
    <>
      {successMsg && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
          {successMsg}
        </div>
      )}
      <div className="px-6 py-3 flex justify-end border-b border-slate-100">
        <button
          onClick={openCriar}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-all"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          Novo Usuário
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/30">
              <th className="px-6 py-4">Nome</th>
              <th className="px-6 py-4">E-mail</th>
              <th className="px-6 py-4">Perfil de Acesso</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {usuarios.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                      {getInitials(u.name)}
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${ROLE_BADGE[u.role] ?? 'bg-slate-100 text-slate-500'}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className={`flex items-center gap-2 ${u.ativo ? 'text-green-600' : 'text-slate-400'}`}>
                      <span className={`size-2 rounded-full ${u.ativo ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                      <span className="text-xs font-medium">{u.ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    {u.cpfBloqueado && (
                      <span className="text-[10px] text-red-600 font-bold uppercase">CPF Bloqueado</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEditar(u)}
                      className="p-2 text-slate-400 hover:text-primary transition-colors"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => toggleAtivo(u)}
                      className={`p-2 transition-colors ${u.ativo ? 'text-slate-400 hover:text-red-500' : 'text-slate-400 hover:text-green-500'}`}
                      title={u.ativo ? 'Desativar conta' : 'Ativar conta'}
                    >
                      <span className="material-symbols-outlined text-lg">{u.ativo ? 'lock' : 'lock_open'}</span>
                    </button>
                    {u.cpfBloqueado && (
                      <button
                        onClick={() => desbloquearCpf(u)}
                        className="p-2 text-orange-400 hover:text-orange-600 transition-colors"
                        title="Desbloquear CPF"
                      >
                        <span className="material-symbols-outlined text-lg">key</span>
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
      {modalMode && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">{modalMode === 'criar' ? 'Novo Usuário' : 'Editar Usuário'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Nome completo</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              {modalMode === 'criar' && (
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Perfil de acesso</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="DEMANDANTE">Demandante</option>
                  <option value="SECOL">SECOL / DRP</option>
                  <option value="SEGOV">SEGOV</option>
                  <option value="SF">Secretaria de Finanças</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">
                  {modalMode === 'criar' ? 'Senha temporária' : 'Nova senha (deixe em branco para manter)'}
                </label>
                <input
                  type="password"
                  required={modalMode === 'criar'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
