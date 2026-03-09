'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function PrestacaoPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [relatorio, setRelatorio] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!relatorio.trim()) {
      setErro('O relatório de atividades é obrigatório')
      return
    }
    setEnviando(true)
    setErro('')

    const res = await fetch(`/api/prestacao/${params.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relatorio }),
    })

    const data = await res.json()

    if (!res.ok) {
      setErro(data.error ?? 'Erro ao enviar prestação')
      setEnviando(false)
      return
    }

    // Upload de evidências se houver
    if (arquivos.length > 0) {
      const fd = new FormData()
      arquivos.forEach(f => fd.append('files', f))
      fd.append('solicitacaoId', params.id)
      fd.append('prestacaoId', data.prestacaoId)
      fd.append('tipo', 'EVIDENCIA')
      await fetch('/api/upload', { method: 'POST', body: fd })
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-800 text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={`/solicitacoes/${params.id}`} className="text-blue-200 hover:text-white text-sm">
            ← Voltar
          </Link>
          <h1 className="font-bold">Prestação de Contas — Art. 4º</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
            <p className="text-amber-800 font-semibold text-sm">⚠️ Prazo Legal — Art. 4º</p>
            <p className="text-amber-700 text-sm mt-1">
              O envio deve ser realizado em até <strong>5 dias úteis</strong> após a data de retorno.
              O não cumprimento resultará em <strong>bloqueio do CPF</strong> para novas solicitações de viagem.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Relatório de Atividades *
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Descreva as atividades realizadas, resultados obtidos e benefícios para a administração pública
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] resize-y"
              value={relatorio}
              onChange={e => setRelatorio(e.target.value)}
              placeholder="Descreva detalhadamente as atividades realizadas durante a missão, eventos que participou, conhecimentos adquiridos, contatos estabelecidos e demais resultados que beneficiam a administração pública municipal de Osasco..."
              required
            />
            <p className="text-xs text-gray-400 mt-1">{relatorio.length} caracteres</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evidências (Fotos, Certificados, Lista de Presença)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Anexe documentos que comprovem a participação no evento (PDF, JPG, PNG)
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setArquivos(Array.from(e.target.files ?? []))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium cursor-pointer"
            />
            {arquivos.length > 0 && (
              <ul className="mt-3 space-y-1">
                {arquivos.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5">
                    📎 {f.name}
                    <span className="text-gray-400 text-xs ml-auto">{(f.size / 1024).toFixed(0)} KB</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition font-semibold text-sm disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : '✓ Enviar Prestação de Contas'}
          </button>
        </form>
      </div>
    </div>
  )
}
