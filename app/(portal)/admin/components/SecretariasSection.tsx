'use client'
import { useState } from 'react'

type Secretaria = {
  id: string
  nome: string
  ativo: boolean
  createdAt: Date
  _count?: { users: number }
}

export default function SecretariasSection({ secretarias: initial }: { secretarias: Secretaria[] }) {
  const [secretarias, setSecretarias] = useState<Secretaria[]>(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Secretaria | null>(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    const res = await fetch('/api/admin/secretarias')
    if (res.ok) setSecretarias(await res.json())
  }

  function openCriar() {
    setNome(''); setEditTarget(null); setError(''); setModalOpen(true)
  }

  function openEditar(s: Secretaria) {
    setNome(s.nome); setEditTarget(s); setError(''); setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      let res: Response
      if (editTarget) {
        res = await fetch(`/api/admin/secretarias/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome }),
        })
      } else {
        res = await fetch('/api/admin/secretarias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome }),
        })
      }
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setModalOpen(false)
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAtivo(s: Secretaria) {
    setError('')
    const res = await fetch(`/api/admin/secretarias/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !s.ativo }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error); return }
    await reload()
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">Secretarias</h2>
        <button onClick={openCriar} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Nova Secretaria
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 font-bold text-slate-500 uppercase text-xs tracking-wider">Nome</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase text-xs tracking-wider">Usuarios Ativos</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase text-xs tracking-wider">Status</th>
              <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase text-xs tracking-wider">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {secretarias.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{s.nome}</td>
                <td className="px-4 py-3 text-slate-600">{s._count?.users ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {s.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  <button onClick={() => openEditar(s)} className="text-blue-600 hover:underline text-xs font-medium">Editar</button>
                  <button onClick={() => toggleAtivo(s)} className="text-slate-500 hover:underline text-xs font-medium">
                    {s.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-slate-900">{editTarget ? 'Editar Secretaria' : 'Nova Secretaria'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Nome</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 h-10 text-sm focus:ring-2 focus:ring-blue-500"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
