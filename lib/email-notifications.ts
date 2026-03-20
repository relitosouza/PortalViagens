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

/** Notifica todos os Secretários ativos da secretaria do solicitante */
export async function notificarSecretariosAtivos(
  sol: SolicitacaoComUser,
  secretariaId: string
): Promise<void> {
  const secretarios = await prisma.user.findMany({
    where: { role: 'SECRETARIO', secretariaId, ativo: true },
  })
  for (const s of secretarios) {
    try {
      logEmail({
        para: s.email,
        assunto: '[Viagens Osasco] Nova solicitação aguardando sua aprovação',
        corpo: `Uma nova solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} aguarda sua aprovação.\n\nAcesse: ${APP_URL}/portal/solicitacoes/${sol.id}`,
        tipo: 'NOVA_SOLICITACAO_SECRETARIO',
      })
    } catch {
      // silent
    }
  }
}

/** Secretário aprovou → notificar SECOL + Demandante */
export async function notificarAprovacaoSecretario(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Nova solicitação aguardando cotação',
    `A solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} foi aprovada pelo Secretário e aguarda cotação.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'APROVACAO_SECRETARIO_SECOL'
  )
  notificarDemandante(
    sol,
    '[Viagens Osasco] Sua solicitação foi aprovada pelo Secretário',
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi aprovada pelo Secretário e encaminhada para cotação.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'APROVACAO_SECRETARIO_DEMANDANTE'
  )
}

/** Secretário devolveu → notificar Demandante */
export function notificarDevolucaoSecretario(
  sol: SolicitacaoComUser,
  observacao: string
): void {
  notificarDemandante(
    sol,
    '[Viagens Osasco] Sua solicitação foi devolvida para correção',
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi devolvida pelo Secretário para correção.\n\nMotivo: ${observacao}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'DEVOLUCAO_SECRETARIO'
  )
}

/** Secretário reprovou → notificar Demandante */
export function notificarReprovacaoSecretario(
  sol: SolicitacaoComUser,
  observacao: string
): void {
  notificarDemandante(
    sol,
    '[Viagens Osasco] Sua solicitação foi reprovada',
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi reprovada pelo Secretário.\n\nMotivo: ${observacao}\n\nPara novas viagens, crie uma nova solicitação.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'REPROVACAO_SECRETARIO'
  )
}
