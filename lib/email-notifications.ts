// lib/email-notifications.ts
import { prisma } from '@/lib/prisma'
import { logEmail } from '@/lib/email-log'
import { Solicitacao, User } from '@prisma/client'

type SolicitacaoComUser = Solicitacao & { user: User }

const APP_URL = () => process.env.APP_URL ?? 'http://localhost:3000'

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
    logEmail({ para: u.email, assunto, corpo, tipo })
  }
}

/** Notifica o demandante diretamente pelo emailServidor da solicitação */
export function notificarDemandante(
  sol: SolicitacaoComUser,
  assunto: string,
  corpo: string,
  tipo: string
): void {
  logEmail({ para: sol.emailServidor, assunto, corpo, tipo })
}

/** Demandante submeteu → notificar SECOL para cotar */
export async function notificarNovaSOlicitacaoParaSecol(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Nova solicitação aguardando cotação',
    `Uma nova solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} está aguardando cotação.\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
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
    `A cotação da viagem para ${sol.destino} de ${sol.nomeCompleto} foi concluída pela SECOL. A solicitação aguarda análise de viabilidade.\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
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
    `A viabilidade da viagem para ${sol.destino} de ${sol.nomeCompleto} foi aprovada. A solicitação aguarda emissão dos vouchers.\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
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
    `A SEGOV solicitou ajuste na cotação da viagem para ${sol.destino} de ${sol.nomeCompleto}.\n\nMotivo: ${observacao || 'Não informado'}\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
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
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} precisa de ajustes.\n\nMotivo: ${observacao || 'Não informado'}\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
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
    `Os vouchers da viagem para ${sol.destino} de ${sol.nomeCompleto} foram emitidos. A solicitação aguarda confirmação de execução.\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
    'EXECUCAO_SF'
  )
}
