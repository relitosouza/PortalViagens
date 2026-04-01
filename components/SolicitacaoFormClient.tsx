'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { parseExcelSolicitacao } from '@/lib/utils/parse-excel-solicitacao'

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
  userRole?: string
  status?: string
}

export function SolicitacaoFormClient({ initialData, userName, userRole = 'DEMANDANTE', status = 'RASCUNHO' }: Props) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})
  const [enviando, setEnviando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [importWarning, setImportWarning] = useState('')
  const [importing, setImporting] = useState(false)
  const [arquivos, setArquivos] = useState<File[]>([])
  const [form, setForm] = useState<FormData>(initialData ?? {
    nomeCompleto: '', matricula: '', cpf: '', dataNascimento: '',
    celular: '', emailServidor: '', justificativaPublica: '', nexoCargo: '',
    destino: '', dataIda: '', dataVolta: '', justificativaLocal: '',
    indicacaoVoo: '', indicacaoHospedagem: '', fichaOrcamentaria: ''
  })

  const update = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [field]: e.target.value }))
      if (fieldErrors[field]) {
        setFieldErrors(prev => {
          const next = { ...prev }
          delete next[field]
          return next
        })
      }
    }

  async function handleImport(file: File) {
    setImportWarning('')
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const dados = await parseExcelSolicitacao(buffer)
      setForm(f => ({ ...f, ...dados }))

      const FIELD_LABELS: Partial<Record<keyof FormData, string>> = {
        nomeCompleto: 'Nome Completo',
        matricula: 'Matrícula',
        cpf: 'CPF',
        dataNascimento: 'Data de Nascimento',
        celular: 'Telefone/WhatsApp',
        emailServidor: 'E-mail Institucional',
        justificativaPublica: 'Justificativa do Interesse Público',
        nexoCargo: 'Nexo com as Atribuições do Cargo',
        destino: 'Destino',
        dataIda: 'Data de Ida',
        dataVolta: 'Data de Volta',
        justificativaLocal: 'Justificativa de Localização',
        fichaOrcamentaria: 'Ficha Orçamentária',
      }
      const obrigatorios = Object.keys(FIELD_LABELS) as (keyof FormData)[]
      const faltando = obrigatorios.filter(k => !dados[k as keyof typeof dados]).map(k => FIELD_LABELS[k] ?? k)
      if (faltando.length > 0) {
        setImportWarning(`Preencha manualmente: ${faltando.join(', ')}.`)
      }
    } catch {
      setImportWarning('Erro ao ler a planilha. Verifique se o arquivo é um .xlsx válido.')
    } finally {
      setImporting(false)
    }
  }

  function validar(): boolean {
    setErro('')
    const errors: Record<string, boolean> = {}
    let hasError = false

    if (status === 'RASCUNHO' || status === 'DEVOLVIDO_SECRETARIO' || !form.id) {
      const servidorCampos = ['nomeCompleto', 'matricula', 'cpf', 'dataNascimento', 'celular', 'emailServidor']
      servidorCampos.forEach(field => {
        if (!form[field as keyof FormData]) {
          errors[field] = true
          hasError = true
        }
      })
      if (hasError) {
        setErro('Preencha todos os campos obrigatórios na seção "Dados do Servidor"')
      }
    }
    
    // Na etapa do secretário, estes campos são obrigatórios
    if (status === 'AGUARDANDO_APROVACAO_PASTA' && (userRole === 'SECRETARIO' || userRole === 'ADMIN')) {
      if (!form.justificativaPublica) {
        errors.justificativaPublica = true
        hasError = true
      }
      if (!form.nexoCargo) {
        errors.nexoCargo = true
        hasError = true
      }
      if (hasError) {
        setErro('Atenção: Para prosseguir com a aprovação, é obrigatório preencher a Justificativa de Interesse Público e o Nexo com as Atribuições do Cargo.')
      }
    }

    if ((status === 'RASCUNHO' || status === 'DEVOLVIDO_SECRETARIO' || !form.id)) {
      const logisticaCampos = ['destino', 'dataIda', 'dataVolta', 'justificativaLocal', 'fichaOrcamentaria']
      let logisticaMissing = false
      logisticaCampos.forEach(field => {
        if (!form[field as keyof FormData]) {
          errors[field] = true
          hasError = true
          logisticaMissing = true
        }
      })
      if (logisticaMissing && !erro) {
        setErro('Preencha todos os campos obrigatórios na seção "Logística" e "Orçamento"')
      }
    }

    if (form.dataIda && form.dataVolta && new Date(form.dataVolta) <= new Date(form.dataIda)) {
      errors.dataIda = true
      errors.dataVolta = true
      setErro('Data de volta deve ser após a data de ida')
      hasError = true
    }

    setFieldErrors(errors)
    return !hasError
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

  async function devolverParaAjuste() {
    if (!form.id) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/workflow/${form.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao: 'AJUSTE_DEMANDANTE', observacao: 'Retornado pelo Secretário para ajustes.' }),
      })
      if (!res.ok) throw new Error('Erro ao devolver')
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setErro(err.message)
      setEnviando(false)
    }
  }

  const getInputCls = (hasError?: boolean) => 
    `w-full rounded-lg border transition-all bg-[#f6f6f8] focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 h-10 px-4 text-sm ${
      hasError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
    }`
  const getTextareaCls = (hasError?: boolean) => 
    `w-full rounded-lg border transition-all bg-[#f6f6f8] focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 px-4 py-3 text-sm ${
      hasError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
    }`
  const labelCls = "block text-xs font-bold text-slate-600 mb-1.5 uppercase"

  return (
    <div className="p-8 space-y-8 max-w-[960px] mx-auto w-full">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-8 px-8 -mt-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 leading-none">
            {form.id ? 'Editar Solicitação' : 'Requisição de Viagem'}
          </h2>
          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${form.id ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {status === 'AGUARDANDO_APROVACAO_PASTA' ? 'Gabinete do Secretário' : form.id ? 'Ajustes no Processo' : 'Novo Processo'}
          </span>
        </div>
        {status === 'AGUARDANDO_APROVACAO_PASTA' && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 text-sm">info</span>
            <span className="text-xs text-indigo-700 font-medium italic">"Sua solicitação foi encaminhada para o Gabinete do Secretário para preenchimento dos detalhes da missão e aprovação de mérito."</span>
          </div>
        )}
      </header>

      {/* Importação via Excel */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <a
          href="/modelo-solicitacao-viagem.xlsx"
          download
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <span className="material-symbols-outlined text-base">download</span>
          Baixar modelo (.xlsx)
        </a>
        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${importing ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-blue-300 text-blue-700 hover:bg-blue-50 cursor-pointer'}`}>
          <span className="material-symbols-outlined text-base">upload_file</span>
          Importar planilha
          <input
            type="file"
            accept=".xlsx"
            disabled={importing}
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleImport(file)
              e.target.value = ''
            }}
          />
        </label>
        {importWarning && (
          <span className="text-amber-700 text-xs font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">warning</span>
            {importWarning}
          </span>
        )}
      </div>

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
              <input className={getInputCls(fieldErrors.nomeCompleto)} value={form.nomeCompleto} onChange={update('nomeCompleto')} placeholder="Nome como consta no crachá" type="text" />
            </div>
            <div>
              <label className={labelCls}>Matrícula</label>
              <input className={getInputCls(fieldErrors.matricula)} value={form.matricula} onChange={update('matricula')} placeholder="000.000-0" type="text" />
            </div>
            <div>
              <label className={labelCls}>CPF</label>
              <input className={getInputCls(fieldErrors.cpf)} value={form.cpf} onChange={update('cpf')} placeholder="000.000.000-00" type="text" />
            </div>
            <div>
              <label className={labelCls}>Data de Nascimento</label>
              <input className={getInputCls(fieldErrors.dataNascimento)} value={form.dataNascimento} onChange={update('dataNascimento')} type="date" />
            </div>
            <div>
              <label className={labelCls}>Telefone / WhatsApp</label>
              <input className={getInputCls(fieldErrors.celular)} value={form.celular} onChange={update('celular')} placeholder="(11) 90000-0000" type="tel" />
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <label className={labelCls}>E-mail Institucional</label>
              <input className={getInputCls(fieldErrors.emailServidor)} value={form.emailServidor} onChange={update('emailServidor')} placeholder="servidor@osasco.sp.gov.br" type="email" />
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
              <label className={labelCls}>
                Justificativa do Interesse Público
                {(userRole === 'SECRETARIO' || userRole === 'ADMIN') && status === 'AGUARDANDO_SECRETARIO' && <span className="text-red-500 ml-1">*</span>}
              </label>
              <textarea 
                className={getTextareaCls(fieldErrors.justificativaPublica)} 
                rows={4} 
                value={form.justificativaPublica} 
                onChange={update('justificativaPublica')}
                disabled={!(userRole === 'SECRETARIO' || userRole === 'ADMIN') || status !== 'AGUARDANDO_APROVACAO_PASTA'}
                placeholder={status === 'AGUARDANDO_APROVACAO_PASTA' ? "Preencha a justificativa de mérito público para o município..." : "A ser preenchido pelo Secretário..."} 
              />
              {status === 'AGUARDANDO_APROVACAO_PASTA' && userRole === 'DEMANDANTE' && (
                <p className="text-[10px] text-indigo-600 mt-1 italic font-medium">Aguardando preenchimento do Secretário</p>
              )}
            </div>
            <div>
              <label className={labelCls}>
                Nexo com as Atribuições do Cargo
                {(userRole === 'SECRETARIO' || userRole === 'ADMIN') && status === 'AGUARDANDO_SECRETARIO' && <span className="text-red-500 ml-1">*</span>}
              </label>
              <textarea 
                className={getTextareaCls(fieldErrors.nexoCargo)} 
                rows={3} 
                value={form.nexoCargo} 
                onChange={update('nexoCargo')}
                disabled={!(userRole === 'SECRETARIO' || userRole === 'ADMIN') || status !== 'AGUARDANDO_APROVACAO_PASTA'}
                placeholder={status === 'AGUARDANDO_APROVACAO_PASTA' ? "Explique como o evento se relaciona com o cargo..." : "A ser preenchido pelo Secretário..."} 
              />
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
                <input className={`w-full pl-10 pr-4 rounded-lg border transition-all bg-[#f6f6f8] focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 h-10 text-sm ${fieldErrors.destino ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                  value={form.destino} onChange={update('destino')} placeholder="Ex: Brasília, DF" type="text" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Data de Ida</label>
              <input className={getInputCls(fieldErrors.dataIda)} value={form.dataIda} onChange={update('dataIda')} type="date" />
            </div>
            <div>
              <label className={labelCls}>Data de Volta</label>
              <input className={getInputCls(fieldErrors.dataVolta)} value={form.dataVolta} onChange={update('dataVolta')} type="date" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Justificativa de Localização (Escolha do Destino)</label>
              <textarea className={getTextareaCls(fieldErrors.justificativaLocal)} rows={2} value={form.justificativaLocal} onChange={update('justificativaLocal')}
                placeholder="Por que o evento ocorre neste local específico?" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Indicação de Voo (Preferência)</label>
              <input className={getInputCls(fieldErrors.indicacaoVoo)} value={form.indicacaoVoo} onChange={update('indicacaoVoo')}
                placeholder="Sugira horários ou números de voo de sua preferência" type="text" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Indicação de Hospedagem (Preferência)</label>
              <input className={getInputCls(fieldErrors.indicacaoHospedagem)} value={form.indicacaoHospedagem} onChange={update('indicacaoHospedagem')}
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
            <input className={getInputCls(fieldErrors.fichaOrcamentaria)} value={form.fichaOrcamentaria} onChange={update('fichaOrcamentaria')}
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
            disabled={salvando || enviando || importing}
            className="w-full md:w-auto px-8 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors disabled:opacity-50 text-sm"
          >
            {salvando ? 'Salvando...' : 'Salvar Rascunho'}
          </button>
          {status === 'AGUARDANDO_APROVACAO_PASTA' && (userRole === 'SECRETARIO' || userRole === 'ADMIN') && (
            <button
              type="button"
              onClick={devolverParaAjuste}
              disabled={enviando || salvando || importing}
              className="w-full md:w-auto px-8 py-2.5 rounded-lg border border-red-300 text-red-700 font-bold hover:bg-red-50 transition-colors text-sm"
            >
              Devolver para Ajuste
            </button>
          )}
          <button
            type="button"
            onClick={() => enviar(false)}
            disabled={enviando || salvando || importing}
            className="w-full md:w-auto px-10 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:shadow-lg hover:shadow-blue-600/30 hover:bg-blue-700 transition-all disabled:opacity-50 text-sm"
          >
            {enviando ? 'Processando...' : status === 'AGUARDANDO_APROVACAO_PASTA' ? 'Aprovar e Seguir' : status === 'DEVOLVIDO_SECRETARIO' ? 'Resubmeter Solicitação' : 'Enviar Solicitação'}
          </button>
        </div>
      </div>
    </div>
  )
}
