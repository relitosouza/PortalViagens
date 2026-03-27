# Email Lembretes por Fase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 3 lacunas de notificação nas transições do SECRETÁRIO e adicionar lembretes automáticos diários por fase com escalonamento para SEGOV após 5 dias.

**Architecture:** Dois campos novos em `Solicitacao` (`ultimoLembrete`, `qtdLembretes`) controlam o estado dos lembretes. Uma API route GET `/api/cron/lembretes` (autenticada por `CRON_SECRET`) processa as solicitações pendentes diariamente. Ao avançar de fase, os contadores são resetados.

**Tech Stack:** Next.js 15, Prisma 5, PostgreSQL, Nodemailer (Gmail), TypeScript

---

## File Map

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Modificar — adicionar `ultimoLembrete` e `qtdLembretes` a `Solicitacao` |
| `lib/email-notifications.ts` | Modificar — adicionar 5 novas funções de notificação |
| `app/api/workflow/[id]/route.ts` | Modificar — 3 novos disparos de email + reset de contadores |
| `app/api/cron/lembretes/route.ts` | Criar — endpoint do cron diário |

---

## Task 1: Adicionar campos ao schema Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos ao modelo Solicitacao**

Abrir `prisma/schema.prisma` e localizar o modelo `Solicitacao`. Adicionar as duas linhas após `updatedAt`:

```prisma
model Solicitacao {
  id                   String         @id @default(cuid())
  nomeCompleto         String
  matricula            String
  cpf                  String
  dataNascimento       DateTime
  celular              String
  emailServidor        String
  justificativaPublica String
  nexoCargo            String
  destino              String
  dataIda              DateTime
  dataVolta            DateTime
  justificativaLocal   String
  fichaOrcamentaria    String
  indicacaoVoo         String?
  indicacaoHospedagem  String?
  status               String         @default("RASCUNHO")
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt
  ultimoLembrete       DateTime?
  qtdLembretes         Int            @default(0)
  userId               String
  user                 User           @relation(fields: [userId], references: [id])
  secretariaId         String?
  secretaria           Secretaria?    @relation(fields: [secretariaId], references: [id])
  anexos               Anexo[]
  steps                WorkflowStep[]
  prestacao            Prestacao?
}
```

- [ ] **Step 2: Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name add-lembrete-fields
```

Saída esperada: `The following migration(s) have been applied: ..._add-lembrete-fields`

- [ ] **Step 3: Verificar que o client foi gerado**

```bash
npx prisma generate
```

Saída esperada: `Generated Prisma Client`

- [ ] **Step 4: Verificar build sem erros**

```bash
npm run build 2>&1 | tail -5
```

Saída esperada: sem erros de TypeScript relacionados a `ultimoLembrete` ou `qtdLembretes`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: adiciona ultimoLembrete e qtdLembretes à Solicitacao"
```

---

## Task 2: Adicionar funções de notificação em email-notifications.ts

**Files:**
- Modify: `lib/email-notifications.ts`

- [ ] **Step 1: Adicionar as 5 novas funções ao final do arquivo**

Abrir `lib/email-notifications.ts` e adicionar ao final (após a última função existente):

```ts
/** SECRETARIO aprovou → notificar SECOL para iniciar cotação */
export async function notificarSecretarioAprovacaoParaSecol(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Nova solicitação aguardando cotação',
    `A solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} foi aprovada pelo Secretário e aguarda cotação.\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'SECRETARIO_APROVACAO_SECOL'
  )
}

/** SECRETARIO pediu ajuste → notificar DEMANDANTE */
export function notificarSecretarioAjusteParaDemandante(
  sol: SolicitacaoComUser,
  observacao: string | null
): void {
  notificarDemandante(
    sol,
    '[Viagens Osasco] Ajuste necessário na sua solicitação',
    `Prezado(a) ${sol.nomeCompleto},\n\nO Secretário solicitou ajuste na sua viagem para ${sol.destino}.\n\nMotivo: ${observacao ?? 'Não informado'}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'SECRETARIO_AJUSTE_DEMANDANTE'
  )
}

/** SECRETARIO reprovou → notificar DEMANDANTE */
export function notificarSecretarioReprovacaoParaDemandante(
  sol: SolicitacaoComUser,
  observacao: string | null
): void {
  notificarDemandante(
    sol,
    '[Viagens Osasco] ❌ Solicitação reprovada pelo Secretário',
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi REPROVADA pelo Secretário.\n\nMotivo: ${observacao ?? 'Não informado'}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'SECRETARIO_REPROVACAO_DEMANDANTE'
  )
}

const FASE_LABELS: Record<string, string> = {
  AGUARDANDO_APROVACAO_PASTA: 'aprovação do Secretário',
  EM_COTACAO: 'cotação pela SECOL',
  AGUARDANDO_VIABILIDADE: 'análise de viabilidade pela SEGOV',
  AGUARDANDO_EMISSAO: 'emissão de vouchers pela SECOL',
  AGUARDANDO_EXECUCAO: 'confirmação de execução pela SF',
  DEVOLVIDO_SECRETARIO: 'correção pelo servidor demandante',
}

const FASE_ROLE_MAP: Record<string, string> = {
  EM_COTACAO: 'SECOL',
  AGUARDANDO_VIABILIDADE: 'SEGOV',
  AGUARDANDO_EMISSAO: 'SECOL',
  AGUARDANDO_EXECUCAO: 'SF',
}

/** Lembrete diário para o responsável da fase atual */
export async function notificarLembreteFase(
  sol: SolicitacaoComUser
): Promise<void> {
  const dias = sol.qtdLembretes + 1
  const faseLabel = FASE_LABELS[sol.status] ?? sol.status
  const link = `${APP_URL}/solicitacoes/${sol.id}`

  if (sol.status === 'DEVOLVIDO_SECRETARIO') {
    notificarDemandante(
      sol,
      `[Viagens Osasco] Lembrete: sua solicitação aguarda correção (dia ${dias})`,
      `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} aguarda correção há ${dias} dia(s).\n\nPor favor, realize os ajustes solicitados.\n\nAcesse: ${link}`,
      'LEMBRETE_DEMANDANTE'
    )
    return
  }

  if (sol.status === 'AGUARDANDO_APROVACAO_PASTA') {
    if (!sol.secretariaId) return
    const usuarios = await prisma.user.findMany({
      where: { role: 'SECRETARIO', secretariaId: sol.secretariaId, ativo: true },
    })
    for (const u of usuarios) {
      try {
        logEmail({
          para: u.email,
          assunto: `[Viagens Osasco] Lembrete: solicitação aguardando sua aprovação (dia ${dias})`,
          corpo: `Prezado(a) Secretário(a),\n\nA solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} aguarda sua aprovação há ${dias} dia(s).\n\nAcesse: ${link}`,
          tipo: 'LEMBRETE_SECRETARIO',
        })
      } catch { /* silent */ }
    }
    return
  }

  const role = FASE_ROLE_MAP[sol.status]
  if (!role) return

  await notificarRole(
    role,
    `[Viagens Osasco] Lembrete: solicitação aguardando ${faseLabel} (dia ${dias})`,
    `A solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} aguarda ${faseLabel} há ${dias} dia(s).\n\nAcesse: ${link}`,
    `LEMBRETE_${role}`
  )
}

/** Escalonamento para SEGOV após 5 dias sem ação */
export async function notificarEscalonamento(
  sol: SolicitacaoComUser
): Promise<void> {
  const faseLabel = FASE_LABELS[sol.status] ?? sol.status
  await notificarRole(
    'SEGOV',
    '[Viagens Osasco] ⚠️ Escalonamento: solicitação parada há 5 dias',
    `A solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} está aguardando ${faseLabel} há 5 dias sem ação.\n\nStatus atual: ${sol.status}\n\nAcesse: ${APP_URL}/solicitacoes/${sol.id}`,
    'ESCALAMENTO_SEGOV'
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -10
```

Saída esperada: sem erros de TypeScript em `lib/email-notifications.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/email-notifications.ts
git commit -m "feat: adiciona notificações do SECRETÁRIO e funções de lembrete/escalonamento"
```

---

## Task 3: Corrigir transições do SECRETÁRIO e resetar contadores no workflow

**Files:**
- Modify: `app/api/workflow/[id]/route.ts`

- [ ] **Step 1: Atualizar imports no topo do arquivo**

Localizar a linha de import de `email-notifications` (linha 4-12 do arquivo atual) e adicionar as 3 novas funções:

```ts
import {
  notificarCotacaoParaSegov,
  notificarViabilidadeAprovadaParaSecol,
  notificarAjusteParaSecol,
  notificarAjusteParaDemandante,
  notificarEmissaoParaSf,
  notificarDemandante,
  notificarRole,
  notificarSecretarioAprovacaoParaSecol,
  notificarSecretarioAjusteParaDemandante,
  notificarSecretarioReprovacaoParaDemandante,
} from '@/lib/email-notifications'
```

- [ ] **Step 2: Resetar contadores ao atualizar status**

Localizar o bloco `await prisma.solicitacao.update` que atualiza apenas `status` (em torno da linha 97) e substituir por:

```ts
await prisma.solicitacao.update({
  where: { id: sol.id },
  data: {
    status: transicao.proximoStatus,
    ultimoLembrete: null,
    qtdLembretes: 0,
  },
})
```

- [ ] **Step 3: Adicionar os 3 disparos de email do SECRETÁRIO**

Localizar o bloco de comentário `// ── Notificações por email` (após a lógica de débito de empenhos) e adicionar os 3 novos blocos **antes** do bloco `// COTACAO aprovada`:

```ts
  // SECRETARIO aprovado → SECOL cota
  if (transicao.etapa === 'SECRETARIO' && decisao === 'APROVADO') {
    notificarSecretarioAprovacaoParaSecol(sol).catch(() => {})
  }

  // SECRETARIO ajuste demandante → demandante corrige
  if (transicao.etapa === 'SECRETARIO' && decisao === 'AJUSTE_DEMANDANTE') {
    notificarSecretarioAjusteParaDemandante(sol, observacao)
  }

  // SECRETARIO reprovado → demandante
  if (transicao.etapa === 'SECRETARIO' && decisao === 'REPROVADO') {
    notificarSecretarioReprovacaoParaDemandante(sol, observacao)
  }
```

- [ ] **Step 4: Verificar build**

```bash
npm run build 2>&1 | tail -10
```

Saída esperada: sem erros de TypeScript em `app/api/workflow/[id]/route.ts`.

- [ ] **Step 5: Commit**

```bash
git add app/api/workflow/[id]/route.ts
git commit -m "feat: notificações do SECRETÁRIO e reset de contadores de lembrete ao avançar fase"
```

---

## Task 4: Criar endpoint do cron de lembretes

**Files:**
- Create: `app/api/cron/lembretes/route.ts`

- [ ] **Step 1: Criar o arquivo do endpoint**

Criar o arquivo `app/api/cron/lembretes/route.ts` com o seguinte conteúdo:

```ts
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notificarLembreteFase, notificarEscalonamento } from '@/lib/email-notifications'

const FASES_PENDENTES = [
  'AGUARDANDO_APROVACAO_PASTA',
  'EM_COTACAO',
  'AGUARDANDO_VIABILIDADE',
  'AGUARDANDO_EMISSAO',
  'AGUARDANDO_EXECUCAO',
  'DEVOLVIDO_SECRETARIO',
]

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()
  const limite24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000)

  const solicitacoes = await prisma.solicitacao.findMany({
    where: {
      status: { in: FASES_PENDENTES },
      OR: [
        { ultimoLembrete: null },
        { ultimoLembrete: { lte: limite24h } },
      ],
    },
    include: { user: true },
  })

  let lembretes = 0
  let escalamentos = 0

  for (const sol of solicitacoes) {
    try {
      if (sol.qtdLembretes < 5) {
        await notificarLembreteFase(sol)
        lembretes++
      } else if (sol.qtdLembretes === 5) {
        await notificarEscalonamento(sol)
        escalamentos++
      }
      // qtdLembretes > 5: já escalou, não envia mais

      await prisma.solicitacao.update({
        where: { id: sol.id },
        data: {
          ultimoLembrete: agora,
          qtdLembretes: { increment: 1 },
        },
      })
    } catch (err) {
      console.error(`[cron/lembretes] Erro na solicitação ${sol.id}:`, err)
    }
  }

  console.log(`[cron/lembretes] processadas=${solicitacoes.length} lembretes=${lembretes} escalamentos=${escalamentos}`)

  return NextResponse.json({
    ok: true,
    processadas: solicitacoes.length,
    lembretes,
    escalamentos,
  })
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -10
```

Saída esperada: sem erros. A rota `/api/cron/lembretes` deve aparecer no output do build.

- [ ] **Step 3: Testar o endpoint manualmente**

Com o servidor rodando (`npm run dev`), executar:

```bash
curl -s -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/cron/lembretes
```

Saída esperada (sem solicitações pendentes):
```json
{ "ok": true, "processadas": 0, "lembretes": 0, "escalamentos": 0 }
```

Testar sem o header de autenticação:

```bash
curl -s http://localhost:3000/api/cron/lembretes
```

Saída esperada:
```json
{ "error": "Não autorizado" }
```

- [ ] **Step 4: Adicionar CRON_SECRET ao .env.example (se existir) ou documentar no README**

Se existir `.env.example` no projeto, adicionar:
```
CRON_SECRET=seu-token-secreto-aqui
```

Se não existir `.env.example`, adicionar `CRON_SECRET` ao `.env.local` com um valor de teste.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/lembretes/route.ts
git commit -m "feat: endpoint GET /api/cron/lembretes para lembretes automáticos diários"
```

---

## Task 5: Configuração opcional do Vercel Cron

**Files:**
- Create or Modify: `vercel.json`

- [ ] **Step 1: Verificar se vercel.json existe**

```bash
ls vercel.json 2>/dev/null && echo "existe" || echo "não existe"
```

- [ ] **Step 2a: Se não existir — criar vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/lembretes",
      "schedule": "0 8 * * *"
    }
  ]
}
```

*(Roda todo dia às 8h UTC. Para 8h no horário de Brasília (UTC-3), usar `"0 11 * * *"`)*

- [ ] **Step 2b: Se já existir — adicionar a entry de cron ao array `"crons"` existente**

Verificar o conteúdo atual e adicionar:
```json
{ "path": "/api/cron/lembretes", "schedule": "0 11 * * *" }
```

- [ ] **Step 3: Adicionar CRON_SECRET nas variáveis de ambiente do Vercel**

No painel do Vercel: Settings → Environment Variables → adicionar `CRON_SECRET` com um valor seguro (ex.: gerado por `openssl rand -hex 32`).

O Vercel injeta automaticamente o header `Authorization: Bearer <CRON_SECRET>` nas chamadas de cron quando a variável está configurada.

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat: configurar Vercel Cron para lembretes diários às 8h"
```

---

## Resumo das Variáveis de Ambiente Necessárias

| Variável | Descrição | Onde configurar |
|---|---|---|
| `CRON_SECRET` | Token de autenticação do cron | `.env.local` + Vercel/servidor |
| `EMAIL_USER` | Já existente | — |
| `EMAIL_PASSWORD` | Já existente | — |
| `APP_URL` | Já existente | — |
