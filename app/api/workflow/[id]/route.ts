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
  notificarSecretarioAprovacaoParaSecol,
  notificarSecretarioAjusteParaDemandante,
  notificarSecretarioReprovacaoParaDemandante,
} from '@/lib/email-notifications'
import { criarNotificacao, criarNotificacaoPorRole } from '@/lib/notifications'
import { addDiasUteis } from '@/lib/utils/diasUteis'

// Tabela de transições de estado — REGRA DE SEGREGAÇÃO DE FUNÇÕES implementada aqui
// SECOL não pode fazer o passo de SEGOV e vice-versa
const TRANSICOES: Record<string, {
  etapa: string
  decisao: string
  proximoStatus: string
  rolePermitido: string
}[]> = {
  AGUARDANDO_APROVACAO_PASTA: [
    { etapa: 'SECRETARIO', decisao: 'APROVADO', proximoStatus: 'EM_COTACAO', rolePermitido: 'SECRETARIO' },
    { etapa: 'SECRETARIO', decisao: 'AJUSTE_DEMANDANTE', proximoStatus: 'DEVOLVIDO_SECRETARIO', rolePermitido: 'SECRETARIO' },
    { etapa: 'SECRETARIO', decisao: 'REPROVADO', proximoStatus: 'REPROVADA', rolePermitido: 'SECRETARIO' },
  ],
  EM_COTACAO: [
    { etapa: 'COTACAO', decisao: 'APROVADO', proximoStatus: 'AGUARDANDO_VIABILIDADE', rolePermitido: 'SECOL' },
  ],
  AGUARDANDO_VIABILIDADE: [
    { etapa: 'VIABILIDADE', decisao: 'APROVADO', proximoStatus: 'AGUARDANDO_EMISSAO', rolePermitido: 'SEGOV' },
    { etapa: 'VIABILIDADE', decisao: 'REPROVADO', proximoStatus: 'REPROVADA', rolePermitido: 'SEGOV' },
    { etapa: 'VIABILIDADE', decisao: 'AJUSTE_SECOL', proximoStatus: 'EM_COTACAO', rolePermitido: 'SEGOV' },
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

  // Registrar passo do workflow
  const newStep = await prisma.workflowStep.create({
    data: {
      solicitacaoId: sol.id,
      etapa: transicao.etapa,
      atorRole: role,
      atorNome: userName,
      decisao,
      observacao: observacao || null,
      ...(['COTACAO', 'VIABILIDADE'].includes(transicao.etapa) && {
        valorPassagem: valorPassagem ?? null,
        valorHospedagem: valorHospedagem ?? null,
      }),
    },
  })

  // Atualizar status da solicitação
  await prisma.solicitacao.update({
    where: { id: sol.id },
    data: {
      status: transicao.proximoStatus,
      ultimoLembrete: null,
      qtdLembretes: 0,
    },
  })

  // Lógica especial para etapa de VIABILIDADE aprovada (SEGOV) — DÉBITO DE EMPENHOS
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'APROVADO') {
    const valorPassagem = newStep.valorPassagem ?? 0
    const valorHospedagem = newStep.valorHospedagem ?? 0

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

      if (newStep) {
        let nota = `\n\n[DÉBITO AUTOMÁTICO] ${notasDebito.join(' | ')}`
        if (notasAlerta.length > 0) {
          nota += `\n⚠️ ALERTA: ${notasAlerta.join('; ')} — Secretaria de Finanças notificada para regularização.`
        }
        await prisma.workflowStep.update({
          where: { id: newStep.id },
          data: { observacao: (observacao || '') + nota },
        }).catch((e) => console.error('[workflow] newStep annotation failed', e))
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

  // ── Notificações por email + in-app ──────────────────────────────────────

  // SECRETARIO aprovado → SECOL cota
  if (transicao.etapa === 'SECRETARIO' && decisao === 'APROVADO') {
    notificarSecretarioAprovacaoParaSecol(sol).catch(() => {})
    criarNotificacaoPorRole({
      role: 'SECOL',
      titulo: 'Nova solicitação para cotar',
      descricao: `${sol.nomeCompleto} — ${sol.destino}`,
      tipo: 'APROVADO',
      solicitacaoId: sol.id,
    }).catch(() => {})
  }

  // SECRETARIO ajuste demandante → demandante corrige
  if (transicao.etapa === 'SECRETARIO' && decisao === 'AJUSTE_DEMANDANTE') {
    notificarSecretarioAjusteParaDemandante(sol, observacao)
    criarNotificacao({
      userId: sol.userId,
      titulo: 'Ajuste solicitado pelo Secretário',
      descricao: observacao || `Viagem para ${sol.destino}`,
      tipo: 'AJUSTE',
      solicitacaoId: sol.id,
    }).catch(() => {})
  }

  // SECRETARIO reprovado → demandante
  if (transicao.etapa === 'SECRETARIO' && decisao === 'REPROVADO') {
    notificarSecretarioReprovacaoParaDemandante(sol, observacao)
    criarNotificacao({
      userId: sol.userId,
      titulo: 'Solicitação reprovada pelo Secretário',
      descricao: observacao || `Viagem para ${sol.destino}`,
      tipo: 'REPROVADO',
      solicitacaoId: sol.id,
    }).catch(() => {})
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
    criarNotificacao({
      userId: sol.userId,
      titulo: 'Cotação concluída',
      descricao: `Viagem para ${sol.destino} aguarda análise de viabilidade`,
      tipo: 'APROVADO',
      solicitacaoId: sol.id,
    }).catch(() => {})
    criarNotificacaoPorRole({
      role: 'SEGOV',
      titulo: 'Nova solicitação para análise de viabilidade',
      descricao: `${sol.nomeCompleto} — ${sol.destino}`,
      tipo: 'APROVADO',
      solicitacaoId: sol.id,
    }).catch(() => {})
  }

  // VIABILIDADE aprovada → SECOL (emitir vouchers)
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'APROVADO') {
    notificarViabilidadeAprovadaParaSecol(sol).catch(() => {})
    criarNotificacaoPorRole({
      role: 'SECOL',
      titulo: 'Viabilidade aprovada — emitir Ordem de Serviço',
      descricao: `${sol.nomeCompleto} — ${sol.destino}`,
      tipo: 'APROVADO',
      solicitacaoId: sol.id,
    }).catch(() => {})
  }

  // VIABILIDADE ajuste SECOL → SECOL recota
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'AJUSTE_SECOL') {
    notificarAjusteParaSecol(sol, observacao).catch(() => {})
    criarNotificacaoPorRole({
      role: 'SECOL',
      titulo: 'Ajuste de cotação solicitado pela SEGOV',
      descricao: observacao || `${sol.nomeCompleto} — ${sol.destino}`,
      tipo: 'AJUSTE',
      solicitacaoId: sol.id,
    }).catch(() => {})
  }

  // VIABILIDADE ajuste demandante → demandante corrige rascunho
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'AJUSTE_DEMANDANTE') {
    notificarAjusteParaDemandante(sol, observacao)
    criarNotificacao({
      userId: sol.userId,
      titulo: 'Ajuste solicitado pela SEGOV',
      descricao: observacao || `Viagem para ${sol.destino}`,
      tipo: 'AJUSTE',
      solicitacaoId: sol.id,
    }).catch(() => {})
  }

  // VIABILIDADE reprovada → demandante
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'REPROVADO') {
    notificarDemandante(
      sol,
      '[Viagens Osasco] ❌ Solicitação reprovada',
      `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi REPROVADA.\n\nMotivo: ${observacao || 'Não informado'}\n\nPara mais informações, acesse: ${process.env.APP_URL ?? 'http://localhost:3000'}/solicitacoes/${sol.id}`,
      'REPROVACAO'
    )
    criarNotificacao({
      userId: sol.userId,
      titulo: 'Solicitação reprovada pela SEGOV',
      descricao: observacao || `Viagem para ${sol.destino}`,
      tipo: 'REPROVADO',
      solicitacaoId: sol.id,
    }).catch(() => {})
  }

  // EMISSAO aprovada → SF executa
  if (transicao.etapa === 'EMISSAO' && decisao === 'APROVADO') {
    notificarEmissaoParaSf(sol).catch(() => {})
    criarNotificacaoPorRole({
      role: 'SF',
      titulo: 'OS emitida — confirmar execução orçamentária',
      descricao: `${sol.nomeCompleto} — ${sol.destino}`,
      tipo: 'APROVADO',
      solicitacaoId: sol.id,
    }).catch(() => {})
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
    criarNotificacao({
      userId: sol.userId,
      titulo: 'Viagem aprovada — vouchers disponíveis',
      descricao: `Prazo para prestação de contas: ${prazoFinal.toLocaleDateString('pt-BR')}`,
      tipo: 'APROVADO',
      solicitacaoId: sol.id,
    }).catch(() => {})
  }

  return NextResponse.json({
    ok: true,
    novoStatus: transicao.proximoStatus,
    etapa: transicao.etapa,
  })
}
