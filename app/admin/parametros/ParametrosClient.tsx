'use client'

import { useState } from 'react'

interface Parametro {
  chave: string
  valor: string
  descricao: string
  updatedAt: string
}

interface Props {
  parametros: Parametro[]
}

const LABELS: Record<string, string> = {
  DIAS_UTEIS_ANTECEDENCIA_MINIMA: 'Antecedência mínima para solicitação',
  DIAS_UTEIS_PRAZO_PRESTACAO: 'Prazo para prestação de contas',
  DIAS_ALERTA_VENCIMENTO: 'Dias de alerta antes do vencimento',
  UPLOAD_MAX_MB: 'Tamanho máximo de upload (MB)',
}

const UNITS: Record<string, string> = {
  DIAS_UTEIS_ANTECEDENCIA_MINIMA: 'dias úteis',
  DIAS_UTEIS_PRAZO_PRESTACAO: 'dias úteis',
  DIAS_ALERTA_VENCIMENTO: 'dias',
  UPLOAD_MAX_MB: 'MB',
}

export function ParametrosClient({ parametros }: Props) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(parametros.map(p => [p.chave, p.valor]))
  )
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function handleChange(chave: string, value: string) {
    setValores(prev => ({ ...prev, [chave]: value }))
    setSuccessMsg(null)
    setErrorMsg(null)
  }

  async function handleSaveAll() {
    setSaving(true)
    setSuccessMsg(null)
    setErrorMsg(null)

    try {
      const updates = Object.entries(valores).map(([chave, valor]) => ({ chave, valor }))

      const res = await fetch('/api/admin/parametros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.error ?? 'Erro ao salvar parâmetros.')
      } else {
        setSuccessMsg('Parâmetros salvos com sucesso.')
      }
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f6f8] px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-blue-600 text-3xl">settings</span>
            <h1 className="text-2xl font-semibold text-gray-900">Parâmetros Operacionais</h1>
          </div>
          <p className="text-gray-500 text-sm ml-10">
            Configure os valores usados pelas regras de negócio do sistema.
          </p>
        </div>

        {/* Success/Error messages */}
        {successMsg && (
          <div className="mb-6 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-green-600 text-xl">check_circle</span>
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-red-600 text-xl">error</span>
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Parameter cards */}
        <div className="space-y-4 mb-8">
          {parametros.map(p => (
            <div
              key={p.chave}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-base">
                      {LABELS[p.chave] ?? p.chave}
                    </span>
                  </div>
                  <code className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded">
                    {p.chave}
                  </code>
                  <p className="text-sm text-gray-500 mt-2">{p.descricao}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Última atualização:{' '}
                    {new Date(p.updatedAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={1}
                    value={valores[p.chave] ?? ''}
                    onChange={e => handleChange(p.chave, e.target.value)}
                    className="w-24 text-right text-2xl font-bold text-blue-600 border-b-2 border-blue-200 focus:border-blue-600 outline-none bg-transparent transition-colors px-1 py-1"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    {UNITS[p.chave] ?? ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Save all button */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-xl">
              {saving ? 'hourglass_empty' : 'save'}
            </span>
            {saving ? 'Salvando...' : 'Salvar Todos'}
          </button>
        </div>
      </div>
    </div>
  )
}
