// scripts/gerar-template-excel.ts
import * as XLSX from 'xlsx'
import path from 'path'

const HEADERS = [
  'Nome Completo',
  'Matrícula',
  'CPF',
  'Data de Nascimento',
  'Telefone/WhatsApp',
  'E-mail Institucional',
  'Destino',
  'Data de Ida',
  'Data de Volta',
  'Justificativa de Localização',
  'Indicação de Voo',
  'Indicação de Hospedagem',
  'Ficha Orçamentária',
]

const EXAMPLE = [
  'João da Silva',
  '123456-7',
  '000.000.000-00',
  '15/06/1985',
  '(11) 99999-9999',
  'joao.silva@osasco.sp.gov.br',
  'Brasília, DF',
  '20/04/2026',
  '23/04/2026',
  'O evento ocorre exclusivamente em Brasília, sede do governo federal.',
  'Voo das 06h30 (LATAM LA3456)',
  'Hotel próximo ao centro de convenções',
  '02.10.01.001',
]

const wb = XLSX.utils.book_new()
const ws = XLSX.utils.aoa_to_sheet([HEADERS, EXAMPLE])

// Largura das colunas
ws['!cols'] = HEADERS.map((_, i) => ({
  wch: i >= 6 && i <= 7 ? 50 : i === 0 ? 30 : 22,
}))

XLSX.utils.book_append_sheet(wb, ws, 'Solicitação de Viagem')

const outputPath = path.join(process.cwd(), 'public', 'modelo-solicitacao-viagem.xlsx')
XLSX.writeFile(wb, outputPath)
console.log(`Template gerado: ${outputPath}`)
