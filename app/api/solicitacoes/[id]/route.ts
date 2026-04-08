import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calcularDiasUteisAte } from '@/lib/utils/diasUteis'
import { 
  notificarSecretarioParaAprovacao, 
  notificarNovaSolicitacaoParaSecol,
  SolicitacaoComUser
} from '@/lib/email-notifications'
import { criarNotificacaoPorRole } from '@/lib/notifications'
import { getAuthUser } from '@/lib/types/auth'
import { validateSolicitacaoInput } from '@/lib/validators/solicitacao'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const user = getAuthUser(session.user)
  if (!user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  
  const sol = await prisma.solicitacao.findUnique({ where: { id } })
  if (!sol) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  // Regras de Autenticação/Autorização baseadas em Status e Role
  const canEditAsDemandante = (sol.status === 'RASCUNHO' || sol.status === 'DEVOLVIDO_SECRETARIO') && (user.id === sol.userId || user.role === 'ADMIN')
  const canEditAsSecretario = sol.status === 'AGUARDANDO_APROVACAO_PASTA' && (user.role === 'SECRETARIO' || user.role === 'ADMIN')

  if (!canEditAsDemandante && !canEditAsSecretario) {
    return NextResponse.json({ error: 'Você não tem permissão para editar esta solicitação no status atual.' }, { status: 403 })
  }

  const body = await req.json()
  
  // Validate input
  const validation = validateSolicitacaoInput(body)
  if (!validation.valid) {
    return NextResponse.json({
      error: 'Validação falhou',
      details: validation.errors
    }, { status: 400 })
  }

  const isRascunho = body.rascunho === true
  let dataIda: Date
  try {
    dataIda = new Date(body.dataIda)
    if (isNaN(dataIda.getTime())) throw new Error()
  } catch {
    return NextResponse.json({ error: 'dataIda: data inválida' }, { status: 400 })
  }

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
      dataNascimento: body.dataNascimento ? new Date(body.dataNascimento) : undefined,
      celular: body.celular,
      emailServidor: body.emailServidor,
      justificativaPublica: body.justificativaPublica,
      nexoCargo: body.nexoCargo,
      destino: body.destino,
      dataIda,
      dataVolta: body.dataVolta ? new Date(body.dataVolta) : undefined,
      justificativaLocal: body.justificativaLocal,
      fichaOrcamentaria: body.fichaOrcamentaria,
      indicacaoVoo: body.indicacaoVoo ?? null,
      indicacaoHospedagem: body.indicacaoHospedagem ?? null,
      status: isRascunho 
        ? sol.status === 'DEVOLVIDO_SECRETARIO' ? 'DEVOLVIDO_SECRETARIO' : 'RASCUNHO'
        : canEditAsSecretario ? 'EM_COTACAO' : 'AGUARDANDO_APROVACAO_PASTA',
    },
    include: { user: true }
  })

  // Se o Secretário aprovou diretamente nesta edição, logar no workflow
  if (!isRascunho && canEditAsSecretario && updated.status === 'EM_COTACAO') {
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

  // Notificações nas alterações de status (Resubmissão ou Aprovação)
  if (!isRascunho) {
    if (updated.status === 'AGUARDANDO_APROVACAO_PASTA' && sol.status !== 'AGUARDANDO_APROVACAO_PASTA') {
      notificarSecretarioParaAprovacao(updated as SolicitacaoComUser).catch(err => {
        console.error('Falha ao notificar SECRETARIO:', err)
      })
      criarNotificacaoPorRole({
        role: 'SECRETARIO',
        secretariaId: updated.secretariaId || undefined,
        titulo: 'Solicitação reenviada para análise',
        descricao: `${updated.nomeCompleto} realizou os ajustes solicitados.`,
        tipo: 'URGENTE',
        solicitacaoId: updated.id,
      }).catch(err => {
        console.error('Falha ao criar notificação in-app para SECRETARIO:', err)
      })
    } else if (updated.status === 'EM_COTACAO' && sol.status !== 'EM_COTACAO') {
        notificarNovaSolicitacaoParaSecol(updated as SolicitacaoComUser).catch(err => {
            console.error('Falha ao notificar SECOL:', err)
        })
        criarNotificacaoPorRole({
            role: 'SECOL',
            titulo: 'Solicitação aprovada — realizar cotação',
            descricao: `${updated.nomeCompleto} — ${updated.destino}`,
            tipo: 'APROVADO',
            solicitacaoId: updated.id,
        }).catch(err => {
            console.error('Falha ao criar notificação in-app para SECOL:', err)
        })
    }
  }

  return NextResponse.json(updated)
}
