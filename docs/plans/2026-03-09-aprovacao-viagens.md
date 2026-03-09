# Sistema de Aprovação de Despesas com Viagem — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Construir um sistema web completo de aprovação de despesas com viagem para prefeitura de Osasco, com workflow de 4 etapas entre secretarias (SECOL, SEGOV, SF) e prestação de contas pós-viagem.

**Architecture:** Next.js 14 App Router com autenticação por role (NextAuth.js + bcrypt), banco SQLite via Prisma ORM, e upload de arquivos local. Tramitação 100% digital conforme Art. 3º.

**Tech Stack:** Next.js 14, NextAuth.js, Prisma + SQLite, Tailwind CSS, TypeScript, next-safe-action

---

## Task 1: Setup do projeto Next.js + Prisma + NextAuth

**Task ID:** #1
**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Create: `prisma/schema.prisma`
- Create: `lib/auth.ts`, `lib/prisma.ts`

**Step 1: Inicializar projeto**

```bash
cd E:/projetos/Viagens
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

**Step 2: Instalar dependências**

```bash
npm install @prisma/client prisma next-auth@beta bcryptjs
npm install -D @types/bcryptjs
npx prisma init --datasource-provider sqlite
```

**Step 3: Configurar lib/prisma.ts**

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Step 4: Configurar variáveis de ambiente**

```env
# .env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="viagens-osasco-secret-2026"
NEXTAUTH_URL="http://localhost:3000"
```

**Step 5: Commit**

```bash
git init
git add .
git commit -m "feat: setup inicial Next.js + Prisma + NextAuth"
```

---

## Task 2: Schema Prisma e seed de usuários

**Task ID:** #2
**Files:**
- Create/Modify: `prisma/schema.prisma`
- Create: `prisma/seed.ts`

**Step 1: Escrever schema.prisma**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(cuid())
  name         String
  email        String        @unique
  password     String
  role         String        // DEMANDANTE | SECOL | SEGOV | SF
  cpfBloqueado Boolean       @default(false)
  createdAt    DateTime      @default(now())
  solicitacoes Solicitacao[]
}

model Solicitacao {
  id                   String         @id @default(cuid())
  // Dados do servidor
  nomeCompleto         String
  matricula            String
  cpf                  String
  dataNascimento       DateTime
  celular              String
  emailServidor        String
  // Missão
  justificativaPublica String
  nexoCargo            String
  // Logística
  destino              String
  dataIda              DateTime
  dataVolta            DateTime
  justificativaLocal   String
  fichaOrcamentaria    String
  // Controle
  status               String         @default("RASCUNHO")
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt
  userId               String
  user                 User           @relation(fields: [userId], references: [id])
  anexos               Anexo[]
  steps                WorkflowStep[]
  prestacao            Prestacao?
}

model WorkflowStep {
  id            String      @id @default(cuid())
  solicitacaoId String
  etapa         String      // COTACAO | VIABILIDADE | EMISSAO | EXECUCAO
  atorRole      String
  atorNome      String
  decisao       String?     // APROVADO | REPROVADO | AJUSTE
  observacao    String?
  createdAt     DateTime    @default(now())
  solicitacao   Solicitacao @relation(fields: [solicitacaoId], references: [id])
}

model Prestacao {
  id            String      @id @default(cuid())
  solicitacaoId String      @unique
  relatorio     String?
  prazoFinal    DateTime
  enviadoEm    DateTime?
  bloqueado     Boolean     @default(false)
  solicitacao   Solicitacao @relation(fields: [solicitacaoId], references: [id])
  anexos        Anexo[]
}

model Anexo {
  id            String      @id @default(cuid())
  nome          String
  path          String
  tipo          String      // CONVITE | VOUCHER | EVIDENCIA | COTACAO | ORDEM_SERVICO
  createdAt     DateTime    @default(now())
  solicitacaoId String?
  solicitacao   Solicitacao? @relation(fields: [solicitacaoId], references: [id])
  prestacaoId   String?
  prestacao     Prestacao?  @relation(fields: [prestacaoId], references: [id])
}
```

**Step 2: Criar seed de usuários**

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const usuarios = [
    { name: 'Maria Silva', email: 'demandante@osasco.sp.gov.br', role: 'DEMANDANTE' },
    { name: 'João Santos', email: 'secol@osasco.sp.gov.br', role: 'SECOL' },
    { name: 'Ana Gabinete', email: 'segov@osasco.sp.gov.br', role: 'SEGOV' },
    { name: 'Carlos Finanças', email: 'sf@osasco.sp.gov.br', role: 'SF' },
  ]

  for (const u of usuarios) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: await bcrypt.hash('senha123', 10) },
    })
  }
  console.log('Seed concluído. Senha padrão: senha123')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

**Step 3: Adicionar seed ao package.json e rodar migrations**

```json
// Adicionar em package.json:
"prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }
```

```bash
npm install -D ts-node
npx prisma migrate dev --name init
npx prisma db seed
```

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: schema Prisma completo e seed de usuários"
```

---

## Task 3: Layout base, autenticação e dashboard por role

**Task ID:** #3
**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/layout.tsx`
- Create: `app/dashboard/page.tsx`
- Create: `middleware.ts`
- Create: `components/SessionProvider.tsx`

**Step 1: Configurar NextAuth em lib/auth.ts**

```typescript
// lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null
        return { id: user.id, name: user.name, email: user.email, role: user.role }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as any).role
      return token
    },
    session({ session, token }) {
      if (session.user) (session.user as any).role = token.role
      return session
    }
  },
  pages: { signIn: '/login' }
})
```

**Step 2: Criar route handler**

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

**Step 3: Criar middleware de proteção**

```typescript
// middleware.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
})

export const config = { matcher: ['/((?!api/auth|_next|favicon).*)'] }
```

**Step 4: Criar layout raiz com Tailwind**

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aprovação de Viagens — Osasco',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
```

**Step 5: Criar tela de login**

```typescript
// app/(auth)/login/page.tsx
'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) setError('E-mail ou senha inválidos')
    else router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-800">Prefeitura de Osasco</h1>
          <p className="text-gray-500 text-sm mt-1">Sistema de Aprovação de Viagens</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="E-mail institucional" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input type="password" placeholder="Senha" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit"
            className="w-full bg-blue-700 text-white py-2 rounded-lg hover:bg-blue-800 transition font-semibold">
            Entrar
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-4">Acesso restrito a servidores autorizados</p>
      </div>
    </div>
  )
}
```

**Step 6: Criar dashboard por role**

```typescript
// app/dashboard/page.tsx
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_COTACAO: 'Aguardando Cotação',
  AGUARDANDO_VIABILIDADE: 'Análise de Viabilidade',
  AGUARDANDO_EMISSAO: 'Aguardando Emissão de OS',
  AGUARDANDO_EXECUCAO: 'Execução Orçamentária',
  CONCLUIDA: 'Concluída',
  REPROVADA: 'Reprovada',
}

const STATUS_CORES: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-700',
  AGUARDANDO_COTACAO: 'bg-yellow-100 text-yellow-700',
  AGUARDANDO_VIABILIDADE: 'bg-orange-100 text-orange-700',
  AGUARDANDO_EMISSAO: 'bg-blue-100 text-blue-700',
  AGUARDANDO_EXECUCAO: 'bg-purple-100 text-purple-700',
  CONCLUIDA: 'bg-green-100 text-green-700',
  REPROVADA: 'bg-red-100 text-red-700',
}

const ROLE_STATUS_MAP: Record<string, string[]> = {
  DEMANDANTE: ['RASCUNHO', 'AGUARDANDO_COTACAO', 'AGUARDANDO_VIABILIDADE', 'AGUARDANDO_EMISSAO', 'AGUARDANDO_EXECUCAO', 'CONCLUIDA', 'REPROVADA'],
  SECOL: ['AGUARDANDO_COTACAO', 'AGUARDANDO_EMISSAO'],
  SEGOV: ['AGUARDANDO_VIABILIDADE'],
  SF: ['AGUARDANDO_EXECUCAO'],
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const role = (session.user as any).role as string
  const userId = (session.user as any).id as string

  const where = role === 'DEMANDANTE'
    ? { userId, status: { in: ROLE_STATUS_MAP[role] } }
    : { status: { in: ROLE_STATUS_MAP[role] } }

  const solicitacoes = await prisma.solicitacao.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 50,
    include: { user: { select: { name: true } } }
  })

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Painel — {role}</h1>
          <p className="text-gray-500 text-sm">{session.user?.name}</p>
        </div>
        {role === 'DEMANDANTE' && (
          <Link href="/solicitacoes/nova"
            className="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition text-sm font-semibold">
            + Nova Solicitação
          </Link>
        )}
      </div>
      <div className="space-y-3">
        {solicitacoes.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
            Nenhuma solicitação na sua fila
          </div>
        )}
        {solicitacoes.map(s => (
          <Link key={s.id} href={`/solicitacoes/${s.id}`}>
            <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-800">{s.nomeCompleto}</p>
                <p className="text-sm text-gray-500">{s.destino} · {new Date(s.dataIda).toLocaleDateString('pt-BR')} a {new Date(s.dataVolta).toLocaleDateString('pt-BR')}</p>
                {role !== 'DEMANDANTE' && <p className="text-xs text-gray-400 mt-1">Solicitado por: {s.user.name}</p>}
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_CORES[s.status] ?? 'bg-gray-100'}`}>
                {STATUS_LABELS[s.status] ?? s.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 7: Commit**

```bash
git add .
git commit -m "feat: autenticação NextAuth, layout, dashboard por role"
```

---

## Task 4: Formulário Nova Solicitação (4 passos)

**Task ID:** #4
**Files:**
- Create: `app/solicitacoes/nova/page.tsx`
- Create: `lib/utils/diasUteis.ts`
- Create: `app/api/solicitacoes/route.ts`

**Step 1: Criar utilitário de dias úteis**

```typescript
// lib/utils/diasUteis.ts
export function calcularDiasUteisAte(dataAlvo: Date): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  let count = 0
  const cursor = new Date(hoje)
  while (cursor < dataAlvo) {
    cursor.setDate(cursor.getDate() + 1)
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

export function addDiasUteis(data: Date, dias: number): Date {
  const resultado = new Date(data)
  let count = 0
  while (count < dias) {
    resultado.setDate(resultado.getDate() + 1)
    const dow = resultado.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return resultado
}
```

**Step 2: Criar API de criação de solicitação**

```typescript
// app/api/solicitacoes/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calcularDiasUteisAte } from '@/lib/utils/diasUteis'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'DEMANDANTE') return NextResponse.json({ error: 'Apenas DEMANDANTE pode criar solicitações' }, { status: 403 })

  // Verificar bloqueio do CPF
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (user?.cpfBloqueado) return NextResponse.json({ error: 'CPF bloqueado por prestação de contas pendente' }, { status: 403 })

  const body = await req.json()

  // Validar antecedência de 15 dias úteis
  const dataIda = new Date(body.dataIda)
  const diasUteis = calcularDiasUteisAte(dataIda)
  if (diasUteis < 15) {
    return NextResponse.json({
      error: `Antecedência insuficiente: ${diasUteis} dias úteis. Mínimo: 15 dias úteis (Art. 1º).`
    }, { status: 422 })
  }

  const solicitacao = await prisma.solicitacao.create({
    data: {
      ...body,
      dataIda,
      dataVolta: new Date(body.dataVolta),
      dataNascimento: new Date(body.dataNascimento),
      status: 'AGUARDANDO_COTACAO',
      userId: (session.user as any).id,
    }
  })

  return NextResponse.json(solicitacao, { status: 201 })
}
```

**Step 3: Criar formulário multi-step**

```typescript
// app/solicitacoes/nova/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PASSOS = ['Dados do Servidor', 'A Missão', 'Logística', 'Documentos']

type FormData = {
  nomeCompleto: string; matricula: string; cpf: string
  dataNascimento: string; celular: string; emailServidor: string
  justificativaPublica: string; nexoCargo: string
  destino: string; dataIda: string; dataVolta: string
  justificativaLocal: string; fichaOrcamentaria: string
}

export default function NovaSolicitacaoPage() {
  const router = useRouter()
  const [passo, setPasso] = useState(0)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [arquivos, setArquivos] = useState<File[]>([])
  const [form, setForm] = useState<FormData>({
    nomeCompleto: '', matricula: '', cpf: '', dataNascimento: '',
    celular: '', emailServidor: '', justificativaPublica: '', nexoCargo: '',
    destino: '', dataIda: '', dataVolta: '', justificativaLocal: '', fichaOrcamentaria: ''
  })

  const update = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit() {
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error); setEnviando(false); return }

      // Upload de arquivos
      if (arquivos.length > 0) {
        const fd = new FormData()
        arquivos.forEach(f => fd.append('files', f))
        fd.append('solicitacaoId', data.id)
        fd.append('tipo', 'CONVITE')
        await fetch('/api/upload', { method: 'POST', body: fd })
      }
      router.push('/dashboard')
    } catch {
      setErro('Erro ao enviar solicitação')
      setEnviando(false)
    }
  }

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">Nova Solicitação de Viagem</h1>

      {/* Indicador de passos */}
      <div className="flex mb-8">
        {PASSOS.map((p, i) => (
          <div key={i} className="flex-1 flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
              ${i <= passo ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i + 1}
            </div>
            <span className={`text-xs ml-1 hidden sm:block ${i <= passo ? 'text-blue-700' : 'text-gray-400'}`}>{p}</span>
            {i < PASSOS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < passo ? 'bg-blue-700' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        {/* Passo 0: Dados do Servidor */}
        {passo === 0 && (<>
          <div><label className={labelCls}>Nome Completo *</label>
            <input className={inputCls} value={form.nomeCompleto} onChange={update('nomeCompleto')} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Matrícula *</label>
              <input className={inputCls} value={form.matricula} onChange={update('matricula')} required /></div>
            <div><label className={labelCls}>CPF *</label>
              <input className={inputCls} value={form.cpf} onChange={update('cpf')} placeholder="000.000.000-00" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Data de Nascimento *</label>
              <input type="date" className={inputCls} value={form.dataNascimento} onChange={update('dataNascimento')} required /></div>
            <div><label className={labelCls}>Celular *</label>
              <input className={inputCls} value={form.celular} onChange={update('celular')} placeholder="(11) 99999-9999" required /></div>
          </div>
          <div><label className={labelCls}>E-mail do Servidor *</label>
            <input type="email" className={inputCls} value={form.emailServidor} onChange={update('emailServidor')} required /></div>
        </>)}

        {/* Passo 1: A Missão */}
        {passo === 1 && (<>
          <div><label className={labelCls}>Justificativa do Interesse Público *</label>
            <textarea className={inputCls} rows={4} value={form.justificativaPublica} onChange={update('justificativaPublica')}
              placeholder="Descreva o benefício para a administração pública..." required /></div>
          <div><label className={labelCls}>Nexo com o Cargo *</label>
            <textarea className={inputCls} rows={3} value={form.nexoCargo} onChange={update('nexoCargo')}
              placeholder="Como esta missão se relaciona com as atribuições do cargo..." required /></div>
        </>)}

        {/* Passo 2: Logística */}
        {passo === 2 && (<>
          <div><label className={labelCls}>Destino *</label>
            <input className={inputCls} value={form.destino} onChange={update('destino')} placeholder="Cidade / Estado" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Data de Ida *</label>
              <input type="date" className={inputCls} value={form.dataIda} onChange={update('dataIda')} required /></div>
            <div><label className={labelCls}>Data de Volta *</label>
              <input type="date" className={inputCls} value={form.dataVolta} onChange={update('dataVolta')} required /></div>
          </div>
          <div><label className={labelCls}>Justificativa de Localização (Economicidade) *</label>
            <textarea className={inputCls} rows={3} value={form.justificativaLocal} onChange={update('justificativaLocal')}
              placeholder="Justifique a escolha de localização considerando o menor custo..." required /></div>
          <div><label className={labelCls}>Ficha Orçamentária de Contrapartida *</label>
            <input className={inputCls} value={form.fichaOrcamentaria} onChange={update('fichaOrcamentaria')}
              placeholder="Ex: 01.001.04.122.0001.2001.339030" required /></div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-amber-800 text-xs font-medium">⚠️ Vedação Legal (Art. 4º, § 2º)</p>
            <p className="text-amber-700 text-xs mt-1">O pagamento por adiantamento é vedado neste fluxo. Toda despesa será processada pela Secretaria de Finanças após emissão da Ordem de Serviço.</p>
          </div>
        </>)}

        {/* Passo 3: Documentos */}
        {passo === 3 && (<>
          <div>
            <label className={labelCls}>Anexar Convite / Folder / Pauta do Evento *</label>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={e => setArquivos(Array.from(e.target.files ?? []))}
              className="w-full border rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700" />
            {arquivos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {arquivos.map((f, i) => <li key={i} className="text-xs text-gray-500">📎 {f.name}</li>)}
              </ul>
            )}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-blue-800 text-xs font-medium">ℹ️ Tramitação Digital (Art. 3º)</p>
            <p className="text-blue-700 text-xs mt-1">Toda a tramitação é 100% digital. Não é necessário o envio de documentos físicos entre as secretarias.</p>
          </div>
        </>)}

        {erro && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{erro}</div>}

        <div className="flex justify-between pt-2">
          {passo > 0 ? (
            <button onClick={() => setPasso(p => p - 1)} className="text-gray-500 hover:text-gray-700 text-sm">← Voltar</button>
          ) : <div />}
          {passo < PASSOS.length - 1 ? (
            <button onClick={() => setPasso(p => p + 1)}
              className="bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition text-sm font-semibold">
              Próximo →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={enviando}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition text-sm font-semibold disabled:opacity-50">
              {enviando ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: formulário nova solicitação 4 passos com validação de prazo"
```

---

## Task 5: Tela de detalhe da solicitação + timeline do workflow

**Task ID:** #5
**Files:**
- Create: `app/solicitacoes/[id]/page.tsx`
- Create: `components/WorkflowTimeline.tsx`

**Step 1: Criar componente de timeline**

```typescript
// components/WorkflowTimeline.tsx
const ETAPAS = [
  { key: 'COTACAO', label: 'Cotação Técnica', ator: 'SECOL/DRP' },
  { key: 'VIABILIDADE', label: 'Análise de Viabilidade', ator: 'SEGOV' },
  { key: 'EMISSAO', label: 'Formalização e Emissão OS', ator: 'SECOL' },
  { key: 'EXECUCAO', label: 'Execução Orçamentária', ator: 'SF' },
]

const STATUS_ETAPA_MAP: Record<string, string> = {
  AGUARDANDO_COTACAO: 'COTACAO',
  AGUARDANDO_VIABILIDADE: 'VIABILIDADE',
  AGUARDANDO_EMISSAO: 'EMISSAO',
  AGUARDANDO_EXECUCAO: 'EXECUCAO',
  CONCLUIDA: 'DONE',
  REPROVADA: 'REPROVADA',
}

export function WorkflowTimeline({ status, steps }: { status: string, steps: any[] }) {
  const etapaAtual = STATUS_ETAPA_MAP[status]

  return (
    <div className="space-y-3">
      {ETAPAS.map((etapa, i) => {
        const step = steps.find(s => s.etapa === etapa.key)
        const isAtual = etapaAtual === etapa.key
        const isDone = step?.decisao === 'APROVADO'
        const isReprovado = step?.decisao === 'REPROVADO'
        const isPending = !step && !isAtual

        return (
          <div key={etapa.key} className={`flex gap-4 p-4 rounded-xl border
            ${isAtual ? 'border-blue-300 bg-blue-50' : isDone ? 'border-green-200 bg-green-50' : isReprovado ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
              ${isDone ? 'bg-green-500 text-white' : isReprovado ? 'bg-red-500 text-white' : isAtual ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
              {isDone ? '✓' : isReprovado ? '✗' : i + 1}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{etapa.label}</p>
                  <p className="text-xs text-gray-500">Ator: {etapa.ator}</p>
                </div>
                {isAtual && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Em análise</span>}
                {isPending && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pendente</span>}
              </div>
              {step?.observacao && (
                <p className="text-xs text-gray-600 mt-2 bg-white rounded p-2 border">{step.observacao}</p>
              )}
              {step && (
                <p className="text-xs text-gray-400 mt-1">
                  {step.atorNome} · {new Date(step.createdAt).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Criar tela de detalhe**

```typescript
// app/solicitacoes/[id]/page.tsx
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { WorkflowTimeline } from '@/components/WorkflowTimeline'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DetalhesolicitacaoPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const sol = await prisma.solicitacao.findUnique({
    where: { id: params.id },
    include: { user: true, steps: { orderBy: { createdAt: 'asc' } }, anexos: true, prestacao: true }
  })
  if (!sol) notFound()

  const role = (session.user as any).role as string

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Voltar</Link>
        <h1 className="text-xl font-bold text-gray-800">Solicitação de Viagem</h1>
      </div>

      {/* Dados do Servidor */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Dados do Servidor</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Nome:</span> <span className="font-medium">{sol.nomeCompleto}</span></div>
          <div><span className="text-gray-500">Matrícula:</span> {sol.matricula}</div>
          <div><span className="text-gray-500">CPF:</span> {sol.cpf}</div>
          <div><span className="text-gray-500">Celular:</span> {sol.celular}</div>
        </div>
        <div className="mt-4 text-sm">
          <span className="text-gray-500">Destino:</span> <span className="font-medium">{sol.destino}</span>
          <span className="mx-3 text-gray-300">|</span>
          <span className="text-gray-500">Ida:</span> {new Date(sol.dataIda).toLocaleDateString('pt-BR')}
          <span className="mx-3 text-gray-300">|</span>
          <span className="text-gray-500">Volta:</span> {new Date(sol.dataVolta).toLocaleDateString('pt-BR')}
        </div>
        <div className="mt-4 text-sm">
          <p className="text-gray-500 mb-1">Justificativa Pública:</p>
          <p className="text-gray-700 bg-gray-50 rounded p-2">{sol.justificativaPublica}</p>
        </div>
        <div className="mt-3 text-sm">
          <p className="text-gray-500 mb-1">Ficha Orçamentária:</p>
          <p className="font-mono text-gray-700">{sol.fichaOrcamentaria}</p>
        </div>
      </div>

      {/* Anexos */}
      {sol.anexos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-3">Documentos Anexados</h2>
          <div className="space-y-2">
            {sol.anexos.map(a => (
              <a key={a.id} href={`/uploads/${a.path}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                📎 {a.nome} <span className="text-gray-400 text-xs">({a.tipo})</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Timeline do Workflow */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Fluxo de Aprovação</h2>
        <WorkflowTimeline status={sol.status} steps={sol.steps} />
      </div>

      {/* Ações por role — será implementado na Task 6 */}
      <div id="acoes-workflow" />

      {/* Prestação de Contas */}
      {sol.status === 'CONCLUIDA' && role === 'DEMANDANTE' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="font-semibold text-amber-800 mb-2">Prestação de Contas</h2>
          {sol.prestacao?.enviadoEm ? (
            <p className="text-green-700 text-sm">✓ Enviada em {new Date(sol.prestacao.enviadoEm).toLocaleDateString('pt-BR')}</p>
          ) : (
            <div>
              <p className="text-amber-700 text-sm mb-3">
                Prazo: {sol.prestacao?.prazoFinal ? new Date(sol.prestacao.prazoFinal).toLocaleDateString('pt-BR') : 'A definir'}
              </p>
              <Link href={`/solicitacoes/${sol.id}/prestacao`}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700 transition">
                Enviar Prestação de Contas
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: tela de detalhe da solicitação com timeline do workflow"
```

---

## Task 6: API de workflow (ações por etapa)

**Task ID:** #6
**Files:**
- Create: `app/api/workflow/[id]/route.ts`
- Create: `lib/email-log.ts`
- Modify: `app/solicitacoes/[id]/page.tsx` (adicionar bloco de ações)
- Create: `components/AcoesWorkflow.tsx`

**Step 1: Criar logger de e-mails**

```typescript
// lib/email-log.ts
import fs from 'fs'
import path from 'path'

const LOG_PATH = path.join(process.cwd(), 'email-logs.json')

type EmailLog = {
  id: string
  para: string
  assunto: string
  corpo: string
  timestamp: string
  tipo: string
}

export function logEmail(email: Omit<EmailLog, 'id' | 'timestamp'>) {
  let logs: EmailLog[] = []
  if (fs.existsSync(LOG_PATH)) {
    try { logs = JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8')) } catch { logs = [] }
  }
  const entry: EmailLog = {
    ...email,
    id: Date.now().toString(),
    timestamp: new Date().toISOString()
  }
  logs.unshift(entry)
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs.slice(0, 500), null, 2))
  console.log(`[EMAIL LOG] Para: ${email.para} | Assunto: ${email.assunto}`)
}
```

**Step 2: Criar API de workflow**

```typescript
// app/api/workflow/[id]/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { logEmail } from '@/lib/email-log'
import { addDiasUteis } from '@/lib/utils/diasUteis'

const TRANSICOES: Record<string, { etapa: string; decisao: string; proximoStatus: string; rolePermitido: string }[]> = {
  AGUARDANDO_COTACAO: [
    { etapa: 'COTACAO', decisao: 'APROVADO', proximoStatus: 'AGUARDANDO_VIABILIDADE', rolePermitido: 'SECOL' }
  ],
  AGUARDANDO_VIABILIDADE: [
    { etapa: 'VIABILIDADE', decisao: 'APROVADO', proximoStatus: 'AGUARDANDO_EMISSAO', rolePermitido: 'SEGOV' },
    { etapa: 'VIABILIDADE', decisao: 'REPROVADO', proximoStatus: 'REPROVADA', rolePermitido: 'SEGOV' },
  ],
  AGUARDANDO_EMISSAO: [
    { etapa: 'EMISSAO', decisao: 'APROVADO', proximoStatus: 'AGUARDANDO_EXECUCAO', rolePermitido: 'SECOL' }
  ],
  AGUARDANDO_EXECUCAO: [
    { etapa: 'EXECUCAO', decisao: 'APROVADO', proximoStatus: 'CONCLUIDA', rolePermitido: 'SF' }
  ],
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const role = (session.user as any).role as string
  const userName = session.user?.name ?? ''
  const { decisao, observacao } = await req.json()

  const sol = await prisma.solicitacao.findUnique({
    where: { id: params.id }, include: { user: true }
  })
  if (!sol) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  const transicoesPossiveis = TRANSICOES[sol.status] ?? []
  const transicao = transicoesPossiveis.find(t => t.decisao === decisao && t.rolePermitido === role)

  if (!transicao) {
    return NextResponse.json({ error: 'Ação não permitida para este papel nesta etapa' }, { status: 403 })
  }

  // Registrar step do workflow
  await prisma.workflowStep.create({
    data: {
      solicitacaoId: sol.id,
      etapa: transicao.etapa,
      atorRole: role,
      atorNome: userName,
      decisao,
      observacao: observacao ?? null,
    }
  })

  // Atualizar status
  await prisma.solicitacao.update({
    where: { id: sol.id },
    data: { status: transicao.proximoStatus }
  })

  // Lógica especial: EMISSÃO aprovada → criar registro de prestação de contas
  if (transicao.etapa === 'EXECUCAO' && decisao === 'APROVADO') {
    const prazoFinal = addDiasUteis(new Date(sol.dataVolta), 5)
    await prisma.prestacao.upsert({
      where: { solicitacaoId: sol.id },
      update: {},
      create: { solicitacaoId: sol.id, prazoFinal }
    })
    logEmail({
      para: sol.emailServidor,
      assunto: `[Viagens Osasco] Viagem aprovada — vouchers disponíveis`,
      corpo: `Prezado(a) ${sol.nomeCompleto}, sua viagem para ${sol.destino} foi aprovada. Acesse o sistema para baixar os vouchers. Prazo para prestação de contas: ${prazoFinal.toLocaleDateString('pt-BR')}.`,
      tipo: 'VOUCHER_APROVACAO'
    })
  }

  if (decisao === 'REPROVADO') {
    logEmail({
      para: sol.emailServidor,
      assunto: `[Viagens Osasco] Solicitação reprovada`,
      corpo: `Prezado(a) ${sol.nomeCompleto}, sua solicitação de viagem para ${sol.destino} foi reprovada. Motivo: ${observacao ?? 'Não informado'}.`,
      tipo: 'REPROVACAO'
    })
  }

  return NextResponse.json({ ok: true, novoStatus: transicao.proximoStatus })
}
```

**Step 3: Criar componente de ações do workflow (client component)**

```typescript
// components/AcoesWorkflow.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  solicitacaoId: string
  status: string
  userRole: string
}

const ACOES_POR_STATUS_ROLE: Record<string, Record<string, { label: string; decisao: string; cor: string }[]>> = {
  AGUARDANDO_COTACAO: {
    SECOL: [{ label: 'Confirmar Cotação e Avançar', decisao: 'APROVADO', cor: 'blue' }]
  },
  AGUARDANDO_VIABILIDADE: {
    SEGOV: [
      { label: 'Aprovar Viabilidade', decisao: 'APROVADO', cor: 'green' },
      { label: 'Reprovar', decisao: 'REPROVADO', cor: 'red' },
    ]
  },
  AGUARDANDO_EMISSAO: {
    SECOL: [{ label: 'Emitir OS e Vouchers', decisao: 'APROVADO', cor: 'blue' }]
  },
  AGUARDANDO_EXECUCAO: {
    SF: [{ label: 'Confirmar Execução Orçamentária (BRS)', decisao: 'APROVADO', cor: 'green' }]
  },
}

const COR_MAP: Record<string, string> = {
  blue: 'bg-blue-700 hover:bg-blue-800',
  green: 'bg-green-600 hover:bg-green-700',
  red: 'bg-red-600 hover:bg-red-700',
}

export function AcoesWorkflow({ solicitacaoId, status, userRole }: Props) {
  const [obs, setObs] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  const acoes = ACOES_POR_STATUS_ROLE[status]?.[userRole] ?? []
  if (acoes.length === 0) return null

  async function executarAcao(decisao: string) {
    setLoading(true)
    setErro('')
    const res = await fetch(`/api/workflow/${solicitacaoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisao, observacao: obs })
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.error); setLoading(false); return }
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-blue-200">
      <h2 className="font-semibold text-gray-700 mb-4">Ação Requerida</h2>
      <textarea
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        rows={3} placeholder="Observação (opcional para aprovação, recomendada para reprovação)"
        value={obs} onChange={e => setObs(e.target.value)} />
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}
      <div className="flex gap-3 flex-wrap">
        {acoes.map(a => (
          <button key={a.decisao} onClick={() => executarAcao(a.decisao)} disabled={loading}
            className={`text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${COR_MAP[a.cor]}`}>
            {loading ? 'Processando...' : a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Integrar AcoesWorkflow na tela de detalhe (adicionar após a timeline)**

No arquivo `app/solicitacoes/[id]/page.tsx`, importar e adicionar:
```typescript
import { AcoesWorkflow } from '@/components/AcoesWorkflow'
// Dentro do return, após WorkflowTimeline:
<AcoesWorkflow solicitacaoId={sol.id} status={sol.status} userRole={role} />
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: API de workflow com transições de estado e log de e-mails"
```

---

## Task 7: Upload de arquivos

**Task ID:** #7
**Files:**
- Create: `app/api/upload/route.ts`
- Create: `public/uploads/.gitkeep`

**Step 1: Criar API de upload**

```typescript
// app/api/upload/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]
  const solicitacaoId = formData.get('solicitacaoId') as string
  const prestacaoId = formData.get('prestacaoId') as string | null
  const tipo = formData.get('tipo') as string

  const uploadDir = path.join(process.cwd(), 'uploads')
  await mkdir(uploadDir, { recursive: true })

  const anexosCriados = []
  for (const file of files) {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    await writeFile(path.join(uploadDir, filename), buffer)

    const anexo = await prisma.anexo.create({
      data: {
        nome: file.name,
        path: filename,
        tipo,
        solicitacaoId: solicitacaoId || null,
        prestacaoId: prestacaoId || null,
      }
    })
    anexosCriados.push(anexo)
  }

  return NextResponse.json({ anexos: anexosCriados })
}
```

**Step 2: Criar rota para servir arquivos**

```typescript
// app/api/files/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const filePath = path.join(process.cwd(), 'uploads', params.filename)
  try {
    const file = await readFile(filePath)
    return new NextResponse(file, {
      headers: { 'Content-Disposition': `inline; filename="${params.filename}"` }
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
  }
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: upload de arquivos com API e rota de download protegida"
```

---

## Task 8: Prestação de Contas pós-viagem

**Task ID:** #8
**Files:**
- Create: `app/solicitacoes/[id]/prestacao/page.tsx`
- Create: `app/api/prestacao/[id]/route.ts`
- Create: `app/api/cron/verificar-prestacoes/route.ts`

**Step 1: Criar formulário de prestação de contas**

```typescript
// app/solicitacoes/[id]/prestacao/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PrestacaoPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [relatorio, setRelatorio] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!relatorio.trim()) { setErro('O relatório de atividades é obrigatório'); return }
    setEnviando(true)
    setErro('')

    const res = await fetch(`/api/prestacao/${params.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relatorio })
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.error); setEnviando(false); return }

    // Upload de evidências
    if (arquivos.length > 0) {
      const fd = new FormData()
      arquivos.forEach(f => fd.append('files', f))
      fd.append('solicitacaoId', params.id)
      fd.append('prestacaoId', data.prestacaoId)
      fd.append('tipo', 'EVIDENCIA')
      await fetch('/api/upload', { method: 'POST', body: fd })
    }

    router.push('/dashboard')
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">Prestação de Contas — Art. 4º</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>Prazo legal:</strong> 5 dias úteis após o retorno. O não envio resultará em bloqueio para novas solicitações.
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Relatório de Atividades *</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
            value={relatorio} onChange={e => setRelatorio(e.target.value)}
            placeholder="Descreva as atividades realizadas durante a missão, resultados obtidos e benefícios para a administração pública..."
            required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Evidências (Fotos, Certificados, Lista de Presença)</label>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => setArquivos(Array.from(e.target.files ?? []))}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          {arquivos.length > 0 && (
            <ul className="mt-2 space-y-1">
              {arquivos.map((f, i) => <li key={i} className="text-xs text-gray-500">📎 {f.name}</li>)}
            </ul>
          )}
        </div>
        {erro && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{erro}</div>}
        <button type="submit" disabled={enviando}
          className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50">
          {enviando ? 'Enviando...' : 'Enviar Prestação de Contas'}
        </button>
      </form>
    </div>
  )
}
```

**Step 2: Criar API de prestação de contas**

```typescript
// app/api/prestacao/[id]/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { relatorio } = await req.json()
  if (!relatorio?.trim()) return NextResponse.json({ error: 'Relatório obrigatório' }, { status: 422 })

  const prestacao = await prisma.prestacao.findUnique({ where: { solicitacaoId: params.id } })
  if (!prestacao) return NextResponse.json({ error: 'Prestação não encontrada' }, { status: 404 })
  if (prestacao.enviadoEm) return NextResponse.json({ error: 'Prestação já enviada' }, { status: 409 })

  const updated = await prisma.prestacao.update({
    where: { solicitacaoId: params.id },
    data: { relatorio, enviadoEm: new Date(), bloqueado: false }
  })

  // Desbloquear CPF se estava bloqueado
  const sol = await prisma.solicitacao.findUnique({ where: { id: params.id } })
  if (sol) {
    await prisma.user.update({ where: { id: sol.userId }, data: { cpfBloqueado: false } })
  }

  return NextResponse.json({ ok: true, prestacaoId: updated.id })
}
```

**Step 3: Criar cron de verificação de prestações vencidas**

```typescript
// app/api/cron/verificar-prestacoes/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logEmail } from '@/lib/email-log'

// Chamar periodicamente via cron externo ou manualmente
export async function GET() {
  const agora = new Date()

  // Bloquear CPFs com prazo vencido
  const vencidas = await prisma.prestacao.findMany({
    where: { enviadoEm: null, prazoFinal: { lt: agora }, bloqueado: false },
    include: { solicitacao: { include: { user: true } } }
  })

  for (const p of vencidas) {
    await prisma.prestacao.update({ where: { id: p.id }, data: { bloqueado: true } })
    await prisma.user.update({ where: { id: p.solicitacao.userId }, data: { cpfBloqueado: true } })
    logEmail({
      para: p.solicitacao.emailServidor,
      assunto: '[Viagens Osasco] BLOQUEIO — Prestação de contas em atraso',
      corpo: `Prezado(a) ${p.solicitacao.nomeCompleto}, o prazo para prestação de contas da viagem a ${p.solicitacao.destino} venceu em ${p.prazoFinal.toLocaleDateString('pt-BR')}. Seu CPF foi bloqueado para novas solicitações. Envie o relatório para desbloqueio.`,
      tipo: 'BLOQUEIO_CPF'
    })
  }

  // Alertar quem está perto do prazo (1 dia útil restante)
  const amanha = new Date(agora)
  amanha.setDate(amanha.getDate() + 2)
  const proximas = await prisma.prestacao.findMany({
    where: { enviadoEm: null, prazoFinal: { gte: agora, lte: amanha } },
    include: { solicitacao: true }
  })
  for (const p of proximas) {
    logEmail({
      para: p.solicitacao.emailServidor,
      assunto: '[Viagens Osasco] ⚠️ Prazo de prestação de contas se encerrando',
      corpo: `Prezado(a) ${p.solicitacao.nomeCompleto}, você tem até ${p.prazoFinal.toLocaleDateString('pt-BR')} para enviar o relatório de atividades da viagem a ${p.solicitacao.destino}.`,
      tipo: 'ALERTA_PRAZO'
    })
  }

  return NextResponse.json({ bloqueados: vencidas.length, alertas: proximas.length })
}
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: prestação de contas com bloqueio automático de CPF e cron de alertas"
```

---

## Task 9: Regras de negócio e toques finais

**Task ID:** #9
**Files:**
- Create: `app/api/solicitacoes/[id]/route.ts` (GET individual)
- Modify: `app/dashboard/page.tsx` (alerta de prestação pendente)
- Create: `components/AlertasPrestacao.tsx`

**Step 1: Alerta de prestação de contas pendente no dashboard**

```typescript
// components/AlertasPrestacao.tsx
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export async function AlertasPrestacao({ userId }: { userId: string }) {
  const pendentes = await prisma.prestacao.findMany({
    where: { enviadoEm: null, solicitacao: { userId } },
    include: { solicitacao: true }
  })

  if (pendentes.length === 0) return null

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6">
      <h3 className="font-bold text-red-700 mb-2">⚠️ Prestação de Contas Pendente</h3>
      {pendentes.map(p => (
        <div key={p.id} className="flex justify-between items-center text-sm">
          <span className="text-red-600">
            Viagem para {p.solicitacao.destino} — prazo: {new Date(p.prazoFinal).toLocaleDateString('pt-BR')}
          </span>
          <Link href={`/solicitacoes/${p.solicitacaoId}/prestacao`}
            className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-red-700 transition ml-3">
            Enviar Agora
          </Link>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Integrar AlertasPrestacao no dashboard**

Adicionar no `app/dashboard/page.tsx` após o cabeçalho:
```typescript
{role === 'DEMANDANTE' && <AlertasPrestacao userId={(session.user as any).id} />}
```

**Step 3: Verificar segregação de funções no backend**

No `app/api/workflow/[id]/route.ts` já está implementado via `rolePermitido`. Verificar que SECOL não aparece como opção em etapas da SEGOV e vice-versa — garantido pela tabela `TRANSICOES`.

**Step 4: Adicionar redirecionamento raiz**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'
export default function Home() { redirect('/dashboard') }
```

**Step 5: Rodar e testar o fluxo completo**

```bash
npm run dev
# Testar em http://localhost:3000
# 1. Login como demandante@osasco.sp.gov.br / senha123
# 2. Criar nova solicitação com data > 15 dias úteis
# 3. Logout → login como secol@osasco.sp.gov.br → aprovar cotação
# 4. Login como segov@osasco.sp.gov.br → aprovar viabilidade
# 5. Login como secol@osasco.sp.gov.br → emitir OS
# 6. Login como sf@osasco.sp.gov.br → confirmar execução
# 7. Login como demandante → enviar prestação de contas
```

**Step 6: Commit final**

```bash
git add .
git commit -m "feat: sistema completo de aprovação de viagens Osasco v1.0"
```

---

## Referência de Usuários de Teste

| Role | E-mail | Senha |
|------|--------|-------|
| DEMANDANTE | demandante@osasco.sp.gov.br | senha123 |
| SECOL | secol@osasco.sp.gov.br | senha123 |
| SEGOV | segov@osasco.sp.gov.br | senha123 |
| SF | sf@osasco.sp.gov.br | senha123 |

## Regras de Negócio — Checklist Final

- [x] Antecedência mínima 15 dias úteis (API bloqueia)
- [x] Vedação de adiantamento (aviso visual + sem campo no formulário)
- [x] Segregação de funções SECOL/SEGOV (tabela TRANSICOES)
- [x] Prestação de contas em 5 dias úteis (cron + bloqueio)
- [x] Bloqueio de CPF automático (User.cpfBloqueado)
- [x] Tramitação 100% digital (sem papel)
- [x] Log de e-mails em arquivo (email-logs.json)
