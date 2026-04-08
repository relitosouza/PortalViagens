import { isValidCPF } from './cpf'
import { isValidBirthDate, isValidTravelDate, isValidDateRange } from './dates'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates the input for a Solicitacao (travel request).
 * This covers both POST (creation) and PATCH (update) scenarios.
 */
export function validateSolicitacaoInput(body: unknown): ValidationResult {
  const errors: string[] = []

  if (typeof body !== 'object' || body === null) {
    return { valid: false, errors: ['Corpo da requisição inválido'] }
  }

  const data = body as Record<string, unknown>

  // Campos obrigatórios pelo DEMANDANTE
  // justificativaPublica e nexoCargo são preenchidos pelo SECRETARIO em etapa posterior
  const requiredFields = [
    'nomeCompleto', 'matricula', 'cpf', 'dataNascimento', 'celular',
    'emailServidor', 'destino',
    'dataIda', 'dataVolta', 'justificativaLocal', 'fichaOrcamentaria'
  ]

  // Only validate required fields if it's not a draft (rascunho)
  // or if we're doing a full validation for PATCH
  const isRascunho = data.rascunho === true

  if (!isRascunho) {
    requiredFields.forEach(field => {
      if (!data[field] || typeof data[field] !== 'string') {
        errors.push(`Campo obrigatório: ${field}`)
      }
    })
  } else {
    // For drafts, we at least need these to be strings if provided
    requiredFields.forEach(field => {
      if (data[field] && typeof data[field] !== 'string') {
        errors.push(`Campo ${field} deve ser texto`)
      }
    })
  }

  // Validar CPF com checksum
  if (data.cpf && !isValidCPF(String(data.cpf))) {
    errors.push('cpf: CPF inválido (checksum falhou)')
  }

  // Validar data de nascimento (sanity check)
  if (data.dataNascimento && !isValidBirthDate(String(data.dataNascimento))) {
    errors.push('dataNascimento: data de nascimento inválida (deve ser no passado, maior de 18 anos)')
  }

  // Validar datas de viagem
  if (data.dataIda && !isValidTravelDate(String(data.dataIda))) {
    errors.push('dataIda: data de ida deve ser no futuro')
  }

  if (data.dataVolta && !isValidTravelDate(String(data.dataVolta))) {
    errors.push('dataVolta: data de volta deve ser no futuro')
  }

  // Validar intervalo de datas
  if (data.dataIda && data.dataVolta && !isValidDateRange(String(data.dataIda), String(data.dataVolta))) {
    errors.push('dataVolta: data de volta deve ser após data de ida')
  }

  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (data.emailServidor && !emailRegex.test(String(data.emailServidor))) {
    errors.push('emailServidor: formato de email inválido')
  }

  // Validar celular (mínimo 10 dígitos)
  if (data.celular) {
    const celular = String(data.celular).replace(/\D/g, '')
    if (celular.length < 10) {
      errors.push('celular: deve conter pelo menos 10 dígitos')
    }
  }

  // Validar tamanho máximo dos campos de texto (prevenção de DoS/Data Truncation)
  const textFields: Record<string, number> = {
    nomeCompleto: 255,
    matricula: 50,
    cpf: 14,
    destino: 255,
    nexoCargo: 255,
    justificativaPublica: 2000,
    justificativaLocal: 2000,
    fichaOrcamentaria: 1000
  }

  Object.entries(textFields).forEach(([field, maxLength]) => {
    if (data[field] && String(data[field]).length > maxLength) {
      errors.push(`${field}: máximo ${maxLength} caracteres`)
    }
  })

  return { valid: errors.length === 0, errors }
}
