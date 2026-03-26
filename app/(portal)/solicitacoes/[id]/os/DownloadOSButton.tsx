'use client'

import { gerarOSPDF } from '@/lib/utils/pdf-generator'

type Props = {
  sol: any
}

export default function DownloadOSButton({ sol }: Props) {
  return (
    <button
      onClick={() => gerarOSPDF(sol)}
      className="bg-[#002745] text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-xl hover:scale-105 transition-transform active:opacity-80 font-bold text-sm"
    >
      <span className="material-symbols-outlined">download</span>
      Baixar PDF
    </button>
  )
}
