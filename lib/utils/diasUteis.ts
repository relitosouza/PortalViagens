// lib/utils/diasUteis.ts
export function calcularDiasUteisAte(dataAlvo: Date): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(dataAlvo)
  alvo.setHours(0, 0, 0, 0)
  let count = 0
  const cursor = new Date(hoje)
  while (cursor < alvo) {
    cursor.setDate(cursor.getDate() + 1)
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) count++ // ignorar sábado(6) e domingo(0)
  }
  return count
}

export function addDiasUteis(data: Date, dias: number): Date {
  const resultado = new Date(data)
  let count = 0
  while (count < dias) {
    resultado.setDate(resultado.getDate() + 1)
    const dow = resultado.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return resultado
}
