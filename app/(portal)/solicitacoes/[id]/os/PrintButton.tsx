'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-[#002745] text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-xl hover:scale-105 transition-transform active:opacity-80 font-bold text-sm"
    >
      <span className="material-symbols-outlined">print</span>
      Imprimir OSV
    </button>
  )
}
