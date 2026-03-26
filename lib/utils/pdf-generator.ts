import jsPDF from 'jspdf'
import 'jspdf-autotable'

// Extensão de tipos para o jsPDF com autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF
}

const fmtMoeda = (valor: number | string) => {
  const v = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : valor
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const fmtData = (dataStr: string | Date) => {
  return new Date(dataStr).toLocaleDateString('pt-BR')
}

export function gerarOSPDF(sol: any) {
  const doc = new jsPDF() as jsPDFWithAutoTable
  const protocol = sol.id.slice(-8).toUpperCase()

  // Cabeçalho
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('PREFEITURA DO MUNICÍPIO DE OSASCO', 105, 15, { align: 'center' })
  doc.setFontSize(12)
  doc.text(`ORDEM DE SERVIÇO Nº ${protocol} / 2026`, 105, 22, { align: 'center' })

  // 1. Identificação
  doc.setFontSize(11)
  doc.text('1. IDENTIFICAÇÃO DO SOLICITANTE', 14, 35)
  doc.setLineWidth(0.5)
  doc.line(14, 37, 196, 37)

  doc.setFont('helvetica', 'normal')
  doc.text(`Servidor: ${sol.nomeCompleto}`, 14, 45)
  doc.text(`Matrícula: ${sol.matricula || '-'}`, 14, 52)
  doc.text(`E-mail: ${sol.emailServidor}`, 14, 59)
  doc.text(`Ficha Orçamentária: ${sol.fichaOrcamentaria}`, 14, 66)

  // 2. Detalhamento
  doc.setFont('helvetica', 'bold')
  doc.text('2. DETALHAMENTO DA VIAGEM', 14, 80)
  doc.line(14, 82, 196, 82)
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Destino: ${sol.destino}`, 14, 90)
  doc.text(`Período: ${fmtData(sol.dataIda)} a ${fmtData(sol.dataVolta)}`, 14, 97)

  // 3. Serviços Autorizados
  doc.setFont('helvetica', 'bold')
  doc.text('3. SERVIÇOS AUTORIZADOS', 14, 110)
  doc.line(14, 112, 196, 112)

  // Buscar última etapa de viabilidade aprovada para pegar os voos/hoteis
  // O componente passará os dados já processados ou os brutos
  // Para ser robusto, vamos extrair do passo de viabilidade
  const viabilidade = sol.steps?.find((s: any) => s.etapa === 'VIABILIDADE' && s.decisao === 'APROVADO')
  const obs = viabilidade?.observacao || ''

  // Extrair Voos
  const voosMatch = obs.match(/=== OPÇÕES DE VOO SELECIONADAS ===([\s\S]*?)(?:===|$)/)
  const voosLines = voosMatch ? voosMatch[1].trim().split('\n') : []

  // Extrair Hoteis
  const hoteisMatch = obs.match(/=== OPÇÕES DE HOSPEDAGEM SELECIONADAS ===([\s\S]*?)(?:===|$)/)
  const hoteisLines = hoteisMatch ? hoteisMatch[1].trim().split('\n') : []

  let currentY = 120

  if (voosLines.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Transporte Aéreo:', 14, currentY)
    currentY += 5
    doc.setFont('helvetica', 'normal')
    voosLines.forEach((line: string) => {
      const parts = line.split('|').map((p: string) => p.trim())
      if (parts.length >= 4) {
        const desc = `${parts[0].replace(/\[\d+\]\s+/, '')} | ${parts[1]} | ${parts[2]}`
        const valor = parts[3].replace('Tarifa: ', '')
        doc.text(`- ${desc} | ${valor}`, 20, currentY, { maxWidth: 170 })
        currentY += 7
      }
    })
    currentY += 5
  }

  if (hoteisLines.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Hospedagem:', 14, currentY)
    currentY += 5
    doc.setFont('helvetica', 'normal')
    hoteisLines.forEach((line: string) => {
      const parts = line.split('|').map((p: string) => p.trim())
      if (parts.length >= 3) {
        const desc = `${parts[0].replace(/\[\d+\]\s+/, '')} | ${parts[1]}`
        const valor = parts[2]
        doc.text(`- ${desc} | ${valor}`, 20, currentY, { maxWidth: 170 })
        currentY += 7
      }
    })
    currentY += 5
  }

  // 4. Valor Total
  const valorPassagem = viabilidade?.valorPassagem || 0
  const valorHospedagem = viabilidade?.valorHospedagem || 0
  const total = valorPassagem + valorHospedagem

  doc.setFont('helvetica', 'bold')
  doc.text('4. VALOR TOTAL AUTORIZADO', 14, currentY + 10)
  doc.line(14, currentY + 12, 196, currentY + 12)
  doc.text(`Total Geral: ${fmtMoeda(total)}`, 14, currentY + 20)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.text('(Soma de Passagens e Hospedagem)', 14, currentY + 25)

  // Assinatura
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('__________________________________________', 105, 260, { align: 'center' })
  doc.text('Assinatura do Responsável (SEGOV)', 105, 265, { align: 'center' })

  doc.save(`OS_${protocol}_2026.pdf`)
}

export function gerarPortariaPDF(sol: any, nomeEvento: string) {
  const doc = new jsPDF()
  const protocol = sol.id.slice(-8).toUpperCase()
  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

  // Cabeçalho institucional
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('PREFEITURA DO MUNICÍPIO DE OSASCO', 105, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.text('GABINETE DO PREFEITO', 105, 27, { align: 'center' })
  
  doc.setFontSize(14)
  doc.text(`PORTARIA DE DISPENSA Nº ____ / 2026`, 105, 50, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  
  const texto = `O PREFEITO DO MUNICÍPIO DE OSASCO, no uso de suas atribuições legais, resolve DISPENSAR o servidor ${sol.nomeCompleto}, matrícula nº ${sol.matricula || '_______'}, para participar do evento "${nomeEvento}", a ser realizado em ${sol.destino}, no período de ${fmtData(sol.dataIda)} a ${fmtData(sol.dataVolta)}, sem prejuízo de seus vencimentos e demais vantagens do cargo.`

  // Texto justificado
  const splitText = doc.splitTextToSize(texto, 170)
  doc.text(splitText, 20, 70, { align: 'justify' })

  doc.text(`Osasco, ${hoje}.`, 20, 110)

  // Assinatura
  doc.setFont('helvetica', 'bold')
  doc.text('__________________________________________', 105, 160, { align: 'center' })
  doc.text('Duly Amaral', 105, 165, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Secretário de Governo - SEGOV', 105, 170, { align: 'center' })

  doc.save(`Portaria_Dispensa_${protocol}.pdf`)
}
