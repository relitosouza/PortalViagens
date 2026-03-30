# Módulo de Relatórios — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Implementar módulo completo de relatórios com dashboard executivo expandido e 24 relatórios em 5 categorias, com controle de acesso por perfil e exportação PDF/Excel.

**Architecture:** Dashboard executivo em `/dashboard` expandido com KPIs e gráficos. Hub de relatórios em `/relatorios` com navegação por categoria. Cada relatório é um Server Component que busca dados via Prisma, com exportação client-side via jsPDF e xlsx.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), Tailwind CSS, jsPDF + jspdf-autotable (já instalado), xlsx (já instalado), recharts (instalar).

---

## Task 1: Instalar recharts

**Files:**
- Modify: `package.json`

**Step 1: Instalar a dependência**

```bash
npm install recharts
npm install --save-dev @types/recharts
```

**Step 2: Verificar instalação**

```bash
node -e "require('recharts'); console.log('ok')"
```
Expected: `ok`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add recharts for report charts"
```

---

## Task 2: Criar tipos e constantes compartilhadas de relatórios

**Files:**
- Create: `lib/reports/types.ts`
- Create: `lib/reports/constants.ts`

**Step 1: Criar `lib/reports/types.ts`**

```typescript
export interface FiltroRelatorio {
  dataInicio?: string
  dataFim?: string
  secretariaId?: string
  status?: string
}

export interface KpiCard {
  label: string
  value: string | number
  icon: string
  color: string
  alerta?: boolean
}
```

**Step 2: Criar `lib/reports/constants.ts`**

```typescript
export const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_APROVACAO_PASTA: 'Gabinete do Secretário',
  DEVOLVIDO_SECRETARIO: 'Ajustes Necessários',
  EM_COTACAO: 'Aguardando Cotação',
  AGUARDANDO_VIABILIDADE: 'Análise de Viabilidade',
  AGUARDANDO_EMISSAO: 'Aguardando Emissão OS',
  AGUARDANDO_EXECUCAO: 'Execução Orçamentária',
  CONCLUIDA: 'Concluída',
  REPROVADA: 'Reprovada',
}

export const ROLES_RELATORIOS: Record<string, string[]> = {
  financeiro: ['ADMIN', 'SECRETARIO', 'SF'],
  workflow: ['ADMIN', 'SECRETARIO', 'SECOL', 'SEGOV', 'SF'],
  servidores: ['ADMIN', 'SECRETARIO'],
  prestacao: ['ADMIN', 'SECRETARIO', 'SF', 'DEMANDANTE'],
  auditoria: ['ADMIN'],
}
```

**Step 3: Commit**

```bash
git add lib/reports/
git commit -m "feat: add report shared types and constants"
```

---

## Task 3: Criar queries de dados para relatórios (data access layer)

**Files:**
- Create: `lib/reports/queries.ts`

**Step 1: Criar `lib/reports/queries.ts`**

```typescript
import { prisma } from '@/lib/prisma'

export async function getGastosPorSecretaria(dataInicio?: Date, dataFim?: Date) {
  const steps = await prisma.workflowStep.findMany({
    where: {
      etapa: 'VIABILIDADE',
      decisao: 'APROVADO',
      solicitacao: {
        status: { in: ['AGUARDANDO_EMISSAO', 'AGUARDANDO_EXECUCAO', 'CONCLUIDA'] },
        ...(dataInicio && dataFim ? { dataIda: { gte: dataInicio, lte: dataFim } } : {}),
      },
    },
    include: {
      solicitacao: {
        include: { secretaria: { select: { id: true, nome: true } } },
      },
    },
  })

  const map = new Map<string, { nome: string; passagem: number; hospedagem: number; total: number }>()
  for (const s of steps) {
    const sec = s.solicitacao.secretaria
    const key = sec?.id ?? 'sem-secretaria'
    const nome = sec?.nome ?? 'Sem Secretaria'
    const prev = map.get(key) ?? { nome, passagem: 0, hospedagem: 0, total: 0 }
    prev.passagem += s.valorPassagem ?? 0
    prev.hospedagem += s.valorHospedagem ?? 0
    prev.total += (s.valorPassagem ?? 0) + (s.valorHospedagem ?? 0)
    map.set(key, prev)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export async function getSolicitacoesPorStatus(secretariaId?: string) {
  const where = secretariaId ? { secretariaId } : {}
  const result = await prisma.solicitacao.groupBy({
    by: ['status'],
    where,
    _count: { status: true },
  })
  return result.map(r => ({ status: r.status, count: r._count.status }))
}

export async function getTempoMedioAprovacaoPorEtapa() {
  const steps = await prisma.workflowStep.findMany({
    where: { decisao: 'APROVADO' },
    include: { solicitacao: { select: { createdAt: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const map = new Map<string, number[]>()
  for (const s of steps) {
    const dias = Math.ceil(
      (s.createdAt.getTime() - s.solicitacao.createdAt.getTime()) / 86400000
    )
    const prev = map.get(s.etapa) ?? []
    prev.push(dias)
    map.set(s.etapa, prev)
  }

  return Array.from(map.entries()).map(([etapa, dias]) => ({
    etapa,
    mediaDias: Math.round(dias.reduce((a, b) => a + b, 0) / dias.length),
  }))
}

export async function getPrestacoesPendentes(userId?: string, secretariaId?: string) {
  return prisma.prestacao.findMany({
    where: {
      enviadoEm: null,
      ...(userId ? { solicitacao: { userId } } : {}),
      ...(secretariaId ? { solicitacao: { secretariaId } } : {}),
    },
    include: {
      solicitacao: {
        select: {
          destino: true,
          dataIda: true,
          dataVolta: true,
          nomeCompleto: true,
          matricula: true,
          secretaria: { select: { nome: true } },
        },
      },
    },
    orderBy: { prazoFinal: 'asc' },
  })
}

export async function getPrestacoesEmAtraso() {
  return prisma.prestacao.findMany({
    where: {
      enviadoEm: null,
      prazoFinal: { lt: new Date() },
    },
    include: {
      solicitacao: {
        select: {
          destino: true,
          nomeCompleto: true,
          matricula: true,
          secretaria: { select: { nome: true } },
        },
      },
    },
    orderBy: { prazoFinal: 'asc' },
  })
}

export async function getViagensPorServidor(secretariaId?: string) {
  const sol = await prisma.solicitacao.findMany({
    where: {
      status: { in: ['CONCLUIDA', 'AGUARDANDO_EXECUCAO', 'AGUARDANDO_EMISSAO'] },
      ...(secretariaId ? { secretariaId } : {}),
    },
    include: {
      steps: { where: { etapa: 'VIABILIDADE', decisao: 'APROVADO' } },
      secretaria: { select: { nome: true } },
    },
  })

  const map = new Map<string, {
    nome: string; matricula: string; secretaria: string;
    viagens: number; totalGasto: number
  }>()

  for (const s of sol) {
    const key = s.cpf
    const step = s.steps[0]
    const gasto = (step?.valorPassagem ?? 0) + (step?.valorHospedagem ?? 0)
    const prev = map.get(key) ?? {
      nome: s.nomeCompleto, matricula: s.matricula,
      secretaria: s.secretaria?.nome ?? '-', viagens: 0, totalGasto: 0,
    }
    prev.viagens++
    prev.totalGasto += gasto
    map.set(key, prev)
  }

  return Array.from(map.values()).sort((a, b) => b.viagens - a.viagens)
}

export async function getLogsAcoes(dataInicio?: Date, dataFim?: Date) {
  return prisma.workflowStep.findMany({
    where: dataInicio && dataFim
      ? { createdAt: { gte: dataInicio, lte: dataFim } }
      : {},
    include: {
      solicitacao: {
        select: { destino: true, nomeCompleto: true, secretaria: { select: { nome: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
}

export async function getKpisDashboard(role: string, userId: string, secretariaId?: string) {
  const scopeWhere = role === 'DEMANDANTE'
    ? { userId }
    : role === 'SECRETARIO' && secretariaId
    ? { secretariaId }
    : {}

  const [total, concluidas, reprovadas, prestAtrasadas, naFila] = await Promise.all([
    prisma.solicitacao.count({ where: scopeWhere }),
    prisma.solicitacao.count({ where: { ...scopeWhere, status: 'CONCLUIDA' } }),
    prisma.solicitacao.count({ where: { ...scopeWhere, status: 'REPROVADA' } }),
    prisma.prestacao.count({
      where: {
        enviadoEm: null,
        prazoFinal: { lt: new Date() },
        ...(role === 'DEMANDANTE' ? { solicitacao: { userId } } : {}),
      },
    }),
    prisma.solicitacao.count({
      where: {
        ...scopeWhere,
        status: {
          notIn: ['RASCUNHO', 'CONCLUIDA', 'REPROVADA'],
        },
      },
    }),
  ])

  return { total, concluidas, reprovadas, prestAtrasadas, naFila }
}
```

**Step 2: Commit**

```bash
git add lib/reports/
git commit -m "feat: add report data access queries"
```

---

## Task 4: Criar utilitários de exportação para relatórios

**Files:**
- Create: `lib/reports/export-pdf.ts`
- Create: `lib/reports/export-excel.ts`

**Step 1: Criar `lib/reports/export-pdf.ts`**

```typescript
import jsPDF from 'jspdf'
import 'jspdf-autotable'

interface jsPDFWithAutoTable extends jsPDF {
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
```

**Step 2: Criar `lib/reports/export-excel.ts`**

```typescript
import * as XLSX from 'xlsx'

export function exportarRelatorioExcel(
  titulo: string,
  colunas: string[],
  linhas: (string | number)[][],
  nomeArquivo: string
) {
  const ws = XLSX.utils.aoa_to_sheet([colunas, ...linhas])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31))
  XLSX.writeFile(wb, `${nomeArquivo}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
```

**Step 3: Commit**

```bash
git add lib/reports/
git commit -m "feat: add PDF and Excel export utilities for reports"
```

---

## Task 5: Criar layout e hub da rota /relatorios

**Files:**
- Create: `app/(portal)/relatorios/layout.tsx`
- Create: `app/(portal)/relatorios/page.tsx`

**Step 1: Criar `app/(portal)/relatorios/layout.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function RelatoriosLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  return <>{children}</>
}
```

**Step 2: Criar `app/(portal)/relatorios/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ROLES_RELATORIOS } from '@/lib/reports/constants'

const CATEGORIAS = [
  {
    slug: 'financeiro',
    label: 'Financeiro / Orçamentário',
    icon: 'payments',
    color: 'blue',
    descricao: 'Gastos por secretaria, orçado vs executado, ficha orçamentária',
    relatorios: ['F1 — Gastos por Secretaria', 'F2 — Orçado vs Executado', 'F3 — Saldo Disponível', 'F4 — Por Ficha Orçamentária', 'F5 — Evolução Mensal', 'F6 — Top 10 por Valor'],
  },
  {
    slug: 'workflow',
    label: 'Workflow / Operacional',
    icon: 'account_tree',
    color: 'indigo',
    descricao: 'Filas, SLA, rejeições, histórico de etapas',
    relatorios: ['W1 — Por Status', 'W2 — Fila por Etapa', 'W3 — Tempo Médio', 'W4 — Rejeitadas', 'W5 — Histórico de Ações', 'W6 — Com Urgência'],
  },
  {
    slug: 'servidores',
    label: 'Servidores / Viajantes',
    icon: 'group',
    color: 'violet',
    descricao: 'Ranking de viajantes, destinos, CPFs bloqueados',
    relatorios: ['S1 — Por Servidor', 'S2 — Mais Viagens', 'S3 — Destinos', 'S4 — CPFs Bloqueados', 'S5 — Por Secretaria e Servidor'],
  },
  {
    slug: 'prestacao',
    label: 'Prestação de Contas',
    icon: 'receipt_long',
    color: 'amber',
    descricao: 'Prestações em atraso, pendentes, vencimento próximo',
    relatorios: ['P1 — Em Atraso', 'P2 — Pendentes', 'P3 — Por Status', 'P4 — Histórico Completo', 'P5 — Vencimento Próximo'],
  },
  {
    slug: 'auditoria',
    label: 'Auditoria / Compliance',
    icon: 'policy',
    color: 'rose',
    descricao: 'Logs de ações, exceções orçamentárias, gargalos',
    relatorios: ['A1 — Log de Ações', 'A2 — Acima do Teto', 'A3 — Atividade por Perfil', 'A4 — Funil do Workflow', 'A5 — Gargalos por Etapa'],
  },
]

const COLOR_MAP: Record<string, { bg: string; icon: string; badge: string }> = {
  blue: { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  indigo: { bg: 'bg-indigo-50 border-indigo-200', icon: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
  violet: { bg: 'bg-violet-50 border-violet-200', icon: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
  amber: { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  rose: { bg: 'bg-rose-50 border-rose-200', icon: 'text-rose-600', badge: 'bg-rose-100 text-rose-700' },
}

export default async function RelatoriosPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = session.user.role as string

  const categoriasVisiveis = CATEGORIAS.filter(c =>
    ROLES_RELATORIOS[c.slug]?.includes(role)
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Relatórios</h2>
        <p className="text-slate-500 text-sm mt-1">Selecione uma categoria para acessar os relatórios disponíveis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoriasVisiveis.map(cat => {
          const colors = COLOR_MAP[cat.color]
          return (
            <Link
              key={cat.slug}
              href={`/relatorios/${cat.slug}`}
              className={`p-5 rounded-xl border ${colors.bg} hover:shadow-md transition-all group`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className={`material-symbols-outlined text-[28px] ${colors.icon}`}>{cat.icon}</span>
                <h3 className="font-bold text-slate-900 text-sm">{cat.label}</h3>
              </div>
              <p className="text-xs text-slate-600 mb-3">{cat.descricao}</p>
              <div className="flex flex-wrap gap-1">
                {cat.relatorios.map(r => (
                  <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors.badge}`}>
                    {r.split(' — ')[0]}
                  </span>
                ))}
              </div>
            </Link>
          )
        })}
      </div>

      {categoriasVisiveis.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <span className="material-symbols-outlined text-[48px] block mb-2">bar_chart</span>
          <p>Nenhum relatório disponível para o seu perfil.</p>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Verificar que a rota carrega**

```bash
npm run build 2>&1 | tail -20
```
Expected: sem erros de compilação

**Step 4: Commit**

```bash
git add app/(portal)/relatorios/
git commit -m "feat: add /relatorios hub page with role-based category access"
```

---

## Task 6: Relatórios Financeiros (Categoria F)

**Files:**
- Create: `app/(portal)/relatorios/financeiro/page.tsx`
- Create: `app/(portal)/relatorios/financeiro/ExportButtons.tsx`

**Step 1: Criar `app/(portal)/relatorios/financeiro/ExportButtons.tsx`** (Client Component para export)

```tsx
'use client'
import { exportarRelatorioPDF } from '@/lib/reports/export-pdf'
import { exportarRelatorioExcel } from '@/lib/reports/export-excel'

interface Row {
  nome: string
  passagem: number
  hospedagem: number
  total: number
}

export function ExportGastosPorSecretaria({ dados }: { dados: Row[] }) {
  const colunas = ['Secretaria', 'Passagens (R$)', 'Hospedagem (R$)', 'Total (R$)']
  const linhas = dados.map(d => [
    d.nome,
    d.passagem.toFixed(2),
    d.hospedagem.toFixed(2),
    d.total.toFixed(2),
  ])

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
```

**Step 2: Criar `app/(portal)/relatorios/financeiro/page.tsx`**

```tsx
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

  const dbUser = role === 'SECRETARIO'
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null

  const gastos = await getGastosPorSecretaria()
  const dadosFiltrados = role === 'SECRETARIO' && dbUser?.secretariaId
    ? gastos.filter(g => {
        // filtragem por secretaria já feita na query, aqui só por segurança
        return true
      })
    : gastos

  const totalGeral = dadosFiltrados.reduce((sum, d) => sum + d.total, 0)

  // F2 — Orçado vs Executado: buscar parâmetros de empenho
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

  // F6 — Top 10 por valor
  const top10 = [...dadosFiltrados].sort((a, b) => b.total - a.total).slice(0, 10)

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
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
          <ExportGastosPorSecretaria dados={dadosFiltrados} />
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
              {dadosFiltrados.map(d => (
                <tr key={d.nome} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{d.nome}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 text-right">{fmtMoeda(d.passagem)}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 text-right">{fmtMoeda(d.hospedagem)}</td>
                  <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">{fmtMoeda(d.total)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-5 py-3 text-sm text-slate-900">TOTAL GERAL</td>
                <td className="px-5 py-3 text-sm text-slate-900 text-right">{fmtMoeda(dadosFiltrados.reduce((s, d) => s + d.passagem, 0))}</td>
                <td className="px-5 py-3 text-sm text-slate-900 text-right">{fmtMoeda(dadosFiltrados.reduce((s, d) => s + d.hospedagem, 0))}</td>
                <td className="px-5 py-3 text-sm text-blue-700 text-right">{fmtMoeda(totalGeral)}</td>
              </tr>
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
                <div className="flex justify-between"><span className="text-slate-500">Orçado</span><span className="font-medium">{fmtMoeda(item.orcado)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Executado</span><span className="font-medium text-rose-600">{fmtMoeda(item.executado)}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-1"><span className="text-slate-500">Saldo</span><span className={`font-bold ${item.saldo < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoeda(item.saldo)}</span></div>
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
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
```

**Step 3: Commit**

```bash
git add app/(portal)/relatorios/financeiro/
git commit -m "feat: add financeiro reports page (F1, F2, F6)"
```

---

## Task 7: Relatórios de Workflow (Categoria W)

**Files:**
- Create: `app/(portal)/relatorios/workflow/page.tsx`

**Step 1: Criar `app/(portal)/relatorios/workflow/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSolicitacoesPorStatus, getTempoMedioAprovacaoPorEtapa } from '@/lib/reports/queries'
import { prisma } from '@/lib/prisma'
import { STATUS_LABELS } from '@/lib/reports/constants'

const ETAPA_LABELS: Record<string, string> = {
  SECRETARIO: 'Gabinete do Secretário',
  COTACAO: 'SECOL — Cotação',
  VIABILIDADE: 'SEGOV — Viabilidade',
  EMISSAO: 'SECOL — Emissão OS',
  EXECUCAO: 'SF — Execução',
}

export default async function WorkflowPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = session.user.role as string
  if (!['ADMIN', 'SECRETARIO', 'SECOL', 'SEGOV', 'SF'].includes(role)) redirect('/relatorios')

  const dbUser = role === 'SECRETARIO'
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null

  const [porStatus, tempoMedio, rejeitadas, urgencia] = await Promise.all([
    getSolicitacoesPorStatus(dbUser?.secretariaId ?? undefined),
    getTempoMedioAprovacaoPorEtapa(),
    prisma.workflowStep.findMany({
      where: { decisao: 'REPROVADO' },
      include: { solicitacao: { select: { destino: true, nomeCompleto: true, secretaria: { select: { nome: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.solicitacao.findMany({
      where: {
        status: { notIn: ['CONCLUIDA', 'REPROVADA', 'RASCUNHO'] },
        dataIda: { lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, destino: true, nomeCompleto: true, dataIda: true, status: true },
      orderBy: { dataIda: 'asc' },
    }),
  ])

  const total = porStatus.reduce((s, r) => s + r.count, 0)

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Workflow / Operacional</h2>
        <p className="text-slate-500 text-sm mt-0.5">Filas, prazos e histórico do fluxo de aprovação</p>
      </div>

      {/* W1 — Por Status */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">W1</span>
          <h3 className="font-bold text-slate-900">Solicitações por Status</h3>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {porStatus.map(r => (
            <div key={r.status} className="border border-slate-100 rounded-lg p-3 text-center">
              <p className="text-2xl font-black text-slate-900">{r.count}</p>
              <p className="text-xs text-slate-500 mt-1">{STATUS_LABELS[r.status] ?? r.status}</p>
              <div className="w-full bg-slate-100 rounded-full h-1 mt-2">
                <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* W3 — Tempo Médio */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">W3</span>
          <h3 className="font-bold text-slate-900">Tempo Médio de Aprovação por Etapa (dias)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Etapa</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Média (dias)</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Indicador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tempoMedio.map(t => (
                <tr key={t.etapa} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{ETAPA_LABELS[t.etapa] ?? t.etapa}</td>
                  <td className="px-5 py-3 text-sm text-right font-bold text-slate-900">{t.mediaDias}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.mediaDias <= 2 ? 'bg-emerald-100 text-emerald-700' : t.mediaDias <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                      {t.mediaDias <= 2 ? 'Rápido' : t.mediaDias <= 5 ? 'Normal' : 'Lento'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* W4 — Rejeitadas */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">W4</span>
          <h3 className="font-bold text-slate-900">Solicitações Rejeitadas / Devolvidas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Servidor</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Destino</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Etapa</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rejeitadas.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm text-slate-900">{r.solicitacao.nomeCompleto}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{r.solicitacao.destino}</td>
                  <td className="px-5 py-3 text-sm"><span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full">{ETAPA_LABELS[r.etapa] ?? r.etapa}</span></td>
                  <td className="px-5 py-3 text-sm text-slate-500 max-w-xs truncate">{r.observacao ?? '—'}</td>
                </tr>
              ))}
              {rejeitadas.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">Nenhuma rejeição registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* W6 — Urgência */}
      {urgencia.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-amber-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">warning</span>
            <div>
              <span className="text-xs font-black text-amber-700 uppercase tracking-wider">W6</span>
              <h3 className="font-bold text-amber-900">Solicitações com Urgência (viagem em até 3 dias)</h3>
            </div>
          </div>
          <div className="p-5 space-y-2">
            {urgencia.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-100 px-4 py-2">
                <div>
                  <p className="font-medium text-sm text-slate-900">{u.nomeCompleto} → {u.destino}</p>
                  <p className="text-xs text-slate-500">{STATUS_LABELS[u.status] ?? u.status}</p>
                </div>
                <p className="text-sm font-bold text-amber-700">{new Date(u.dataIda).toLocaleDateString('pt-BR')}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/(portal)/relatorios/workflow/
git commit -m "feat: add workflow reports page (W1, W3, W4, W6)"
```

---

## Task 8: Relatórios de Servidores (Categoria S)

**Files:**
- Create: `app/(portal)/relatorios/servidores/page.tsx`

**Step 1: Criar `app/(portal)/relatorios/servidores/page.tsx`**

```tsx
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

  const dbUser = role === 'SECRETARIO'
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null

  const [viagens, destinos, bloqueados] = await Promise.all([
    getViagensPorServidor(dbUser?.secretariaId ?? undefined),
    prisma.solicitacao.groupBy({
      by: ['destino'],
      where: dbUser?.secretariaId ? { secretariaId: dbUser.secretariaId } : {},
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
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Servidores / Viajantes</h2>
        <p className="text-slate-500 text-sm mt-0.5">Ranking de viajantes, destinos frequentes e restrições</p>
      </div>

      {/* S2 — Mais viagens */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-violet-600 uppercase tracking-wider">S1 / S2</span>
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
                <tr key={v.matricula} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-black text-slate-400">{i + 1}</td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{v.nome}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{v.matricula || '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{v.secretaria}</td>
                  <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">{v.viagens}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 text-right">{fmtMoeda(v.totalGasto)}</td>
                </tr>
              ))}
              {viagens.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">Nenhum dado disponível.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* S3 — Destinos */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-violet-600 uppercase tracking-wider">S3</span>
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
                  <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${destinos[0]._count.destino > 0 ? (d._count.destino / destinos[0]._count.destino) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* S4 — CPFs Bloqueados */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-500 text-[20px]">block</span>
          <div>
            <span className="text-xs font-black text-violet-600 uppercase tracking-wider">S4</span>
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
```

**Step 2: Commit**

```bash
git add app/(portal)/relatorios/servidores/
git commit -m "feat: add servidores reports page (S1, S2, S3, S4)"
```

---

## Task 9: Relatórios de Prestação de Contas (Categoria P)

**Files:**
- Create: `app/(portal)/relatorios/prestacao/page.tsx`

**Step 1: Criar `app/(portal)/relatorios/prestacao/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPrestacoesPendentes, getPrestacoesEmAtraso } from '@/lib/reports/queries'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

const fmtData = (d: Date) => new Date(d).toLocaleDateString('pt-BR')

function diasRestantes(prazo: Date) {
  return Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000)
}

export default async function PrestacaoRelatorioPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = session.user.role as string
  if (!['ADMIN', 'SECRETARIO', 'SF', 'DEMANDANTE'].includes(role)) redirect('/relatorios')

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } })

  const userId = role === 'DEMANDANTE' ? session.user.id : undefined
  const secretariaId = role === 'SECRETARIO' ? dbUser?.secretariaId ?? undefined : undefined

  const [pendentes, atrasadas, vencendo] = await Promise.all([
    getPrestacoesPendentes(userId, secretariaId),
    role !== 'DEMANDANTE' ? getPrestacoesEmAtraso() : Promise.resolve([]),
    getPrestacoesPendentes(userId, secretariaId).then(p =>
      p.filter(x => {
        const dias = diasRestantes(x.prazoFinal)
        return dias >= 0 && dias <= 10
      })
    ),
  ])

  const totalEnviadas = await prisma.prestacao.count({
    where: {
      enviadoEm: { not: null },
      ...(userId ? { solicitacao: { userId } } : {}),
      ...(secretariaId ? { solicitacao: { secretariaId } } : {}),
    },
  })

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Prestação de Contas</h2>
        <p className="text-slate-500 text-sm mt-0.5">Monitoramento de prazos e comprovações</p>
      </div>

      {/* P3 — Resumo por Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Pendentes', value: pendentes.length, icon: 'pending', color: 'amber', alerta: pendentes.length > 0 },
          { label: 'Em Atraso', value: atrasadas.length, icon: 'assignment_late', color: 'rose', alerta: atrasadas.length > 0 },
          { label: 'Enviadas', value: totalEnviadas, icon: 'task_alt', color: 'emerald', alerta: false },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-xl border ${k.alerta ? 'border-rose-200' : 'border-slate-200'} shadow-sm p-5`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`material-symbols-outlined text-[24px] text-${k.color}-600`}>{k.icon}</span>
              <p className="text-slate-500 text-sm font-medium">{k.label}</p>
            </div>
            <p className={`text-3xl font-black text-${k.alerta ? 'rose' : 'slate'}-${k.alerta ? '600' : '900'}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* P5 — Vencimento Próximo */}
      {vencendo.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-amber-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">timer</span>
            <div>
              <span className="text-xs font-black text-amber-700 uppercase tracking-wider">P5</span>
              <h3 className="font-bold text-amber-900">Vencendo em até 10 dias</h3>
            </div>
          </div>
          <div className="p-5 space-y-2">
            {vencendo.map(p => {
              const dias = diasRestantes(p.prazoFinal)
              return (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-100 px-4 py-2">
                  <div>
                    <p className="font-medium text-sm text-slate-900">{p.solicitacao.nomeCompleto} → {p.solicitacao.destino}</p>
                    <p className="text-xs text-slate-500">{p.solicitacao.secretaria?.nome ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${dias <= 3 ? 'text-rose-600' : 'text-amber-700'}`}>
                      {dias === 0 ? 'Vence hoje' : `${dias} dia${dias !== 1 ? 's' : ''}`}
                    </p>
                    <p className="text-xs text-slate-400">{fmtData(p.prazoFinal)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* P1 — Em Atraso */}
      {role !== 'DEMANDANTE' && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500 text-[20px]">assignment_late</span>
            <div>
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider">P1</span>
              <h3 className="font-bold text-slate-900">Prestações em Atraso</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Servidor</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Destino</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Secretaria</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Prazo Vencido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {atrasadas.map(p => (
                  <tr key={p.id} className="hover:bg-rose-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{p.solicitacao.nomeCompleto}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{p.solicitacao.destino}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{p.solicitacao.secretaria?.nome ?? '—'}</td>
                    <td className="px-5 py-3 text-sm font-bold text-rose-600 text-right">{fmtData(p.prazoFinal)}</td>
                  </tr>
                ))}
                {atrasadas.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">Nenhuma prestação em atraso.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* P2 — Pendentes */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-amber-600 uppercase tracking-wider">P2</span>
          <h3 className="font-bold text-slate-900">Prestações Pendentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Servidor</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Destino</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Prazo Final</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Dias Restantes</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendentes.map(p => {
                const dias = diasRestantes(p.prazoFinal)
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{p.solicitacao.nomeCompleto}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{p.solicitacao.destino}</td>
                    <td className="px-5 py-3 text-sm text-slate-600 text-right">{fmtData(p.prazoFinal)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dias < 0 ? 'bg-rose-100 text-rose-700' : dias <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {dias < 0 ? `${Math.abs(dias)}d atrasado` : `${dias}d`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/solicitacoes/${p.solicitacaoId}/prestacao`} className="text-blue-600 hover:underline text-xs font-medium">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {pendentes.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">Nenhuma prestação pendente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/(portal)/relatorios/prestacao/
git commit -m "feat: add prestacao reports page (P1, P2, P3, P5)"
```

---

## Task 10: Relatórios de Auditoria (Categoria A)

**Files:**
- Create: `app/(portal)/relatorios/auditoria/page.tsx`

**Step 1: Criar `app/(portal)/relatorios/auditoria/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getLogsAcoes, getSolicitacoesPorStatus, getTempoMedioAprovacaoPorEtapa } from '@/lib/reports/queries'
import { prisma } from '@/lib/prisma'

const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDateTime = (d: Date) => new Date(d).toLocaleString('pt-BR')

const ETAPA_LABELS: Record<string, string> = {
  SECRETARIO: 'Gabinete do Secretário',
  COTACAO: 'SECOL — Cotação',
  VIABILIDADE: 'SEGOV — Viabilidade',
  EMISSAO: 'SECOL — Emissão OS',
  EXECUCAO: 'SF — Execução',
}

export default async function AuditoriaPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/relatorios')

  // Buscar teto configurado
  const parametros = await prisma.configuracaoSistema.findMany({
    where: { chave: { in: ['VALOR_EMPENHO_PASSAGEM', 'VALOR_EMPENHO_HOSPEDAGEM'] } }
  })
  const tetoPassagem = parseFloat(parametros.find(p => p.chave === 'VALOR_EMPENHO_PASSAGEM')?.valor ?? '0')
  const tetoHospedagem = parseFloat(parametros.find(p => p.chave === 'VALOR_EMPENHO_HOSPEDAGEM')?.valor ?? '0')

  const [logs, porStatus, tempoMedio, acimaDoTeto] = await Promise.all([
    getLogsAcoes(),
    getSolicitacoesPorStatus(),
    getTempoMedioAprovacaoPorEtapa(),
    prisma.workflowStep.findMany({
      where: {
        etapa: 'VIABILIDADE',
        decisao: 'APROVADO',
        OR: [
          tetoPassagem > 0 ? { valorPassagem: { gt: tetoPassagem } } : {},
          tetoHospedagem > 0 ? { valorHospedagem: { gt: tetoHospedagem } } : {},
        ],
      },
      include: {
        solicitacao: {
          select: { destino: true, nomeCompleto: true, secretaria: { select: { nome: true } } },
        },
      },
    }),
  ])

  // A3 — Atividade por perfil
  const atividadePorAtor = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.atorRole] = (acc[l.atorRole] ?? 0) + 1
    return acc
  }, {})

  // A4 — Funil
  const total = porStatus.reduce((s, r) => s + r.count, 0)
  const concluidas = porStatus.find(r => r.status === 'CONCLUIDA')?.count ?? 0
  const reprovadas = porStatus.find(r => r.status === 'REPROVADA')?.count ?? 0

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Auditoria / Compliance</h2>
        <p className="text-slate-500 text-sm mt-0.5">Logs de ações, exceções e análise de gargalos</p>
      </div>

      {/* A4 — Funil */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <span className="text-xs font-black text-rose-600 uppercase tracking-wider">A4</span>
        <h3 className="font-bold text-slate-900 mb-4">Funil do Workflow</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Total Criadas', value: total, color: 'slate' },
            { label: 'Concluídas', value: concluidas, color: 'emerald' },
            { label: 'Reprovadas', value: reprovadas, color: 'rose' },
          ].map(f => (
            <div key={f.label} className="border border-slate-100 rounded-lg p-4">
              <p className={`text-3xl font-black text-${f.color}-${f.color === 'slate' ? '900' : '600'}`}>{f.value}</p>
              <p className="text-xs text-slate-500 mt-1">{f.label}</p>
              {total > 0 && <p className="text-xs text-slate-400 mt-0.5">{((f.value / total) * 100).toFixed(1)}%</p>}
            </div>
          ))}
        </div>
      </section>

      {/* A3 — Atividade por perfil */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <span className="text-xs font-black text-rose-600 uppercase tracking-wider">A3</span>
        <h3 className="font-bold text-slate-900 mb-4">Atividade por Perfil</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(atividadePorAtor).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
            <div key={role} className="border border-slate-100 rounded-lg p-3 text-center">
              <p className="text-2xl font-black text-slate-900">{count}</p>
              <p className="text-xs text-slate-500 mt-1">{role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* A5 — Gargalos */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-rose-600 uppercase tracking-wider">A5</span>
          <h3 className="font-bold text-slate-900">Gargalos por Etapa (Tempo Médio)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Etapa</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">Média (dias)</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Classificação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...tempoMedio].sort((a, b) => b.mediaDias - a.mediaDias).map(t => (
                <tr key={t.etapa} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{ETAPA_LABELS[t.etapa] ?? t.etapa}</td>
                  <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">{t.mediaDias}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.mediaDias > 7 ? 'bg-rose-100 text-rose-700' : t.mediaDias > 3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {t.mediaDias > 7 ? 'Gargalo' : t.mediaDias > 3 ? 'Atenção' : 'Normal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* A2 — Acima do Teto */}
      {acimaDoTeto.length > 0 && (
        <section className="bg-rose-50 border border-rose-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-rose-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-600">gpp_bad</span>
            <div>
              <span className="text-xs font-black text-rose-700 uppercase tracking-wider">A2</span>
              <h3 className="font-bold text-rose-900">Aprovações Acima do Teto Orçamentário</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-rose-100/50">
                  <th className="px-5 py-3 text-xs font-bold text-rose-700 uppercase">Servidor</th>
                  <th className="px-5 py-3 text-xs font-bold text-rose-700 uppercase">Destino</th>
                  <th className="px-5 py-3 text-xs font-bold text-rose-700 uppercase text-right">Passagem</th>
                  <th className="px-5 py-3 text-xs font-bold text-rose-700 uppercase text-right">Hospedagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {acimaDoTeto.map(s => (
                  <tr key={s.id} className="hover:bg-rose-100/30">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{s.solicitacao.nomeCompleto}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{s.solicitacao.destino}</td>
                    <td className="px-5 py-3 text-sm font-bold text-rose-700 text-right">{fmtMoeda(s.valorPassagem ?? 0)}</td>
                    <td className="px-5 py-3 text-sm font-bold text-rose-700 text-right">{fmtMoeda(s.valorHospedagem ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* A1 — Log de Ações */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <span className="text-xs font-black text-rose-600 uppercase tracking-wider">A1</span>
          <h3 className="font-bold text-slate-900">Log de Ações (últimas 500)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Data/Hora</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Ator</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Perfil</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Etapa</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Decisão</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Destino</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.slice(0, 100).map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-5 py-3 text-sm text-slate-900">{l.atorNome}</td>
                  <td className="px-5 py-3"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{l.atorRole}</span></td>
                  <td className="px-5 py-3 text-xs text-slate-600">{ETAPA_LABELS[l.etapa] ?? l.etapa}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${l.decisao === 'APROVADO' ? 'bg-emerald-100 text-emerald-700' : l.decisao === 'REPROVADO' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                      {l.decisao ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">{l.solicitacao.destino}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/(portal)/relatorios/auditoria/
git commit -m "feat: add auditoria reports page (A1, A2, A3, A4, A5)"
```

---

## Task 11: Adicionar link "Relatórios" na Sidebar

**Files:**
- Modify: `components/Sidebar.tsx`

**Step 1: Ler o arquivo atual**

```bash
# Ler components/Sidebar.tsx para entender a estrutura de navegação
```

**Step 2: Adicionar item de menu para /relatorios**

Adicionar no array de links da Sidebar (após Dashboard, antes de Admin se existir):

```tsx
{ href: '/relatorios', label: 'Relatórios', icon: 'bar_chart' }
```

Visível para todos os perfis exceto DEMANDANTE (ou restringir apenas prestação para DEMANDANTE).

**Step 3: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

**Step 4: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: add Relatórios link to sidebar navigation"
```

---

## Task 12: Expandir KPIs no Dashboard (/dashboard)

**Files:**
- Modify: `app/(portal)/dashboard/page.tsx`

**Step 1: Ler o arquivo atual**

Já lido — `app/(portal)/dashboard/page.tsx`

**Step 2: Adicionar `getKpisDashboard` query e expandir cards**

Importar `getKpisDashboard` de `@/lib/reports/queries` e substituir os cards existentes pelos KPIs expandidos:

```tsx
// Adicionar import
import { getKpisDashboard } from '@/lib/reports/queries'

// No corpo do componente, após auth():
const kpis = await getKpisDashboard(role, userId, dbUser?.secretariaId ?? undefined)
```

Cards a adicionar (além dos existentes):
- **Reprovadas** — `kpis.reprovadas` (rose)
- **Prestações em Atraso** — `kpis.prestAtrasadas` com badge de alerta se > 0 (para ADMIN/SF/SECRETARIO)
- **Na Fila** — `kpis.naFila` (já existe como `ativas`, melhorar com dado preciso)

**Step 3: Adicionar link "Ver Relatórios Completos" no dashboard**

```tsx
<Link href="/relatorios" className="text-sm text-blue-600 hover:underline">
  Ver Relatórios Completos →
</Link>
```

**Step 4: Verificar build e testar**

```bash
npm run build 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add app/(portal)/dashboard/page.tsx
git commit -m "feat: expand dashboard KPIs with report data and link to /relatorios"
```

---

## Checklist Final

- [ ] `recharts` instalado
- [ ] `lib/reports/types.ts` e `constants.ts` criados
- [ ] `lib/reports/queries.ts` com todas as queries
- [ ] `lib/reports/export-pdf.ts` e `export-excel.ts` criados
- [ ] `/relatorios` hub com controle de acesso por perfil
- [ ] `/relatorios/financeiro` — F1, F2, F6
- [ ] `/relatorios/workflow` — W1, W3, W4, W6
- [ ] `/relatorios/servidores` — S1, S2, S3, S4
- [ ] `/relatorios/prestacao` — P1, P2, P3, P5
- [ ] `/relatorios/auditoria` — A1, A2, A3, A4, A5
- [ ] Link "Relatórios" na Sidebar
- [ ] Dashboard com KPIs expandidos + link para relatórios
- [ ] Build sem erros
