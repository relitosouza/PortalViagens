import * as XLSX from 'xlsx'

export function exportarRelatorioExcel(
  titulo: string,
  colunas: string[],
  linhas: (string | number)[][],
  nomeArquivo: string
) {
  const ws = XLSX.utils.aoa_to_sheet([colunas, ...linhas])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31))
  XLSX.writeFile(wb, `${nomeArquivo}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
