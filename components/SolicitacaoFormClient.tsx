'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type FormData = {
  id?: string
  nomeCompleto: string; matricula: string; cpf: string
  dataNascimento: string; celular: string; emailServidor: string
  justificativaPublica: string; nexoCargo: string
  destino: string; dataIda: string; dataVolta: string
  justificativaLocal: string; indicacaoVoo: string; indicacaoHospedagem: string
  fichaOrcamentaria: string
}

type Props = {
  initialData?: FormData
  userName: string
}

export function SolicitacaoFormClient({ initialData, userName }: Props) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [arquivos, setArquivos] = useState<File[]>([])
  const [form, setForm] = useState<FormData>(initialData ?? {
    nomeCompleto: '', matricula: '', cpf: '', dataNascimento: '',
    celular: '', emailServidor: '', justificativaPublica: '', nexoCargo: '',
    destino: '', dataIda: '', dataVolta: '', justificativaLocal: '',
    indicacaoVoo: '', indicacaoHospedagem: '', fichaOrcamentaria: ''
  })

  const update = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  function validar(): boolean {
    setErro('')
    if (!form.nomeCompleto || !form.matricula || !form.cpf || !form.dataNascimento || !form.celular || !form.emailServidor) {
      setErro('Preencha todos os campos obrigatórios na seção "Dados do Servidor"')
      return false
    }
    if (!form.justificativaPublica || !form.nexoCargo) {
      setErro('Preencha todos os campos obrigatórios na seção "Detalhes da Missão"')
      return false
    }
    if (!form.destino || !form.dataIda || !form.dataVolta || !form.justificativaLocal || !form.fichaOrcamentaria) {
      setErro('Preencha todos os campos obrigatórios na seção "Logística"')
      return false
    }
    if (new Date(form.dataVolta) <= new Date(form.dataIda)) {
      setErro('Data de volta deve ser após a data de ida')
      return false
    }
    return true
  }

  async function enviar(rascunho: boolean) {
    if (!rascunho && !validar()) return
    if (rascunho) {
      setSalvando(true)
    } else {
      setEnviando(true)
    }
    setErro('')

    try {
      const url = form.id ? `/api/solicitacoes/${form.id}` : '/api/solicitacoes'
      const method = form.id ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rascunho })
      })
      const text = await res.text()
      let data: Record<string, any> = {}
      try { data = JSON.parse(text) } catch { /* ignore */ }

      if (!res.ok) {
        setErro(typeof data.error === 'string' ? data.error : `Erro do servidor (${res.status}): ${text.slice(0, 100)}`)
        return
      }

      const solId = data.id || form.id

      if (arquivos.length > 0 && solId) {
        const fd = new FormData()
        arquivos.forEach(f => fd.append('files', f))
        fd.append('solicitacaoId', String(solId))
        fd.append('tipo', 'CONVITE')
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const upText = await uploadRes.text()
          let upData: Record<string, any> = {}
          try { upData = JSON.parse(upText) } catch {}
          setErro(typeof upData.error === 'string' ? upData.error : `Erro no envio de arquivos (${uploadRes.status})`)
          return
        }
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setErro('Erro de rede ou falha inesperada: ' + err.message)
    } finally {
      setSalvando(false)
      setEnviando(false)
    }
  }

  const inputCls = "w-full rounded-lg border-slate-300 bg-[#f6f6f8] focus:ring-blue-600 focus:border-blue-600 text-slate-900 h-10 px-4 text-sm"
  const textareaCls = "w-full rounded-lg border-slate-300 bg-[#f6f6f8] focus:ring-blue-600 focus:border-blue-600 text-slate-900 px-4 py-3 text-sm"
  const labelCls = "block text-xs font-bold text-slate-600 mb-1.5 uppercase"

  return (
    <div className="p-8 space-y-8 max-w-[960px] mx-auto w-full">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-8 px-8 -mt-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 leading-none">
            {form.id ? 'Editar Solicitação' : 'Requisição de Viagem'}
          </h2>
          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${form.id ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {form.id ? 'Ajustes no Processo' : 'Novo Processo'}
          </span>
        </div>
      </header>

      <div className="space-y-8 bg-white p-6 md:p-10 rounded-xl border border-slate-200 shadow-sm">
        {/* 1. Dados do Servidor */}
        <section>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-blue-600">person</span>
            <h2 className="text-slate-900 text-lg font-bold">1. Dados do Servidor</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className={labelCls}>Nome Completo</label>
              <input className={inputCls} value={form.nomeCompleto} onChange={update('nomeCompleto')} placeholder="Nome como consta no crachá" type="text" />
            </div>
            <div>
              <label className={labelCls}>Matrícula</label>
              <input className={inputCls} value={form.matricula} onChange={update('matricula')} placeholder="000.000-0" type="text" />
            </div>
            <div>
              <label className={labelCls}>CPF</label>
              <input className={inputCls} value={form.cpf} onChange={update('cpf')} placeholder="000.000.000-00" type="text" />
            </div>
            <div>
              <label className={labelCls}>Data de Nascimento</label>
              <input className={inputCls} value={form.dataNascimento} onChange={update('dataNascimento')} type="date" />
            </div>
            <div>
              <label className={labelCls}>Telefone / WhatsApp</label>
              <input className={inputCls} value={form.celular} onChange={update('celular')} placeholder="(11) 90000-0000" type="tel" />
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <label className={labelCls}>E-mail Institucional</label>
              <input className={inputCls} value={form.emailServidor} onChange={update('emailServidor')} placeholder="servidor@osasco.sp.gov.br" type="email" />
            </div>
          </div>
        </section>

        {/* 2. Detalhes da Missão */}
        <section>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-blue-600">assignment</span>
            <h2 className="text-slate-900 text-lg font-bold">2. Detalhes da Missão</h2>
          </div>
          <div className="space-y-6">
            <div>
              <label className={labelCls}>Justificativa do Interesse Público</label>
              <textarea className={textareaCls} rows={4} value={form.justificativaPublica} onChange={update('justificativaPublica')}
                placeholder="Descreva os benefícios da viagem para o município de Osasco..." />
            </div>
            <div>
              <label className={labelCls}>Nexo com as Atribuições do Cargo</label>
              <textarea className={textareaCls} rows={3} value={form.nexoCargo} onChange={update('nexoCargo')}
                placeholder="Explique como este evento se relaciona com suas funções atuais..." />
            </div>
          </div>
        </section>

        {/* 3. Logística */}
        <section>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-blue-600">flight_takeoff</span>
            <h2 className="text-slate-900 text-lg font-bold">3. Logística</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className={labelCls}>Destino (Cidade / Estado / País)</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">location_on</span>
                <input className="w-full pl-10 pr-4 rounded-lg border border-slate-300 bg-[#f6f6f8] focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 h-10 text-sm"
                  value={form.destino} onChange={update('destino')} placeholder="Ex: Brasília, DF" type="text" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Data de Ida</label>
              <input className={inputCls} value={form.dataIda} onChange={update('dataIda')} type="date" />
            </div>
            <div>
              <label className={labelCls}>Data de Volta</label>
              <input className={inputCls} value={form.dataVolta} onChange={update('dataVolta')} type="date" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Justificativa de Localização (Escolha do Destino)</label>
              <textarea className={textareaCls} rows={2} value={form.justificativaLocal} onChange={update('justificativaLocal')}
                placeholder="Por que o evento ocorre neste local específico?" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Indicação de Voo (Preferência)</label>
              <input className={inputCls} value={form.indicacaoVoo} onChange={update('indicacaoVoo')}
                placeholder="Sugira horários ou números de voo de sua preferência" type="text" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Indicação de Hospedagem (Preferência)</label>
              <input className={inputCls} value={form.indicacaoHospedagem} onChange={update('indicacaoHospedagem')}
                placeholder="Sugira um hotel específico ou região de interesse" type="text" />
            </div>
          </div>
        </section>

        {/* 4. Upload de Documentos */}
        <section>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-blue-600">upload_file</span>
            <h2 className="text-slate-900 text-lg font-bold">4. Upload de Documentos</h2>
          </div>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">
            <span className="material-symbols-outlined text-slate-400 text-[48px] mb-3 block">cloud_upload</span>
            <p className="text-slate-700 font-medium mb-1">Anexar Convite, Folder ou Pauta do Evento</p>
            <p className="text-slate-500 text-xs mb-4">PDF, JPG ou PNG (Máx 5MB)</p>
            <label className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block text-sm">
              Selecionar Arquivo
              <input
                className="hidden"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={e => setArquivos(Array.from(e.target.files ?? []))}
              />
            </label>
          </div>
        </section>

        {/* 5. Orçamento */}
        <section>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-blue-600">payments</span>
            <h2 className="text-slate-900 text-lg font-bold">5. Orçamento</h2>
          </div>
          <div>
            <label className={labelCls}>Indicação da Ficha Orçamentária</label>
            <input className={inputCls} value={form.fichaOrcamentaria} onChange={update('fichaOrcamentaria')}
              placeholder="Número da ficha ou dotação orçamentária" type="text" />
          </div>
        </section>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex gap-2">
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
            {erro}
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-100">
          <Link href="/dashboard"
            className="w-full md:w-auto px-8 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors text-center text-sm">
            Cancelar
          </Link>
          <button
            type="button"
            onClick={() => enviar(true)}
            disabled={salvando || enviando}
            className="w-full md:w-auto px-8 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors disabled:opacity-50 text-sm"
          >
            {salvando ? 'Salvando...' : 'Salvar Rascunho'}
          </button>
          <button
            type="button"
            onClick={() => enviar(false)}
            disabled={enviando || salvando}
            className="w-full md:w-auto px-10 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:shadow-lg hover:shadow-blue-600/30 hover:bg-blue-700 transition-all disabled:opacity-50 text-sm"
          >
            {enviando ? 'Enviando...' : 'Enviar Solicitação'}
          </button>
        </div>
      </div>
    </div>
  )
}
