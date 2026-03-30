import jsPDF from 'jspdf'
import 'jspdf-autotable'

interface jsPDFWithAutoTable extends jsPDF {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoTable: (options: any) => jsPDF
}

export function exportarRelatorioPDF(
  titulo: string,
  colunas: string[],
  linhas: (string | number)[][],
  nomeArquivo: string
) {
  const doc = new jsPDF() as jsPDFWithAutoTable
  const hoje = new Date().toLocaleDateString('pt-BR')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('PREFEITURA DO MUNICÍPIO DE OSASCO', 105, 14, { align: 'center' })
  doc.setFontSize(11)
  doc.text(titulo, 105, 21, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Gerado em: ${hoje}`, 14, 28)

  doc.autoTable({
    head: [colunas],
    body: linhas,
    startY: 32,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  })

  doc.save(`${nomeArquivo}_${hoje.replace(/\//g, '-')}.pdf`)
}
