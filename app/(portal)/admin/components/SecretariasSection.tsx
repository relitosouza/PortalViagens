'use client'

import { useState, useEffect } from 'react'

type Secretaria = {
  id: string
  nome: string
  ativo: boolean
  createdAt: Date
  _count?: {
    users: number
  }
}

export default function SecretariasSection() {
  const [secretarias, setSecretarias] = useState<Secretaria[]>([])
  const [loading, setLoading] = useState(true)
  const [modalMode, setModalMode] = useState<'criar' | 'editar' | null>(null)
  const [editTarget, setEditTarget] = useState<Secretaria | null>(null)
  const [form, setForm] = useState({ nome: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    fetchSecretarias()
  }, [])

  async function fetchSecretarias() {
    try {
      const res = await fetch('/api/admin/secretarias')
      if (res.ok) setSecretarias(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function openCriar() {
    setForm({ nome: '' })
    setEditTarget(null)
    setModalMode('criar')
    setError('')
  }

  function openEditar(s: Secretaria) {
    setForm({ nome: s.nome })
    setEditTarget(s)
    setModalMode('editar')
    setError('')
  }

  function closeModal() {
    setModalMode(null)
    setEditTarget(null)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const url = modalMode === 'criar' 
        ? '/api/admin/secretarias' 
        : `/api/admin/secretarias/${editTarget?.id}`
      
      const res = await fetch(url, {
        method: modalMode === 'criar' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Erro ao salvar')
      }

      setSuccessMsg(modalMode === 'criar' ? 'Secretaria criada!' : 'Secretaria atualizada!')
      await fetchSecretarias()
      closeModal()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleAtivo(s: Secretaria) {
    try {
      const res = await fetch(`/api/admin/secretarias/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !s.ativo }),
      })
      if (res.ok) await fetchSecretarias()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">domain</span>
          <h2 className="text-lg font-bold text-slate-900">Gestão de Secretarias</h2>
          {!loading && <span className="text-xs text-slate-400 font-medium">{secretarias.length} registros</span>}
        </div>
        <button
          onClick={openCriar}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Nova Secretaria
        </button>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
          {successMsg}
        </div>
      )}

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Carregando...</div>
        ) : secretarias.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Nenhuma secretaria cadastrada.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/30">
                <th className="px-6 py-4">Nome da Secretaria</th>
                <th className="px-6 py-4">Usuários Vinculados</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {secretarias.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">{s.nome}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {s._count?.users || 0} usuários
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-2 ${s.ativo ? 'text-green-600' : 'text-slate-400'}`}>
                      <span className={`size-2 rounded-full ${s.ativo ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                      <span className="text-xs font-medium">{s.ativo ? 'Ativa' : 'Inativa'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditar(s)}
                        className="p-2 text-slate-400 hover:text-primary transition-colors"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => toggleAtivo(s)}
                        className={`p-2 transition-colors ${s.ativo ? 'text-slate-400 hover:text-red-500' : 'text-slate-400 hover:text-green-500'}`}
                        title={s.ativo ? 'Desativar' : 'Ativar'}
                      >
                        <span className="material-symbols-outlined text-lg">{s.ativo ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalMode && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">{modalMode === 'criar' ? 'Nova Secretaria' : 'Editar Secretaria'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Nome da Secretaria</label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={e => setForm({ nome: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="Ex: Secretaria de Saúde"
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
    </div>
  )
}
