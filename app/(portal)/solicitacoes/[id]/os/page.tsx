import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import DownloadOSButton from './DownloadOSButton'

export default async function OrdemServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/login')

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      user: true,
      steps: {
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!sol) notFound()

  const viabilidade = sol.steps.find(s => s.etapa === 'VIABILIDADE' && s.decisao === 'APROVADO')
  if (!viabilidade) {
    // Se não tem viabilidade, não pode gerar OS? 
    // Em produção sim, mas vamos permitir visualizar se houver dados.
  }

  const obs = viabilidade?.observacao || ''
  
  // Extrair Voos
  const voosMatch = obs.match(/=== OPÇÕES DE VOO SELECIONADAS ===([\s\S]*?)(?:===|$)/)
  const voosLines = voosMatch ? voosMatch[1].trim().split('\n') : []
  const voos = voosLines.map(line => {
    const parts = line.split('|').map(p => p.trim())
    return {
      desc: parts[0]?.replace(/\[\d+\]\s+/, '') || '',
      detalhes: parts[1] || '',
      sentido: parts[2] || '',
      valor: parts[3] || 'R$ 0,00'
    }
  })

  // Extrair Hoteis
  const hoteisMatch = obs.match(/=== OPÇÕES DE HOSPEDAGEM SELECIONADAS ===([\s\S]*?)(?:===|$)/)
  const hoteisLines = hoteisMatch ? hoteisMatch[1].trim().split('\n') : []
  const hoteis = hoteisLines.map(line => {
    const parts = line.split('|').map(p => p.trim())
    return {
      nome: parts[0]?.replace(/\[\d+\]\s+/, '') || '',
      quarto: parts[1] || '',
      valor: parts[2] || 'R$ 0,00'
    }
  })

  const valorTotal = (viabilidade?.valorPassagem || 0) + (viabilidade?.valorHospedagem || 0)
  const code = `OSV-${new Date().getFullYear()}-${sol.id.slice(-4).toUpperCase()}-${sol.nomeCompleto.split(' ').map(n => n[0]).join('').toUpperCase()}`

  const fmtData = (d: Date) => d.toLocaleDateString('pt-BR')
  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="bg-[#fcf9f8] min-h-screen font-sans text-[#1b1c1c]">
      {/* Action Bar for Web */}
      <div className="fixed bottom-8 right-8 flex gap-3 z-50 print:hidden">
        <Link
          href={`/solicitacoes/${sol.id}`}
          className="bg-white text-[#002745] px-6 py-3 rounded-full flex items-center gap-2 shadow-xl border border-slate-200 hover:bg-slate-50 transition-all font-bold text-sm"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Voltar
        </Link>
        <DownloadOSButton sol={{
          id: sol.id,
          nomeCompleto: sol.nomeCompleto,
          matricula: sol.matricula,
          emailServidor: sol.emailServidor,
          fichaOrcamentaria: sol.fichaOrcamentaria,
          destino: sol.destino,
          dataIda: sol.dataIda.toISOString(),
          dataVolta: sol.dataVolta.toISOString(),
          steps: sol.steps.map(s => ({
            etapa: s.etapa,
            decisao: s.decisao,
            observacao: s.observacao,
            valorPassagem: s.valorPassagem,
            valorHospedagem: s.valorHospedagem,
          }))
        }} />
      </div>

      <main className="flex justify-center py-12 px-4 md:px-0">
        <div className="w-full max-w-[850px] bg-white p-10 md:p-16 shadow-2xl relative overflow-hidden ring-1 ring-black/5">
          
          {/* Official Watermark Backdrop */}
          <div className="absolute top-10 right-10 opacity-[0.03] pointer-events-none -rotate-12">
            <span className="material-symbols-outlined text-[300px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
          </div>

          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-4 border-[#002745] pb-8 mb-10">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-slate-100 flex items-center justify-center rounded-lg p-2">
                <img 
                  src="/brasao-osasco.png" 
                  alt="Brasão de Osasco" 
                  className="w-16 h-16 grayscale contrast-125" 
                />
              </div>
              <div>
                <h1 className="text-[#002745] text-2xl font-black uppercase tracking-tight leading-none">Prefeitura do Município de Osasco</h1>
                <p className="text-[#006d38] font-semibold text-sm tracking-widest mt-1 uppercase">Secretaria de Administração</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">CÓDIGO DO DOCUMENTO</p>
              <p className="text-[#002745] font-mono text-lg font-bold">{code}</p>
            </div>
          </div>

          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#002745] tracking-tighter uppercase mb-2">ORDEM DE SERVIÇO DE VIAGEM E AUTORIZAÇÃO</h2>
            <div className="flex justify-center items-center gap-2 text-slate-400">
              <span className="h-px w-12 bg-slate-200"></span>
              <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Documento Oficial e Inalienável</span>
              <span className="h-px w-12 bg-slate-200"></span>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            
            {/* 1. Identificação */}
            <div className="md:col-span-12">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-2 h-6 bg-[#febb10] rounded-full"></span>
                <h3 className="text-sm font-black uppercase tracking-widest text-[#002745]">1. IDENTIFICAÇÃO DO SOLICITANTE</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-0.5 bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Servidor</p>
                  <p className="font-bold text-[#002745]">{sol.nomeCompleto}</p>
                </div>
                <div className="bg-slate-50 p-5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Matrícula</p>
                  <p className="font-bold text-[#002745]">{sol.matricula || '-'}</p>
                </div>
                <div className="bg-slate-50 p-5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">E-mail Institucional</p>
                  <p className="font-bold text-[#002745] break-all">{sol.emailServidor}</p>
                </div>
                <div className="bg-slate-50 p-5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Ficha Orçamentária</p>
                  <p className="font-bold text-[#002745]">{sol.fichaOrcamentaria}</p>
                </div>
              </div>
            </div>

            {/* 2. Detalhamento */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-2 h-6 bg-[#febb10] rounded-full"></span>
                <h3 className="text-sm font-black uppercase tracking-widest text-[#002745]">2. DETALHAMENTO DA VIAGEM</h3>
              </div>
              <div className="bg-slate-50 p-6 rounded-xl border-l-4 border-[#006d38] space-y-6">
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Destino Oficial</p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006d38]">location_on</span>
                    <p className="text-lg font-black text-[#002745]">{sol.destino}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Período da Missão</p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006d38]">calendar_today</span>
                    <p className="font-bold text-[#002745]">{fmtData(sol.dataIda)} a {fmtData(sol.dataVolta)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Serviços */}
            <div className="md:col-span-7">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-2 h-6 bg-[#febb10] rounded-full"></span>
                <h3 className="text-sm font-black uppercase tracking-widest text-[#002745]">3. SERVIÇOS AUTORIZADOS</h3>
              </div>
              <div className="space-y-4">
                {/* Flight Card */}
                {voos.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#002745] text-sm">flight</span>
                        <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Transporte Aéreo</span>
                      </div>
                      <span className="bg-emerald-100 text-[#006d38] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Autorizado</span>
                    </div>
                    <div className="space-y-3">
                      {voos.map((v, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 uppercase pr-2">
                            {v.desc} {v.detalhes.split('|')[0]} [{v.sentido}]
                          </span>
                          <span className="font-bold text-[#002745] whitespace-nowrap">{v.valor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hotel Card */}
                {hoteis.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#002745] text-sm">hotel</span>
                        <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Hospedagem</span>
                      </div>
                      <span className="bg-emerald-100 text-[#006d38] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Autorizado</span>
                    </div>
                    {hoteis.map((h, i) => (
                      <div key={i} className="text-[10px]">
                        <p className="font-bold text-[#002745] uppercase">{h.nome}</p>
                        <p className="text-slate-600 mt-1">{h.quarto}</p>
                        <p className="font-bold text-[#002745] mt-1">{h.valor}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Total Section */}
            <div className="md:col-span-12 mt-4">
              <div className="bg-[#002745] p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Valor Total Empenhado</p>
                  <p className="text-xs italic opacity-60">(Soma de Passagens e Hospedagem conforme cotação)</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#febb10] text-3xl font-black">
                    {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="material-symbols-outlined text-[#febb10] text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
              </div>
            </div>

            {/* Approval Section */}
            <div className="md:col-span-12 mt-12 grid grid-cols-1 md:grid-cols-2 gap-16">
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-[#002745]/30 mt-12 mb-2"></div>
                <p className="text-[10px] font-black uppercase tracking-tighter text-[#002745]">{sol.nomeCompleto}</p>
                <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Assinatura do Servidor</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-[#002745]/30 mt-12 mb-2"></div>
                <p className="text-[10px] font-black uppercase tracking-tighter text-[#002745]">CHEFIA IMEDIATA</p>
                <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Autorização da Chefia Imediata</p>
              </div>
            </div>

            <div className="md:col-span-12 flex justify-between items-end mt-16 pt-8 border-t border-slate-100">
              <div className="text-[10px] text-slate-400 leading-tight">
                <p className="font-bold mb-1 uppercase text-slate-500">Observações Legais:</p>
                <p>Esta Ordem de Serviço autoriza o deslocamento para fins exclusivamente de interesse público.<br />A prestação de contas deverá ser realizada em até 5 dias úteis após o retorno.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">DATA DE EMISSÃO</p>
                <p className="text-[#002745] font-bold">Osasco, {hoje}</p>
              </div>
            </div>

          </div>

          {/* Side Stamp */}
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 rotate-90 origin-right flex items-center gap-4 pointer-events-none opacity-20 no-print uppercase">
            <span className="text-[8px] font-black tracking-[1em] text-[#002745]">Prefeitura de Osasco • Sistema de Gestão de Viagens</span>
          </div>

        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          vertical-align: middle;
        }
      `}} />
    </div>
  )
}
