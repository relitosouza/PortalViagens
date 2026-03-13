'use client'

type Props = {
  numeroEmpenho?: string
  valorEmpenho?: string
  saldoEmpenho?: string
  destacado?: boolean
}

export default function BudgetTetoInfo({ numeroEmpenho, valorEmpenho, saldoEmpenho, destacado = false }: Props) {
  if (!numeroEmpenho && !saldoEmpenho) return null

  const saldo = parseFloat(saldoEmpenho || '0')
  const total = parseFloat(valorEmpenho || '0')
  const percent = total > 0 ? (saldo / total) * 100 : 0
  
  const isLow = percent < 15
  const isCritical = percent < 5

  if (destacado) {
    return (
      <div className={`p-5 rounded-2xl border-2 shadow-lg transition-all ${
        isCritical ? 'bg-red-50 border-red-500 animate-pulse' : 
        isLow ? 'bg-amber-50 border-amber-500' : 
        'bg-blue-600 text-white border-blue-400'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`size-12 rounded-xl flex items-center justify-center ${
              isCritical || isLow ? 'bg-white' : 'bg-blue-500'
            }`}>
              <span className={`material-symbols-outlined ${
                isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-white'
              }`}>
                account_balance_wallet
              </span>
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest leading-none mb-1 ${
                isCritical || isLow ? 'text-slate-500' : 'text-blue-200'
              }`}>
                Teto Orçamentário (Empenho {numeroEmpenho})
              </p>
              <p className={`text-2xl font-black leading-none ${
                isCritical ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-white'
              }`}>
                R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className={`text-[10px] mt-1 font-medium ${
                isCritical || isLow ? 'text-slate-400' : 'text-blue-200'
              }`}>
                Disponível para novas aprovações
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`inline-block px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
              isCritical ? 'bg-red-200 text-red-800' : 
              isLow ? 'bg-amber-200 text-amber-800' : 
              'bg-blue-500 text-white'
            }`}>
              {percent.toFixed(1)}% Restante
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-4 h-2 bg-black/10 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${
              isCritical ? 'bg-red-600' : isLow ? 'bg-amber-500' : 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]'
            }`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-6 py-2 px-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex flex-col">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Empenho</span>
        <span className="text-sm font-black text-slate-700 font-mono">{numeroEmpenho || 'N/A'}</span>
      </div>
      <div className="w-px h-8 bg-slate-200" />
      <div className="flex flex-col">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Saldo Disponível</span>
        <span className={`text-sm font-black ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-blue-600'}`}>
          R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  )
}
