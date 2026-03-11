import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calcularDiasUteisAte } from '@/lib/utils/diasUteis'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const user = session.user as { id: string; role: string }
  
  const sol = await prisma.solicitacao.findUnique({ where: { id } })
  if (!sol) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  // Apenas o dono ou ADMIN podem editar em RASCUNHO
  if (user.role !== 'ADMIN' && sol.userId !== user.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  if (sol.status !== 'RASCUNHO' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solicitação não está em rascunho' }, { status: 403 })
  }

  const body = await req.json()
  const isRascunho = body.rascunho === true
  const dataIda = new Date(body.dataIda)

  if (!isRascunho) {
    const diasUteis = calcularDiasUteisAte(dataIda)
    // Se for ADMIN, ignora a trava de 15 dias (para correções emergenciais)
    if (diasUteis < 15 && user.role !== 'ADMIN') {
      return NextResponse.json({
        error: `Antecedência insuficiente: apenas ${diasUteis} dia(s) útil(is). Mínimo exigido: 15 dias úteis (Art. 1º).`
      }, { status: 422 })
    }
  }

  const updated = await prisma.solicitacao.update({
    where: { id },
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
      indicacaoVoo: body.indicacaoVoo ?? null,
      indicacaoHospedagem: body.indicacaoHospedagem ?? null,
      status: isRascunho ? 'RASCUNHO' : 'AGUARDANDO_COTACAO',
    }
  })

  return NextResponse.json(updated)
}
