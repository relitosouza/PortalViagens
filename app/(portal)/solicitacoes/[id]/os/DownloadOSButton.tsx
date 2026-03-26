'use client'

import { useState } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function DownloadOSButton({ nomeCompleto, id }: { nomeCompleto: string; id: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    const el = document.getElementById('os-documento')
    if (!el) return

    setLoading(true)
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (canvas.height * pdfW) / canvas.width

      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
      const code = `OS_${id.slice(-4).toUpperCase()}_${nomeCompleto.split(' ').map(n => n[0]).join('')}`
      pdf.save(`${code}.pdf`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="bg-[#002745] text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-xl hover:scale-105 transition-transform active:opacity-80 font-bold text-sm disabled:opacity-60 disabled:cursor-wait"
    >
      <span className="material-symbols-outlined">{loading ? 'hourglass_empty' : 'download'}</span>
      {loading ? 'Gerando...' : 'Baixar PDF'}
    </button>
  )
}
