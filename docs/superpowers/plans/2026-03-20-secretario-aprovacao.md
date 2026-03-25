# Aprovação do Secretário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a Secretary approval step between travel request submission and SECOL quotation, with a Secretary dashboard showing their employees' trips and expense report status.

**Architecture:** Incremental — reuses the existing `WorkflowStep` model for the new SECRETARIO step. New `Secretaria` table links users to departments. The submission endpoint (`PATCH /api/solicitacoes/[id]`) is modified to route to `AGUARDANDO_SECRETARIO` instead of `AGUARDANDO_COTACAO`. The workflow engine adds SECRETARIO transitions with optimistic locking via Prisma transactions.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), NextAuth v5, Tailwind CSS, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-20-secretario-aprovacao-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `Secretaria` model + `secretariaId` on `User` |
| `types/next-auth.d.ts` | Modify | Add `secretariaId` to Session/JWT types |
| `lib/auth.config.ts` | Modify | Propagate `secretariaId` through JWT/session callbacks + protect `/portal/secretario` |
| `lib/email-notifications.ts` | Modify | Add `notificarSecretariosAtivos` function |
| `app/api/admin/secretarias/route.ts` | Create | GET + POST secretarias |
| `app/api/admin/secretarias/[id]/route.ts` | Create | PATCH + DELETE (soft) secretaria |
| `app/api/admin/usuarios/route.ts` | Modify | Add `secretariaId` to create, validate for DEMANDANTE/SECRETARIO |
| `app/api/admin/usuarios/[id]/route.ts` | Modify | Add `secretariaId` to existing `PUT` handler |
| `app/api/solicitacoes/route.ts` | Modify | Change initial submission status to `AGUARDANDO_SECRETARIO`; notify secretários |
| `app/api/solicitacoes/[id]/route.ts` | Modify | Allow SECRETARIO edit when `AGUARDANDO_SECRETARIO`; allow DEMANDANTE resubmit from `DEVOLVIDO_SECRETARIO` |
| `app/api/workflow/[id]/route.ts` | Modify | Add SECRETARIO transitions with Prisma transaction; add email notifications |
| `app/(portal)/layout.tsx` | Modify | Add `SECRETARIO` to `ROLE_LABELS` |
| `components/Sidebar.tsx` | Modify | Add `/portal/secretario` link + "Nova Viagem" button for SECRETARIO |
| `app/(portal)/dashboard/page.tsx` | Modify | Add new statuses to labels/badges; add SECRETARIO to `ROLE_STATUS_MAP` |
| `components/WorkflowTimeline.tsx` | Modify | Prepend SECRETARIO to `ETAPAS`; handle multiple SECRETARIO sub-steps |
| `components/AcoesWorkflow.tsx` | Modify | Add `AGUARDANDO_SECRETARIO` actions (separate modals for Devolver/Reprovar) |
| `components/SolicitacaoFormClient.tsx` | Modify | Disable `justificativaPublica`/`nexoCargo`; add DEVOLVIDO banner; add REPROVADO banner; remove those fields from DEMANDANTE validation |
| `components/SecretarioAprovacaoClient.tsx` | Create | Secretary approval form — all fields editable, 3 action buttons |
| `app/(portal)/admin/components/SecretariasSection.tsx` | Create | Admin CRUD for secretarias |
| `app/(portal)/admin/components/UsuariosSection.tsx` | Modify | Add secretaria dropdown to create/edit modal |
| `app/(portal)/admin/page.tsx` | Modify | Add `SecretariasSection` + pass secretarias data |
| `app/(portal)/solicitacoes/[id]/page.tsx` | Modify | Add new status labels; render `SecretarioAprovacaoClient` for SECRETARIO role |
| `app/(portal)/secretario/page.tsx` | Create | Secretary dashboard — 3 blocks |

---

## Task 1: Prisma Schema — Add Secretaria model and secretariaId

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Secretaria model and secretariaId to User in schema**

In `prisma/schema.prisma`, add after the `ConfiguracaoSistema` model:

```prisma
model Secretaria {
  id        String   @id @default(cuid())
  nome      String   @unique
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now())
  users     User[]
}
```

And add to the `User` model (after `ativo` field):

```prisma
  secretariaId String?
  secretaria   Secretaria? @relation(fields: [secretariaId], references: [id])
```

Also update the comment on `role`:
```prisma
  role         String        // DEMANDANTE | SECOL | SEGOV | SF | ADMIN | SECRETARIO
```

- [ ] **Step 2: Run migration**

```bash
cd "c:/automação/PortalViagens"
npx prisma migrate dev --name add_secretaria
```

Expected: Migration created and applied. `npx prisma generate` runs automatically.

- [ ] **Step 3: Verify build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: No Prisma-related type errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Secretaria model and secretariaId to User"
```

---

## Task 2: Auth — Add secretariaId to JWT and Session

**Files:**
- Modify: `types/next-auth.d.ts`
- Modify: `lib/auth.config.ts`

- [ ] **Step 1: Update type declarations**

In `types/next-auth.d.ts`, replace the entire file content:

```ts
import type { DefaultSession } from 'next-auth'
import type { JWT as DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      secretariaId?: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: string
    id: string
    secretariaId?: string
  }
}
```

- [ ] **Step 2: Update auth.config.ts callbacks**

In `lib/auth.config.ts`, find the `jwt` callback and extend it to also read `secretariaId` from the user object. Find the `session` callback and propagate it. Replace the two callbacks:

```ts
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role
        token.id = user.id as string
        token.secretariaId = (user as { secretariaId?: string }).secretariaId ?? undefined
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = token.role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).secretariaId = token.secretariaId;
      }
      return session
    }
```

Note: The `authorized` callback in `auth.config.ts` also needs to protect `/portal/secretario`. Add after the `isAdminRoute` check:

```ts
      const isSecretarioRoute = nextUrl.pathname.startsWith('/portal/secretario')
      if (isSecretarioRoute) {
        const role = (auth?.user as { role?: string })?.role
        if (role !== 'SECRETARIO' && role !== 'ADMIN') {
          return Response.redirect(new URL('/dashboard', nextUrl))
        }
      }
```

- [ ] **Step 3: Update lib/auth.ts to include secretariaId when building the session user**

Find `lib/auth.ts` and check how user is fetched in the `authorize` callback. The `secretariaId` must be fetched from the DB and attached to the user object returned by `authorize`. Open `lib/auth.ts` and find the `authorize` function. After retrieving `user` from Prisma, make sure `secretariaId` is included in the returned object:

```ts
return {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  secretariaId: user.secretariaId ?? undefined,
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add types/next-auth.d.ts lib/auth.config.ts lib/auth.ts
git commit -m "feat: add secretariaId to JWT session token"
```

---

## Task 3: Email — Add notificarSecretariosAtivos

**Files:**
- Modify: `lib/email-notifications.ts`

- [ ] **Step 1: Add the new notification function**

In `lib/email-notifications.ts`, add these functions after `notificarNovaSolicitacaoParaSecol`:

```ts
/** Demandante submeteu → notificar Secretários ativos da mesma secretaria */
export async function notificarSecretariosAtivos(
  sol: SolicitacaoComUser,
  secretariaId: string
): Promise<void> {
  const secretarios = await prisma.user.findMany({
    where: { role: 'SECRETARIO', secretariaId, ativo: true },
  })
  for (const s of secretarios) {
    try {
      logEmail({
        para: s.email,
        assunto: '[Viagens Osasco] Nova solicitação aguardando sua aprovação',
        corpo: `Prezado(a) ${s.name},\n\nUma nova solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} aguarda sua aprovação.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
        tipo: 'NOVA_SOLICITACAO_SECRETARIO',
      })
    } catch { /* silent */ }
  }
}

/** Secretário aprovou → notificar SECOL + Demandante */
export async function notificarAprovacaoSecretario(
  sol: SolicitacaoComUser
): Promise<void> {
  // notificarDemandante is fire-and-forget (same pattern as rest of file)
  notificarDemandante(
    sol,
    '[Viagens Osasco] Solicitação aprovada pelo Secretário',
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi aprovada pelo Secretário e encaminhada para cotação.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'APROVACAO_SECRETARIO'
  )
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Nova solicitação aprovada — aguardando cotação',
    `Uma solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} foi aprovada pelo Secretário e aguarda cotação.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'COTACAO_APOS_SECRETARIO'
  )
}

/** Secretário devolveu → notificar Demandante */
export function notificarDevolucaoSecretario(
  sol: SolicitacaoComUser,
  motivo: string
): void {
  notificarDemandante(
    sol,
    '[Viagens Osasco] Solicitação devolvida para correção',
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi devolvida pelo Secretário para correção.\n\nMotivo: ${motivo}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'DEVOLUCAO_SECRETARIO'
  )
}

/** Secretário reprovou → notificar Demandante */
export function notificarReprovacaoSecretario(
  sol: SolicitacaoComUser,
  motivo: string
): void {
  notificarDemandante(
    sol,
    '[Viagens Osasco] Solicitação reprovada pelo Secretário',
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi REPROVADA pelo Secretário.\n\nMotivo: ${motivo}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'REPROVACAO_SECRETARIO'
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/email-notifications.ts
git commit -m "feat: add secretary email notification functions"
```

---

## Task 4: Admin API — Secretarias CRUD

**Files:**
- Create: `app/api/admin/secretarias/route.ts`
- Create: `app/api/admin/secretarias/[id]/route.ts`

- [ ] **Step 1: Create GET + POST endpoint**

Create `app/api/admin/secretarias/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  const user = session.user as { role: string }
  if (user.role !== 'ADMIN') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const secretarias = await prisma.secretaria.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { users: { where: { ativo: true } } } } },
  })
  return NextResponse.json(secretarias)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { nome } = await req.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const existing = await prisma.secretaria.findUnique({ where: { nome: nome.trim() } })
  if (existing) return NextResponse.json({ error: 'Secretaria já cadastrada' }, { status: 409 })

  const secretaria = await prisma.secretaria.create({
    data: { nome: nome.trim() },
  })
  return NextResponse.json(secretaria, { status: 201 })
}
```

- [ ] **Step 2: Create PATCH + soft-delete endpoint**

Create `app/api/admin/secretarias/[id]/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  const user = session.user as { role: string }
  if (user.role !== 'ADMIN') return null
  return session
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  const data: { nome?: string; ativo?: boolean } = {}
  if (body.nome !== undefined) data.nome = body.nome.trim()
  if (body.ativo !== undefined) data.ativo = body.ativo

  // Block deactivation if active users linked
  if (data.ativo === false) {
    const activeUsers = await prisma.user.count({
      where: { secretariaId: id, ativo: true },
    })
    if (activeUsers > 0) {
      return NextResponse.json({
        error: `Existem ${activeUsers} usuário(s) ativo(s) vinculados. Desvincule-os antes de desativar.`,
      }, { status: 409 })
    }
  }

  const secretaria = await prisma.secretaria.update({ where: { id }, data })
  return NextResponse.json(secretaria)
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/secretarias/
git commit -m "feat: add admin secretarias CRUD API"
```

---

## Task 5: Admin API — Update usuarios to support secretariaId

**Files:**
- Modify: `app/api/admin/usuarios/route.ts`

- [ ] **Step 1: Add secretariaId to GET (include it in the select)**

In `app/api/admin/usuarios/route.ts`, update the `GET` select to include `secretariaId`:

```ts
select: {
  id: true,
  name: true,
  email: true,
  role: true,
  cpfBloqueado: true,
  ativo: true,
  createdAt: true,
  secretariaId: true,
},
```

- [ ] **Step 2: Add secretariaId validation to POST**

In the `POST` handler, after the existing required-fields check, add:

```ts
const ROLES_REQUEREM_SECRETARIA = ['DEMANDANTE', 'SECRETARIO']
if (ROLES_REQUEREM_SECRETARIA.includes(role) && !body.secretariaId) {
  return NextResponse.json({
    error: 'Secretaria obrigatória para os papéis DEMANDANTE e SECRETARIO',
  }, { status: 400 })
}
```

And add `secretariaId` to the `prisma.user.create` data:

```ts
const usuario = await prisma.user.create({
  data: { name, email, password: hashedPassword, role, secretariaId: body.secretariaId ?? null },
  select: { id: true, name: true, email: true, role: true, cpfBloqueado: true, ativo: true, createdAt: true, secretariaId: true },
})
```

- [ ] **Step 3: Add `secretariaId` to the existing PUT handler**

`app/api/admin/usuarios/[id]/route.ts` already exists with a `PUT` handler. Modify it (do NOT create a new method):

1. Add secretaria validation inside the `PUT` handler, before the `updateData` block:
```ts
  const ROLES_REQUEREM_SECRETARIA = ['DEMANDANTE', 'SECRETARIO']
  if (body.role && ROLES_REQUEREM_SECRETARIA.includes(body.role) && !body.secretariaId) {
    return NextResponse.json({
      error: 'Secretaria obrigatória para os papéis DEMANDANTE e SECRETARIO',
    }, { status: 400 })
  }
```

2. Add `secretariaId` to the `updateData` assignments:
```ts
  if (body.secretariaId !== undefined) updateData.secretariaId = body.secretariaId || null
```

3. Update the `select` in `prisma.user.update` to include `secretariaId`:
```ts
    select: { id: true, name: true, email: true, role: true, cpfBloqueado: true, ativo: true, createdAt: true, secretariaId: true },
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/usuarios/
git commit -m "feat: add secretariaId to admin usuarios API"
```

---

## Task 6: Submission Endpoints — Route to AGUARDANDO_SECRETARIO

**Files:**
- Modify: `app/api/solicitacoes/route.ts`
- Modify: `app/api/solicitacoes/[id]/route.ts`

- [ ] **Step 1: Update POST /api/solicitacoes (new request)**

In `app/api/solicitacoes/route.ts`:

1. Replace the import for `notificarNovaSolicitacaoParaSecol` with:
```ts
import { notificarSecretariosAtivos, notificarRole } from '@/lib/email-notifications'
```
Keep all other imports unchanged (including `calcularDiasUteisAte` from `@/lib/utils/diasUteis`).

2. After `const dbUser = await prisma.user.findUnique(...)`, add validation:
```ts
  if (!isRascunho) {
    if (!dbUser?.secretariaId) {
      return NextResponse.json({
        error: 'Seu cadastro não possui uma secretaria vinculada. Contate o administrador.',
      }, { status: 400 })
    }
    const secretariosAtivos = await prisma.user.count({
      where: { role: 'SECRETARIO', secretariaId: dbUser.secretariaId, ativo: true },
    })
    if (secretariosAtivos === 0) {
      // Notify all ADMINs
      await notificarRole(
        'ADMIN',
        '[Viagens Osasco] ⚠️ Submissão bloqueada — sem Secretário ativo',
        `O usuário ${dbUser.name} tentou submeter uma solicitação mas não há Secretário ativo para sua secretaria (id: ${dbUser.secretariaId}).`,
        'SEM_SECRETARIO_ATIVO'
      )
      return NextResponse.json({
        error: 'Não há Secretário ativo para sua secretaria. Contate o administrador.',
      }, { status: 400 })
    }
  }
```

3. Change status in `prisma.solicitacao.create`:
```ts
status: isRascunho ? 'RASCUNHO' : 'AGUARDANDO_SECRETARIO',
```

4. Replace the `notificarNovaSolicitacaoParaSecol` call:
```ts
  if (!isRascunho) {
    notificarSecretariosAtivos(solicitacao, dbUser!.secretariaId!).catch(() => {})
  }
```

- [ ] **Step 2: Update PATCH /api/solicitacoes/[id] (edit existing)**

In `app/api/solicitacoes/[id]/route.ts`:

1. Replace the status guard and logic. The full updated PATCH handler:

```ts
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const user = session.user as { id: string; role: string; secretariaId?: string }

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: { user: true },
  })
  if (!sol) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  const body = await req.json()
  const isRascunho = body.rascunho === true

  // SECRETARIO editing AGUARDANDO_SECRETARIO (save form fields before approving)
  if (user.role === 'SECRETARIO' || (user.role === 'ADMIN' && sol.status === 'AGUARDANDO_SECRETARIO')) {
    if (sol.status !== 'AGUARDANDO_SECRETARIO') {
      return NextResponse.json({ error: 'Solicitação não está aguardando aprovação do Secretário' }, { status: 403 })
    }
    // Verify secretario belongs to the same secretaria
    if (user.role === 'SECRETARIO' && user.secretariaId !== sol.user.secretariaId) {
      return NextResponse.json({ error: 'Não autorizado para esta secretaria' }, { status: 403 })
    }
    // Save all fields (no status change, no 15-day check)
    const updated = await prisma.solicitacao.update({
      where: { id },
      data: {
        nomeCompleto: body.nomeCompleto,
        matricula: body.matricula,
        cpf: body.cpf,
        dataNascimento: new Date(body.dataNascimento),
        celular: body.celular,
        emailServidor: body.emailServidor,
        justificativaPublica: body.justificativaPublica,
        nexoCargo: body.nexoCargo,
        destino: body.destino,
        dataIda: new Date(body.dataIda),
        dataVolta: new Date(body.dataVolta),
        justificativaLocal: body.justificativaLocal,
        fichaOrcamentaria: body.fichaOrcamentaria,
        indicacaoVoo: body.indicacaoVoo ?? null,
        indicacaoHospedagem: body.indicacaoHospedagem ?? null,
      },
    })
    return NextResponse.json(updated)
  }

  // DEMANDANTE editing RASCUNHO or DEVOLVIDO_SECRETARIO
  if (user.role !== 'ADMIN' && sol.userId !== user.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const allowedStatuses = ['RASCUNHO', 'DEVOLVIDO_SECRETARIO']
  if (!allowedStatuses.includes(sol.status) && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Esta solicitação não pode ser editada no status atual' }, { status: 403 })
  }

  if (sol.status === 'DEVOLVIDO_SECRETARIO' && user.role !== 'ADMIN') {
    // Block editing Detalhes da Missão fields — force them from DB
    body.justificativaPublica = sol.justificativaPublica
    body.nexoCargo = sol.nexoCargo
  }

  const dataIda = new Date(body.dataIda)

  if (!isRascunho) {
    const diasUteis = calcularDiasUteisAte(dataIda)
    if (diasUteis < 15 && user.role !== 'ADMIN') {
      return NextResponse.json({
        error: `Antecedência insuficiente: apenas ${diasUteis} dia(s) útil(is). Mínimo exigido: 15 dias úteis (Art. 1º).`
      }, { status: 422 })
    }
  }

  // Determine next status
  let nextStatus: string
  if (isRascunho) {
    nextStatus = 'RASCUNHO'
  } else if (sol.status === 'DEVOLVIDO_SECRETARIO') {
    // Resubmission — validate secretaria
    if (!sol.user.secretariaId) {
      return NextResponse.json({ error: 'Seu cadastro não possui secretaria vinculada.' }, { status: 400 })
    }
    nextStatus = 'AGUARDANDO_SECRETARIO'
  } else {
    // Initial submission from RASCUNHO
    if (!sol.user.secretariaId) {
      return NextResponse.json({ error: 'Seu cadastro não possui secretaria vinculada. Contate o administrador.' }, { status: 400 })
    }
    const secretariosAtivos = await prisma.user.count({
      where: { role: 'SECRETARIO', secretariaId: sol.user.secretariaId, ativo: true },
    })
    if (secretariosAtivos === 0) {
      await notificarRole(
        'ADMIN',
        '[Viagens Osasco] ⚠️ Submissão bloqueada — sem Secretário ativo',
        `O usuário ${sol.user.name} tentou submeter uma solicitação mas não há Secretário ativo para sua secretaria.`,
        'SEM_SECRETARIO_ATIVO'
      ).catch(() => {})
      return NextResponse.json({ error: 'Não há Secretário ativo para sua secretaria. Contate o administrador.' }, { status: 400 })
    }
    nextStatus = 'AGUARDANDO_SECRETARIO'
  }

  const updated = await prisma.solicitacao.update({
    where: { id },
    data: {
      nomeCompleto: body.nomeCompleto,
      matricula: body.matricula,
      cpf: body.cpf,
      dataNascimento: new Date(body.dataNascimento),
      celular: body.celular,
      emailServidor: body.emailServidor,
      justificativaPublica: body.justificativaPublica,
      nexoCargo: body.nexoCargo,
      destino: body.destino,
      dataIda,
      dataVolta: new Date(body.dataVolta),
      justificativaLocal: body.justificativaLocal,
      fichaOrcamentaria: body.fichaOrcamentaria,
      indicacaoVoo: body.indicacaoVoo ?? null,
      indicacaoHospedagem: body.indicacaoHospedagem ?? null,
      status: nextStatus,
    },
    include: { user: true },
  })

  if (!isRascunho && nextStatus === 'AGUARDANDO_SECRETARIO') {
    notificarSecretariosAtivos(updated, sol.user.secretariaId!).catch(() => {})
  }

  return NextResponse.json(updated)
}
```

Also ensure the full imports at the top of `app/api/solicitacoes/[id]/route.ts` are:
```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calcularDiasUteisAte } from '@/lib/utils/diasUteis'
import { notificarRole, notificarSecretariosAtivos } from '@/lib/email-notifications'
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/solicitacoes/
git commit -m "feat: route submissions to AGUARDANDO_SECRETARIO"
```

---

## Task 7: Workflow API — Add SECRETARIO transitions

**Files:**
- Modify: `app/api/workflow/[id]/route.ts`

- [ ] **Step 1: Add SECRETARIO imports**

At the top of the file, update the import from `@/lib/email-notifications` to include the new functions. The full import must be:
```ts
import {
  notificarCotacaoParaSegov,
  notificarViabilidadeAprovadaParaSecol,
  notificarAjusteParaSecol,
  notificarAjusteParaDemandante,
  notificarEmissaoParaSf,
  notificarDemandante,
  notificarRole,
  notificarAprovacaoSecretario,
  notificarDevolucaoSecretario,
  notificarReprovacaoSecretario,
} from '@/lib/email-notifications'
```

- [ ] **Step 2: Add SECRETARIO transitions to TRANSICOES map**

In the `TRANSICOES` object, add before `AGUARDANDO_COTACAO`:

```ts
  AGUARDANDO_SECRETARIO: [
    { etapa: 'SECRETARIO', decisao: 'APROVADO', proximoStatus: 'AGUARDANDO_COTACAO', rolePermitido: 'SECRETARIO' },
    { etapa: 'SECRETARIO', decisao: 'DEVOLVIDO', proximoStatus: 'DEVOLVIDO_SECRETARIO', rolePermitido: 'SECRETARIO' },
    { etapa: 'SECRETARIO', decisao: 'REPROVADO', proximoStatus: 'REPROVADO_SECRETARIO', rolePermitido: 'SECRETARIO' },
  ],
```

- [ ] **Step 3: Replace the status check + update with an optimistic-locking transaction**

The current code does two separate Prisma calls (findUnique, then workflowStep.create + solicitacao.update). Replace ONLY the section from `const transicoesPossiveis...` through the closing `})` of `await prisma.solicitacao.update(...)`. **STOP before the comment `// Lógica especial para etapa de VIABILIDADE` — do not touch anything after that line.** Replace with:

```ts
  const transicoesPossiveis = TRANSICOES[sol.status] ?? []
  const transicao = transicoesPossiveis.find(
    t => t.decisao === decisao && (t.rolePermitido === role || role === 'ADMIN')
  )

  if (!transicao) {
    return NextResponse.json({
      error: `Ação não permitida para o papel "${role}" no status atual "${sol.status}".`
    }, { status: 403 })
  }

  // Validate required observacao for SECRETARIO DEVOLVIDO and REPROVADO
  if (transicao.etapa === 'SECRETARIO' && ['DEVOLVIDO', 'REPROVADO'].includes(decisao) && !observacao?.trim()) {
    return NextResponse.json({ error: 'Justificativa obrigatória para devolução ou reprovação.' }, { status: 400 })
  }

  // Validate SECRETARIO belongs to same secretaria (for non-ADMIN)
  if (transicao.etapa === 'SECRETARIO' && role === 'SECRETARIO') {
    const sessionUser = session.user as { id: string; role: string; secretariaId?: string }
    if (sessionUser.secretariaId !== sol.user.secretariaId) {
      return NextResponse.json({ error: 'Não autorizado para esta secretaria.' }, { status: 403 })
    }
  }

  // Use transaction for optimistic locking (prevents concurrent secretário actions)
  try {
    await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction
      const solAtual = await tx.solicitacao.findUnique({ where: { id: sol.id }, select: { status: true } })
      if (solAtual?.status !== sol.status) {
        throw new Error('CONCURRENT_ACTION')
      }

      await tx.workflowStep.create({
        data: {
          solicitacaoId: sol.id,
          etapa: transicao.etapa,
          atorRole: role,
          atorNome: userName,
          decisao,
          observacao: observacao || null,
          ...(transicao.etapa === 'COTACAO' && {
            valorPassagem: valorPassagem ?? null,
            valorHospedagem: valorHospedagem ?? null,
          }),
        },
      })

      await tx.solicitacao.update({
        where: { id: sol.id },
        data: { status: transicao.proximoStatus },
      })
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CONCURRENT_ACTION') {
      return NextResponse.json({ error: 'Este pedido já foi processado por outro Secretário.' }, { status: 409 })
    }
    throw err
  }
```

- [ ] **Step 4: Add SECRETARIO email notifications**

After the transaction, add notifications for the new SECRETARIO step (before the existing COTACAO notifications):

```ts
  // SECRETARIO aprovado → notificar SECOL + Demandante
  if (transicao.etapa === 'SECRETARIO' && decisao === 'APROVADO') {
    notificarAprovacaoSecretario(sol).catch(() => {})
  }

  // SECRETARIO devolvido → notificar Demandante
  if (transicao.etapa === 'SECRETARIO' && decisao === 'DEVOLVIDO') {
    notificarDevolucaoSecretario(sol, observacao || '')
  }

  // SECRETARIO reprovado → notificar Demandante
  if (transicao.etapa === 'SECRETARIO' && decisao === 'REPROVADO') {
    notificarReprovacaoSecretario(sol, observacao || '')
  }
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add app/api/workflow/[id]/route.ts
git commit -m "feat: add SECRETARIO workflow transitions with optimistic locking"
```

---

## Task 8: Portal Layout + Sidebar + Dashboard — Role updates

**Files:**
- Modify: `app/(portal)/layout.tsx`
- Modify: `components/Sidebar.tsx`
- Modify: `app/(portal)/dashboard/page.tsx`

- [ ] **Step 1: Add SECRETARIO to ROLE_LABELS in layout.tsx**

In `app/(portal)/layout.tsx`, add to the `ROLE_LABELS` object:
```ts
  SECRETARIO: 'Secretário(a)',
```

- [ ] **Step 2: Update Sidebar.tsx**

In `components/Sidebar.tsx`:

1. Add `/portal/secretario` link for SECRETARIO (add after the "Solicitações" Link):
```tsx
          {(role === 'SECRETARIO') && (
            <Link
              href="/portal/secretario"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname.startsWith('/portal/secretario')
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">approval</span>
              <span className="text-sm font-medium">Aprovações</span>
            </Link>
          )}
```

2. Add SECRETARIO to the "Nova Viagem" button condition:
```tsx
          {(role === 'DEMANDANTE' || role === 'ADMIN' || role === 'SECRETARIO') && (
```

- [ ] **Step 3: Update dashboard/page.tsx**

In `app/(portal)/dashboard/page.tsx`:

1. Add new statuses to `STATUS_LABELS`:
```ts
  AGUARDANDO_SECRETARIO: 'Aguardando Secretário',
  DEVOLVIDO_SECRETARIO: 'Devolvido — Correção',
  REPROVADO_SECRETARIO: 'Reprovado pelo Secretário',
```

2. Add new statuses to `STATUS_BADGE`:
```ts
  AGUARDANDO_SECRETARIO: 'bg-violet-100 text-violet-800',
  DEVOLVIDO_SECRETARIO: 'bg-amber-100 text-amber-800',
  REPROVADO_SECRETARIO: 'bg-rose-100 text-rose-800',
```

3. Add SECRETARIO to `ROLE_STATUS_MAP`:
```ts
  SECRETARIO: ['AGUARDANDO_SECRETARIO', 'DEVOLVIDO_SECRETARIO', 'REPROVADO_SECRETARIO', 'AGUARDANDO_COTACAO', 'CONCLUIDA'],
```

4. Update the DEMANDANTE status list to include the new statuses:
```ts
  DEMANDANTE: ['RASCUNHO', 'AGUARDANDO_SECRETARIO', 'DEVOLVIDO_SECRETARIO', 'REPROVADO_SECRETARIO', 'AGUARDANDO_COTACAO', 'AGUARDANDO_VIABILIDADE', 'AGUARDANDO_EMISSAO', 'AGUARDANDO_EXECUCAO', 'CONCLUIDA', 'REPROVADA'],
```

5. Update the dashboard query for SECRETARIO to filter by secretaria. In the `let where` block, add the SECRETARIO case:
```ts
  } else if (role === 'SECRETARIO') {
    const sessionUser = session.user as { id: string; role: string; secretariaId?: string }
    where = {
      status: { in: ROLE_STATUS_MAP['SECRETARIO'] },
      user: { secretariaId: sessionUser.secretariaId ?? '' },
    }
```

6. Add to `getStatusActionIcon`:
```ts
  if (status === 'AGUARDANDO_SECRETARIO') return 'approval'
  if (status === 'DEVOLVIDO_SECRETARIO') return 'edit'
  if (status === 'REPROVADO_SECRETARIO') return 'info'
```

7. For the DEMANDANTE entry in `ROLE_STATUS_MAP`, **replace** the entire existing line (the current entry only has 7 statuses) with:
```ts
  DEMANDANTE: ['RASCUNHO', 'AGUARDANDO_SECRETARIO', 'DEVOLVIDO_SECRETARIO', 'REPROVADO_SECRETARIO', 'AGUARDANDO_COTACAO', 'AGUARDANDO_VIABILIDADE', 'AGUARDANDO_EMISSAO', 'AGUARDANDO_EXECUCAO', 'CONCLUIDA', 'REPROVADA'],
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add app/(portal)/layout.tsx components/Sidebar.tsx app/(portal)/dashboard/page.tsx
git commit -m "feat: add SECRETARIO role to layout, sidebar, and dashboard"
```

---

## Task 9: WorkflowTimeline — Add SECRETARIO step

**Files:**
- Modify: `components/WorkflowTimeline.tsx`

- [ ] **Step 1: Prepend SECRETARIO to ETAPAS and update STATUS_ETAPA_MAP**

In `components/WorkflowTimeline.tsx`:

1. Replace the `ETAPAS` array:
```ts
const ETAPAS = [
  { key: 'SECRETARIO', label: 'Aprovação do Secretário', ator: 'Secretário(a)', desc: 'Avaliação e aprovação do pedido de viagem pelo Secretário responsável pela área' },
  { key: 'COTACAO', label: 'Cotação Técnica', ator: 'SECOL / DRP', desc: 'Consulta à Ata de Registro de Preços e upload de opções de voos/hotéis' },
  { key: 'VIABILIDADE', label: 'Análise de Viabilidade', ator: 'SEGOV — Gabinete', desc: 'Avaliação de conveniência e oportunidade política/financeira' },
  { key: 'EMISSAO', label: 'Emissão de OS e Vouchers', ator: 'SECOL', desc: 'Emissão da Ordem de Serviço e envio de vouchers ao servidor' },
  { key: 'EXECUCAO', label: 'Execução Orçamentária', ator: 'Secretaria de Finanças', desc: 'Recebimento da BRS e autorização para liquidação e pagamento' },
]
```

2. In `STATUS_ETAPA_MAP`, **add** (do not remove existing entries) the three new statuses:
```ts
  AGUARDANDO_SECRETARIO: 'SECRETARIO',
  DEVOLVIDO_SECRETARIO: 'SECRETARIO',
  REPROVADO_SECRETARIO: 'SECRETARIO',
```
The existing entries (`AGUARDANDO_COTACAO`, `AGUARDANDO_VIABILIDADE`, `AGUARDANDO_EMISSAO`, `AGUARDANDO_EXECUCAO`, `CONCLUIDA`, `REPROVADA`) must be preserved unchanged.

3. For the SECRETARIO etapa, the `step` lookup needs to handle multiple steps (cycles of devolution). Replace the single `step` lookup inside the `.map()` with:
```ts
        // For SECRETARIO, find the last step (most recent decision)
        const step = etapa.key === 'SECRETARIO'
          ? steps.filter(s => s.etapa === 'SECRETARIO').at(-1) ?? undefined
          : steps.find(s => s.etapa === etapa.key)
```

4. For SECRETARIO with `DEVOLVIDO` decision, it should not show as `isDone` or `isReprovado`. Update the logic:
```ts
        const isDone = step?.decisao === 'APROVADO'
        const isReprovado = step?.decisao === 'REPROVADO'
        const isDevolvido = etapa.key === 'SECRETARIO' && step?.decisao === 'DEVOLVIDO'
        const isAtual = etapaAtualKey === etapa.key
        const isPending = !isDone && !isReprovado && !isDevolvido && !isAtual
```

5. Update the border/bg classes:
```tsx
            ${isDone ? 'border-green-200 bg-green-50' :
              isReprovado ? 'border-red-200 bg-red-50' :
              isDevolvido ? 'border-amber-200 bg-amber-50' :
              isAtual ? 'border-blue-300 bg-blue-50 shadow-sm' :
              'border-gray-200 bg-gray-50 opacity-70'
            }
```

6. Add badge for `isDevolvido`:
```tsx
                  {isDevolvido && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
                      Devolvido
                    </span>
                  )}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/WorkflowTimeline.tsx
git commit -m "feat: add SECRETARIO step to WorkflowTimeline"
```

---

## Task 10: AcoesWorkflow — Add SECRETARIO actions

**Files:**
- Modify: `components/AcoesWorkflow.tsx`

The SECRETARIO workflow actions are different from others: "Devolver" and "Reprovar" require a mandatory justificativa in a modal, while "Aprovar" does not need a shared textarea. We extend the component with a modal for those two actions.

- [ ] **Step 1: Add AGUARDANDO_SECRETARIO to ACOES_MAP**

In `components/AcoesWorkflow.tsx`, add to the `ACOES_MAP`:

```ts
  AGUARDANDO_SECRETARIO: {
    SECRETARIO: [
      {
        label: 'Aprovar Solicitação',
        decisao: 'APROVADO',
        cor: 'green',
        descricao: 'Aprova a solicitação e encaminha para cotação pela SECOL.',
      },
      {
        label: 'Devolver para Correção',
        decisao: 'DEVOLVIDO',
        cor: 'yellow' as const,
        descricao: 'Devolve o pedido ao servidor para que faça as correções necessárias.',
      },
      {
        label: 'Reprovar Solicitação',
        decisao: 'REPROVADO',
        cor: 'red',
        descricao: 'Reprova definitivamente a solicitação.',
      },
    ],
  },
```

- [ ] **Step 2: Add 'yellow' to the CORES map and Acao type**

Update the `Acao` type:
```ts
type Acao = {
  label: string
  decisao: string
  cor: 'blue' | 'green' | 'red' | 'yellow'
  descricao: string
}
```

Add to `CORES`:
```ts
  yellow: 'bg-amber-500 hover:bg-amber-600 text-white',
```

- [ ] **Step 3: Add modal state and modal UI for DEVOLVIDO/REPROVADO**

Add state:
```ts
  const [modalDecisao, setModalDecisao] = useState<string | null>(null)
  const [modalJustificativa, setModalJustificativa] = useState('')
```

Update `executarAcao` to accept optional justificativa override:
```ts
  async function executarAcao(decisao: string, justificativaOverride?: string) {
    setLoading(true)
    setErro('')
    const obs = justificativaOverride !== undefined ? justificativaOverride : observacao
    try {
      const res = await fetch(`/api/workflow/${solicitacaoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, observacao: obs }),
      })
      // ...rest unchanged
```

Update button `onClick` to open modal for DEVOLVIDO/REPROVADO:
```tsx
            onClick={() => {
              if (['DEVOLVIDO', 'REPROVADO'].includes(a.decisao)) {
                setModalDecisao(a.decisao)
                setModalJustificativa('')
              } else {
                executarAcao(a.decisao)
              }
            }}
```

Add modal JSX before the closing `</section>`:
```tsx
      {modalDecisao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-slate-900">
              {modalDecisao === 'DEVOLVIDO' ? 'Devolver para Correção' : 'Reprovar Solicitação'}
            </h3>
            <p className="text-sm text-slate-500">Informe o motivo (obrigatório):</p>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              placeholder="Descreva o motivo..."
              value={modalJustificativa}
              onChange={e => setModalJustificativa(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModalDecisao(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!modalJustificativa.trim()) return
                  executarAcao(modalDecisao, modalJustificativa.trim())
                  setModalDecisao(null)
                }}
                disabled={!modalJustificativa.trim() || loading}
                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 ${modalDecisao === 'REPROVADO' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add components/AcoesWorkflow.tsx
git commit -m "feat: add SECRETARIO actions to AcoesWorkflow with justificativa modal"
```

---

## Task 11: SolicitacaoFormClient — Disable Detalhes da Missão + add banners

**Files:**
- Modify: `components/SolicitacaoFormClient.tsx`

The component needs to accept new props: `solicitacaoStatus` and `devolucaoMotivo`. When `justificativaPublica` and `nexoCargo` should be disabled depends on the status (always, for DEMANDANTE).

- [ ] **Step 1: Add new props to Props type**

```ts
type Props = {
  initialData?: FormData
  userName: string
  solicitacaoStatus?: string
  devolucaoMotivo?: string   // justificativa from last DEVOLVIDO WorkflowStep
}
```

- [ ] **Step 2: Remove justificativaPublica and nexoCargo from DEMANDANTE validation**

In the `validar()` function, remove the check:
```ts
    if (!form.justificativaPublica || !form.nexoCargo) {
      setErro('Preencha todos os campos obrigatórios na seção "Detalhes da Missão"')
      return false
    }
```

- [ ] **Step 3: Add DEVOLVIDO and REPROVADO banners at the top of the form (after the header)**

After the `<header>` element and before the Excel import section, add:

```tsx
      {/* DEVOLVIDO banner */}
      {solicitacaoStatus === 'DEVOLVIDO_SECRETARIO' && devolucaoMotivo && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 mt-0.5">warning</span>
          <div>
            <p className="font-bold text-amber-900 text-sm">Devolvido para correção pelo Secretário</p>
            <p className="text-amber-700 text-sm mt-1">{devolucaoMotivo}</p>
          </div>
        </div>
      )}

      {/* REPROVADO banner */}
      {solicitacaoStatus === 'REPROVADO_SECRETARIO' && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-red-600">cancel</span>
          <p className="font-bold text-red-900 text-sm">Esta solicitação foi reprovada pelo Secretário.</p>
        </div>
      )}
```

- [ ] **Step 4: Find the Detalhes da Missão section and disable the fields**

Search for `justificativaPublica` in the JSX (the textarea/input for it) and `nexoCargo`. Add `disabled={true}` to both and style them with a badge label. Add a badge showing `"Preenchimento do Secretário"` in the section heading.

Find the section label for "Detalhes da Missão" and update it to include the badge:

```tsx
<h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
  Detalhes da Missão
  <span className="text-[10px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 px-2 py-0.5 rounded">
    Preenchimento do Secretário
  </span>
</h3>
```

For both textarea fields (`justificativaPublica` and `nexoCargo`), add `disabled` and update the class to show disabled styling:
```tsx
<textarea
  disabled
  className={`${textareaCls} disabled:opacity-50 disabled:cursor-not-allowed`}
  ...
/>
```

- [ ] **Step 5: Update the Enviar/Submit button label for DEVOLVIDO status**

In the button section, update the submit button to show "Resubmeter para o Secretário" when status is `DEVOLVIDO_SECRETARIO`:

```tsx
<button
  onClick={() => enviar(false)}
  disabled={enviando || salvando || solicitacaoStatus === 'REPROVADO_SECRETARIO'}
  className="..."
>
  {enviando ? 'Enviando...' : solicitacaoStatus === 'DEVOLVIDO_SECRETARIO' ? 'Resubmeter para o Secretário' : 'Enviar Solicitação'}
</button>
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add components/SolicitacaoFormClient.tsx
git commit -m "feat: disable Detalhes da Missão in DEMANDANTE form, add status banners"
```

---

## Task 12: SecretarioAprovacaoClient — New secretary form component

**Files:**
- Create: `components/SecretarioAprovacaoClient.tsx`

This component reuses the same field structure as `SolicitacaoFormClient` but all fields are editable and has 3 action buttons instead of Enviar.

- [ ] **Step 1: Create the component**

Create `components/SecretarioAprovacaoClient.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type FormData = {
  id: string
  nomeCompleto: string; matricula: string; cpf: string
  dataNascimento: string; celular: string; emailServidor: string
  justificativaPublica: string; nexoCargo: string
  destino: string; dataIda: string; dataVolta: string
  justificativaLocal: string; indicacaoVoo: string; indicacaoHospedagem: string
  fichaOrcamentaria: string
}

type Props = {
  solicitacao: FormData
}

export function SecretarioAprovacaoClient({ solicitacao }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(solicitacao)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [modal, setModal] = useState<{ decisao: 'DEVOLVIDO' | 'REPROVADO' } | null>(null)
  const [justificativa, setJustificativa] = useState('')

  const update = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  const inputCls = "w-full rounded-lg border-slate-300 bg-[#f6f6f8] focus:ring-blue-600 focus:border-blue-600 text-slate-900 h-10 px-4 text-sm"
  const textareaCls = "w-full rounded-lg border-slate-300 bg-[#f6f6f8] focus:ring-blue-600 focus:border-blue-600 text-slate-900 px-4 py-3 text-sm"
  const labelCls = "block text-xs font-bold text-slate-600 mb-1.5 uppercase"

  async function salvarCampos() {
    const res = await fetch(`/api/solicitacoes/${form.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form }),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Erro ao salvar campos')
    }
  }

  async function executarDecisao(decisao: string, obs?: string) {
    setLoading(true)
    setErro('')
    try {
      if (decisao === 'APROVADO') {
        if (!form.justificativaPublica.trim() || !form.nexoCargo.trim()) {
          setErro('Preencha os campos de "Detalhes da Missão" antes de aprovar.')
          setLoading(false)
          return
        }
        await salvarCampos()
      }
      const res = await fetch(`/api/workflow/${form.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, observacao: obs ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao processar ação')
        setLoading(false)
        return
      }
      router.push('/portal/secretario')
      router.refresh()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado')
      setLoading(false)
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-[960px] mx-auto w-full">
      <header className="flex items-center gap-4 border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-8 px-8 -mt-8">
        <h2 className="text-xl font-bold text-slate-900">Análise de Solicitação</h2>
        <span className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-violet-100 text-violet-700">
          Aprovação do Secretário
        </span>
      </header>

      {/* Seção: Dados do Servidor */}
      <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-700 mb-4">Dados do Servidor</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={labelCls}>Nome Completo</label><input className={inputCls} value={form.nomeCompleto} onChange={update('nomeCompleto')} /></div>
          <div><label className={labelCls}>Matrícula</label><input className={inputCls} value={form.matricula} onChange={update('matricula')} /></div>
          <div><label className={labelCls}>CPF</label><input className={inputCls} value={form.cpf} onChange={update('cpf')} /></div>
          <div><label className={labelCls}>Data de Nascimento</label><input type="date" className={inputCls} value={form.dataNascimento} onChange={update('dataNascimento')} /></div>
          <div><label className={labelCls}>Celular</label><input className={inputCls} value={form.celular} onChange={update('celular')} /></div>
          <div><label className={labelCls}>E-mail Institucional</label><input className={inputCls} value={form.emailServidor} onChange={update('emailServidor')} /></div>
        </div>
      </section>

      {/* Seção: Detalhes da Missão — exclusivo Secretário */}
      <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4 border-2 border-violet-200">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          Detalhes da Missão
          <span className="text-[10px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 px-2 py-0.5 rounded">
            Preenchimento do Secretário
          </span>
        </h3>
        <div>
          <label className={labelCls}>Justificativa do Interesse Público <span className="text-red-500">*</span></label>
          <textarea className={textareaCls} rows={4} value={form.justificativaPublica} onChange={update('justificativaPublica')} placeholder="Descreva os benefícios da viagem para o município de Osasco..." />
        </div>
        <div>
          <label className={labelCls}>Nexo com as Atribuições do Cargo <span className="text-red-500">*</span></label>
          <textarea className={textareaCls} rows={3} value={form.nexoCargo} onChange={update('nexoCargo')} placeholder="Descreva a relação entre a viagem e as atribuições do cargo..." />
        </div>
      </section>

      {/* Seção: Logística */}
      <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-700 mb-4">Logística</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={labelCls}>Destino</label><input className={inputCls} value={form.destino} onChange={update('destino')} /></div>
          <div><label className={labelCls}>Ficha Orçamentária</label><input className={inputCls} value={form.fichaOrcamentaria} onChange={update('fichaOrcamentaria')} /></div>
          <div><label className={labelCls}>Data de Ida</label><input type="date" className={inputCls} value={form.dataIda} onChange={update('dataIda')} /></div>
          <div><label className={labelCls}>Data de Volta</label><input type="date" className={inputCls} value={form.dataVolta} onChange={update('dataVolta')} /></div>
        </div>
        <div><label className={labelCls}>Justificativa de Localização</label><textarea className={textareaCls} rows={3} value={form.justificativaLocal} onChange={update('justificativaLocal')} /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={labelCls}>Indicação de Voo (opcional)</label><input className={inputCls} value={form.indicacaoVoo} onChange={update('indicacaoVoo')} /></div>
          <div><label className={labelCls}>Indicação de Hospedagem (opcional)</label><input className={inputCls} value={form.indicacaoHospedagem} onChange={update('indicacaoHospedagem')} /></div>
        </div>
      </section>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{erro}</div>
      )}

      {/* Botões de ação */}
      <div className="flex flex-wrap gap-3 pb-8">
        <button
          onClick={() => executarDecisao('APROVADO')}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition disabled:opacity-50"
        >
          {loading ? 'Processando...' : 'Aprovar Solicitação'}
        </button>
        <button
          onClick={() => { setModal({ decisao: 'DEVOLVIDO' }); setJustificativa('') }}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition disabled:opacity-50"
        >
          Devolver para Correção
        </button>
        <button
          onClick={() => { setModal({ decisao: 'REPROVADO' }); setJustificativa('') }}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition disabled:opacity-50"
        >
          Reprovar Solicitação
        </button>
      </div>

      {/* Modal justificativa */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-slate-900">
              {modal.decisao === 'DEVOLVIDO' ? 'Devolver para Correção' : 'Reprovar Solicitação'}
            </h3>
            <p className="text-sm text-slate-500">Informe o motivo (obrigatório):</p>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              placeholder="Descreva o motivo..."
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!justificativa.trim()) return
                  executarDecisao(modal.decisao, justificativa.trim())
                  setModal(null)
                }}
                disabled={!justificativa.trim() || loading}
                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 ${modal.decisao === 'REPROVADO' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/SecretarioAprovacaoClient.tsx
git commit -m "feat: add SecretarioAprovacaoClient form component"
```

---

## Task 13: Solicitacao Detail Page — Add SECRETARIO form + status labels

**Files:**
- Modify: `app/(portal)/solicitacoes/[id]/page.tsx`

- [ ] **Step 1: Import SecretarioAprovacaoClient**

Add to imports:
```ts
import { SecretarioAprovacaoClient } from '@/components/SecretarioAprovacaoClient'
```

- [ ] **Step 2: Add new statuses to STATUS_LABELS and STATUS_CORES**

```ts
  AGUARDANDO_SECRETARIO: 'Aguardando Secretário',
  DEVOLVIDO_SECRETARIO: 'Devolvido — Correção',
  REPROVADO_SECRETARIO: 'Reprovado pelo Secretário',
```

```ts
  AGUARDANDO_SECRETARIO: 'bg-violet-100 text-violet-700',
  DEVOLVIDO_SECRETARIO: 'bg-amber-100 text-amber-700',
  REPROVADO_SECRETARIO: 'bg-red-100 text-red-700',
```

- [ ] **Step 3: Pass devolucaoMotivo to SolicitacaoFormClient**

Before the return, find the last DEVOLVIDO WorkflowStep and extract its justificativa:

```ts
  const ultimoStepDevolvido = sol.steps
    .filter(s => s.etapa === 'SECRETARIO' && s.decisao === 'DEVOLVIDO')
    .at(-1)
  const devolucaoMotivo = ultimoStepDevolvido?.observacao ?? undefined
```

Then pass to `SolicitacaoFormClient`:
```tsx
<SolicitacaoFormClient
  initialData={{ ...mappedData }}
  userName={sol.user.name ?? ''}
  solicitacaoStatus={sol.status}
  devolucaoMotivo={devolucaoMotivo}
/>
```

- [ ] **Step 4: Render SecretarioAprovacaoClient for SECRETARIO role**

Find the part of the page that renders `<SolicitacaoFormClient>` (the edit form shown when `role === 'DEMANDANTE'` and status is RASCUNHO/DEVOLVIDO). Add the SECRETARIO form condition:

```tsx
  {/* Secretary approval form */}
  {(role === 'SECRETARIO' || role === 'ADMIN') && sol.status === 'AGUARDANDO_SECRETARIO' && (
    <SecretarioAprovacaoClient
      solicitacao={{
        id: sol.id,
        nomeCompleto: sol.nomeCompleto,
        matricula: sol.matricula,
        cpf: sol.cpf,
        dataNascimento: sol.dataNascimento.toISOString().split('T')[0],
        celular: sol.celular,
        emailServidor: sol.emailServidor,
        justificativaPublica: sol.justificativaPublica,
        nexoCargo: sol.nexoCargo,
        destino: sol.destino,
        dataIda: sol.dataIda.toISOString().split('T')[0],
        dataVolta: sol.dataVolta.toISOString().split('T')[0],
        justificativaLocal: sol.justificativaLocal,
        fichaOrcamentaria: sol.fichaOrcamentaria,
        indicacaoVoo: sol.indicacaoVoo ?? '',
        indicacaoHospedagem: sol.indicacaoHospedagem ?? '',
      }}
    />
  )}
```

- [ ] **Step 5: Allow SECRETARIO to access any solicitacao in their secretaria**

In the access control section, after the `DEMANDANTE` check, add:
```ts
  if (role === 'SECRETARIO') {
    const sessionUser = session.user as { id: string; role: string; secretariaId?: string }
    if (sol.user.secretariaId !== sessionUser.secretariaId) notFound()
  }
```

Note: This requires fetching `secretariaId` on the user join. Update the Prisma include:
```ts
    include: {
      user: { select: { name: true, email: true, secretariaId: true } },
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add app/(portal)/solicitacoes/[id]/page.tsx
git commit -m "feat: add secretary approval form to solicitacao detail page"
```

---

## Task 14: Admin — SecretariasSection component

**Files:**
- Create: `app/(portal)/admin/components/SecretariasSection.tsx`

- [ ] **Step 1: Create the component**

Create `app/(portal)/admin/components/SecretariasSection.tsx`:

```tsx
'use client'
import { useState } from 'react'

type Secretaria = {
  id: string
  nome: string
  ativo: boolean
  createdAt: Date
  _count?: { users: number }
}

export default function SecretariasSection({ secretarias: initial }: { secretarias: Secretaria[] }) {
  const [secretarias, setSecretarias] = useState<Secretaria[]>(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Secretaria | null>(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    const res = await fetch('/api/admin/secretarias')
    if (res.ok) setSecretarias(await res.json())
  }

  function openCriar() {
    setNome(''); setEditTarget(null); setError(''); setModalOpen(true)
  }

  function openEditar(s: Secretaria) {
    setNome(s.nome); setEditTarget(s); setError(''); setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      let res: Response
      if (editTarget) {
        res = await fetch(`/api/admin/secretarias/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome }),
        })
      } else {
        res = await fetch('/api/admin/secretarias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome }),
        })
      }
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setModalOpen(false)
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAtivo(s: Secretaria) {
    setError('')
    const res = await fetch(`/api/admin/secretarias/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !s.ativo }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error); return }
    await reload()
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">Secretarias</h2>
        <button onClick={openCriar} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Nova Secretaria
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 font-bold text-slate-500 uppercase text-xs tracking-wider">Nome</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase text-xs tracking-wider">Usuários Ativos</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase text-xs tracking-wider">Status</th>
              <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase text-xs tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {secretarias.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{s.nome}</td>
                <td className="px-4 py-3 text-slate-600">{s._count?.users ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {s.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  <button onClick={() => openEditar(s)} className="text-blue-600 hover:underline text-xs font-medium">Editar</button>
                  <button onClick={() => toggleAtivo(s)} className="text-slate-500 hover:underline text-xs font-medium">
                    {s.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-slate-900">{editTarget ? 'Editar Secretaria' : 'Nova Secretaria'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Nome</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 h-10 text-sm focus:ring-2 focus:ring-blue-500"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add app/(portal)/admin/components/SecretariasSection.tsx
git commit -m "feat: add SecretariasSection admin component"
```

---

## Task 15: Admin — Update UsuariosSection + admin page

**Files:**
- Modify: `app/(portal)/admin/components/UsuariosSection.tsx`
- Modify: `app/(portal)/admin/page.tsx`

- [ ] **Step 1: Update UsuariosSection to include secretaria dropdown**

In `app/(portal)/admin/components/UsuariosSection.tsx`:

1. Add `secretariaId` to the `Usuario` type and `form` state:
```ts
type Usuario = {
  id: string; name: string; email: string; role: string
  cpfBloqueado: boolean | null; ativo: boolean | null; createdAt: Date
  secretariaId?: string | null
}

type Secretaria = { id: string; nome: string; ativo: boolean }
```

2. Add `secretarias` prop:
```ts
export default function UsuariosSection({ usuarios: initial, secretarias }: { usuarios: Usuario[], secretarias: Secretaria[] }) {
```

3. Add `secretariaId` to form state:
```ts
const [form, setForm] = useState({ name: '', email: '', role: 'DEMANDANTE', password: '', secretariaId: '' })
```

4. Update `openCriar` and `openEditar` to set `secretariaId`:
```ts
function openCriar() {
  setForm({ name: '', email: '', role: 'DEMANDANTE', password: '', secretariaId: '' })
  // ...
}

function openEditar(u: Usuario) {
  setForm({ name: u.name, email: u.email, role: u.role, password: '', secretariaId: u.secretariaId ?? '' })
  // ...
}
```

5. In the form modal, add a `Secretaria` dropdown after the `role` select:
```tsx
{(['DEMANDANTE', 'SECRETARIO'].includes(form.role)) && (
  <div>
    <label className="...">Secretaria <span className="text-red-500">*</span></label>
    <select
      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 h-10 text-sm"
      value={form.secretariaId}
      onChange={e => setForm(f => ({ ...f, secretariaId: e.target.value }))}
      required
    >
      <option value="">Selecione...</option>
      {secretarias.filter(s => s.ativo).map(s => (
        <option key={s.id} value={s.id}>{s.nome}</option>
      ))}
    </select>
  </div>
)}
```

6. Add `SECRETARIO` to `ROLE_LABELS` and `ROLE_BADGE` maps in UsuariosSection:
```ts
  SECRETARIO: 'Secretário(a)',
  // badge:
  SECRETARIO: 'bg-violet-100 text-violet-700',
```

7. Update the `handleSubmit` to include `secretariaId` in the POST/PATCH body:
```ts
body: JSON.stringify({ ...form }),  // secretariaId is already in form
```

- [ ] **Step 2: Update admin/page.tsx to fetch and pass secretarias**

In `app/(portal)/admin/page.tsx`:

1. Add import:
```ts
import SecretariasSection from './components/SecretariasSection'
```

2. Fetch secretarias in the data-fetching part:
```ts
  const secretarias = await prisma.secretaria.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { users: { where: { ativo: true } } } } },
  })
```

3. Pass secretarias to UsuariosSection:
```tsx
<UsuariosSection usuarios={usuarios} secretarias={secretarias} />
```

4. Add SecretariasSection after UsuariosSection:
```tsx
<SecretariasSection secretarias={secretarias} />
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add app/(portal)/admin/
git commit -m "feat: add Secretarias management to admin panel"
```

---

## Task 16: Secretary Dashboard Page

**Files:**
- Create: `app/(portal)/secretario/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/(portal)/secretario/page.tsx`:

```tsx
import React from 'react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = {
  AGUARDANDO_SECRETARIO: 'Aguardando Secretário',
  DEVOLVIDO_SECRETARIO: 'Devolvido — Correção',
  REPROVADO_SECRETARIO: 'Reprovado',
  AGUARDANDO_COTACAO: 'Cotação',
  AGUARDANDO_VIABILIDADE: 'Viabilidade',
  AGUARDANDO_EMISSAO: 'Emissão OS',
  AGUARDANDO_EXECUCAO: 'Execução',
  CONCLUIDA: 'Concluída',
  REPROVADA: 'Reprovada',
}

const STATUS_BADGE: Record<string, string> = {
  AGUARDANDO_SECRETARIO: 'bg-violet-100 text-violet-800',
  DEVOLVIDO_SECRETARIO: 'bg-amber-100 text-amber-800',
  REPROVADO_SECRETARIO: 'bg-rose-100 text-rose-800',
  AGUARDANDO_COTACAO: 'bg-amber-100 text-amber-800',
  AGUARDANDO_VIABILIDADE: 'bg-orange-100 text-orange-800',
  CONCLUIDA: 'bg-emerald-100 text-emerald-800',
  REPROVADA: 'bg-rose-100 text-rose-800',
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default async function SecretarioDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; role: string; secretariaId?: string }

  if (user.role !== 'SECRETARIO' && user.role !== 'ADMIN') {
    redirect('/portal/dashboard')
  }

  const secretariaId = user.secretariaId
  if (!secretariaId && user.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="font-medium">Sua conta não possui secretaria vinculada. Contate o administrador.</p>
      </div>
    )
  }

  const hoje = new Date()

  const [aguardando, historico, devolvidos] = await Promise.all([
    // Block 1: Pending secretary approval
    prisma.solicitacao.findMany({
      where: {
        status: 'AGUARDANDO_SECRETARIO',
        ...(secretariaId ? { user: { secretariaId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true } } },
    }),

    // Block 2: All non-draft requests from secretaria
    prisma.solicitacao.findMany({
      where: {
        status: { notIn: ['RASCUNHO', 'AGUARDANDO_SECRETARIO', 'DEVOLVIDO_SECRETARIO', 'REPROVADO_SECRETARIO'] },
        ...(secretariaId ? { user: { secretariaId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { name: true } },
        prestacao: { select: { enviadoEm: true, prazoFinal: true } },
      },
    }),

    // Block 3: Devolvidos / Reprovados
    prisma.solicitacao.findMany({
      where: {
        status: { in: ['DEVOLVIDO_SECRETARIO', 'REPROVADO_SECRETARIO'] },
        ...(secretariaId ? { user: { secretariaId } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { name: true } },
        steps: { where: { etapa: 'SECRETARIO' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
  ])

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <header className="flex items-center gap-4 border-b border-slate-200 pb-4 mb-6 sticky top-0 bg-[#f6f6f8]/80 backdrop-blur-md z-10 -mx-4 md:-mx-8 px-4 md:px-8 -mt-4 md:-mt-8">
        <h2 className="text-xl font-bold text-slate-900">Painel do Secretário</h2>
        <span className="px-2 py-1 rounded bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-widest">
          SECRETARIO
        </span>
      </header>

      {/* Block 1: Awaiting approval */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-900">Aguardando Aprovação</h3>
          {aguardando.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-violet-600 text-white text-xs font-bold">{aguardando.length}</span>
          )}
        </div>
        {aguardando.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <span className="material-symbols-outlined text-[40px] mb-2 block">check_circle</span>
            <p>Nenhuma solicitação aguardando aprovação</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Funcionário</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Datas</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Solicitado em</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aguardando.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.user.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.destino}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(s.dataIda)} — {formatDate(s.dataVolta)}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{formatDate(s.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/portal/solicitacoes/${s.id}`} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">
                        Analisar →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Block 2: History / in-progress */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="font-bold text-lg text-slate-900">Viagens em Andamento / Histórico</h3>
        </div>
        {historico.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Nenhuma viagem no histórico</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Funcionário</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Datas</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Prestação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historico.map(s => {
                  const p = s.prestacao
                  let prestacaoCell: React.ReactNode = <span className="text-slate-300 text-sm">—</span>
                  if (p) {
                    if (p.enviadoEm) {
                      prestacaoCell = <span className="text-emerald-600 text-sm font-medium">✅ Entregue</span>
                    } else if (new Date(p.prazoFinal) < hoje) {
                      prestacaoCell = (
                        <Link href={`/portal/solicitacoes/${s.id}/prestacao`} className="text-red-600 text-sm font-bold hover:underline">
                          ⚠ Em atraso
                        </Link>
                      )
                    } else {
                      prestacaoCell = (
                        <Link href={`/portal/solicitacoes/${s.id}/prestacao`} className="text-amber-600 text-sm font-medium hover:underline">
                          ⏳ Pendente
                        </Link>
                      )
                    }
                  }
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50 ${p && !p.enviadoEm && new Date(p.prazoFinal) < hoje ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.user.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{s.destino}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(s.dataIda)} — {formatDate(s.dataVolta)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{prestacaoCell}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Block 3: Devolvidos / Reprovados */}
      {devolvidos.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="font-bold text-lg text-slate-900">Devolvidos / Reprovados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Funcionário</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Motivo</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devolvidos.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.user.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.destino}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">
                      {s.steps[0]?.observacao ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{formatDate(s.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add app/(portal)/secretario/
git commit -m "feat: add secretary dashboard page"
```

---

## Task 17: Final Build and Verification

- [ ] **Step 1: Run full build**

```bash
cd "c:/automação/PortalViagens" && npm run build
```

Expected: No TypeScript errors, no build failures.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any lint warnings in modified files.

- [ ] **Step 3: Manual smoke test checklist**

- [ ] Login as ADMIN → go to Admin panel → create a Secretaria
- [ ] Go to Admin → create a DEMANDANTE user with the new Secretaria
- [ ] Create a SECRETARIO user with the same Secretaria
- [ ] Login as DEMANDANTE → create a new travel request → submit
- [ ] Verify status shows "Aguardando Secretário" in dashboard
- [ ] Verify `justificativaPublica` and `nexoCargo` fields are disabled in form
- [ ] Login as SECRETARIO → go to `/portal/secretario` → verify request appears in Block 1
- [ ] Click "Analisar" → fill in Detalhes da Missão → click "Aprovar"
- [ ] Verify status moves to "Aguardando Cotação"
- [ ] Test "Devolver" flow: fill justificativa → confirm → verify DEMANDANTE can resubmit
- [ ] Test "Reprovar" flow: fill justificativa → confirm → verify status is terminal
- [ ] Verify WorkflowTimeline shows SECRETARIO step
- [ ] Verify email logs in `/api/email-logs` (or JSON file) for all notification types

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete SECRETARIO approval workflow — all tasks complete"
```
