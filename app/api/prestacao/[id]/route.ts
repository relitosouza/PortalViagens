import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { logEmail } from '@/lib/email-log'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const user = session.user as { id: string; role: string; name?: string | null; email?: string | null }
  if (user.role !== 'DEMANDANTE') {
    return NextResponse.json({ error: 'Apenas DEMANDANTE pode enviar prestação de contas' }, { status: 403 })
  }

  const { id: solicitacaoId } = await params
  const { relatorio } = await req.json()

  if (!relatorio?.trim()) {
    return NextResponse.json({ error: 'Relatório obrigatório' }, { status: 422 })
  }

  // Verificar se a solicitação pertence ao usuário
  const sol = await prisma.solicitacao.findUnique({
    where: { id: solicitacaoId },
    include: { prestacao: true },
  })

  if (!sol) return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })
  if (sol.userId !== user.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  if (sol.status !== 'CONCLUIDA') {
    return NextResponse.json({ error: 'Prestação de contas só pode ser enviada para viagens concluídas' }, { status: 422 })
  }

  if (!sol.prestacao) {
    return NextResponse.json({ error: 'Registro de prestação de contas não encontrado' }, { status: 404 })
  }

  if (sol.prestacao.enviadoEm) {
    return NextResponse.json({ error: 'Prestação de contas já foi enviada' }, { status: 409 })
  }

  const prestacaoAtualizada = await prisma.prestacao.update({
    where: { solicitacaoId },
    data: {
      relatorio,
      enviadoEm: new Date(),
      bloqueado: false,
    },
  })

  // Desbloquear CPF do servidor se estava bloqueado
  await prisma.user.update({
    where: { id: sol.userId },
    data: { cpfBloqueado: false },
  })

  // Log de email de confirmação
  logEmail({
    para: sol.emailServidor,
    assunto: '[Viagens Osasco] ✅ Prestação de contas recebida',
    corpo: `Prezado(a) ${sol.nomeCompleto},\n\nSua prestação de contas referente à viagem para ${sol.destino} foi recebida com sucesso em ${new Date().toLocaleDateString('pt-BR')}.`,
    tipo: 'PRESTACAO_RECEBIDA',
  })

  return NextResponse.json({ ok: true, prestacaoId: prestacaoAtualizada.id })
}
