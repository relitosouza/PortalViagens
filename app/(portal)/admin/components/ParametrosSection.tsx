'use client'

import { useState } from 'react'

type Param = {
  chave: string
  valor: string
  descricao: string
  updatedAt: Date
}

const PARAM_LABELS: Record<string, { label: string; hint: string; unit: string; type?: string }> = {
  DIAS_UTEIS_ANTECEDENCIA_MINIMA: {
    label: 'Regra de Antecedência (Pré-Viagem)',
    hint: 'Determina o prazo mínimo para abertura de novas solicitações de passagem/diária.',
    unit: 'Dias Úteis',
  },
  DIAS_UTEIS_PRAZO_PRESTACAO: {
    label: 'Prazo Prestação de Contas (Pós-Viagem)',
    hint: 'Prazo legal antes do bloqueio automático do CPF no sistema.',
    unit: 'Dias Úteis',
  },
  DIAS_ALERTA_VENCIMENTO: {
    label: 'Dias de Alerta Antes do Vencimento',
    hint: 'Quantos dias antes do prazo enviar alerta ao servidor.',
    unit: 'Dias',
  },
  UPLOAD_MAX_MB: {
    label: 'Tamanho Máximo de Upload',
    hint: 'Limite máximo de arquivos enviados por solicitação.',
    unit: 'MB',
  },
  NUMERO_EMPENHO: {
    label: 'Número do Empenho Global',
    hint: 'Identificador do empenho que suporta as despesas de viagens.',
    unit: 'Nº',
    type: 'text',
  },
  VALOR_EMPENHO: {
    label: 'Valor Total do Empenho (Teto Orçamentário)',
    hint: 'Cota inicial autorizada para o período.',
    unit: 'R$',
    type: 'number',
  },
  SALDO_EMPENHO: {
    label: 'Saldo disponível em Empenho',
    hint: 'Valor atualizado após débitos das solicitações aprovadas.',
    unit: 'R$',
    type: 'number',
  },
}

export default function ParametrosSection({ parametros: initial }: { parametros: Param[] }) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(initial.map(p => [p.chave, p.valor]))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [success, setSuccess] = useState<Record<string, boolean>>({})

  async function atualizar(chave: string) {
    setSaving(s => ({ ...s, [chave]: true }))
    try {
      const res = await fetch('/api/admin/parametros', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave, valor: valores[chave] }),
      })
      if (res.ok) {
        setSuccess(s => ({ ...s, [chave]: true }))
        setTimeout(() => setSuccess(s => ({ ...s, [chave]: false })), 2000)
      }
    } finally {
      setSaving(s => ({ ...s, [chave]: false }))
    }
  }

  const displayOrder = [
    'NUMERO_EMPENHO', 
    'VALOR_EMPENHO', 
    'SALDO_EMPENHO',
    'DIAS_UTEIS_ANTECEDENCIA_MINIMA', 
    'DIAS_UTEIS_PRAZO_PRESTACAO', 
    'DIAS_ALERTA_VENCIMENTO', 
    'UPLOAD_MAX_MB'
  ]

  return (
    <div className="p-6 space-y-6">
      <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        <span className="font-bold text-amber-700">Atenção:</span> Alterações são aplicadas imediatamente. Ao atualizar o <span className="font-bold">Saldo</span>, o sistema passará a usar este novo valor como base para os próximos débitos.
      </p>
      {displayOrder.map(chave => {
        const meta = PARAM_LABELS[chave]
        if (!meta) return null
        return (
          <div key={chave} className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">{meta.label}</label>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <input
                  type={meta.type || 'number'}
                  min={meta.type === 'text' ? undefined : "0"}
                  step={meta.unit === 'R$' ? "0.01" : "1"}
                  value={valores[chave] ?? ''}
                  onChange={e => setValores(v => ({ ...v, [chave]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 pr-16 px-3 py-2 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase">
                  {meta.unit}
                </span>
              </div>
              <button
                onClick={() => atualizar(chave)}
                disabled={saving[chave]}
                className={`px-4 py-2 border rounded-lg text-sm font-bold transition-colors ${
                  success[chave]
                    ? 'border-green-400 text-green-600 bg-green-50'
                    : 'border-primary text-primary hover:bg-primary/10'
                } disabled:opacity-50`}
              >
                {saving[chave] ? '...' : success[chave] ? '✓ Salvo' : 'Atualizar'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 italic">{meta.hint}</p>
          </div>
        )
      })}
    </div>
  )
}
