// lib/email-notifications.ts
import { prisma } from '@/lib/prisma'
import { logEmail } from '@/lib/email-log'
import { Solicitacao, User } from '@prisma/client'

type SolicitacaoComUser = Solicitacao & { user: User }

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

/** Busca todos os usuários ativos do role e dispara logEmail para cada um */
export async function notificarRole(
  role: string,
  assunto: string,
  corpo: string,
  tipo: string
): Promise<void> {
  const usuarios = await prisma.user.findMany({
    where: { role, ativo: true },
  })
  for (const u of usuarios) {
    try {
      logEmail({ para: u.email, assunto, corpo, tipo })
    } catch {
      // silent: email failure must not block workflow
    }
  }
}

/** Notifica o demandante diretamente pelo emailServidor da solicitação */
export function notificarDemandante(
  sol: SolicitacaoComUser,
  assunto: string,
  corpo: string,
  tipo: string
): void {
  try {
    logEmail({ para: sol.emailServidor, assunto, corpo, tipo })
  } catch {
    // silent: email failure must not block workflow
  }
}

/** Demandante submeteu → notificar SECOL para cotar */
export async function notificarNovaSolicitacaoParaSecol(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Nova solicitação aguardando cotação',
    `Uma nova solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} está aguardando cotação.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'NOVA_SOLICITACAO_SECOL'
  )
}

/** Notifica os secretários de uma secretaria específica */
export async function notificarSecretarioParaAprovacao(
  sol: SolicitacaoComUser
): Promise<void> {
  if (!sol.secretariaId) return

  const usuarios = await prisma.user.findMany({
    where: { role: 'SECRETARIO', secretariaId: sol.secretariaId, ativo: true },
  })

  for (const u of usuarios) {
    try {
      logEmail({
        para: u.email,
        assunto: '[Viagens Osasco] Nova solicitação aguardando sua validação',
        corpo: `Prezado(a) Secretário(a),\n\nUma nova solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} foi submetida por um servidor da sua pasta e aguarda sua validação de mérito e aprovação hierárquica.\n\nAcesse o sistema: ${APP_URL}/solicitacoes/${sol.id}`,
        tipo: 'VALIDACAO_SECRETARIO'
      })
    } catch {
      // silent
    }
  }
}

/** SECOL concluiu cotação → notificar SEGOV para analisar viabilidade */
export async function notificarCotacaoParaSegov(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SEGOV',
    '[Viagens Osasco] Solicitação aguardando análise de viabilidade',
    `A cotação da viagem para ${sol.destino} de ${sol.nomeCompleto} foi concluída pela SECOL. A solicitação aguarda análise de viabilidade.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'NOVA_VIABILIDADE_SEGOV'
  )
}

/** SEGOV aprovou viabilidade → notificar SECOL para emitir vouchers */
export async function notificarViabilidadeAprovadaParaSecol(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Viabilidade aprovada — emitir vouchers',
    `A viabilidade da viagem para ${sol.destino} de ${sol.nomeCompleto} foi aprovada. A solicitação aguarda emissão dos vouchers.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'EMISSAO_NECESSARIA_SECOL'
  )
}

/** SEGOV pediu ajuste de cotação → notificar SECOL */
export async function notificarAjusteParaSecol(
  sol: SolicitacaoComUser,
  observacao: string | null
): Promise<void> {
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Ajuste necessário na cotação',
    `A SEGOV solicitou ajuste na cotação da viagem para ${sol.destino} de ${sol.nomeCompleto}.\n\nMotivo: ${observacao ?? 'Não informado'}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'AJUSTE_SECOL'
  )
}

/** SEGOV pediu ajuste ao demandante → notificar demandante */
export function notificarAjusteParaDemandante(
  sol: SolicitacaoComUser,
  observacao: string | null
): void {
  notificarDemandante(
    sol,
    '[Viagens Osasco] Ajuste necessário na sua solicitação',
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} precisa de ajustes.\n\nMotivo: ${observacao ?? 'Não informado'}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'AJUSTE_DEMANDANTE'
  )
}

/** SECOL emitiu vouchers → notificar SF para confirmar execução */
export async function notificarEmissaoParaSf(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SF',
    '[Viagens Osasco] Vouchers emitidos — aguardando execução',
    `Os vouchers da viagem para ${sol.destino} de ${sol.nomeCompleto} foram emitidos. A solicitação aguarda confirmação de execução.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'EXECUCAO_SF'
  )
}

/** SECRETARIO aprovou → notificar SECOL para iniciar cotação */
export async function notificarSecretarioAprovacaoParaSecol(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Nova solicitação aguardando cotação',
    `A solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} foi aprovada pelo Secretário e aguarda cotação.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'SECRETARIO_APROVACAO_SECOL'
  )
}

/** SECRETARIO pediu ajuste → notificar DEMANDANTE */
export function notificarSecretarioAjusteParaDemandante(
  sol: SolicitacaoComUser,
  observacao: string | null
): void {
  notificarDemandante(
    sol,
    '[Viagens Osasco] Ajuste necessário na sua solicitação',
    `Prezado(a) ${sol.nomeCompleto},\n\nO Secretário solicitou ajuste na sua viagem para ${sol.destino}.\n\nMotivo: ${observacao ?? 'Não informado'}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'SECRETARIO_AJUSTE_DEMANDANTE'
  )
}

/** SECRETARIO reprovou → notificar DEMANDANTE */
export function notificarSecretarioReprovacaoParaDemandante(
  sol: SolicitacaoComUser,
  observacao: string | null
): void {
  notificarDemandante(
    sol,
    '[Viagens Osasco] ❌ Solicitação reprovada pelo Secretário',
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi REPROVADA pelo Secretário.\n\nMotivo: ${observacao ?? 'Não informado'}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'SECRETARIO_REPROVACAO_DEMANDANTE'
  )
}

const FASE_LABELS: Record<string, string> = {
  AGUARDANDO_APROVACAO_PASTA: 'aprovação do Secretário',
  EM_COTACAO: 'cotação pela SECOL',
  AGUARDANDO_VIABILIDADE: 'análise de viabilidade pela SEGOV',
  AGUARDANDO_EMISSAO: 'emissão de vouchers pela SECOL',
  AGUARDANDO_EXECUCAO: 'confirmação de execução pela SF',
  DEVOLVIDO_SECRETARIO: 'correção pelo servidor demandante',
}

const FASE_ROLE_MAP: Record<string, string> = {
  EM_COTACAO: 'SECOL',
  AGUARDANDO_VIABILIDADE: 'SEGOV',
  AGUARDANDO_EMISSAO: 'SECOL',
  AGUARDANDO_EXECUCAO: 'SF',
}

/** Lembrete diário para o responsável da fase atual */
export async function notificarLembreteFase(
  sol: SolicitacaoComUser
): Promise<void> {
  const dias = sol.qtdLembretes + 1
  const faseLabel = FASE_LABELS[sol.status] ?? sol.status
  const link = `${APP_URL}/solicitacoes/${sol.id}`

  if (sol.status === 'DEVOLVIDO_SECRETARIO') {
    notificarDemandante(
      sol,
      `[Viagens Osasco] Lembrete: sua solicitação aguarda correção (dia ${dias})`,
      `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} aguarda correção há ${dias} dia(s).\n\nPor favor, realize os ajustes solicitados.\n\nAcesse: ${link}`,
      'LEMBRETE_DEMANDANTE'
    )
    return
  }

  if (sol.status === 'AGUARDANDO_APROVACAO_PASTA') {
    if (!sol.secretariaId) return
    const usuarios = await prisma.user.findMany({
      where: { role: 'SECRETARIO', secretariaId: sol.secretariaId, ativo: true },
    })
    for (const u of usuarios) {
      try {
        logEmail({
          para: u.email,
          assunto: `[Viagens Osasco] Lembrete: solicitação aguardando sua aprovação (dia ${dias})`,
          corpo: `Prezado(a) Secretário(a),\n\nA solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} aguarda sua aprovação há ${dias} dia(s).\n\nAcesse: ${link}`,
          tipo: 'LEMBRETE_SECRETARIO',
        })
      } catch { /* silent */ }
    }
    return
  }

  const role = FASE_ROLE_MAP[sol.status]
  if (!role) return

  await notificarRole(
    role,
    `[Viagens Osasco] Lembrete: solicitação aguardando ${faseLabel} (dia ${dias})`,
    `A solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} aguarda ${faseLabel} há ${dias} dia(s).\n\nAcesse: ${link}`,
    `LEMBRETE_${role}`
  )
}

/** Escalonamento para SEGOV após 5 dias sem ação */
export async function notificarEscalonamento(
  sol: SolicitacaoComUser
): Promise<void> {
  const faseLabel = FASE_LABELS[sol.status] ?? sol.status
  await notificarRole(
    'SEGOV',
    '[Viagens Osasco] ⚠️ Escalonamento: solicitação parada há 5 dias',
    `A solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} está aguardando ${faseLabel} há 5 dias sem ação.\n\nStatus atual: ${sol.status}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'ESCALAMENTO_SEGOV'
  )
}
