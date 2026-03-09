import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logEmail } from '@/lib/email-log'

// Esta rota deve ser chamada periodicamente (ex: diariamente por um cron job externo ou Vercel Cron)
// GET /api/cron/verificar-prestacoes
export async function GET() {
  const agora = new Date()

  // 1. Bloquear CPFs com prazo vencido e sem prestação enviada
  const prestacoesvencidas = await prisma.prestacao.findMany({
    where: {
      enviadoEm: null,
      prazoFinal: { lt: agora },
      bloqueado: false,
    },
    include: {
      solicitacao: {
        include: { user: true }
      },
    },
  })

  const bloqueados: string[] = []

  for (const p of prestacoesvencidas) {
    // Bloquear a prestação e o CPF do servidor
    await prisma.prestacao.update({
      where: { id: p.id },
      data: { bloqueado: true },
    })

    await prisma.user.update({
      where: { id: p.solicitacao.userId },
      data: { cpfBloqueado: true },
    })

    logEmail({
      para: p.solicitacao.emailServidor,
      assunto: '[Viagens Osasco] 🚫 BLOQUEIO — Prestação de contas em atraso',
      corpo: `Prezado(a) ${p.solicitacao.nomeCompleto},\n\nO prazo para prestação de contas da viagem a ${p.solicitacao.destino} venceu em ${p.prazoFinal.toLocaleDateString('pt-BR')}.\n\n⚠️ Seu CPF foi BLOQUEADO para novas solicitações de viagem.\n\nAcesse o sistema para enviar o relatório e desbloquear seu CPF: http://localhost:3000/solicitacoes/${p.solicitacaoId}/prestacao`,
      tipo: 'BLOQUEIO_CPF',
    })

    bloqueados.push(p.solicitacao.nomeCompleto)
  }

  // 2. Alertar servidores com prazo se encerrando em 2 dias
  const em2Dias = new Date(agora)
  em2Dias.setDate(em2Dias.getDate() + 2)

  const prestacoesproximas = await prisma.prestacao.findMany({
    where: {
      enviadoEm: null,
      prazoFinal: { gte: agora, lte: em2Dias },
      bloqueado: false,
    },
    include: { solicitacao: true },
  })

  const alertados: string[] = []

  for (const p of prestacoesproximas) {
    logEmail({
      para: p.solicitacao.emailServidor,
      assunto: '[Viagens Osasco] ⏰ Prazo de prestação de contas se encerrando',
      corpo: `Prezado(a) ${p.solicitacao.nomeCompleto},\n\nVocê tem até ${p.prazoFinal.toLocaleDateString('pt-BR')} para enviar o relatório de atividades da viagem a ${p.solicitacao.destino}.\n\nEvite o bloqueio do seu CPF: http://localhost:3000/solicitacoes/${p.solicitacaoId}/prestacao`,
      tipo: 'ALERTA_PRAZO',
    })
    alertados.push(p.solicitacao.nomeCompleto)
  }

  return NextResponse.json({
    ok: true,
    bloqueados: bloqueados.length,
    alertados: alertados.length,
    detalhes: { bloqueados, alertados },
  })
}
