import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getViagensPorServidor } from '@/lib/reports/queries'
import { prisma } from '@/lib/prisma'

const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function ServidoresPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = session.user.role as string
  if (!['ADMIN', 'SECRETARIO'].includes(role)) redirect('/relatorios')

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id as string } })

  const secretariaId = role === 'SECRETARIO' ? dbUser?.secretariaId ?? undefined : undefined

  const [viagens, destinos, bloqueados] = await Promise.all([
    getViagensPorServidor(secretariaId),
    prisma.solicitacao.groupBy({
      by: ['destino'],
      where: secretariaId ? { secretariaId } : {},
      _count: { destino: true },
      orderBy: { _count: { destino: 'desc' } },
      take: 15,
    }),
    prisma.user.findMany({
      where: { cpfBloqueado: true },
      select: { name: true, email: true, secretaria: { select: { nome: true } } },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <a href="/relatorios" className="text-slate-400 hover:text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </a>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Servidores / Viajantes</h2>
          <p className="text-slate-500 text-sm mt-0.5">Ranking de viajantes, destinos frequentes e restrições</p>
        </div>
      </div>

      {/* S1/S2 — Mais viagens */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          
          <h3 className="font-bold text-slate-900">Servidores com Mais Viagens</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">#</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Servidor</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Matrícula</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Secretaria</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Viagens</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Total Gasto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {viagens.slice(0, 20).map((v, i) => (
                <tr key={`${v.matricula}-${i}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-black text-slate-400">{i + 1}</td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{v.nome}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{v.matricula || '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{v.secretaria}</td>
                  <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">{v.viagens}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 text-right">{fmtMoeda(v.totalGasto)}</td>
                </tr>
              ))}
              {viagens.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">Nenhum dado disponível.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* S3 — Destinos */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          
          <h3 className="font-bold text-slate-900">Destinos Mais Frequentes</h3>
        </div>
        <div className="p-5 space-y-2">
          {destinos.map((d, i) => (
            <div key={d.destino} className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-400 w-5 text-right">{i + 1}</span>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-800">{d.destino}</span>
                  <span className="font-bold text-slate-900">{d._count.destino} viagen{d._count.destino !== 1 ? 's' : ''}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="bg-violet-500 h-1.5 rounded-full"
                    style={{ width: `${destinos[0]._count.destino > 0 ? (d._count.destino / destinos[0]._count.destino) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {destinos.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Nenhum destino registrado.</p>}
        </div>
      </section>

      {/* S4 — CPFs Bloqueados */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-500 text-[20px]">block</span>
          <div>
            
            <h3 className="font-bold text-slate-900">Servidores com CPF Bloqueado</h3>
          </div>
        </div>
        {bloqueados.length === 0 ? (
          <p className="p-5 text-sm text-slate-400 text-center">Nenhum CPF bloqueado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Nome</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">E-mail</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Secretaria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bloqueados.map(u => (
                  <tr key={u.email} className="hover:bg-rose-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{u.name}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{u.email}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{u.secretaria?.nome ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
