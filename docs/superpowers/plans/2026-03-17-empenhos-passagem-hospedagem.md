# Empenhos Separados: Passagem e Hospedagem — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two separate budget commitments (empenhos) — one for airfare (passagem) and one for lodging (hospedagem) — with automatic debit on SEGOV approval and SF notification on overdraft.

**Architecture:** Six new `ConfiguracaoSistema` keys track numbers/totals/balances for each empenho. `WorkflowStep` gains two nullable float fields to store cotação values. The SECOL UI auto-calculates values from the form, SEGOV sees the new cards, and the route.ts debit block is replaced with a `prisma.$transaction()` that debits both empenhos and notifies SF on overdraft.

**Tech Stack:** Prisma (SQLite/better-sqlite3), Next.js 15 App Router, React 19, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-17-empenhos-passagem-hospedagem-design.md`

---

## Chunk 1: Foundation — Schema + Seed + ParametrosSection

**Files:**
- Modify: `prisma/schema.prisma:59-69`
- Modify: `prisma/seed.ts:21-29`
- Modify: `app/(portal)/admin/components/ParametrosSection.tsx:12-50` (PARAM_LABELS) and `:95-103` (displayOrder)

---

- [ ] **Step 1: Add valorPassagem and valorHospedagem to WorkflowStep in schema.prisma**

  In `prisma/schema.prisma`, the `WorkflowStep` model ends at line 69. Add the two new fields before the closing `}`:

  Find this block (lines 59–69):
  ```prisma
  model WorkflowStep {
    id            String      @id @default(cuid())
    solicitacaoId String
    etapa         String
    atorRole      String
    atorNome      String
    decisao       String?
    observacao    String?
    createdAt     DateTime    @default(now())
    solicitacao   Solicitacao @relation(fields: [solicitacaoId], references: [id])
  }
  ```

  Replace with:
  ```prisma
  model WorkflowStep {
    id              String      @id @default(cuid())
    solicitacaoId   String
    etapa           String
    atorRole        String
    atorNome        String
    decisao         String?
    observacao      String?
    valorPassagem   Float?
    valorHospedagem Float?
    createdAt       DateTime    @default(now())
    solicitacao     Solicitacao @relation(fields: [solicitacaoId], references: [id])
  }
  ```

- [ ] **Step 2: Run Prisma migration**

  ```bash
  cd C:/projects/PortalViagens && npx prisma migrate dev --name add-valor-passagem-hospedagem
  ```

  Expected: Migration created and applied. SQLite database updated with two new nullable columns on `WorkflowStep`.

- [ ] **Step 3: Add 6 new seed entries in prisma/seed.ts**

  In `prisma/seed.ts`, the `parametros` array ends with `SALDO_EMPENHO` (line 28). Add after the last entry (before the closing `]`):

  Replace the closing part of the array from:
  ```ts
    { chave: 'SALDO_EMPENHO', valor: '100000.00', descricao: 'Saldo disponível no empenho' },
  ]
  ```

  With:
  ```ts
    { chave: 'SALDO_EMPENHO', valor: '100000.00', descricao: 'Saldo disponível no empenho' },
    { chave: 'NUMERO_EMPENHO_PASSAGEM', valor: '2026/0002', descricao: 'Número do empenho para passagens aéreas' },
    { chave: 'VALOR_EMPENHO_PASSAGEM', valor: '50000.00', descricao: 'Valor total do empenho para passagens' },
    { chave: 'SALDO_EMPENHO_PASSAGEM', valor: '50000.00', descricao: 'Saldo disponível no empenho de passagens' },
    { chave: 'NUMERO_EMPENHO_HOSPEDAGEM', valor: '2026/0003', descricao: 'Número do empenho para hospedagem' },
    { chave: 'VALOR_EMPENHO_HOSPEDAGEM', valor: '50000.00', descricao: 'Valor total do empenho para hospedagem' },
    { chave: 'SALDO_EMPENHO_HOSPEDAGEM', valor: '50000.00', descricao: 'Saldo disponível no empenho de hospedagem' },
  ]
  ```

- [ ] **Step 4: Run seed to populate new config keys**

  ```bash
  cd C:/projects/PortalViagens && npx prisma db seed
  ```

  Expected: "Seed concluído. Senha padrão: senha123" — the 6 new records are upserted.

- [ ] **Step 5: Add 6 new PARAM_LABELS entries in ParametrosSection.tsx**

  In `app/(portal)/admin/components/ParametrosSection.tsx`, find the `PARAM_LABELS` object. After the `SALDO_EMPENHO` entry (around line 50), add before the closing `}`:

  Replace:
  ```ts
    SALDO_EMPENHO: {
      label: 'Saldo disponível em Empenho',
      hint: 'Valor atualizado após débitos das solicitações aprovadas.',
      unit: 'R$',
      type: 'number',
    },
  }
  ```

  With:
  ```ts
    SALDO_EMPENHO: {
      label: 'Saldo disponível em Empenho',
      hint: 'Valor atualizado após débitos das solicitações aprovadas.',
      unit: 'R$',
      type: 'number',
    },
    NUMERO_EMPENHO_PASSAGEM: { label: 'Número do Empenho — Passagens', hint: 'Empenho específico para passagens aéreas.', unit: 'Nº', type: 'text' },
    VALOR_EMPENHO_PASSAGEM: { label: 'Valor Total — Empenho Passagens', hint: 'Cota autorizada para passagens no período.', unit: 'R$', type: 'number' },
    SALDO_EMPENHO_PASSAGEM: { label: 'Saldo Disponível — Passagens', hint: 'Saldo atualizado após débitos de passagens aprovadas.', unit: 'R$', type: 'number' },
    NUMERO_EMPENHO_HOSPEDAGEM: { label: 'Número do Empenho — Hospedagem', hint: 'Empenho específico para hospedagem.', unit: 'Nº', type: 'text' },
    VALOR_EMPENHO_HOSPEDAGEM: { label: 'Valor Total — Empenho Hospedagem', hint: 'Cota autorizada para hospedagem no período.', unit: 'R$', type: 'number' },
    SALDO_EMPENHO_HOSPEDAGEM: { label: 'Saldo Disponível — Hospedagem', hint: 'Saldo atualizado após débitos de hospedagem aprovados.', unit: 'R$', type: 'number' },
  }
  ```

- [ ] **Step 6: Add 6 new keys to displayOrder in ParametrosSection.tsx**

  Find the `displayOrder` array (around line 95):
  ```ts
  const displayOrder = [
    'NUMERO_EMPENHO',
    'VALOR_EMPENHO',
    'SALDO_EMPENHO',
    'DIAS_UTEIS_ANTECEDENCIA_MINIMA',
    'DIAS_UTEIS_PRAZO_PRESTACAO',
    'DIAS_ALERTA_VENCIMENTO',
    'UPLOAD_MAX_MB'
  ]
  ```

  Replace with:
  ```ts
  const displayOrder = [
    'NUMERO_EMPENHO',
    'VALOR_EMPENHO',
    'SALDO_EMPENHO',
    'NUMERO_EMPENHO_PASSAGEM',
    'VALOR_EMPENHO_PASSAGEM',
    'SALDO_EMPENHO_PASSAGEM',
    'NUMERO_EMPENHO_HOSPEDAGEM',
    'VALOR_EMPENHO_HOSPEDAGEM',
    'SALDO_EMPENHO_HOSPEDAGEM',
    'DIAS_UTEIS_ANTECEDENCIA_MINIMA',
    'DIAS_UTEIS_PRAZO_PRESTACAO',
    'DIAS_ALERTA_VENCIMENTO',
    'UPLOAD_MAX_MB'
  ]
  ```

- [ ] **Step 7: Verify build**

  ```bash
  cd C:/projects/PortalViagens && npm run build 2>&1 | tail -20
  ```

  Expected: Build succeeds (or only pre-existing errors — no new TypeScript errors from this chunk).

- [ ] **Step 8: Commit**

  ```bash
  cd C:/projects/PortalViagens && git add prisma/schema.prisma prisma/seed.ts app/\(portal\)/admin/components/ParametrosSection.tsx prisma/migrations && git commit -m "feat: add separate passagem/hospedagem empenho fields to schema and admin config"
  ```

---

## Chunk 2: SECOL Cotação Input — SecolCotacaoClient

**Files:**
- Modify: `components/SecolCotacaoClient.tsx`

**Goal:** Auto-calculate passagem/hospedagem values from the form; let SECOL override; send both values in the POST body to the workflow API.

---

- [ ] **Step 1: Expand budgetData prop type in SecolCotacaoClient.tsx**

  Find the `Props` type (lines 39–48):
  ```ts
  type Props = {
    sol: Solicitacao
    userName: string
    initialQuotes?: string | null
    budgetData?: {
      numeroEmpenho?: string
      valorEmpenho?: string
      saldoEmpenho?: string
    }
  }
  ```

  Replace with:
  ```ts
  type Props = {
    sol: Solicitacao
    userName: string
    initialQuotes?: string | null
    budgetData?: {
      numeroEmpenho?: string
      valorEmpenho?: string
      saldoEmpenho?: string
      numeroEmpenhoPassagem?: string
      valorEmpenhoPassagem?: string
      saldoEmpenhoPassagem?: string
      numeroEmpenhoHospedagem?: string
      valorEmpenhoHospedagem?: string
      saldoEmpenhoHospedagem?: string
    }
  }
  ```

- [ ] **Step 2: Add 4 new state variables after the existing state declarations**

  Find the block of state declarations starting with `const [voos, setVoos]` (around line 55). After `const [editingHotelId, setEditingHotelId] = useState<number | null>(null)` (line 67), add:

  ```ts
  const [valorPassagemStr, setValorPassagemStr] = useState<string>('0')
  const [valorHospedagemStr, setValorHospedagemStr] = useState<string>('0')
  const [valorPassagemEditado, setValorPassagemEditado] = useState(false)
  const [valorHospedagemEditado, setValorHospedagemEditado] = useState(false)
  ```

- [ ] **Step 3: Add two auto-calculation useEffects after the existing useEffect (after line 132)**

  Find the closing `}, [initialQuotes])` of the existing `useEffect` that restores quotes (line 132). After it, add:

  ```ts
  useEffect(() => {
    if (valorPassagemEditado) return
    const total = voos.reduce((acc, v) => acc + parseCurrency(v.preco), 0)
    setValorPassagemStr(total.toFixed(2))
  }, [voos, valorPassagemEditado])

  useEffect(() => {
    if (valorHospedagemEditado) return
    const total = hoteis.reduce((acc, h) => acc + parseCurrency(h.precoPorNoite) * h.noites, 0)
    setValorHospedagemStr(total.toFixed(2))
  }, [hoteis, valorHospedagemEditado])
  ```

- [ ] **Step 4: Update the enviar function to include valorPassagem and valorHospedagem in the POST body**

  Find the `enviar` function body (around line 212–216). Replace the `body: JSON.stringify(...)` line:

  Replace:
  ```ts
        body: JSON.stringify({ decisao: 'APROVADO', observacao: formatarObservacao() }),
  ```

  With:
  ```ts
        body: JSON.stringify({
          decisao: 'APROVADO',
          observacao: formatarObservacao(),
          valorPassagem: parseCurrency(valorPassagemStr),
          valorHospedagem: parseCurrency(valorHospedagemStr),
        }),
  ```

- [ ] **Step 5: Update BudgetTetoInfo call to pass 6 new props**

  Find the `<BudgetTetoInfo` block (around lines 277–282):
  ```tsx
          <BudgetTetoInfo
            destacado
            numeroEmpenho={budgetData?.numeroEmpenho}
            valorEmpenho={budgetData?.valorEmpenho}
            saldoEmpenho={budgetData?.saldoEmpenho}
          />
  ```

  Replace with:
  ```tsx
          <BudgetTetoInfo
            destacado
            numeroEmpenho={budgetData?.numeroEmpenho}
            valorEmpenho={budgetData?.valorEmpenho}
            saldoEmpenho={budgetData?.saldoEmpenho}
            numeroEmpenhoPassagem={budgetData?.numeroEmpenhoPassagem}
            valorEmpenhoPassagem={budgetData?.valorEmpenhoPassagem}
            saldoEmpenhoPassagem={budgetData?.saldoEmpenhoPassagem}
            numeroEmpenhoHospedagem={budgetData?.numeroEmpenhoHospedagem}
            valorEmpenhoHospedagem={budgetData?.valorEmpenhoHospedagem}
            saldoEmpenhoHospedagem={budgetData?.saldoEmpenhoHospedagem}
          />
  ```

- [ ] **Step 6: Add "Resumo Financeiro" section to the JSX**

  Find the section in the JSX that comes after the hotel table and before the observação/submit area. Specifically, look for the `=== OBSERVAÇÕES TÉCNICAS ===` section or the observação textarea. Add the following section immediately before the observação/notes area (or before the "Enviar para Análise" button section at the bottom of the main content area):

  Add this block (after the hoteis table section and before the observações section):
  ```tsx
  {/* Resumo Financeiro */}
  <section className="bg-white p-6 rounded-xl border border-slate-200">
    <div className="flex items-center gap-2 mb-4">
      <span className="material-symbols-outlined text-green-600">payments</span>
      <h3 className="font-bold text-lg text-slate-900">Resumo Financeiro</h3>
    </div>
    <p className="text-xs text-slate-500 mb-4">Calculado automaticamente com base nas opções acima. Edite se necessário.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
          Valor Passagem (R$)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={valorPassagemStr}
          onChange={e => {
            setValorPassagemStr(e.target.value)
            setValorPassagemEditado(e.target.value !== '')
            if (e.target.value === '') setValorPassagemEditado(false)
          }}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
          Valor Hospedagem (R$)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={valorHospedagemStr}
          onChange={e => {
            setValorHospedagemStr(e.target.value)
            setValorHospedagemEditado(e.target.value !== '')
            if (e.target.value === '') setValorHospedagemEditado(false)
          }}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  </section>
  ```

  **Where to insert:** Look for the observação textarea section (`{/* Observações */}` or similar). Place the Resumo Financeiro section immediately before it.

- [ ] **Step 7: Verify build**

  ```bash
  cd C:/projects/PortalViagens && npm run build 2>&1 | tail -20
  ```

  Expected: Build succeeds (or only pre-existing errors).

- [ ] **Step 8: Commit**

  ```bash
  cd C:/projects/PortalViagens && git add components/SecolCotacaoClient.tsx && git commit -m "feat: add auto-calculated passagem/hospedagem values to SECOL cotação form"
  ```

---

## Chunk 3: Workflow API — route.ts

**Files:**
- Modify: `app/api/workflow/[id]/route.ts`

**Goal:** (1) Save `valorPassagem`/`valorHospedagem` on the `WorkflowStep` when etapa is COTACAO. (2) Replace the single-empenho debit block with a `prisma.$transaction()` that debits both empenhos and sends SF email on overdraft.

---

- [ ] **Step 1: Add notificarRole to import in route.ts**

  Find the import block (lines 4–11):
  ```ts
  import {
    notificarCotacaoParaSegov,
    notificarViabilidadeAprovadaParaSecol,
    notificarAjusteParaSecol,
    notificarAjusteParaDemandante,
    notificarEmissaoParaSf,
    notificarDemandante,
  } from '@/lib/email-notifications'
  ```

  Replace with:
  ```ts
  import {
    notificarCotacaoParaSegov,
    notificarViabilidadeAprovadaParaSecol,
    notificarAjusteParaSecol,
    notificarAjusteParaDemandante,
    notificarEmissaoParaSf,
    notificarDemandante,
    notificarRole,
  } from '@/lib/email-notifications'
  ```

- [ ] **Step 2: Destructure valorPassagem and valorHospedagem from request body**

  Find (line 52):
  ```ts
  const { decisao, observacao } = body
  ```

  Replace with:
  ```ts
  const { decisao, observacao, valorPassagem, valorHospedagem } = body
  ```

- [ ] **Step 3: Save valorPassagem/valorHospedagem when creating the WorkflowStep (COTACAO only)**

  Find the `prisma.workflowStep.create` call (lines 75–84):
  ```ts
  await prisma.workflowStep.create({
    data: {
      solicitacaoId: sol.id,
      etapa: transicao.etapa,
      atorRole: role,
      atorNome: userName,
      decisao,
      observacao: observacao || null,
    },
  })
  ```

  Replace with:
  ```ts
  await prisma.workflowStep.create({
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
  ```

- [ ] **Step 4: Replace the VIABILIDADE single-empenho debit block with the two-empenho transaction block**

  Find the entire block (lines 92–126):
  ```ts
  // Lógica especial para etapa de VIABILIDADE aprovada (SEGOV) — DÉBITO DE EMPENHO
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'APROVADO') {
    // 1. Buscar cotação técnica anterior
    const cotacaoStep = await prisma.workflowStep.findFirst({
      where: { solicitacaoId: sol.id, etapa: 'COTACAO', decisao: 'APROVADO' },
      orderBy: { createdAt: 'desc' }
    })

    if (cotacaoStep) {
      const { calcularNoites, parsePreco } = await import('@/lib/utils/budget-utils')
      const noites = calcularNoites(sol.dataIda, sol.dataVolta)
      const dias = noites + 1
      const { total } = parsePreco(cotacaoStep.observacao, dias)

      // 2. Buscar saldo atual
      const configSaldo = await prisma.configuracaoSistema.findUnique({ where: { chave: 'SALDO_EMPENHO' } })

      if (configSaldo) {
        const saldoAtual = parseFloat(configSaldo.valor)
        const novoSaldo = Math.max(0, saldoAtual - total)

        // 3. Atualizar saldo
        await prisma.configuracaoSistema.update({
          where: { chave: 'SALDO_EMPENHO' },
          data: { valor: novoSaldo.toFixed(2) }
        })

        // 4. Adicionar nota na observação do workflow sobre o débito
        await prisma.workflowStep.update({
          where: { id: (await prisma.workflowStep.findFirst({ where: { solicitacaoId: sol.id, etapa: 'VIABILIDADE' }, orderBy: { createdAt: 'desc' } }))?.id ?? '' },
          data: { observacao: (observacao || '') + `\n\n[DÉBITO AUTOMÁTICO] Valor estimado de R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} debitado do empenho. Novo saldo: R$ ${novoSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.` }
        }).catch(() => {}) // Silencioso se falhar
      }
    }
  }
  ```

  Replace the entire block with:
  ```ts
  // Lógica especial para etapa de VIABILIDADE aprovada (SEGOV) — DÉBITO DE EMPENHOS
  if (transicao.etapa === 'VIABILIDADE' && decisao === 'APROVADO') {
    const cotacaoStep = await prisma.workflowStep.findFirst({
      where: { solicitacaoId: sol.id, etapa: 'COTACAO', decisao: 'APROVADO' },
      orderBy: { createdAt: 'desc' },
    })

    if (cotacaoStep && (cotacaoStep.valorPassagem != null || cotacaoStep.valorHospedagem != null)) {
      const notasDebito: string[] = []
      const notasAlerta: string[] = []

      await prisma.$transaction(async (tx) => {
        if (cotacaoStep.valorPassagem != null) {
          const cfg = await tx.configuracaoSistema.findUnique({ where: { chave: 'SALDO_EMPENHO_PASSAGEM' } })
          if (cfg) {
            const saldoAtual = parseFloat(cfg.valor)
            const novoSaldo = Math.max(0, saldoAtual - cotacaoStep.valorPassagem)
            await tx.configuracaoSistema.update({
              where: { chave: 'SALDO_EMPENHO_PASSAGEM' },
              data: { valor: novoSaldo.toFixed(2) },
            })
            notasDebito.push(`Passagem: R$ ${cotacaoStep.valorPassagem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (saldo: R$ ${novoSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
            if (cotacaoStep.valorPassagem > saldoAtual) {
              notasAlerta.push(`PASSAGEM com saldo insuficiente (saldo era R$ ${saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
            }
          }
        }

        if (cotacaoStep.valorHospedagem != null) {
          const cfg = await tx.configuracaoSistema.findUnique({ where: { chave: 'SALDO_EMPENHO_HOSPEDAGEM' } })
          if (cfg) {
            const saldoAtual = parseFloat(cfg.valor)
            const novoSaldo = Math.max(0, saldoAtual - cotacaoStep.valorHospedagem)
            await tx.configuracaoSistema.update({
              where: { chave: 'SALDO_EMPENHO_HOSPEDAGEM' },
              data: { valor: novoSaldo.toFixed(2) },
            })
            notasDebito.push(`Hospedagem: R$ ${cotacaoStep.valorHospedagem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (saldo: R$ ${novoSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
            if (cotacaoStep.valorHospedagem > saldoAtual) {
              notasAlerta.push(`HOSPEDAGEM com saldo insuficiente (saldo era R$ ${saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`)
            }
          }
        }
      })

      // Atualizar observação do WorkflowStep de VIABILIDADE
      const viabilidadeStep = await prisma.workflowStep.findFirst({
        where: { solicitacaoId: sol.id, etapa: 'VIABILIDADE' },
        orderBy: { createdAt: 'desc' },
      })
      if (viabilidadeStep) {
        let nota = `\n\n[DÉBITO AUTOMÁTICO] ${notasDebito.join(' | ')}`
        if (notasAlerta.length > 0) {
          nota += `\n⚠️ ALERTA: ${notasAlerta.join('; ')} — Secretaria de Finanças notificada para regularização.`
        }
        await prisma.workflowStep.update({
          where: { id: viabilidadeStep.id },
          data: { observacao: (observacao || '') + nota },
        }).catch(() => {})
      }

      // Notificar SF se houver saldo insuficiente
      if (notasAlerta.length > 0) {
        notificarRole(
          'SF',
          '[Viagens Osasco] ⚠️ Saldo de empenho insuficiente — regularização necessária',
          `A solicitação de ${sol.nomeCompleto} para ${sol.destino} foi aprovada pela SEGOV, porém o saldo de empenho era insuficiente para cobrir o valor comprometido.\n\nDetalhes:\n${notasAlerta.join('\n')}\n\nAcesse o sistema: ${process.env.APP_URL ?? 'http://localhost:3000'}/solicitacoes/${sol.id}`,
          'SALDO_INSUFICIENTE'
        ).catch(() => {})
      }
    }
  }
  ```

- [ ] **Step 5: Verify build**

  ```bash
  cd C:/projects/PortalViagens && npm run build 2>&1 | tail -20
  ```

  Expected: Build succeeds (or only pre-existing errors). Pay attention to TypeScript errors about `valorPassagem`/`valorHospedagem` — these should resolve because Prisma types now include the fields after the migration.

- [ ] **Step 6: Commit**

  ```bash
  cd C:/projects/PortalViagens && git add app/api/workflow/\\[id\\]/route.ts && git commit -m "feat: replace single-empenho debit with separate passagem/hospedagem transaction in workflow API"
  ```

---

## Chunk 4: Display — BudgetTetoInfo + SegovViabilidadeClient + Dashboard + Solicitações

**Files:**
- Modify: `components/BudgetTetoInfo.tsx`
- Modify: `components/SegovViabilidadeClient.tsx`
- Modify: `app/(portal)/dashboard/page.tsx`
- Modify: `app/(portal)/solicitacoes/[id]/page.tsx`

---

### 4A: BudgetTetoInfo

- [ ] **Step 1: Expand Props and add 6 new optional fields in BudgetTetoInfo.tsx**

  Replace the entire file content with the updated version below. The key changes are: new Props fields, `destacado` mode renders 3 cards in a grid, compact mode renders 3 conditional blocks:

  ```tsx
  'use client'

  type Props = {
    numeroEmpenho?: string
    valorEmpenho?: string
    saldoEmpenho?: string
    numeroEmpenhoPassagem?: string
    valorEmpenhoPassagem?: string
    saldoEmpenhoPassagem?: string
    numeroEmpenhoHospedagem?: string
    valorEmpenhoHospedagem?: string
    saldoEmpenhoHospedagem?: string
    destacado?: boolean
  }

  function EmpenhoCard({
    numeroEmpenho,
    valorEmpenho,
    saldoEmpenho,
    label,
    colorClass,
    iconName,
  }: {
    numeroEmpenho?: string
    valorEmpenho?: string
    saldoEmpenho?: string
    label: string
    colorClass: string
    iconName: string
  }) {
    const saldo = parseFloat(saldoEmpenho || '0')
    const total = parseFloat(valorEmpenho || '0')
    const percent = total > 0 ? (saldo / total) * 100 : 0
    const isLow = percent < 15
    const isCritical = percent < 5

    return (
      <div className={`p-5 rounded-2xl border-2 shadow-lg transition-all ${
        isCritical ? 'bg-red-50 border-red-500 animate-pulse' :
        isLow ? 'bg-amber-50 border-amber-500' :
        `${colorClass}`
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`size-12 rounded-xl flex items-center justify-center ${
              isCritical || isLow ? 'bg-white' : 'bg-white/20'
            }`}>
              <span className={`material-symbols-outlined ${
                isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-white'
              }`}>
                {iconName}
              </span>
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest leading-none mb-1 ${
                isCritical || isLow ? 'text-slate-500' : 'text-white/70'
              }`}>
                {label} (Empenho {numeroEmpenho})
              </p>
              <p className={`text-2xl font-black leading-none ${
                isCritical ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-white'
              }`}>
                R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className={`text-[10px] mt-1 font-medium ${
                isCritical || isLow ? 'text-slate-400' : 'text-white/70'
              }`}>
                Disponível para novas aprovações
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`inline-block px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
              isCritical ? 'bg-red-200 text-red-800' :
              isLow ? 'bg-amber-200 text-amber-800' :
              'bg-white/20 text-white'
            }`}>
              {percent.toFixed(1)}% Restante
            </div>
          </div>
        </div>
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

  export default function BudgetTetoInfo({
    numeroEmpenho, valorEmpenho, saldoEmpenho,
    numeroEmpenhoPassagem, valorEmpenhoPassagem, saldoEmpenhoPassagem,
    numeroEmpenhoHospedagem, valorEmpenhoHospedagem, saldoEmpenhoHospedagem,
    destacado = false,
  }: Props) {
    if (!numeroEmpenho && !saldoEmpenho) return null

    const hasPassagem = !!(numeroEmpenhoPassagem || saldoEmpenhoPassagem)
    const hasHospedagem = !!(numeroEmpenhoHospedagem || saldoEmpenhoHospedagem)

    if (destacado) {
      return (
        <div className={`grid gap-4 ${hasPassagem || hasHospedagem ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
          <EmpenhoCard
            numeroEmpenho={numeroEmpenho}
            valorEmpenho={valorEmpenho}
            saldoEmpenho={saldoEmpenho}
            label="Teto Orçamentário"
            colorClass="bg-blue-600 text-white border-blue-400"
            iconName="account_balance_wallet"
          />
          {hasPassagem && (
            <EmpenhoCard
              numeroEmpenho={numeroEmpenhoPassagem}
              valorEmpenho={valorEmpenhoPassagem}
              saldoEmpenho={saldoEmpenhoPassagem}
              label="Passagens"
              colorClass="bg-emerald-700 text-white border-emerald-500"
              iconName="flight"
            />
          )}
          {hasHospedagem && (
            <EmpenhoCard
              numeroEmpenho={numeroEmpenhoHospedagem}
              valorEmpenho={valorEmpenhoHospedagem}
              saldoEmpenho={saldoEmpenhoHospedagem}
              label="Hospedagem"
              colorClass="bg-orange-600 text-white border-orange-400"
              iconName="hotel"
            />
          )}
        </div>
      )
    }

    const saldo = parseFloat(saldoEmpenho || '0')
    const isLow = (parseFloat(valorEmpenho || '0') > 0)
      ? (saldo / parseFloat(valorEmpenho || '1')) * 100 < 15 : false
    const isCritical = (parseFloat(valorEmpenho || '0') > 0)
      ? (saldo / parseFloat(valorEmpenho || '1')) * 100 < 5 : false

    const saldoPass = parseFloat(saldoEmpenhoPassagem || '0')
    const saldoHosp = parseFloat(saldoEmpenhoHospedagem || '0')

    return (
      <div className="flex items-center gap-6 py-2 px-4 bg-slate-50 rounded-lg border border-slate-200 flex-wrap">
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
        {hasPassagem && (
          <>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Passagens ({numeroEmpenhoPassagem || 'N/A'})</span>
              <span className="text-sm font-black text-emerald-700">
                R$ {saldoPass.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </>
        )}
        {hasHospedagem && (
          <>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Hospedagem ({numeroEmpenhoHospedagem || 'N/A'})</span>
              <span className="text-sm font-black text-orange-600">
                R$ {saldoHosp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </>
        )}
      </div>
    )
  }
  ```

---

### 4B: SegovViabilidadeClient

- [ ] **Step 2: Expand budgetData prop type in SegovViabilidadeClient.tsx**

  Find the `Props` type (around lines 30–38):
  ```ts
  type Props = {
    sol: Solicitacao
    userName: string
    budgetData?: {
      numeroEmpenho?: string
      valorEmpenho?: string
      saldoEmpenho?: string
    }
  }
  ```

  Replace with:
  ```ts
  type Props = {
    sol: Solicitacao
    userName: string
    budgetData?: {
      numeroEmpenho?: string
      valorEmpenho?: string
      saldoEmpenho?: string
      numeroEmpenhoPassagem?: string
      valorEmpenhoPassagem?: string
      saldoEmpenhoPassagem?: string
      numeroEmpenhoHospedagem?: string
      valorEmpenhoHospedagem?: string
      saldoEmpenhoHospedagem?: string
    }
  }
  ```

- [ ] **Step 3: Add new grid-cols-2 row after the existing grid-cols-4 in SegovViabilidadeClient.tsx**

  Find the closing `</div>` of the existing `grid grid-cols-1 md:grid-cols-4 gap-4` section. This grid ends after the "Custo Estimado" card (around line 224). Immediately after that closing `</div>` (and still inside the outer container `<div className="space-y-6">`), add:

  ```tsx
  {/* Empenhos Separados — Passagem e Hospedagem */}
  {(budgetData?.saldoEmpenhoPassagem || budgetData?.saldoEmpenhoHospedagem) && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {budgetData?.saldoEmpenhoPassagem && (
        <div className="bg-emerald-900 p-6 rounded-3xl shadow-xl border border-emerald-700 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-emerald-400 text-[18px]">flight</span>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Empenho Passagens</p>
              </div>
              <p className="text-2xl font-black text-white tracking-tight">
                <span className="text-emerald-400">R$</span> {parseFloat(budgetData.saldoEmpenhoPassagem).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">Teto</p>
              <p className="text-sm font-bold text-emerald-300">
                R$ {parseFloat(budgetData.valorEmpenhoPassagem || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (parseFloat(budgetData.saldoEmpenhoPassagem) / parseFloat(budgetData.valorEmpenhoPassagem || '1')) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-2">
            Nº {budgetData.numeroEmpenhoPassagem}
          </p>
        </div>
      )}
      {budgetData?.saldoEmpenhoHospedagem && (
        <div className="bg-orange-900 p-6 rounded-3xl shadow-xl border border-orange-700 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-orange-400 text-[18px]">hotel</span>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Empenho Hospedagem</p>
              </div>
              <p className="text-2xl font-black text-white tracking-tight">
                <span className="text-orange-400">R$</span> {parseFloat(budgetData.saldoEmpenhoHospedagem).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Teto</p>
              <p className="text-sm font-bold text-orange-300">
                R$ {parseFloat(budgetData.valorEmpenhoHospedagem || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-400 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (parseFloat(budgetData.saldoEmpenhoHospedagem) / parseFloat(budgetData.valorEmpenhoHospedagem || '1')) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-2">
            Nº {budgetData.numeroEmpenhoHospedagem}
          </p>
        </div>
      )}
    </div>
  )}
  ```

---

### 4C: Dashboard page

- [ ] **Step 4: Update config query to fetch 9 keys in dashboard/page.tsx**

  Find (around line 63–65):
  ```ts
  const parametros = await prisma.configuracaoSistema.findMany({
    where: { chave: { in: ['NUMERO_EMPENHO', 'VALOR_EMPENHO', 'SALDO_EMPENHO'] } }
  })
  ```

  Replace with:
  ```ts
  const parametros = await prisma.configuracaoSistema.findMany({
    where: { chave: { in: [
      'NUMERO_EMPENHO', 'VALOR_EMPENHO', 'SALDO_EMPENHO',
      'NUMERO_EMPENHO_PASSAGEM', 'VALOR_EMPENHO_PASSAGEM', 'SALDO_EMPENHO_PASSAGEM',
      'NUMERO_EMPENHO_HOSPEDAGEM', 'VALOR_EMPENHO_HOSPEDAGEM', 'SALDO_EMPENHO_HOSPEDAGEM',
    ] } }
  })
  ```

- [ ] **Step 5: Pass 6 new props to both BudgetTetoInfo calls in dashboard/page.tsx**

  There are two `<BudgetTetoInfo` calls in this file. Both must receive the 6 new props. Find each call and add after `saldoEmpenho={...}`:

  ```tsx
  numeroEmpenhoPassagem={parametros.find(p => p.chave === 'NUMERO_EMPENHO_PASSAGEM')?.valor}
  valorEmpenhoPassagem={parametros.find(p => p.chave === 'VALOR_EMPENHO_PASSAGEM')?.valor}
  saldoEmpenhoPassagem={parametros.find(p => p.chave === 'SALDO_EMPENHO_PASSAGEM')?.valor}
  numeroEmpenhoHospedagem={parametros.find(p => p.chave === 'NUMERO_EMPENHO_HOSPEDAGEM')?.valor}
  valorEmpenhoHospedagem={parametros.find(p => p.chave === 'VALOR_EMPENHO_HOSPEDAGEM')?.valor}
  saldoEmpenhoHospedagem={parametros.find(p => p.chave === 'SALDO_EMPENHO_HOSPEDAGEM')?.valor}
  ```

  Apply to both `<BudgetTetoInfo` calls (header compact version and destacado version).

---

### 4D: Solicitações page

- [ ] **Step 6: Update config query to fetch 9 keys in solicitações/[id]/page.tsx**

  Find (around lines 58–60):
  ```ts
  const budgetParams = await prisma.configuracaoSistema.findMany({
    where: { chave: { in: ['NUMERO_EMPENHO', 'VALOR_EMPENHO', 'SALDO_EMPENHO'] } }
  })
  ```

  Replace with:
  ```ts
  const budgetParams = await prisma.configuracaoSistema.findMany({
    where: { chave: { in: [
      'NUMERO_EMPENHO', 'VALOR_EMPENHO', 'SALDO_EMPENHO',
      'NUMERO_EMPENHO_PASSAGEM', 'VALOR_EMPENHO_PASSAGEM', 'SALDO_EMPENHO_PASSAGEM',
      'NUMERO_EMPENHO_HOSPEDAGEM', 'VALOR_EMPENHO_HOSPEDAGEM', 'SALDO_EMPENHO_HOSPEDAGEM',
    ] } }
  })
  ```

- [ ] **Step 7: Add 6 new fields to the budgetData object in solicitações/[id]/page.tsx**

  Find (around lines 62–66):
  ```ts
  const budgetData = {
    numeroEmpenho: budgetParams.find(p => p.chave === 'NUMERO_EMPENHO')?.valor,
    valorEmpenho: budgetParams.find(p => p.chave === 'VALOR_EMPENHO')?.valor,
    saldoEmpenho: budgetParams.find(p => p.chave === 'SALDO_EMPENHO')?.valor,
  }
  ```

  Replace with:
  ```ts
  const budgetData = {
    numeroEmpenho: budgetParams.find(p => p.chave === 'NUMERO_EMPENHO')?.valor,
    valorEmpenho: budgetParams.find(p => p.chave === 'VALOR_EMPENHO')?.valor,
    saldoEmpenho: budgetParams.find(p => p.chave === 'SALDO_EMPENHO')?.valor,
    numeroEmpenhoPassagem: budgetParams.find(p => p.chave === 'NUMERO_EMPENHO_PASSAGEM')?.valor,
    valorEmpenhoPassagem: budgetParams.find(p => p.chave === 'VALOR_EMPENHO_PASSAGEM')?.valor,
    saldoEmpenhoPassagem: budgetParams.find(p => p.chave === 'SALDO_EMPENHO_PASSAGEM')?.valor,
    numeroEmpenhoHospedagem: budgetParams.find(p => p.chave === 'NUMERO_EMPENHO_HOSPEDAGEM')?.valor,
    valorEmpenhoHospedagem: budgetParams.find(p => p.chave === 'VALOR_EMPENHO_HOSPEDAGEM')?.valor,
    saldoEmpenhoHospedagem: budgetParams.find(p => p.chave === 'SALDO_EMPENHO_HOSPEDAGEM')?.valor,
  }
  ```

  The `budgetData` object is already passed to `SegovViabilidadeClient` (line 124) and to `SecolCotacaoClient` — both receive the expanded object automatically since TypeScript uses structural typing. No change needed to the component call sites.

---

### 4E: Verify and commit

- [ ] **Step 8: Verify build**

  ```bash
  cd C:/projects/PortalViagens && npm run build 2>&1 | tail -30
  ```

  Expected: Build succeeds (or only pre-existing errors — no new TypeScript errors).

- [ ] **Step 9: Commit**

  ```bash
  cd C:/projects/PortalViagens && git add components/BudgetTetoInfo.tsx components/SegovViabilidadeClient.tsx "app/(portal)/dashboard/page.tsx" "app/(portal)/solicitacoes/[id]/page.tsx" && git commit -m "feat: display separate passagem/hospedagem empenho cards in dashboard and viabilidade"
  ```

---

## Done

After all 4 chunks are committed:

1. `prisma migrate dev` ran — DB has `valorPassagem`/`valorHospedagem` on `WorkflowStep`
2. Seed ran — 6 new config keys exist
3. Admin ParametrosSection shows 6 new editable fields
4. SECOL cotação form auto-calculates passagem/hospedagem values, SECOL can override, values sent in POST
5. Workflow route saves values at COTACAO, debits both empenhos at VIABILIDADE, notifies SF on overdraft
6. BudgetTetoInfo renders up to 3 cards (blue/green/orange) or 3 compact blocks
7. SegovViabilidadeClient shows a new 2-column row with passagem/hospedagem cards
8. Dashboard and solicitações page fetch all 9 config keys and pass them downstream
