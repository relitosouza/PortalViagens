// lib/utils/parse-excel-solicitacao.ts
import type * as XLSXType from 'xlsx'

type FormData = {
  nomeCompleto: string
  matricula: string
  cpf: string
  dataNascimento: string
  celular: string
  emailServidor: string
  justificativaPublica: string
  nexoCargo: string
  destino: string
  dataIda: string
  dataVolta: string
  justificativaLocal: string
  indicacaoVoo: string
  indicacaoHospedagem: string
  fichaOrcamentaria: string
}

const COLUMN_MAP: Record<string, keyof FormData> = {
  'Nome Completo': 'nomeCompleto',
  'Matrícula': 'matricula',
  'CPF': 'cpf',
  'Data de Nascimento': 'dataNascimento',
  'Telefone/WhatsApp': 'celular',
  'E-mail Institucional': 'emailServidor',
  'Justificativa do Interesse Público': 'justificativaPublica',
  'Nexo com as Atribuições do Cargo': 'nexoCargo',
  'Destino': 'destino',
  'Data de Ida': 'dataIda',
  'Data de Volta': 'dataVolta',
  'Justificativa de Localização': 'justificativaLocal',
  'Indicação de Voo': 'indicacaoVoo',
  'Indicação de Hospedagem': 'indicacaoHospedagem',
  'Ficha Orçamentária': 'fichaOrcamentaria',
}

const DATE_FIELDS = new Set<keyof FormData>(['dataNascimento', 'dataIda', 'dataVolta'])

/** Converte serial Excel ou string DD/MM/AAAA para YYYY-MM-DD */
function toISODate(value: unknown): string {
  if (typeof value === 'number') {
    // Serial Excel: dias desde 1900-01-01 (com bug leap year do Excel)
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (match) return `${match[3]}-${match[2]}-${match[1]}`
    // Já está em YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  }
  return ''
}

export async function parseExcelSolicitacao(buffer: ArrayBuffer): Promise<Partial<FormData>> {
  const XLSX: typeof XLSXType = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // sheet_to_json com header: 1 retorna array de arrays
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })

  // Linha 0: cabeçalhos, Linha 1: exemplo, Linha 2: primeiro dado real
  const headers = rows[0] as string[]
  const dataRow = rows[2] as (string | number)[]

  if (!headers || !dataRow) return {}

  const result: Partial<FormData> = {}

  headers.forEach((header, i) => {
    const field = COLUMN_MAP[header?.trim()]
    if (!field) return
    const raw = dataRow[i]
    if (raw === '' || raw === undefined || raw === null) return

    if (DATE_FIELDS.has(field)) {
      const iso = toISODate(raw)
      if (iso) (result as Record<string, string>)[field] = iso
    } else {
      (result as Record<string, string>)[field] = String(raw).trim()
    }
  })

  return result
}
