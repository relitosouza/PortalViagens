# Email Notifications — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Enviar emails para o setor/usuário responsável em cada transição do workflow de viagens.

**Architecture:** Criar `lib/email-notifications.ts` como módulo central com funções `notificarRole` (busca usuários do role no banco) e helpers por tipo de evento. Atualizar `solicitacoes/route.ts` e `workflow/[id]/route.ts` para usar o novo módulo.

**Tech Stack:** Next.js 15, TypeScript, Prisma (PostgreSQL), `lib/email-log.ts` (transporte atual: arquivo JSON)

---

### Task 1: Criar `lib/email-notifications.ts`

**Files:**
- Create: `lib/email-notifications.ts`

**Step 1: Criar o arquivo com as funções base e helpers**

```typescript
// lib/email-notifications.ts
import { prisma } from '@/lib/prisma'
import { logEmail } from '@/lib/email-log'
import { Solicitacao, User } from '@prisma/client'

type SolicitacaoComUser = Solicitacao & { user: User }

const APP_URL = () => process.env.APP_URL ?? 'http://localhost:3000'

/** Busca todos os usuários ativos do role e dispara logEmail para cada um */
export async function notificarRole(
  role: string,
  assunto: string,
  corpo: string,
  tipo: string
): Promise<void> {
  const usuarios = await prisma.user.findMany({
    where: { role, ativo: true },
  })
  for (const u of usuarios) {
    logEmail({ para: u.email, assunto, corpo, tipo })
  }
}

/** Notifica o demandante diretamente pelo emailServidor da solicitação */
export function notificarDemandante(
  sol: SolicitacaoComUser,
  assunto: string,
  corpo: string,
  tipo: string
): void {
  logEmail({ para: sol.emailServidor, assunto, corpo, tipo })
}

// ── Helpers por evento ────────────────────────────────────────────────────────

/** Demandante submeteu → notificar SECOL para cotar */
export async function notificarNovaSOlicitacaoParaSecol(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Nova solicitação aguardando cotação',
    `Uma nova solicitação de viagem para ${sol.destino} de ${sol.nomeCompleto} está aguardando cotação.\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
    'NOVA_SOLICITACAO_SECOL'
  )
}

/** SECOL concluiu cotação → notificar SEGOV para analisar viabilidade */
export async function notificarCotacaoParaSegov(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SEGOV',
    '[Viagens Osasco] Solicitação aguardando análise de viabilidade',
    `A cotação da viagem para ${sol.destino} de ${sol.nomeCompleto} foi concluída pela SECOL. A solicitação aguarda análise de viabilidade.\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
    'NOVA_VIABILIDADE_SEGOV'
  )
}

/** SEGOV aprovou viabilidade → notificar SECOL para emitir vouchers */
export async function notificarViabilidadeAprovadaParaSecol(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Viabilidade aprovada — emitir vouchers',
    `A viabilidade da viagem para ${sol.destino} de ${sol.nomeCompleto} foi aprovada. A solicitação aguarda emissão dos vouchers.\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
    'EMISSAO_NECESSARIA_SECOL'
  )
}

/** SEGOV pediu ajuste de cotação → notificar SECOL */
export async function notificarAjusteParaSecol(
  sol: SolicitacaoComUser,
  observacao: string | null
): Promise<void> {
  await notificarRole(
    'SECOL',
    '[Viagens Osasco] Ajuste necessário na cotação',
    `A SEGOV solicitou ajuste na cotação da viagem para ${sol.destino} de ${sol.nomeCompleto}.\n\nMotivo: ${observacao || 'Não informado'}\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
    'AJUSTE_SECOL'
  )
}

/** SEGOV pediu ajuste ao demandante → notificar demandante */
export function notificarAjusteParaDemandante(
  sol: SolicitacaoComUser,
  observacao: string | null
): void {
  notificarDemandante(
    sol,
    '[Viagens Osasco] Ajuste necessário na sua solicitação',
    `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} precisa de ajustes.\n\nMotivo: ${observacao || 'Não informado'}\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
    'AJUSTE_DEMANDANTE'
  )
}

/** SECOL emitiu vouchers → notificar SF para confirmar execução */
export async function notificarEmissaoParaSf(
  sol: SolicitacaoComUser
): Promise<void> {
  await notificarRole(
    'SF',
    '[Viagens Osasco] Vouchers emitidos — aguardando execução',
    `Os vouchers da viagem para ${sol.destino} de ${sol.nomeCompleto} foram emitidos. A solicitação aguarda confirmação de execução.\n\nAcesse: ${APP_URL()}/solicitacoes/${sol.id}`,
    'EXECUCAO_SF'
  )
}
```

**Step 2: Verificar build**

```bash
npm run build
```

Expected: sem erros de TypeScript no novo arquivo.

**Step 3: Commit**

```bash
git add lib/email-notifications.ts
git commit -m "feat: add email-notifications module with per-role helpers"
```

---

### Task 2: Notificar SECOL ao submeter solicitação

**Files:**
- Modify: `app/api/solicitacoes/route.ts`

**Context:** O POST em `solicitacoes/route.ts` cria a solicitação com status `AGUARDANDO_COTACAO` quando `!isRascunho` (linha 56). Falta notificar a SECOL.

**Step 1: Adicionar import do novo módulo**

Após a linha 5 (`import { calcularDiasUteisAte } from '@/lib/utils/diasUteis'`), adicionar:

```typescript
import { notificarNovaSOlicitacaoParaSecol } from '@/lib/email-notifications'
```

**Step 2: Disparar notificação após criar solicitação**

Substituir o bloco final (linhas 39-61):

```typescript
  const solicitacao = await prisma.solicitacao.create({
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
      status: isRascunho ? 'RASCUNHO' : 'AGUARDANDO_COTACAO',
      userId: user.id,
    },
    include: { user: true },
  })

  if (!isRascunho) {
    notificarNovaSOlicitacaoParaSecol(solicitacao).catch(() => {})
  }

  return NextResponse.json(solicitacao, { status: 201 })
```

> Nota: Adicionar `include: { user: true }` ao `prisma.solicitacao.create` para satisfazer o tipo `SolicitacaoComUser`. O `.catch(() => {})` garante que falha no email não quebra a criação.

**Step 3: Verificar build**

```bash
npm run build
```

Expected: sem erros.

**Step 4: Commit**

```bash
git add app/api/solicitacoes/route.ts
git commit -m "feat: notify SECOL by email when new travel request is submitted"
```

---

### Task 3: Cobrir todas as transições no workflow route

**Files:**
- Modify: `app/api/workflow/[id]/route.ts`

**Context:** O route atual (`app/api/workflow/[id]/route.ts`) já usa `logEmail` diretamente para 3 casos. Vamos substituir por funções do novo módulo e adicionar os casos faltantes.

**Step 1: Substituir o import de `logEmail` pelo de `email-notifications`**

Remover a linha:
```typescript
import { logEmail } from '@/lib/email-log'
```

Adicionar no lugar:
```typescript
import {
  notificarCotacaoParaSegov,
  notificarViabilidadeAprovadaParaSecol,
  notificarAjusteParaSecol,
  notificarAjusteParaDemandante,
  notificarEmissaoParaSf,
  notificarDemandante,
} from '@/lib/email-notifications'
```

**Step 2: Substituir e expandir o bloco de notificações (linhas 121-157)**

Localizar o bloco que começa em `// Lógica especial para etapa de EXECUÇÃO aprovada` e o que vem após. Substituir **todo o bloco de notificações** (de `// Lógica especial para etapa de EXECUÇÃO` até o final antes do `return`) por:

```typescript
  // ── Notificações por email ────────────────────────────────────────────────

  // COTACAO aprovada → demandante (atualização) + SEGOV (próxima ação)
  if (transicao.etapa === 'COTACAO' && decisao === 'APROVADO') {
    notificarDemandante(
      sol,
      '[Viagens Osasco] Cotação concluída — aguardando análise de viabilidade',
      `Prezado(a) ${sol.nomeCompleto},\n\nA cotação da sua viagem para ${sol.destino} foi concluída pela SECOL. A solicitação aguarda análise de viabilidade pela SEGOV.`,
      'COTACAO_CONCLUIDA'
    )
    notificarCotacaoParaSegov(sol).catch(() => {})
  }

  // VIABILIDADE aprovada → SECOL (emitir vouchers) + débito de empenho (já feito acima)
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'APROVADO') {
    notificarViabilidadeAprovadaParaSecol(sol).catch(() => {})
  }

  // VIABILIDADE ajuste SECOL → SECOL recota
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'AJUSTE_SECOL') {
    notificarAjusteParaSecol(sol, observacao).catch(() => {})
  }

  // VIABILIDADE ajuste demandante → demandante corrige rascunho
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'AJUSTE_DEMANDANTE') {
    notificarAjusteParaDemandante(sol, observacao)
  }

  // VIABILIDADE reprovada → demandante
  if (decisao === 'REPROVADO') {
    notificarDemandante(
      sol,
      '[Viagens Osasco] ❌ Solicitação reprovada',
      `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi REPROVADA.\n\nMotivo: ${observacao || 'Não informado'}\n\nPara mais informações, acesse: ${process.env.APP_URL ?? 'http://localhost:3000'}/solicitacoes/${sol.id}`,
      'REPROVACAO'
    )
  }

  // EMISSAO aprovada → SF executa
  if (transicao.etapa === 'EMISSAO' && decisao === 'APROVADO') {
    notificarEmissaoParaSf(sol).catch(() => {})
  }

  // EXECUCAO aprovada → demandante (vouchers + prestação de contas)
  if (transicao.etapa === 'EXECUCAO' && decisao === 'APROVADO') {
    const prazoFinal = addDiasUteis(new Date(sol.dataVolta), 5)

    await prisma.prestacao.upsert({
      where: { solicitacaoId: sol.id },
      update: {},
      create: { solicitacaoId: sol.id, prazoFinal },
    })

    notificarDemandante(
      sol,
      '[Viagens Osasco] ✅ Viagem aprovada — acesse seus vouchers',
      `Prezado(a) ${sol.nomeCompleto},\n\nSua solicitação de viagem para ${sol.destino} foi APROVADA e os vouchers estão disponíveis no sistema.\n\nPrazo para prestação de contas: ${prazoFinal.toLocaleDateString('pt-BR')} (5 dias úteis após o retorno).\n\nAcesse o sistema: ${process.env.APP_URL ?? 'http://localhost:3000'}/solicitacoes/${sol.id}`,
      'VOUCHER_APROVACAO'
    )
  }
```

> **Atenção:** O bloco de débito de empenho (VIABILIDADE + APROVADO, linhas 86-118 do original) deve ser mantido **intacto** antes das notificações. Apenas o bloco de notificações abaixo dele é substituído.

**Step 3: Remover o bloco antigo de prestacao/upsert e o bloco de notificações que estava separado**

Depois de aplicar o Step 2, confirmar que não existe mais código duplicado de `logEmail` ou `prisma.prestacao.upsert` no arquivo.

**Step 4: Verificar build**

```bash
npm run build
```

Expected: sem erros. Se o TypeScript reclamar do tipo de `sol` (sem `user`), adicionar `include: { user: true }` ao `prisma.solicitacao.findUnique` na linha 49 do original.

**Step 5: Commit**

```bash
git add app/api/workflow/[id]/route.ts
git commit -m "feat: complete email notifications for all workflow phase transitions"
```

---

### Task 4: Smoke test manual

**Step 1: Iniciar o servidor**

```bash
npm run dev
```

**Step 2: Submeter uma solicitação como DEMANDANTE**

- Logar como usuário DEMANDANTE
- Criar uma nova solicitação (não rascunho)
- Verificar `email-logs.json`: deve aparecer entrada `NOVA_SOLICITACAO_SECOL`

**Step 3: Avançar cada etapa e verificar o log**

| Ação | Tipo esperado em email-logs.json |
|------|----------------------------------|
| SECOL aprova cotação | `COTACAO_CONCLUIDA` + `NOVA_VIABILIDADE_SEGOV` |
| SEGOV aprova viabilidade | `EMISSAO_NECESSARIA_SECOL` |
| SEGOV pede ajuste SECOL | `AJUSTE_SECOL` |
| SEGOV pede ajuste demandante | `AJUSTE_DEMANDANTE` |
| SEGOV reprova | `REPROVACAO` |
| SECOL emite vouchers | `EXECUCAO_SF` |
| SF aprova execução | `VOUCHER_APROVACAO` |

**Step 4: Commit final se tudo ok**

```bash
git add .
git commit -m "chore: verify email notifications smoke test complete"
```
