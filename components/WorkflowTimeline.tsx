type WorkflowStep = {
  id: string
  etapa: string
  atorRole: string
  atorNome: string
  decisao: string | null
  observacao: string | null
  createdAt: Date | string
}

const ETAPAS = [
  { key: 'COTACAO', label: 'Cotação Técnica', ator: 'SECOL / DRP', desc: 'Consulta à Ata de Registro de Preços e upload de opções de voos/hotéis' },
  { key: 'VIABILIDADE', label: 'Análise de Viabilidade', ator: 'SEGOV — Gabinete', desc: 'Avaliação de conveniência e oportunidade política/financeira' },
  { key: 'EMISSAO', label: 'Emissão de OS e Vouchers', ator: 'SECOL', desc: 'Emissão da Ordem de Serviço e envio de vouchers ao servidor' },
  { key: 'EXECUCAO', label: 'Execução Orçamentária', ator: 'Secretaria de Finanças', desc: 'Recebimento da BRS e autorização para liquidação e pagamento' },
]

const STATUS_ETAPA_MAP: Record<string, string> = {
  AGUARDANDO_COTACAO: 'COTACAO',
  AGUARDANDO_VIABILIDADE: 'VIABILIDADE',
  AGUARDANDO_EMISSAO: 'EMISSAO',
  AGUARDANDO_EXECUCAO: 'EXECUCAO',
  CONCLUIDA: 'DONE',
  REPROVADA: 'REPROVADA',
}

export function WorkflowTimeline({ status, steps }: { status: string; steps: WorkflowStep[] }) {
  const etapaAtualKey = STATUS_ETAPA_MAP[status]

  return (
    <div className="space-y-3">
      {ETAPAS.map((etapa, i) => {
        const step = steps.find(s => s.etapa === etapa.key)
        const isDone = step?.decisao === 'APROVADO'
        const isReprovado = step?.decisao === 'REPROVADO'
        const isAtual = etapaAtualKey === etapa.key
        const isPending = !isDone && !isReprovado && !isAtual

        return (
          <div key={etapa.key} className={`rounded-xl border-2 p-4 transition-all
            ${isDone ? 'border-green-200 bg-green-50' :
              isReprovado ? 'border-red-200 bg-red-50' :
              isAtual ? 'border-blue-300 bg-blue-50 shadow-sm' :
              'border-gray-200 bg-gray-50 opacity-70'}`}>
            <div className="flex gap-4">
              {/* Ícone de status */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                ${isDone ? 'bg-green-500 text-white' :
                  isReprovado ? 'bg-red-500 text-white' :
                  isAtual ? 'bg-blue-600 text-white animate-pulse' :
                  'bg-gray-300 text-gray-500'}`}>
                {isDone ? '✓' : isReprovado ? '✗' : i + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap justify-between gap-2 items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{etapa.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Ator: {etapa.ator}</p>
                  </div>
                  {isAtual && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                      Em análise
                    </span>
                  )}
                  {isPending && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">
                      Pendente
                    </span>
                  )}
                  {isDone && (
                    <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">
                      Aprovado
                    </span>
                  )}
                  {isReprovado && (
                    <span className="text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-medium">
                      Reprovado
                    </span>
                  )}
                </div>

                {!isAtual && !isDone && !isReprovado && (
                  <p className="text-xs text-gray-400 mt-1">{etapa.desc}</p>
                )}

                {step?.observacao && (
                  <div className="mt-2 bg-white rounded-lg border px-3 py-2">
                    <p className="text-xs text-gray-600">{step.observacao}</p>
                  </div>
                )}

                {step && (
                  <p className="text-xs text-gray-400 mt-2">
                    {step.atorNome} · {new Date(step.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
