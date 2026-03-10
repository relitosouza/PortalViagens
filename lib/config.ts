import { prisma } from '@/lib/prisma'

const DEFAULTS: Record<string, string> = {
  DIAS_UTEIS_ANTECEDENCIA_MINIMA: '15',
  DIAS_UTEIS_PRAZO_PRESTACAO: '5',
  DIAS_ALERTA_VENCIMENTO: '2',
  UPLOAD_MAX_MB: '10',
}

export async function getConfig(chave: string): Promise<string> {
  try {
    const cfg = await prisma.configuracaoSistema.findUnique({ where: { chave } })
    return cfg?.valor ?? DEFAULTS[chave] ?? ''
  } catch {
    return DEFAULTS[chave] ?? ''
  }
}

export async function getConfigInt(chave: string): Promise<number> {
  const val = await getConfig(chave)
  return parseInt(val, 10)
}
