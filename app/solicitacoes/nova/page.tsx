'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type FormData = {
  nomeCompleto: string; matricula: string; cpf: string
  dataNascimento: string; celular: string; emailServidor: string
  justificativaPublica: string; nexoCargo: string
  destino: string; dataIda: string; dataVolta: string
  justificativaLocal: string; indicacaoVoo: string; indicacaoHospedagem: string
  fichaOrcamentaria: string
}

const EMPTY_FORM: FormData = {
  nomeCompleto: '', matricula: '', cpf: '', dataNascimento: '',
  celular: '', emailServidor: '', justificativaPublica: '', nexoCargo: '',
  destino: '', dataIda: '', dataVolta: '', justificativaLocal: '',
  indicacaoVoo: '', indicacaoHospedagem: '', fichaOrcamentaria: ''
}

export default function NovaSolicitacaoPage() {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [arquivos, setArquivos] = useState<File[]>([])
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

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
      const res = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rascunho })
      })
      const text = await res.text()
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(text) } catch { /* ignore */ }

      if (!res.ok) {
        setErro(typeof data.error === 'string' ? data.error : `Erro do servidor (${res.status}): ${text.slice(0, 100)}`)
        return
      }

      if (arquivos.length > 0) {
        const fd = new FormData()
        arquivos.forEach(f => fd.append('files', f))
        fd.append('solicitacaoId', String(data.id))
        fd.append('tipo', 'CONVITE')
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const upText = await uploadRes.text()
          let upData: Record<string, unknown> = {}
          try { upData = JSON.parse(upText) } catch {}
          setErro(typeof upData.error === 'string' ? upData.error : `Erro no envio de arquivos (${uploadRes.status})`)
          return
        }
      }

      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErro('Erro de rede ou falha inesperada: ' + msg)
    } finally {
      setSalvando(false)
      setEnviando(false)
    }
  }

  const inputCls = "w-full rounded-lg border-slate-300 bg-[#f6f6f8] focus:ring-blue-600 focus:border-blue-600 text-slate-900 h-12 px-4"
  const textareaCls = "w-full rounded-lg border-slate-300 bg-[#f6f6f8] focus:ring-blue-600 focus:border-blue-600 text-slate-900 px-4 py-3"
  const labelCls = "block text-sm font-semibold text-slate-700 mb-2"

  return (
    <div className="relative flex min-h-screen flex-col bg-[#f6f6f8]">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 md:px-20 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="text-blue-600 size-8">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fill="currentColor" fillRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-slate-900 text-lg font-bold leading-tight tracking-tight">Prefeitura de Osasco</h2>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <Link className="text-slate-700 text-sm font-medium hover:text-blue-600 transition-colors" href="/dashboard">Início</Link>
          <Link className="text-slate-700 text-sm font-medium hover:text-blue-600 transition-colors" href="/dashboard">Minhas Viagens</Link>
        </nav>
      </header>

      <main className="flex flex-1 justify-center py-10 px-4">
        <div className="flex flex-col max-w-[960px] w-full flex-1">

          {/* Title */}
          <div className="flex flex-col gap-2 mb-8">
            <h1 className="text-slate-900 text-4xl font-black leading-tight tracking-tight">Requisição de Viagem</h1>
            <p className="text-slate-500 text-base">Portal de solicitação de passagens e diárias para servidores municipais.</p>
          </div>

          {/* Form */}
          <div className="space-y-8 bg-white p-6 md:p-10 rounded-xl border border-slate-200 shadow-sm">

            {/* 1. Dados do Servidor */}
            <section>
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                <span className="material-symbols-outlined text-blue-600">person</span>
                <h2 className="text-slate-900 text-xl font-bold">1. Dados do Servidor</h2>
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
                <h2 className="text-slate-900 text-xl font-bold">2. Detalhes da Missão</h2>
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
                <h2 className="text-slate-900 text-xl font-bold">3. Logística</h2>
              </div>

              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
                <span className="material-symbols-outlined text-amber-600 flex-shrink-0">warning</span>
                <p className="text-sm text-amber-800">
                  <strong>Atenção:</strong> Solicitações devem ser feitas com no mínimo 15 dias úteis de antecedência.
                  Caso a data de ida seja inferior a este prazo, anexe justificativa de urgência.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className={labelCls}>Destino (Cidade / Estado / País)</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">location_on</span>
                    <input className="w-full pl-10 pr-4 rounded-lg border border-slate-300 bg-[#f6f6f8] focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 h-12"
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

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 text-sm font-semibold">⚠️ Vedação Legal — Art. 4º, § 2º</p>
                <p className="text-amber-700 text-sm mt-1">
                  O pagamento por <strong>adiantamento é vedado</strong> neste fluxo. Toda despesa será
                  processada pela Secretaria de Finanças após aprovação e emissão da Ordem de Serviço.
                </p>
              </div>
            </section>

            {/* 4. Upload de Documentos */}
            <section>
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                <span className="material-symbols-outlined text-blue-600">upload_file</span>
                <h2 className="text-slate-900 text-xl font-bold">4. Upload de Documentos</h2>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">
                <span className="material-symbols-outlined text-slate-400 text-[48px] mb-3 block">cloud_upload</span>
                <p className="text-slate-700 font-medium mb-1">Anexar Convite, Folder ou Pauta do Evento</p>
                <p className="text-slate-500 text-xs mb-4">PDF, JPG ou PNG (Máx 5MB)</p>
                <label className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block">
                  Selecionar Arquivo
                  <input
                    className="hidden"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => setArquivos(Array.from(e.target.files ?? []))}
                  />
                </label>
                {arquivos.length > 0 && (
                  <ul className="mt-4 space-y-1 text-left max-w-sm mx-auto">
                    {arquivos.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-600 bg-white rounded px-3 py-1.5 border border-slate-200">
                        <span className="material-symbols-outlined text-[18px] text-slate-400">attach_file</span>
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="text-slate-400 text-xs">{(f.size / 1024).toFixed(0)} KB</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm font-semibold">ℹ️ Tramitação Digital — Art. 3º</p>
                <p className="text-blue-700 text-sm mt-1">
                  Toda a tramitação é <strong>100% digital</strong>. Não é necessário o envio de
                  documentos físicos entre as secretarias de Osasco.
                </p>
              </div>
            </section>

            {/* 5. Orçamento */}
            <section>
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                <span className="material-symbols-outlined text-blue-600">payments</span>
                <h2 className="text-slate-900 text-xl font-bold">5. Orçamento</h2>
              </div>
              <div>
                <label className={labelCls}>Indicação da Ficha Orçamentária</label>
                <input className={inputCls} value={form.fichaOrcamentaria} onChange={update('fichaOrcamentaria')}
                  placeholder="Número da ficha ou dotação orçamentária" type="text" />
              </div>
            </section>

            {/* Error */}
            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex gap-2">
                <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
                {erro}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col md:flex-row items-center justify-end gap-4 pt-6 border-t border-slate-100">
              <Link href="/dashboard"
                className="w-full md:w-auto px-8 py-3 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors text-center">
                Cancelar
              </Link>
              <button
                type="button"
                onClick={() => enviar(true)}
                disabled={salvando || enviando}
                className="w-full md:w-auto px-8 py-3 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar Rascunho'}
              </button>
              <button
                type="button"
                onClick={() => enviar(false)}
                disabled={enviando || salvando}
                className="w-full md:w-auto px-10 py-3 rounded-lg bg-blue-600 text-white font-bold hover:shadow-lg hover:shadow-blue-600/30 hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {enviando ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-12 text-center pb-10">
            <p className="text-slate-500 text-sm">Prefeitura do Município de Osasco - Secretaria de Administração</p>
            <p className="text-slate-400 text-xs mt-2">Dúvidas? Entre em contato com o RH no ramal 4455.</p>
          </footer>
        </div>
      </main>
    </div>
  )
}
