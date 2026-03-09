import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export async function AlertasPrestacao({ userId }: { userId: string }) {
  const agora = new Date()

  const pendentes = await prisma.prestacao.findMany({
    where: {
      enviadoEm: null,
      solicitacao: { userId },
    },
    include: { solicitacao: { select: { id: true, destino: true, dataVolta: true } } },
    orderBy: { prazoFinal: 'asc' },
  })

  if (pendentes.length === 0) return null

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 mb-6">
      <h3 className="font-bold text-red-700 text-sm mb-3 flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        Prestação de Contas Pendente
      </h3>
      <div className="space-y-3">
        {pendentes.map(p => {
          const prazoFinal = new Date(p.prazoFinal)
          const diasRestantes = Math.ceil((prazoFinal.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24))
          const vencida = prazoFinal < agora

          return (
            <div key={p.id} className="flex flex-wrap justify-between items-center gap-3">
              <div className="text-sm">
                <span className={`font-medium ${vencida ? 'text-red-700' : 'text-amber-700'}`}>
                  Viagem para {p.solicitacao.destino}
                </span>
                <span className="text-gray-500 ml-2 text-xs">
                  {vencida
                    ? `⚠️ Prazo vencido em ${prazoFinal.toLocaleDateString('pt-BR')}`
                    : diasRestantes <= 1
                    ? `⏰ Vence amanhã — ${prazoFinal.toLocaleDateString('pt-BR')}`
                    : `Prazo: ${prazoFinal.toLocaleDateString('pt-BR')} (${diasRestantes} dias)`}
                </span>
              </div>
              <Link
                href={`/solicitacoes/${p.solicitacaoId}/prestacao`}
                className={`text-xs px-4 py-1.5 rounded-lg font-semibold transition whitespace-nowrap
                  ${vencida ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
              >
                Enviar Agora →
              </Link>
            </div>
          )
        })}
      </div>
      {pendentes.some(p => new Date(p.prazoFinal) < agora) && (
        <p className="text-red-600 text-xs mt-3 font-medium">
          ⛔ CPF bloqueado para novas solicitações até o envio do relatório
        </p>
      )}
    </div>
  )
}
