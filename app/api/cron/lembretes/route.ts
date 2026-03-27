import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notificarLembreteFase, notificarEscalonamento } from '@/lib/email-notifications'

const FASES_PENDENTES = [
  'AGUARDANDO_APROVACAO_PASTA',
  'EM_COTACAO',
  'AGUARDANDO_VIABILIDADE',
  'AGUARDANDO_EMISSAO',
  'AGUARDANDO_EXECUCAO',
  'DEVOLVIDO_SECRETARIO',
]

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()
  const limite24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000)

  const solicitacoes = await prisma.solicitacao.findMany({
    where: {
      status: { in: FASES_PENDENTES },
      OR: [
        { ultimoLembrete: null },
        { ultimoLembrete: { lte: limite24h } },
      ],
    },
    include: { user: true },
  })

  let lembretes = 0
  let escalamentos = 0

  for (const sol of solicitacoes) {
    try {
      if (sol.qtdLembretes < 5) {
        await notificarLembreteFase(sol)
        lembretes++
      } else if (sol.qtdLembretes === 5) {
        await notificarEscalonamento(sol)
        escalamentos++
      }
      // qtdLembretes > 5: já escalou, não envia mais

      await prisma.solicitacao.update({
        where: { id: sol.id },
        data: {
          ultimoLembrete: agora,
          qtdLembretes: { increment: 1 },
        },
      })
    } catch (err) {
      console.error(`[cron/lembretes] Erro na solicitação ${sol.id}:`, err)
    }
  }

  console.log(`[cron/lembretes] processadas=${solicitacoes.length} lembretes=${lembretes} escalamentos=${escalamentos}`)

  return NextResponse.json({
    ok: true,
    processadas: solicitacoes.length,
    lembretes,
    escalamentos,
  })
}
