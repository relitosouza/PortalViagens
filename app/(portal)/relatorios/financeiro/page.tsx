import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getGastosPorSecretaria } from '@/lib/reports/queries'
import { ExportGastosPorSecretaria } from './ExportButtons'

const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function FinanceiroPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = session.user.role as string
  if (!['ADMIN', 'SECRETARIO', 'SF'].includes(role)) redirect('/relatorios')

  const gastos = await getGastosPorSecretaria()
  const totalGeral = gastos.reduce((sum, d) => sum + d.total, 0)

  const parametros = await prisma.configuracaoSistema.findMany({
    where: { chave: { in: ['VALOR_EMPENHO_PASSAGEM', 'SALDO_EMPENHO_PASSAGEM', 'VALOR_EMPENHO_HOSPEDAGEM', 'SALDO_EMPENHO_HOSPEDAGEM'] } }
  })
  const getParam = (chave: string) => parseFloat(parametros.find(p => p.chave === chave)?.valor ?? '0')
  const orcadoPass = getParam('VALOR_EMPENHO_PASSAGEM')
  const saldoPass = getParam('SALDO_EMPENHO_PASSAGEM')
  const orcadoHosp = getParam('VALOR_EMPENHO_HOSPEDAGEM')
  const saldoHosp = getParam('SALDO_EMPENHO_HOSPEDAGEM')
  const executadoPass = orcadoPass - saldoPass
  const executadoHosp = orcadoHosp - saldoHosp
  const top10 = [...gastos].slice(0, 10)

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <a href="/relatorios" className="text-slate-400 hover:text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </a>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Financeiro / Orçamentário</h2>
          <p className="text-slate-500 text-sm mt-0.5">Análise de gastos e execução orçamentária</p>
        </div>
      </div>

      {/* F1 — Gastos por Secretaria */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-blue-600 uppercase tracking-wider">F1</span>
            <h3 className="font-bold text-slate-900">Gastos por Secretaria</h3>
          </div>
          <ExportGastosPorSecretaria dados={gastos} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Secretaria</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Passagens</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Hospedagem</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gastos.map(d => (
                <tr key={d.nome} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{d.nome}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 text-right">{fmtMoeda(d.passagem)}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 text-right">{fmtMoeda(d.hospedagem)}</td>
                  <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">{fmtMoeda(d.total)}</td>
                </tr>
              ))}
              {gastos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">Nenhum dado disponível.</td>
                </tr>
              )}
              {gastos.length > 0 && (
                <tr className="bg-slate-50 font-bold">
                  <td className="px-5 py-3 text-sm text-slate-900">TOTAL GERAL</td>
                  <td className="px-5 py-3 text-sm text-slate-900 text-right">{fmtMoeda(gastos.reduce((s, d) => s + d.passagem, 0))}</td>
                  <td className="px-5 py-3 text-sm text-slate-900 text-right">{fmtMoeda(gastos.reduce((s, d) => s + d.hospedagem, 0))}</td>
                  <td className="px-5 py-3 text-sm text-blue-700 text-right">{fmtMoeda(totalGeral)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* F2 — Orçado vs Executado */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-blue-600 uppercase tracking-wider">F2</span>
          <h3 className="font-bold text-slate-900">Orçado vs Executado</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Passagens', orcado: orcadoPass, executado: executadoPass, saldo: saldoPass },
            { label: 'Hospedagem', orcado: orcadoHosp, executado: executadoHosp, saldo: saldoHosp },
          ].map(item => (
            <div key={item.label} className="border border-slate-100 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-slate-700">{item.label}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Orçado</span>
                  <span className="font-medium">{fmtMoeda(item.orcado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Executado</span>
                  <span className="font-medium text-rose-600">{fmtMoeda(item.executado)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1">
                  <span className="text-slate-500">Saldo</span>
                  <span className={`font-bold ${item.saldo < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoeda(item.saldo)}</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min(100, item.orcado > 0 ? (item.executado / item.orcado) * 100 : 0)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 text-right">
                {item.orcado > 0 ? ((item.executado / item.orcado) * 100).toFixed(1) : 0}% executado
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* F6 — Top 10 */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-blue-600 uppercase tracking-wider">F6</span>
          <h3 className="font-bold text-slate-900">Top 10 Secretarias por Gasto Total</h3>
        </div>
        <div className="p-5 space-y-3">
          {top10.map((d, i) => (
            <div key={d.nome} className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-400 w-5 text-right">{i + 1}</span>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-800">{d.nome}</span>
                  <span className="font-bold text-slate-900">{fmtMoeda(d.total)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${totalGeral > 0 ? (d.total / totalGeral) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {top10.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Sem dados disponíveis.</p>}
        </div>
      </section>
    </div>
  )
}
