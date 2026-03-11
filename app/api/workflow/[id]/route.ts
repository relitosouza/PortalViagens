import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { logEmail } from '@/lib/email-log'
import { addDiasUteis } from '@/lib/utils/diasUteis'

// Tabela de transições de estado — REGRA DE SEGREGAÇÃO DE FUNÇÕES implementada aqui
// SECOL não pode fazer o passo de SEGOV e vice-versa
const TRANSICOES: Record<string, {
  etapa: string
  decisao: string
  proximoStatus: string
  rolePermitido: string
}[]> = {
  AGUARDANDO_COTACAO: [
    { etapa: 'COTACAO', decisao: 'APROVADO', proximoStatus: 'AGUARDANDO_VIABILIDADE', rolePermitido: 'SECOL' },
  ],
  AGUARDANDO_VIABILIDADE: [
    { etapa: 'VIABILIDADE', decisao: 'APROVADO', proximoStatus: 'AGUARDANDO_EMISSAO', rolePermitido: 'SEGOV' },
    { etapa: 'VIABILIDADE', decisao: 'REPROVADO', proximoStatus: 'REPROVADA', rolePermitido: 'SEGOV' },
    { etapa: 'VIABILIDADE', decisao: 'AJUSTE_SECOL', proximoStatus: 'AGUARDANDO_COTACAO', rolePermitido: 'SEGOV' },
    { etapa: 'VIABILIDADE', decisao: 'AJUSTE_DEMANDANTE', proximoStatus: 'RASCUNHO', rolePermitido: 'SEGOV' },
  ],
  AGUARDANDO_EMISSAO: [
    { etapa: 'EMISSAO', decisao: 'APROVADO', proximoStatus: 'AGUARDANDO_EXECUCAO', rolePermitido: 'SECOL' },
  ],
  AGUARDANDO_EXECUCAO: [
    { etapa: 'EXECUCAO', decisao: 'APROVADO', proximoStatus: 'CONCLUIDA', rolePermitido: 'SF' },
  ],
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const user = session.user as { id: string; role: string; name?: string | null }
  const role: string = user.role
  const userName: string = user.name ?? ''

  const body = await req.json()
  const { decisao, observacao } = body

  if (!decisao) return NextResponse.json({ error: 'Decisão obrigatória' }, { status: 400 })

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: { user: true },
  })

  if (!sol) return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })

  const transicoesPossiveis = TRANSICOES[sol.status] ?? []
  const transicao = transicoesPossiveis.find(
    t => t.decisao === decisao && (t.rolePermitido === role || role === 'ADMIN')
  )

  if (!transicao) {
    return NextResponse.json({
      error: `Ação não permitida para o papel "${role}" no status atual "${sol.status}".`
    }, { status: 403 })
  }

  // Registrar passo do workflow
  await prisma.workflowStep.create({
    data: {
      solicitacaoId: sol.id,
      etapa: transicao.etapa,
      atorRole: role,
      atorNome: userName,
      decisao,
      observacao: observacao || null,
    },
  })

  // Atualizar status da solicitação
  await prisma.solicitacao.update({
    where: { id: sol.id },
    data: { status: transicao.proximoStatus },
  })

  // Lógica especial para etapa de EXECUÇÃO aprovada (conclusão)
  if (transicao.etapa === 'EXECUCAO' && decisao === 'APROVADO') {
    const prazoFinal = addDiasUteis(new Date(sol.dataVolta), 5)

    await prisma.prestacao.upsert({
      where: { solicitacaoId: sol.id },
      update: {},
      create: { solicitacaoId: sol.id, prazoFinal },
    })

    logEmail({
      para: sol.emailServidor,
      assunto: '[Viagens Osasco] ✅ Viagem aprovada — acesse seus vouchers',
      corpo: `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi APROVADA e os vouchers estão disponíveis no sistema.\n\nPrazo para prestação de contas: ${prazoFinal.toLocaleDateString('pt-BR')} (5 dias úteis após o retorno).\n\nAcesse o sistema: ${process.env.APP_URL ?? 'http://localhost:3000'}/solicitacoes/${sol.id}`,
      tipo: 'VOUCHER_APROVACAO',
    })
  }

  // Notificar reprovação
  if (decisao === 'REPROVADO') {
    logEmail({
      para: sol.emailServidor,
      assunto: '[Viagens Osasco] ❌ Solicitação reprovada',
      corpo: `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi REPROVADA.\n\nMotivo: ${observacao || 'Não informado'}\n\nPara mais informações, acesse o sistema: ${process.env.APP_URL ?? 'http://localhost:3000'}/solicitacoes/${sol.id}`,
      tipo: 'REPROVACAO',
    })
  }

  // Notificar aprovação intermediária (cotação para SEGOV)
  if (transicao.etapa === 'COTACAO' && decisao === 'APROVADO') {
    logEmail({
      para: sol.emailServidor,
      assunto: '[Viagens Osasco] Cotação concluída — aguardando análise de viabilidade',
      corpo: `Prezado(a) ${sol.nomeCompleto},\n\nA cotação da sua viagem para ${sol.destino} foi concluída pela SECOL. A solicitação aguarda agora a análise de viabilidade pela SEGOV.`,
      tipo: 'COTACAO_CONCLUIDA',
    })
  }

  return NextResponse.json({
    ok: true,
    novoStatus: transicao.proximoStatus,
    etapa: transicao.etapa,
  })
}
