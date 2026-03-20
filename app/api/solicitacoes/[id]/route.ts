import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calcularDiasUteisAte } from '@/lib/utils/diasUteis'
import { notificarRole, notificarSecretariosAtivos } from '@/lib/email-notifications'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const user = session.user as { id: string; role: string; secretariaId?: string }
  const { id } = await params
  const body = await req.json()
  const isRascunho = body.isRascunho === true

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: { user: { select: { secretariaId: true, name: true } } },
  })
  if (!sol) return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })

  // SECRETARIO editing their secretaria's request
  if (user.role === 'SECRETARIO' && sol.status === 'AGUARDANDO_SECRETARIO') {
    if (user.secretariaId !== sol.user.secretariaId) {
      return NextResponse.json({ error: 'Não autorizado para esta secretaria.' }, { status: 403 })
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
        dataIda: new Date(body.dataIda),
        dataVolta: new Date(body.dataVolta),
        justificativaLocal: body.justificativaLocal,
        fichaOrcamentaria: body.fichaOrcamentaria,
        indicacaoVoo: body.indicacaoVoo ?? null,
        indicacaoHospedagem: body.indicacaoHospedagem ?? null,
      },
    })
    return NextResponse.json(updated)
  }

  // DEMANDANTE editing RASCUNHO or DEVOLVIDO_SECRETARIO
  if (user.role !== 'ADMIN' && sol.userId !== user.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const allowedStatuses = ['RASCUNHO', 'DEVOLVIDO_SECRETARIO']
  if (!allowedStatuses.includes(sol.status) && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Esta solicitação não pode ser editada no status atual' }, { status: 403 })
  }

  if (sol.status === 'DEVOLVIDO_SECRETARIO' && user.role !== 'ADMIN') {
    // Block editing Detalhes da Missão fields — force them from DB
    body.justificativaPublica = sol.justificativaPublica
    body.nexoCargo = sol.nexoCargo
  }

  const dataIda = new Date(body.dataIda)

  if (!isRascunho) {
    const diasUteis = calcularDiasUteisAte(dataIda)
    if (diasUteis < 15 && user.role !== 'ADMIN') {
      return NextResponse.json({
        error: `Antecedência insuficiente: apenas ${diasUteis} dia(s) útil(is). Mínimo exigido: 15 dias úteis (Art. 1º).`
      }, { status: 422 })
    }
  }

  // Determine next status
  let nextStatus: string
  if (isRascunho) {
    nextStatus = 'RASCUNHO'
  } else if (sol.status === 'DEVOLVIDO_SECRETARIO') {
    // Resubmission — validate secretaria
    if (!sol.user.secretariaId) {
      return NextResponse.json({ error: 'Seu cadastro não possui secretaria vinculada.' }, { status: 400 })
    }
    nextStatus = 'AGUARDANDO_SECRETARIO'
  } else {
    // Initial submission from RASCUNHO
    if (!sol.user.secretariaId) {
      return NextResponse.json({ error: 'Seu cadastro não possui secretaria vinculada. Contate o administrador.' }, { status: 400 })
    }
    const secretariosAtivos = await prisma.user.count({
      where: { role: 'SECRETARIO', secretariaId: sol.user.secretariaId, ativo: true },
    })
    if (secretariosAtivos === 0) {
      await notificarRole(
        'ADMIN',
        '[Viagens Osasco] ⚠️ Submissão bloqueada — sem Secretário ativo',
        `O usuário ${sol.user.name} tentou submeter uma solicitação mas não há Secretário ativo para sua secretaria.`,
        'SEM_SECRETARIO_ATIVO'
      ).catch(() => {})
      return NextResponse.json({ error: 'Não há Secretário ativo para sua secretaria. Contate o administrador.' }, { status: 400 })
    }
    nextStatus = 'AGUARDANDO_SECRETARIO'
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
      status: nextStatus,
    },
    include: { user: true },
  })

  if (!isRascunho && nextStatus === 'AGUARDANDO_SECRETARIO') {
    notificarSecretariosAtivos(updated, sol.user.secretariaId!).catch(() => {})
  }

  return NextResponse.json(updated)
}
