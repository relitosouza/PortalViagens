# Empenhos Separados: Passagem e Hospedagem — Design Spec

**Data:** 2026-03-17
**Status:** Em revisão

---

## Problema

O sistema possui um único empenho global (`SALDO_EMPENHO`) que debita o valor total de cada solicitação aprovada (passagem + hospedagem juntos). Não é possível rastrear separadamente o consumo orçamentário de passagens aéreas versus hospedagem, nem configurar tetos e números de empenho distintos para cada natureza de despesa.

## Solução

Adicionar dois empenhos específicos — um para passagem e outro para hospedagem — com campos estruturados no `WorkflowStep` para armazenar os valores cotados, débito automático separado por natureza de despesa, e visualização nos cards de orçamento em todo o sistema.

---

## Arquitetura

### 1. Schema Prisma — novos campos em `WorkflowStep`

```prisma
model WorkflowStep {
  // campos existentes mantidos...
  valorPassagem   Float?
  valorHospedagem Float?
}
```

Migration: adicionar 2 colunas opcionais (nullable). Compatibilidade retroativa: steps existentes têm `null` em ambos os campos.

### 2. Configuração do sistema — 6 novas chaves

Adicionadas via seed e gerenciadas pelo admin em `ParametrosSection`:

| Chave | Descrição |
|-------|-----------|
| `NUMERO_EMPENHO_PASSAGEM` | Número do empenho para passagens aéreas |
| `VALOR_EMPENHO_PASSAGEM` | Valor total autorizado para passagens |
| `SALDO_EMPENHO_PASSAGEM` | Saldo disponível para passagens |
| `NUMERO_EMPENHO_HOSPEDAGEM` | Número do empenho para hospedagem |
| `VALOR_EMPENHO_HOSPEDAGEM` | Valor total autorizado para hospedagem |
| `SALDO_EMPENHO_HOSPEDAGEM` | Saldo disponível para hospedagem |

Os 3 campos antigos (`NUMERO_EMPENHO`, `VALOR_EMPENHO`, `SALDO_EMPENHO`) são **mantidos sem alteração**.

---

## Comportamento

### Cotação da SECOL (`SecolCotacaoClient`)

**Seção "Resumo Financeiro"** adicionada logo antes do botão de envio:

- **Valor Passagem (R$)**: pré-preenchido com a soma de todos os preços de voo da tabela (`parseCurrency(v.preco)` para cada voo). Campo numérico editável — SECOL pode corrigir o valor antes de enviar.
- **Valor Hospedagem (R$)**: pré-preenchido com a soma de `noites × parseCurrency(precoPorNoite)` de todos os hotéis da tabela. Campo numérico editável.

Os campos se atualizam em tempo real (`useEffect`) conforme voos e hotéis são adicionados/editados. Se o usuário editar manualmente o campo, o valor editado tem precedência e não é recalculado automaticamente.

**Envio:** o body do POST para `/api/workflow/[id]` inclui:
```json
{
  "decisao": "APROVADO",
  "observacao": "...",
  "valorPassagem": 1240.50,
  "valorHospedagem": 2700.00
}
```

### Rota de workflow (`/api/workflow/[id]`)

**Recepção da cotação (etapa `COTACAO`, decisão `APROVADO`):**
- Aceitar `valorPassagem` e `valorHospedagem` no body
- Salvar em `workflowStep.create({ data: { ..., valorPassagem, valorHospedagem } })`

**Débito na aprovação de viabilidade (etapa `VIABILIDADE`, decisão `APROVADO`):**

Substitui o débito único do `SALDO_EMPENHO` por dois débitos separados:

1. Buscar cotação: `workflowStep.findFirst({ where: { solicitacaoId, etapa: 'COTACAO', decisao: 'APROVADO' } })`
2. Se `cotacaoStep.valorPassagem != null`:
   - Buscar `SALDO_EMPENHO_PASSAGEM`
   - Calcular `novoSaldoPassagem = max(0, saldoAtual - valorPassagem)`
   - Atualizar `SALDO_EMPENHO_PASSAGEM`
3. Se `cotacaoStep.valorHospedagem != null`:
   - Buscar `SALDO_EMPENHO_HOSPEDAGEM`
   - Calcular `novoSaldoHospedagem = max(0, saldoAtual - valorHospedagem)`
   - Atualizar `SALDO_EMPENHO_HOSPEDAGEM`
4. Nota automática na observação do step de VIABILIDADE:
   ```
   [DÉBITO AUTOMÁTICO] Passagem: R$ X,XX (saldo: R$ Y,YY) | Hospedagem: R$ A,AA (saldo: R$ B,BB)
   ```
5. O débito do antigo `SALDO_EMPENHO` é **removido**.

**Compatibilidade retroativa:** se `valorPassagem` e `valorHospedagem` forem `null` (cotações antigas), nenhum débito é feito — sem erros.

### Cards de orçamento (`BudgetTetoInfo`)

**Novos props opcionais:**
```ts
numeroEmpenhoPassagem?: string
valorEmpenhoPassagem?: string
saldoEmpenhoPassagem?: string
numeroEmpenhoHospedagem?: string
valorEmpenhoHospedagem?: string
saldoEmpenhoHospedagem?: string
```

**Modo `destacado`** (dashboard, tela de cotação): exibe até 3 cards em grid:
- Card azul (existente): empenho geral
- Card verde: Empenho Passagem — ícone `flight`, número, saldo, barra de progresso, alertas de baixo saldo
- Card laranja: Empenho Hospedagem — ícone `hotel`, número, saldo, barra de progresso, alertas

Cada novo card só é renderizado se o respectivo `numeroEmpenho*` ou `saldo*` for fornecido.

**Modo compacto** (tela de solicitação): linha com até 3 blocos separados por divisor vertical.

### Dashboard (`app/(portal)/dashboard/page.tsx`)

Atualizar query para buscar 9 chaves:
```ts
where: { chave: { in: [
  'NUMERO_EMPENHO', 'VALOR_EMPENHO', 'SALDO_EMPENHO',
  'NUMERO_EMPENHO_PASSAGEM', 'VALOR_EMPENHO_PASSAGEM', 'SALDO_EMPENHO_PASSAGEM',
  'NUMERO_EMPENHO_HOSPEDAGEM', 'VALOR_EMPENHO_HOSPEDAGEM', 'SALDO_EMPENHO_HOSPEDAGEM',
] } }
```

Passar os 6 novos props para `BudgetTetoInfo`.

### Tela de solicitação (`app/(portal)/solicitacoes/[id]/page.tsx`)

Mesma atualização de query e props que o dashboard.

### Admin — `ParametrosSection`

Adicionar 6 novas entradas ao `PARAM_LABELS`:
- `NUMERO_EMPENHO_PASSAGEM` — tipo `text`
- `VALOR_EMPENHO_PASSAGEM` — tipo `number`, unidade `R$`
- `SALDO_EMPENHO_PASSAGEM` — tipo `number`, unidade `R$`
- `NUMERO_EMPENHO_HOSPEDAGEM` — tipo `text`
- `VALOR_EMPENHO_HOSPEDAGEM` — tipo `number`, unidade `R$`
- `SALDO_EMPENHO_HOSPEDAGEM` — tipo `number`, unidade `R$`

Atualizar o array de chaves exibidas no componente para incluir as 6 novas.

### Seed (`prisma/seed.ts`)

Adicionar 6 novos registros em `ConfiguracaoSistema`:
```ts
{ chave: 'NUMERO_EMPENHO_PASSAGEM', valor: '2024/0002', descricao: 'Número do empenho para passagens aéreas' },
{ chave: 'VALOR_EMPENHO_PASSAGEM', valor: '50000.00', descricao: 'Valor total do empenho para passagens' },
{ chave: 'SALDO_EMPENHO_PASSAGEM', valor: '50000.00', descricao: 'Saldo disponível no empenho de passagens' },
{ chave: 'NUMERO_EMPENHO_HOSPEDAGEM', valor: '2024/0003', descricao: 'Número do empenho para hospedagem' },
{ chave: 'VALOR_EMPENHO_HOSPEDAGEM', valor: '50000.00', descricao: 'Valor total do empenho para hospedagem' },
{ chave: 'SALDO_EMPENHO_HOSPEDAGEM', valor: '50000.00', descricao: 'Saldo disponível no empenho de hospedagem' },
```

---

## File Map

| Ação | Arquivo |
|------|---------|
| Modificar | `prisma/schema.prisma` |
| Criar migration | `prisma/migrations/` (via `prisma migrate dev`) |
| Modificar | `prisma/seed.ts` |
| Modificar | `components/SecolCotacaoClient.tsx` |
| Modificar | `app/api/workflow/[id]/route.ts` |
| Modificar | `components/BudgetTetoInfo.tsx` |
| Modificar | `app/(portal)/dashboard/page.tsx` |
| Modificar | `app/(portal)/solicitacoes/[id]/page.tsx` |
| Modificar | `app/(portal)/admin/components/ParametrosSection.tsx` |

---

## Fora do escopo

- Migração dos valores históricos do `SALDO_EMPENHO` antigo para os novos
- Relatório de consumo por natureza de despesa
- Desbloqueio automático de saldo em caso de reprovação/cancelamento de solicitação
