'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Acao = {
  label: string
  decisao: string
  cor: 'blue' | 'green' | 'red'
  descricao: string
}

// Ações disponíveis por status + role
const ACOES_MAP: Record<string, Record<string, Acao[]>> = {
  AGUARDANDO_COTACAO: {
    SECOL: [{
      label: 'Confirmar Cotação e Avançar',
      decisao: 'APROVADO',
      cor: 'blue',
      descricao: 'Confirma que a cotação da Ata de Registro de Preços foi consultada e as opções de voos/hotéis foram anexadas.'
    }],
  },
  AGUARDANDO_VIABILIDADE: {
    SEGOV: [
      {
        label: 'Aprovar Viabilidade',
        decisao: 'APROVADO',
        cor: 'green',
        descricao: 'Aprova a solicitação com base na conveniência e oportunidade político-financeira.'
      },
      {
        label: 'Reprovar Solicitação',
        decisao: 'REPROVADO',
        cor: 'red',
        descricao: 'Reprova a solicitação. Informe o motivo no campo de observação.'
      },
    ],
  },
  AGUARDANDO_EMISSAO: {
    SECOL: [{
      label: 'Emitir OS e Enviar Vouchers',
      decisao: 'APROVADO',
      cor: 'blue',
      descricao: 'Confirma a emissão da Ordem de Serviço e o envio dos vouchers ao servidor.'
    }],
  },
  AGUARDANDO_EXECUCAO: {
    SF: [{
      label: 'Confirmar Execução Orçamentária (BRS)',
      decisao: 'APROVADO',
      cor: 'green',
      descricao: 'Confirma o recebimento da BRS e autoriza o processo para liquidação e pagamento.'
    }],
  },
}

const CORES: Record<string, string> = {
  blue: 'bg-blue-700 hover:bg-blue-800 text-white',
  green: 'bg-green-600 hover:bg-green-700 text-white',
  red: 'bg-red-600 hover:bg-red-700 text-white',
}

type Props = {
  solicitacaoId: string
  status: string
  userRole: string
}

export function AcoesWorkflow({ solicitacaoId, status, userRole }: Props) {
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  const acoes = ACOES_MAP[status]?.[userRole] ?? []

  if (acoes.length === 0) return null

  async function executarAcao(decisao: string) {
    setLoading(true)
    setErro('')

    try {
      const res = await fetch(`/api/workflow/${solicitacaoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, observacao }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro(data.error ?? 'Erro ao processar ação')
        setLoading(false)
        return
      }

      router.refresh()
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 border-2 border-blue-300">
      <h2 className="font-semibold text-gray-800 mb-1">Ação Requerida</h2>
      <p className="text-xs text-gray-500 mb-4">
        Como <strong>{userRole}</strong>, você pode executar as seguintes ações nesta etapa:
      </p>

      {acoes.length > 1 && (
        <div className="mb-4 space-y-2">
          {acoes.map(a => (
            <div key={a.decisao} className="flex items-start gap-2 text-sm text-gray-600">
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.cor === 'green' ? 'bg-green-500' : a.cor === 'red' ? 'bg-red-500' : 'bg-blue-500'}`} />
              <span>{a.descricao}</span>
            </div>
          ))}
        </div>
      )}
      {acoes.length === 1 && (
        <p className="text-sm text-gray-600 mb-4">{acoes[0].descricao}</p>
      )}

      <textarea
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
        rows={3}
        placeholder="Observação (obrigatória em caso de reprovação, opcional para aprovação)"
        value={observacao}
        onChange={e => setObservacao(e.target.value)}
      />

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">
          {erro}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {acoes.map(a => (
          <button
            key={a.decisao}
            onClick={() => executarAcao(a.decisao)}
            disabled={loading}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${CORES[a.cor]}`}
          >
            {loading ? 'Processando...' : a.label}
          </button>
        ))}
      </div>
    </section>
  )
}
