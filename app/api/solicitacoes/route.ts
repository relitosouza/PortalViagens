// app/api/solicitacoes/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calcularDiasUteisAte } from '@/lib/utils/diasUteis'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const user = session.user as { id: string; role: string; name?: string | null; email?: string | null }
  if (user.role !== 'DEMANDANTE') {
    return NextResponse.json({ error: 'Apenas DEMANDANTE pode criar solicitações' }, { status: 403 })
  }

  // Verificar bloqueio do CPF
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (dbUser?.cpfBloqueado) {
    return NextResponse.json({
      error: 'CPF bloqueado por prestação de contas pendente. Envie o relatório para desbloquear.'
    }, { status: 403 })
  }

  const body = await req.json()

  // Validar antecedência de 15 dias úteis (Art. 1º)
  const dataIda = new Date(body.dataIda)
  const diasUteis = calcularDiasUteisAte(dataIda)
  if (diasUteis < 15) {
    return NextResponse.json({
      error: `Antecedência insuficiente: apenas ${diasUteis} dia(s) útil(is). Mínimo exigido: 15 dias úteis (Art. 1º).`
    }, { status: 422 })
  }

  const solicitacao = await prisma.solicitacao.create({
    data: {
      nomeCompleto: body.nomeCompleto,
      matricula: body.matricula,
      cpf: body.cpf,
      dataNascimento: new Date(body.dataNascimento),
      celular: body.celular,
      emailServidor: body.emailServidor,
      justificativaPublica: body.justificativaPublica,
      nexoCargo: body.nexoCargo,
      destino: body.destino,
      dataIda,
      dataVolta: new Date(body.dataVolta),
      justificativaLocal: body.justificativaLocal,
      fichaOrcamentaria: body.fichaOrcamentaria,
      status: 'AGUARDANDO_COTACAO',
      userId: user.id,
    }
  })

  return NextResponse.json(solicitacao, { status: 201 })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const user = session.user as { id: string; role: string; name?: string | null; email?: string | null }
  const where = user.role === 'DEMANDANTE' ? { userId: user.id } : {}

  const solicitacoes = await prisma.solicitacao.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } }
  })

  return NextResponse.json(solicitacoes)
}
