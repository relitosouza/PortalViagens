export const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_APROVACAO_PASTA: 'Gabinete do Secretário',
  DEVOLVIDO_SECRETARIO: 'Ajustes Necessários',
  EM_COTACAO: 'Aguardando Cotação',
  AGUARDANDO_VIABILIDADE: 'Análise de Viabilidade',
  AGUARDANDO_EMISSAO: 'Aguardando Emissão OS',
  AGUARDANDO_EXECUCAO: 'Execução Orçamentária',
  CONCLUIDA: 'Concluída',
  REPROVADA: 'Reprovada',
}

export const ROLES_RELATORIOS: Record<string, string[]> = {
  financeiro: ['ADMIN', 'SECRETARIO', 'SF'],
  workflow: ['ADMIN', 'SECRETARIO', 'SECOL', 'SEGOV', 'SF'],
  servidores: ['ADMIN', 'SECRETARIO'],
  prestacao: ['ADMIN', 'SECRETARIO', 'SF', 'DEMANDANTE'],
  auditoria: ['ADMIN'],
}
