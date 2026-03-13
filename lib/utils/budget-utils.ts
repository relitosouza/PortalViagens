export function calcularNoites(dataIda: Date | string, dataVolta: Date | string): number {
  const d1 = new Date(dataIda)
  const d2 = new Date(dataVolta)
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000))
}

/**
 * Converte string de preço (BRL ou US format) para número de forma segura.
 * Identifica se a pontuação é separador de milhar ou decimal.
 */
export function parseCurrency(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined) return 0
  if (typeof valor === 'number') return valor
  
  const v = valor.trim()
  if (!v) return 0

  // Se tem vírgula e ponto, a vírgula é decimal (padrão BR: 1.250,50)
  if (v.includes(',') && v.includes('.')) {
    return parseFloat(v.replace(/\./g, '').replace(',', '.'))
  }

  // Se tem apenas vírgula, é decimal (450,50)
  if (v.includes(',')) {
    return parseFloat(v.replace(',', '.'))
  }

  // Se tem apenas ponto:
  // Se houver 3 dígitos após o ponto, pode ser milhar (1.250)
  // Se houver 2 ou 1 dígito, ou nenhum, é provável que seja decimal (1250.50)
  if (v.includes('.')) {
    const partes = v.split('.')
    const ultimaParte = partes[partes.length - 1]
    
    // Heurística: milhar no Brasil costuma vir sem centavos se for só ponto
    // Mas se o usuário digitou 1.200, ele quer 1200.
    // Se digitou 10.50, ele quer 10.5.
    if (ultimaParte.length === 3 && partes.length > 1) {
      return parseFloat(v.replace(/\./g, ''))
    }
    // Caso contrário, assume decimal (padrão internacional)
    return parseFloat(v)
  }

  return parseFloat(v) || 0
}

export function parsePreco(obs: string | null, totalDias: number) {
  // Diária padrão simulada (pode ser parametrizada futuramente)
  const VALOR_DIARIA = 665.60

  if (!obs) return { voo: 0, hotel: 0, diarias: totalDias * VALOR_DIARIA, total: totalDias * VALOR_DIARIA }
  
  const regexPreco = /R\$\s?([\d.,]+)/g
  const matches = [...obs.matchAll(regexPreco)]
  
  const valores = matches.map(m => parseCurrency(m[1]))

  // Heurística simples: assume o primeiro valor como voo e o último de hotel (total) como hotel
  const voo = valores[0] || 0
  const hotel = (valores.length > 1 ? valores[valores.length - 1] : 0) || 0
  const diarias = totalDias * VALOR_DIARIA

  return { 
    voo, 
    hotel, 
    diarias, 
    total: voo + hotel + diarias 
  }
}
