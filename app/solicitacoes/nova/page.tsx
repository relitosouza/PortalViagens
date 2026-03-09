'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PASSOS = ['Dados do Servidor', 'A Missão', 'Logística', 'Documentos']

type FormData = {
  nomeCompleto: string; matricula: string; cpf: string
  dataNascimento: string; celular: string; emailServidor: string
  justificativaPublica: string; nexoCargo: string
  destino: string; dataIda: string; dataVolta: string
  justificativaLocal: string; fichaOrcamentaria: string
}

const EMPTY_FORM: FormData = {
  nomeCompleto: '', matricula: '', cpf: '', dataNascimento: '',
  celular: '', emailServidor: '', justificativaPublica: '', nexoCargo: '',
  destino: '', dataIda: '', dataVolta: '', justificativaLocal: '', fichaOrcamentaria: ''
}

export default function NovaSolicitacaoPage() {
  const router = useRouter()
  const [passo, setPasso] = useState(0)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [arquivos, setArquivos] = useState<File[]>([])
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const update = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  function validarPasso(): boolean {
    setErro('')
    if (passo === 0) {
      if (!form.nomeCompleto || !form.matricula || !form.cpf || !form.dataNascimento || !form.celular || !form.emailServidor) {
        setErro('Preencha todos os campos obrigatórios')
        return false
      }
    }
    if (passo === 1) {
      if (!form.justificativaPublica || !form.nexoCargo) {
        setErro('Preencha todos os campos obrigatórios')
        return false
      }
    }
    if (passo === 2) {
      if (!form.destino || !form.dataIda || !form.dataVolta || !form.justificativaLocal || !form.fichaOrcamentaria) {
        setErro('Preencha todos os campos obrigatórios')
        return false
      }
      if (new Date(form.dataVolta) <= new Date(form.dataIda)) {
        setErro('Data de volta deve ser após a data de ida')
        return false
      }
    }
    return true
  }

  function avancar() {
    if (validarPasso()) setPasso(p => p + 1)
  }

  async function handleSubmit() {
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao enviar solicitação')
        setEnviando(false)
        return
      }

      // Upload de documentos se houver
      if (arquivos.length > 0) {
        const fd = new FormData()
        arquivos.forEach(f => fd.append('files', f))
        fd.append('solicitacaoId', data.id)
        fd.append('tipo', 'CONVITE')
        await fetch('/api/upload', { method: 'POST', body: fd })
      }

      router.push('/dashboard')
    } catch {
      setErro('Erro ao enviar solicitação. Tente novamente.')
      setEnviando(false)
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-800 text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-blue-200 hover:text-white text-sm">← Voltar</Link>
          <h1 className="font-bold">Nova Solicitação de Viagem</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6">
        {/* Indicador de passos */}
        <div className="flex items-center mb-8">
          {PASSOS.map((p, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${i < passo ? 'bg-green-500 text-white' : i === passo ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {i < passo ? '✓' : i + 1}
                </div>
                <span className={`text-xs hidden sm:block transition-colors
                  ${i === passo ? 'text-blue-700 font-semibold' : i < passo ? 'text-green-600' : 'text-gray-400'}`}>
                  {p}
                </span>
              </div>
              {i < PASSOS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 transition-colors ${i < passo ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          {/* Passo 0: Dados do Servidor */}
          {passo === 0 && (
            <>
              <h2 className="font-semibold text-gray-800 border-b pb-2">Dados do Servidor</h2>
              <div>
                <label className={labelCls}>Nome Completo *</label>
                <input className={inputCls} value={form.nomeCompleto} onChange={update('nomeCompleto')} placeholder="Nome completo do servidor" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Matrícula *</label>
                  <input className={inputCls} value={form.matricula} onChange={update('matricula')} />
                </div>
                <div>
                  <label className={labelCls}>CPF *</label>
                  <input className={inputCls} value={form.cpf} onChange={update('cpf')} placeholder="000.000.000-00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data de Nascimento *</label>
                  <input type="date" className={inputCls} value={form.dataNascimento} onChange={update('dataNascimento')} />
                </div>
                <div>
                  <label className={labelCls}>Celular *</label>
                  <input className={inputCls} value={form.celular} onChange={update('celular')} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div>
                <label className={labelCls}>E-mail do Servidor *</label>
                <input type="email" className={inputCls} value={form.emailServidor} onChange={update('emailServidor')} placeholder="servidor@osasco.sp.gov.br" />
              </div>
            </>
          )}

          {/* Passo 1: A Missão */}
          {passo === 1 && (
            <>
              <h2 className="font-semibold text-gray-800 border-b pb-2">A Missão</h2>
              <div>
                <label className={labelCls}>Justificativa do Interesse Público *</label>
                <textarea className={inputCls} rows={5} value={form.justificativaPublica} onChange={update('justificativaPublica')}
                  placeholder="Descreva o benefício para a administração pública, o objetivo da missão e os resultados esperados..." />
              </div>
              <div>
                <label className={labelCls}>Nexo com o Cargo *</label>
                <textarea className={inputCls} rows={3} value={form.nexoCargo} onChange={update('nexoCargo')}
                  placeholder="Como esta missão se relaciona diretamente com as atribuições e responsabilidades do cargo..." />
              </div>
            </>
          )}

          {/* Passo 2: Logística */}
          {passo === 2 && (
            <>
              <h2 className="font-semibold text-gray-800 border-b pb-2">Logística</h2>
              <div>
                <label className={labelCls}>Destino *</label>
                <input className={inputCls} value={form.destino} onChange={update('destino')} placeholder="Cidade / Estado / País" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data de Ida *</label>
                  <input type="date" className={inputCls} value={form.dataIda} onChange={update('dataIda')} />
                </div>
                <div>
                  <label className={labelCls}>Data de Volta *</label>
                  <input type="date" className={inputCls} value={form.dataVolta} onChange={update('dataVolta')} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Justificativa de Localização (Economicidade) *</label>
                <textarea className={inputCls} rows={3} value={form.justificativaLocal} onChange={update('justificativaLocal')}
                  placeholder="Justifique a escolha de localização e hospedagem considerando o princípio da economicidade..." />
              </div>
              <div>
                <label className={labelCls}>Ficha Orçamentária de Contrapartida *</label>
                <input className={inputCls} value={form.fichaOrcamentaria} onChange={update('fichaOrcamentaria')}
                  placeholder="Ex: 01.001.04.122.0001.2001.339030" />
              </div>
              {/* Aviso de vedação legal */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 text-sm font-semibold">⚠️ Vedação Legal — Art. 4º, § 2º</p>
                <p className="text-amber-700 text-sm mt-1">
                  O pagamento por <strong>adiantamento é vedado</strong> neste fluxo. Toda despesa será
                  processada pela Secretaria de Finanças após aprovação e emissão da Ordem de Serviço.
                </p>
              </div>
            </>
          )}

          {/* Passo 3: Documentos */}
          {passo === 3 && (
            <>
              <h2 className="font-semibold text-gray-800 border-b pb-2">Documentos</h2>
              <div>
                <label className={labelCls}>Convite / Folder / Pauta do Evento *</label>
                <p className="text-xs text-gray-500 mb-2">Anexe o documento que comprova o evento ou missão (PDF, imagem ou Word)</p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => setArquivos(Array.from(e.target.files ?? []))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100 cursor-pointer"
                />
                {arquivos.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {arquivos.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5">
                        <span>📎</span> {f.name}
                        <span className="text-gray-400 text-xs ml-auto">{(f.size / 1024).toFixed(0)} KB</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm font-semibold">ℹ️ Tramitação Digital — Art. 3º</p>
                <p className="text-blue-700 text-sm mt-1">
                  Toda a tramitação é <strong>100% digital</strong>. Não é necessário o envio de
                  documentos físicos entre as secretarias de Osasco.
                </p>
              </div>
            </>
          )}

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {erro}
            </div>
          )}

          {/* Navegação */}
          <div className="flex justify-between pt-4 border-t">
            {passo > 0 ? (
              <button onClick={() => { setErro(''); setPasso(p => p - 1) }}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">
                ← Voltar
              </button>
            ) : (
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">Cancelar</Link>
            )}
            {passo < PASSOS.length - 1 ? (
              <button onClick={avancar}
                className="bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition text-sm font-semibold">
                Próximo →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={enviando}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition text-sm font-semibold disabled:opacity-50">
                {enviando ? 'Enviando...' : '✓ Enviar Solicitação'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
