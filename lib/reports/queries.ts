import { prisma } from '@/lib/prisma'

export async function getGastosPorSecretaria(dataInicio?: Date, dataFim?: Date) {
  const steps = await prisma.workflowStep.findMany({
    where: {
      etapa: 'VIABILIDADE',
      decisao: 'APROVADO',
      solicitacao: {
        status: { in: ['AGUARDANDO_EMISSAO', 'AGUARDANDO_EXECUCAO', 'CONCLUIDA'] },
        ...(dataInicio && dataFim ? { dataIda: { gte: dataInicio, lte: dataFim } } : {}),
      },
    },
    include: {
      solicitacao: {
        include: { secretaria: { select: { id: true, nome: true } } },
      },
    },
  })

  const map = new Map<string, { nome: string; passagem: number; hospedagem: number; total: number }>()
  for (const s of steps) {
    const sec = s.solicitacao.secretaria
    const key = sec?.id ?? 'sem-secretaria'
    const nome = sec?.nome ?? 'Sem Secretaria'
    const prev = map.get(key) ?? { nome, passagem: 0, hospedagem: 0, total: 0 }
    prev.passagem += s.valorPassagem ?? 0
    prev.hospedagem += s.valorHospedagem ?? 0
    prev.total += (s.valorPassagem ?? 0) + (s.valorHospedagem ?? 0)
    map.set(key, prev)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export async function getSolicitacoesPorStatus(secretariaId?: string) {
  const where = secretariaId ? { secretariaId } : {}
  const result = await prisma.solicitacao.groupBy({
    by: ['status'],
    where,
    _count: { status: true },
  })
  return result.map(r => ({ status: r.status, count: r._count.status }))
}

export async function getTempoMedioAprovacaoPorEtapa() {
  const steps = await prisma.workflowStep.findMany({
    where: { decisao: 'APROVADO' },
    include: { solicitacao: { select: { createdAt: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const map = new Map<string, number[]>()
  for (const s of steps) {
    const dias = Math.ceil(
      (s.createdAt.getTime() - s.solicitacao.createdAt.getTime()) / 86400000
    )
    const prev = map.get(s.etapa) ?? []
    prev.push(dias)
    map.set(s.etapa, prev)
  }

  return Array.from(map.entries()).map(([etapa, dias]) => ({
    etapa,
    mediaDias: Math.round(dias.reduce((a, b) => a + b, 0) / dias.length),
  }))
}

export async function getPrestacoesPendentes(userId?: string, secretariaId?: string) {
  return prisma.prestacao.findMany({
    where: {
      enviadoEm: null,
      ...(userId ? { solicitacao: { userId } } : {}),
      ...(secretariaId ? { solicitacao: { secretariaId } } : {}),
    },
    include: {
      solicitacao: {
        select: {
          destino: true,
          dataIda: true,
          dataVolta: true,
          nomeCompleto: true,
          matricula: true,
          secretaria: { select: { nome: true } },
        },
      },
    },
    orderBy: { prazoFinal: 'asc' },
  })
}

export async function getPrestacoesEmAtraso() {
  return prisma.prestacao.findMany({
    where: {
      enviadoEm: null,
      prazoFinal: { lt: new Date() },
    },
    include: {
      solicitacao: {
        select: {
          destino: true,
          nomeCompleto: true,
          matricula: true,
          secretaria: { select: { nome: true } },
        },
      },
    },
    orderBy: { prazoFinal: 'asc' },
  })
}

export async function getViagensPorServidor(secretariaId?: string) {
  const sol = await prisma.solicitacao.findMany({
    where: {
      status: { in: ['CONCLUIDA', 'AGUARDANDO_EXECUCAO', 'AGUARDANDO_EMISSAO'] },
      ...(secretariaId ? { secretariaId } : {}),
    },
    include: {
      steps: { where: { etapa: 'VIABILIDADE', decisao: 'APROVADO' } },
      secretaria: { select: { nome: true } },
    },
  })

  const map = new Map<string, {
    nome: string; matricula: string; secretaria: string;
    viagens: number; totalGasto: number
  }>()

  for (const s of sol) {
    const key = s.cpf
    const step = s.steps[0]
    const gasto = (step?.valorPassagem ?? 0) + (step?.valorHospedagem ?? 0)
    const prev = map.get(key) ?? {
      nome: s.nomeCompleto, matricula: s.matricula,
      secretaria: s.secretaria?.nome ?? '-', viagens: 0, totalGasto: 0,
    }
    prev.viagens++
    prev.totalGasto += gasto
    map.set(key, prev)
  }

  return Array.from(map.values()).sort((a, b) => b.viagens - a.viagens)
}

export async function getLogsAcoes(dataInicio?: Date, dataFim?: Date) {
  return prisma.workflowStep.findMany({
    where: dataInicio && dataFim
      ? { createdAt: { gte: dataInicio, lte: dataFim } }
      : {},
    include: {
      solicitacao: {
        select: { destino: true, nomeCompleto: true, secretaria: { select: { nome: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
}

export async function getKpisDashboard(role: string, userId: string, secretariaId?: string) {
  const scopeWhere = role === 'DEMANDANTE'
    ? { userId }
    : role === 'SECRETARIO' && secretariaId
    ? { secretariaId }
    : {}

  const [total, concluidas, reprovadas, prestAtrasadas, naFila] = await Promise.all([
    prisma.solicitacao.count({ where: scopeWhere }),
    prisma.solicitacao.count({ where: { ...scopeWhere, status: 'CONCLUIDA' } }),
    prisma.solicitacao.count({ where: { ...scopeWhere, status: 'REPROVADA' } }),
    prisma.prestacao.count({
      where: {
        enviadoEm: null,
        prazoFinal: { lt: new Date() },
        ...(role === 'DEMANDANTE' ? { solicitacao: { userId } } : {}),
      },
    }),
    prisma.solicitacao.count({
      where: {
        ...scopeWhere,
        status: {
          notIn: ['RASCUNHO', 'CONCLUIDA', 'REPROVADA'],
        },
      },
    }),
  ])

  return { total, concluidas, reprovadas, prestAtrasadas, naFila }
}
