'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type FormData = {
  id: string
  nomeCompleto: string; matricula: string; cpf: string
  dataNascimento: string; celular: string; emailServidor: string
  justificativaPublica: string; nexoCargo: string
  destino: string; dataIda: string; dataVolta: string
  justificativaLocal: string; indicacaoVoo: string; indicacaoHospedagem: string
  fichaOrcamentaria: string
}

type Props = {
  solicitacao: FormData
}

export function SecretarioAprovacaoClient({ solicitacao }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(solicitacao)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [modal, setModal] = useState<{ decisao: 'DEVOLVIDO' | 'REPROVADO' } | null>(null)
  const [justificativa, setJustificativa] = useState('')

  const update = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  const inputCls = "w-full rounded-lg border-slate-300 bg-[#f6f6f8] focus:ring-blue-600 focus:border-blue-600 text-slate-900 h-10 px-4 text-sm"
  const textareaCls = "w-full rounded-lg border-slate-300 bg-[#f6f6f8] focus:ring-blue-600 focus:border-blue-600 text-slate-900 px-4 py-3 text-sm"
  const labelCls = "block text-xs font-bold text-slate-600 mb-1.5 uppercase"

  async function salvarCampos() {
    const res = await fetch(`/api/solicitacoes/${form.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form }),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Erro ao salvar campos')
    }
  }

  async function executarDecisao(decisao: string, obs?: string) {
    setLoading(true)
    setErro('')
    try {
      if (decisao === 'APROVADO') {
        if (!form.justificativaPublica.trim() || !form.nexoCargo.trim()) {
          setErro('Preencha os campos de "Detalhes da Missão" antes de aprovar.')
          setLoading(false)
          return
        }
        await salvarCampos()
      }
      const res = await fetch(`/api/workflow/${form.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, observacao: obs ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao processar ação')
        setLoading(false)
        return
      }
      router.push('/portal/secretario')
      router.refresh()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado')
      setLoading(false)
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-[960px] mx-auto w-full">
      <header className="flex items-center gap-4 border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-8 px-8 -mt-8">
        <h2 className="text-xl font-bold text-slate-900">Análise de Solicitação</h2>
        <span className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-violet-100 text-violet-700">
          Aprovação do Secretário
        </span>
      </header>

      {/* Seção: Dados do Servidor */}
      <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-700 mb-4">Dados do Servidor</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={labelCls}>Nome Completo</label><input className={inputCls} value={form.nomeCompleto} onChange={update('nomeCompleto')} /></div>
          <div><label className={labelCls}>Matrícula</label><input className={inputCls} value={form.matricula} onChange={update('matricula')} /></div>
          <div><label className={labelCls}>CPF</label><input className={inputCls} value={form.cpf} onChange={update('cpf')} /></div>
          <div><label className={labelCls}>Data de Nascimento</label><input type="date" className={inputCls} value={form.dataNascimento} onChange={update('dataNascimento')} /></div>
          <div><label className={labelCls}>Celular</label><input className={inputCls} value={form.celular} onChange={update('celular')} /></div>
          <div><label className={labelCls}>E-mail Institucional</label><input className={inputCls} value={form.emailServidor} onChange={update('emailServidor')} /></div>
        </div>
      </section>

      {/* Seção: Detalhes da Missão — exclusivo Secretário */}
      <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4 border-2 border-violet-200">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          Detalhes da Missão
          <span className="text-[10px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 px-2 py-0.5 rounded">
            Preenchimento do Secretário
          </span>
        </h3>
        <div>
          <label className={labelCls}>Justificativa do Interesse Público <span className="text-red-500">*</span></label>
          <textarea className={textareaCls} rows={4} value={form.justificativaPublica} onChange={update('justificativaPublica')} placeholder="Descreva os benefícios da viagem para o município de Osasco..." />
        </div>
        <div>
          <label className={labelCls}>Nexo com as Atribuições do Cargo <span className="text-red-500">*</span></label>
          <textarea className={textareaCls} rows={3} value={form.nexoCargo} onChange={update('nexoCargo')} placeholder="Descreva a relação entre a viagem e as atribuições do cargo..." />
        </div>
      </section>

      {/* Seção: Logística */}
      <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-700 mb-4">Logística</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={labelCls}>Destino</label><input className={inputCls} value={form.destino} onChange={update('destino')} /></div>
          <div><label className={labelCls}>Ficha Orçamentária</label><input className={inputCls} value={form.fichaOrcamentaria} onChange={update('fichaOrcamentaria')} /></div>
          <div><label className={labelCls}>Data de Ida</label><input type="date" className={inputCls} value={form.dataIda} onChange={update('dataIda')} /></div>
          <div><label className={labelCls}>Data de Volta</label><input type="date" className={inputCls} value={form.dataVolta} onChange={update('dataVolta')} /></div>
        </div>
        <div><label className={labelCls}>Justificativa de Localização</label><textarea className={textareaCls} rows={3} value={form.justificativaLocal} onChange={update('justificativaLocal')} /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={labelCls}>Indicação de Voo (opcional)</label><input className={inputCls} value={form.indicacaoVoo} onChange={update('indicacaoVoo')} /></div>
          <div><label className={labelCls}>Indicação de Hospedagem (opcional)</label><input className={inputCls} value={form.indicacaoHospedagem} onChange={update('indicacaoHospedagem')} /></div>
        </div>
      </section>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{erro}</div>
      )}

      {/* Botões de ação */}
      <div className="flex flex-wrap gap-3 pb-8">
        <button
          onClick={() => executarDecisao('APROVADO')}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition disabled:opacity-50"
        >
          {loading ? 'Processando...' : 'Aprovar Solicitação'}
        </button>
        <button
          onClick={() => { setModal({ decisao: 'DEVOLVIDO' }); setJustificativa('') }}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition disabled:opacity-50"
        >
          Devolver para Correção
        </button>
        <button
          onClick={() => { setModal({ decisao: 'REPROVADO' }); setJustificativa('') }}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition disabled:opacity-50"
        >
          Reprovar Solicitação
        </button>
      </div>

      {/* Modal justificativa */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-slate-900">
              {modal.decisao === 'DEVOLVIDO' ? 'Devolver para Correção' : 'Reprovar Solicitação'}
            </h3>
            <p className="text-sm text-slate-500">Informe o motivo (obrigatório):</p>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              placeholder="Descreva o motivo..."
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!justificativa.trim()) return
                  executarDecisao(modal.decisao, justificativa.trim())
                  setModal(null)
                }}
                disabled={!justificativa.trim() || loading}
                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 ${modal.decisao === 'REPROVADO' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
