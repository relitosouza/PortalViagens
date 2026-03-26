// MEDIUM FIX: CPF validation
// Validates Brazilian CPF format and calculates check digits

export function isValidCPF(cpf: string): boolean {
  // Remove common formatting
  const cleanCPF = cpf.replace(/[^\d]/g, '')

  // Check length
  if (cleanCPF.length !== 11) {
    return false
  }

  // Reject if all digits are the same
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return false
  }

  // Calculate first check digit
  let sum = 0
  let remainder: number

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i)
  }

  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false

  // Calculate second check digit
  sum = 0
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i)
  }

  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false

  return true
}

export function formatCPF(cpf: string): string {
  const clean = cpf.replace(/[^\d]/g, '')
  if (clean.length !== 11) return cpf
  return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`
}
