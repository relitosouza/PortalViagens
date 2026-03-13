export function calcularNoites(dataIda: Date | string, dataVolta: Date | string): number {
  const d1 = new Date(dataIda)
  const d2 = new Date(dataVolta)
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000))
}

export function parsePreco(obs: string | null, totalDias: number) {
  // Diária padrão simulada (pode ser parametrizada futuramente)
  const VALOR_DIARIA = 665.60

  if (!obs) return { voo: 0, hotel: 0, diarias: totalDias * VALOR_DIARIA, total: totalDias * VALOR_DIARIA }
  
  // Busca por R$ seguido de número (ex: R$ 1.240,00 ou R$ 500)
  const regexPreco = /R\$\s?([\d.,]+)/g
  const matches = [...obs.matchAll(regexPreco)]
  
  const valores = matches.map(m => {
    const v = m[1].replace(/\./g, '').replace(',', '.')
    return parseFloat(v)
  })

  // Heurística simples: assume o primeiro valor como voo e o último de hotel (total) como hotel
  const voo = valores[0] || 1240.00
  const hotel = (valores.length > 1 ? valores[valores.length - 1] : 0) || 950.00
  const diarias = totalDias * VALOR_DIARIA

  return { 
    voo, 
    hotel, 
    diarias, 
    total: voo + hotel + diarias 
  }
}
