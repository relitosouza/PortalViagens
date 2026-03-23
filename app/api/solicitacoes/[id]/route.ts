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

  // Regras de Autenticação/Autorização baseadas em Status e Role
  const canEditAsDemandante = (sol.status === 'RASCUNHO' || sol.status === 'DEVOLVIDO_SECRETARIO') && (user.id === sol.userId || user.role === 'ADMIN')
  const canEditAsSecretario = sol.status === 'AGUARDANDO_SECRETARIO' && (user.role === 'SECRETARIO' || user.role === 'ADMIN')

  if (!canEditAsDemandante && !canEditAsSecretario) {
    return NextResponse.json({ error: 'Você não tem permissão para editar esta solicitação no status atual.' }, { status: 403 })
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
      status: isRascunho 
        ? sol.status === 'DEVOLVIDO_SECRETARIO' ? 'DEVOLVIDO_SECRETARIO' : 'RASCUNHO'
        : canEditAsSecretario ? 'AGUARDANDO_COTACAO' : 'AGUARDANDO_SECRETARIO',
    }
  })

  // Se o Secretário aprovou (não é rascunho e ele tem permissão de secretário), registra o passo do workflow
  if (!isRascunho && canEditAsSecretario) {
    await prisma.workflowStep.create({
      data: {
        solicitacaoId: id,
        etapa: 'SECRETARIO',
        atorRole: user.role,
        atorNome: session.user.name || user.role,
        decisao: 'APROVADO',
        observacao: 'Aprovado e Justificado pelo Secretário.'
      }
    })
  }

  return NextResponse.json(updated)
}
