import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import {
  notificarCotacaoParaSegov,
  notificarViabilidadeAprovadaParaSecol,
  notificarAjusteParaSecol,
  notificarAjusteParaDemandante,
  notificarEmissaoParaSf,
  notificarDemandante,
  notificarRole,
  notificarAprovacaoSecretario,
  notificarDevolucaoSecretario,
  notificarReprovacaoSecretario,
} from '@/lib/email-notifications'
import { addDiasUteis } from '@/lib/utils/diasUteis'

// Tabela de transições de estado — REGRA DE SEGREGAÇÃO DE FUNÇÕES implementada aqui
// SECOL não pode fazer o passo de SEGOV e vice-versa
const TRANSICOES: Record<string, {
  etapa: string
  decisao: string
  proximoStatus: string
  rolePermitido: string
}[]> = {
  AGUARDANDO_SECRETARIO: [
    { etapa: 'SECRETARIO', decisao: 'APROVADO', proximoStatus: 'AGUARDANDO_COTACAO', rolePermitido: 'SECRETARIO' },
    { etapa: 'SECRETARIO', decisao: 'DEVOLVIDO', proximoStatus: 'DEVOLVIDO_SECRETARIO', rolePermitido: 'SECRETARIO' },
    { etapa: 'SECRETARIO', decisao: 'REPROVADO', proximoStatus: 'REPROVADO_SECRETARIO', rolePermitido: 'SECRETARIO' },
  ],
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
  const { decisao, observacao, valorPassagem, valorHospedagem } = body

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

  // Validate required observacao for SECRETARIO DEVOLVIDO and REPROVADO
  if (transicao.etapa === 'SECRETARIO' && ['DEVOLVIDO', 'REPROVADO'].includes(decisao) && !observacao?.trim()) {
    return NextResponse.json({ error: 'Justificativa obrigatória para devolução ou reprovação.' }, { status: 400 })
  }

  // Validate SECRETARIO belongs to same secretaria (for non-ADMIN)
  if (transicao.etapa === 'SECRETARIO' && role === 'SECRETARIO') {
    const sessionUser = session.user as { id: string; role: string; secretariaId?: string }
    if (sessionUser.secretariaId !== sol.user.secretariaId) {
      return NextResponse.json({ error: 'Não autorizado para esta secretaria.' }, { status: 403 })
    }
  }

  // Use transaction for optimistic locking (prevents concurrent secretário actions)
  try {
    await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction
      const solAtual = await tx.solicitacao.findUnique({ where: { id: sol.id }, select: { status: true } })
      if (solAtual?.status !== sol.status) {
        throw new Error('CONCURRENT_ACTION')
      }

      await tx.workflowStep.create({
        data: {
          solicitacaoId: sol.id,
          etapa: transicao.etapa,
          atorRole: role,
          atorNome: userName,
          decisao,
          observacao: observacao || null,
          ...(transicao.etapa === 'COTACAO' && {
            valorPassagem: valorPassagem ?? null,
            valorHospedagem: valorHospedagem ?? null,
          }),
        },
      })

      await tx.solicitacao.update({
        where: { id: sol.id },
        data: { status: transicao.proximoStatus },
      })
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CONCURRENT_ACTION') {
      return NextResponse.json({ error: 'Este pedido já foi processado por outro Secretário.' }, { status: 409 })
    }
    throw err
  }

  // Lógica especial para etapa de VIABILIDADE aprovada (SEGOV) — DÉBITO DE EMPENHOS
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'APROVADO') {
    const cotacaoStep = await prisma.workflowStep.findFirst({
      where: { solicitacaoId: sol.id, etapa: 'COTACAO', decisao: 'APROVADO' },
      orderBy: { createdAt: 'desc' },
    })

    console.log('[workflow/VIABILIDADE] cotacaoStep:', cotacaoStep
      ? { id: cotacaoStep.id, valorPassagem: cotacaoStep.valorPassagem, valorHospedagem: cotacaoStep.valorHospedagem }
      : null)

    const valorPassagem = cotacaoStep?.valorPassagem ?? 0
    const valorHospedagem = cotacaoStep?.valorHospedagem ?? 0

    if (valorPassagem <= 0 && valorHospedagem <= 0) {
      console.warn('[workflow/VIABILIDADE] Débito ignorado: valorPassagem e valorHospedagem são 0 ou null na cotação aprovada')
    }

    if (valorPassagem > 0 || valorHospedagem > 0) {
      const { notasDebito, notasAlerta } = await prisma.$transaction(async (tx) => {
        const notasDebito: string[] = []
        const notasAlerta: string[] = []

        if (valorPassagem > 0) {
          const cfg = await tx.configuracaoSistema.findUnique({ where: { chave: 'SALDO_EMPENHO_PASSAGEM' } })
          if (!cfg) {
            console.error('[workflow/VIABILIDADE] Config SALDO_EMPENHO_PASSAGEM não encontrada no banco')
          } else {
            const saldoAtual = parseFloat(cfg.valor)
            const novoSaldo = Math.max(0, saldoAtual - valorPassagem)
            await tx.configuracaoSistema.update({
              where: { chave: 'SALDO_EMPENHO_PASSAGEM' },
              data: { valor: novoSaldo.toFixed(2) },
            })
            console.log(`[workflow/VIABILIDADE] Passagem debitada: ${valorPassagem} | saldo: ${saldoAtual} → ${novoSaldo}`)
            notasDebito.push(`Passagem: R$ ${valorPassagem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (saldo: R$ ${novoSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
            if (valorPassagem > saldoAtual) {
              notasAlerta.push(`PASSAGEM com saldo insuficiente (saldo era R$ ${saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
            }
          }
        }

        if (valorHospedagem > 0) {
          const cfg = await tx.configuracaoSistema.findUnique({ where: { chave: 'SALDO_EMPENHO_HOSPEDAGEM' } })
          if (!cfg) {
            console.error('[workflow/VIABILIDADE] Config SALDO_EMPENHO_HOSPEDAGEM não encontrada no banco')
          } else {
            const saldoAtual = parseFloat(cfg.valor)
            const novoSaldo = Math.max(0, saldoAtual - valorHospedagem)
            await tx.configuracaoSistema.update({
              where: { chave: 'SALDO_EMPENHO_HOSPEDAGEM' },
              data: { valor: novoSaldo.toFixed(2) },
            })
            console.log(`[workflow/VIABILIDADE] Hospedagem debitada: ${valorHospedagem} | saldo: ${saldoAtual} → ${novoSaldo}`)
            notasDebito.push(`Hospedagem: R$ ${valorHospedagem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (saldo: R$ ${novoSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
            if (valorHospedagem > saldoAtual) {
              notasAlerta.push(`HOSPEDAGEM com saldo insuficiente (saldo era R$ ${saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
            }
          }
        }

        // Débito consolidado no Saldo do Teto (Passagem + Hospedagem)
        const debitoTeto = valorPassagem + valorHospedagem
        if (debitoTeto > 0) {
          const cfgTeto = await tx.configuracaoSistema.findUnique({ where: { chave: 'SALDO_EMPENHO' } })
          if (!cfgTeto) {
            console.error('[workflow/VIABILIDADE] Config SALDO_EMPENHO (Teto) não encontrada no banco')
          } else {
            const saldoAtual = parseFloat(cfgTeto.valor)
            const novoSaldo = Math.max(0, saldoAtual - debitoTeto)
            await tx.configuracaoSistema.update({
              where: { chave: 'SALDO_EMPENHO' },
              data: { valor: novoSaldo.toFixed(2) },
            })
            console.log(`[workflow/VIABILIDADE] Teto debitado: ${debitoTeto} | saldo: ${saldoAtual} → ${novoSaldo}`)
            notasDebito.push(`Teto: R$ ${debitoTeto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (saldo: R$ ${novoSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
            if (debitoTeto > saldoAtual) {
              notasAlerta.push(`TETO com saldo insuficiente (saldo era R$ ${saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
            }
          }
        }

        return { notasDebito, notasAlerta }
      })

      // Atualizar observação do WorkflowStep de VIABILIDADE
      const viabilidadeStep = await prisma.workflowStep.findFirst({
        where: { solicitacaoId: sol.id, etapa: 'VIABILIDADE', decisao: 'APROVADO' },
        orderBy: { createdAt: 'desc' },
      })
      if (viabilidadeStep) {
        let nota = `\n\n[DÉBITO AUTOMÁTICO] ${notasDebito.join(' | ')}`
        if (notasAlerta.length > 0) {
          nota += `\n⚠️ ALERTA: ${notasAlerta.join('; ')} — Secretaria de Finanças notificada para regularização.`
        }
        await prisma.workflowStep.update({
          where: { id: viabilidadeStep.id },
          data: { observacao: (observacao || '') + nota },
        }).catch((e) => console.error('[workflow] viabilidadeStep annotation failed', e))
      }

      // Notificar SF se houver saldo insuficiente
      if (notasAlerta.length > 0) {
        notificarRole(
          'SF',
          '[Viagens Osasco] ⚠️ Saldo de empenho insuficiente — regularização necessária',
          `A solicitação de ${sol.nomeCompleto} para ${sol.destino} foi aprovada pela SEGOV, porém o saldo de empenho era insuficiente para cobrir o valor comprometido.\n\nDetalhes:\n${notasAlerta.join('\n')}\n\nAcesse o sistema: ${process.env.APP_URL ?? 'http://localhost:3000'}/solicitacoes/${sol.id}`,
          'SALDO_INSUFICIENTE'
        ).catch(() => {})
      }
    }
  }

  // ── Notificações por email ────────────────────────────────────────────────

  // SECRETARIO aprovado → notificar SECOL + Demandante
  if (transicao.etapa === 'SECRETARIO' && decisao === 'APROVADO') {
    notificarAprovacaoSecretario(sol).catch(() => {})
  }

  // SECRETARIO devolvido → notificar Demandante
  if (transicao.etapa === 'SECRETARIO' && decisao === 'DEVOLVIDO') {
    notificarDevolucaoSecretario(sol, observacao || '')
  }

  // SECRETARIO reprovado → notificar Demandante
  if (transicao.etapa === 'SECRETARIO' && decisao === 'REPROVADO') {
    notificarReprovacaoSecretario(sol, observacao || '')
  }

  // COTACAO aprovada → demandante (atualização) + SEGOV (próxima ação)
  if (transicao.etapa === 'COTACAO' && decisao === 'APROVADO') {
    notificarDemandante(
      sol,
      '[Viagens Osasco] Cotação concluída — aguardando análise de viabilidade',
      `Prezado(a) ${sol.nomeCompleto},\n\nA cotação da sua viagem para ${sol.destino} foi concluída pela SECOL. A solicitação aguarda análise de viabilidade pela SEGOV.`,
      'COTACAO_CONCLUIDA'
    )
    notificarCotacaoParaSegov(sol).catch(() => {})
  }

  // VIABILIDADE aprovada → SECOL (emitir vouchers)
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'APROVADO') {
    notificarViabilidadeAprovadaParaSecol(sol).catch(() => {})
  }

  // VIABILIDADE ajuste SECOL → SECOL recota
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'AJUSTE_SECOL') {
    notificarAjusteParaSecol(sol, observacao).catch(() => {})
  }

  // VIABILIDADE ajuste demandante → demandante corrige rascunho
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'AJUSTE_DEMANDANTE') {
    notificarAjusteParaDemandante(sol, observacao)
  }

  // VIABILIDADE reprovada → demandante
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'REPROVADO') {
    notificarDemandante(
      sol,
      '[Viagens Osasco] ❌ Solicitação reprovada',
      `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi REPROVADA.\n\nMotivo: ${observacao || 'Não informado'}\n\nPara mais informações, acesse: ${process.env.APP_URL ?? 'http://localhost:3000'}/solicitacoes/${sol.id}`,
      'REPROVACAO'
    )
  }

  // EMISSAO aprovada → SF executa
  if (transicao.etapa === 'EMISSAO' && decisao === 'APROVADO') {
    notificarEmissaoParaSf(sol).catch(() => {})
  }

  // EXECUCAO aprovada → demandante (vouchers + prestação de contas)
  if (transicao.etapa === 'EXECUCAO' && decisao === 'APROVADO') {
    const prazoFinal = addDiasUteis(new Date(sol.dataVolta), 5)

    await prisma.prestacao.upsert({
      where: { solicitacaoId: sol.id },
      update: {},
      create: { solicitacaoId: sol.id, prazoFinal },
    })

    notificarDemandante(
      sol,
      '[Viagens Osasco] ✅ Viagem aprovada — acesse seus vouchers',
      `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi APROVADA e os vouchers estão disponíveis no sistema.\n\nPrazo para prestação de contas: ${prazoFinal.toLocaleDateString('pt-BR')} (5 dias úteis após o retorno).\n\nAcesse o sistema: ${process.env.APP_URL ?? 'http://localhost:3000'}/solicitacoes/${sol.id}`,
      'VOUCHER_APROVACAO'
    )
  }

  return NextResponse.json({
    ok: true,
    novoStatus: transicao.proximoStatus,
    etapa: transicao.etapa,
  })
}
