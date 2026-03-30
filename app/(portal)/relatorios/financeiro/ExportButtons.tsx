'use client'
import { exportarRelatorioPDF } from '@/lib/reports/export-pdf'
import { exportarRelatorioExcel } from '@/lib/reports/export-excel'

interface Row { nome: string; passagem: number; hospedagem: number; total: number }

export function ExportGastosPorSecretaria({ dados }: { dados: Row[] }) {
  const colunas = ['Secretaria', 'Passagens (R$)', 'Hospedagem (R$)', 'Total (R$)']
  const linhas = dados.map(d => [d.nome, d.passagem.toFixed(2), d.hospedagem.toFixed(2), d.total.toFixed(2)])
  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportarRelatorioPDF('F1 — Gastos por Secretaria', colunas, linhas, 'F1_gastos_secretaria')}
        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-100 transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span> PDF
      </button>
      <button
        onClick={() => exportarRelatorioExcel('Gastos por Secretaria', colunas, linhas, 'F1_gastos_secretaria')}
        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">table_view</span> Excel
      </button>
    </div>
  )
}
