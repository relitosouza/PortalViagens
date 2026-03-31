import { prisma } from '@/lib/prisma'

type CriarNotificacaoParams = {
  userId: string
  titulo: string
  descricao?: string
  tipo: string
  solicitacaoId?: string
}

export async function criarNotificacao(params: CriarNotificacaoParams) {
  return prisma.notification.create({ data: params }).catch(() => {
    // silent: notification failure must not block workflow
  })
}

/** Cria notificação para todos os usuários ativos de um determinado papel */
export async function criarNotificacaoPorRole(params: {
  role: string
  secretariaId?: string
  titulo: string
  descricao?: string
  tipo: string
  solicitacaoId?: string
}) {
  const { role, secretariaId, titulo, descricao, tipo, solicitacaoId } = params

  const where: Record<string, unknown> = { role, ativo: true }
  if (secretariaId) where.secretariaId = secretariaId

  const usuarios = await prisma.user.findMany({ where, select: { id: true } })
  if (usuarios.length === 0) return

  await prisma.notification.createMany({
    data: usuarios.map(u => ({
      userId: u.id,
      titulo,
      descricao,
      tipo,
      solicitacaoId,
    })),
  }).catch(() => {})
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, lido: false } })
}

export async function getRecentNotifications(userId: string, limit = 15) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      solicitacao: { select: { destino: true, nomeCompleto: true } },
    },
  })
}

export async function marcarComoLida(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { lido: true, leidoEm: new Date() },
  })
}

export async function marcarTodasComoLidas(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, lido: false },
    data: { lido: true, leidoEm: new Date() },
  })
}
