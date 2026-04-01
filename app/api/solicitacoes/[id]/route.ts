import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calcularDiasUteisAte } from '@/lib/utils/diasUteis'
import { notificarSecretarioParaAprovacao, notificarNovaSolicitacaoParaSecol } from '@/lib/email-notifications'
import { criarNotificacaoPorRole } from '@/lib/notifications'

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
  const canEditAsSecretario = sol.status === 'AGUARDANDO_APROVACAO_PASTA' && (user.role === 'SECRETARIO' || user.role === 'ADMIN')

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
        : canEditAsSecretario ? 'EM_COTACAO' : 'AGUARDANDO_APROVACAO_PASTA',
    }
  })

  // Se o Secretário aprovou diretamente nesta edição, logar no workflow
  if (!isRascunho && canEditAsSecretario && updated.status === 'EM_COTACAO') {
    await prisma.workflowStep.create({
      data: {
        solicitacaoId: id,
        etapa: 'SECRETARIO',
        atorRole: user.role,
        atorNome: (session.user as any).name || user.role,
        decisao: 'APROVADO',
        observacao: 'Aprovado e Justificado pelo Secretário.'
      }
    })
  }

  // Notificações nas alterações de status (Resubmissão ou Aprovação)
  if (!isRascunho) {
    if (updated.status === 'AGUARDANDO_APROVACAO_PASTA' && sol.status !== 'AGUARDANDO_APROVACAO_PASTA') {
      notificarSecretarioParaAprovacao(updated as any).catch(() => {})
      criarNotificacaoPorRole({
        role: 'SECRETARIO',
        secretariaId: updated.secretariaId || undefined,
        titulo: 'Solicitação reenviada para análise',
        descricao: `${updated.nomeCompleto} realizou os ajustes solicitados.`,
        tipo: 'URGENTE',
        solicitacaoId: updated.id,
      }).catch(() => {})
    } else if (updated.status === 'EM_COTACAO' && sol.status !== 'EM_COTACAO') {
        notificarNovaSolicitacaoParaSecol(updated as any).catch(() => {})
        criarNotificacaoPorRole({
            role: 'SECOL',
            titulo: 'Solicitação aprovada — realizar cotação',
            descricao: `${updated.nomeCompleto} — ${updated.destino}`,
            tipo: 'APROVADO',
            solicitacaoId: updated.id,
        }).catch(() => {})
    }
  }

  return NextResponse.json(updated)
}
