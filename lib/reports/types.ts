export interface FiltroRelatorio {
  dataInicio?: string
  dataFim?: string
  secretariaId?: string
  status?: string
}

export interface KpiCard {
  label: string
  value: string | number
  icon: string
  color: string
  alerta?: boolean
}
