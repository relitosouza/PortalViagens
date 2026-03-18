# Empenhos Separados: Passagem e Hospedagem — Design Spec

**Data:** 2026-03-17
**Status:** Em revisão (v2)

---

## Problema

O sistema possui um único empenho global (`SALDO_EMPENHO`) que debita o valor total de cada solicitação aprovada (passagem + hospedagem juntos). Não é possível rastrear separadamente o consumo orçamentário de passagens aéreas versus hospedagem, nem configurar tetos e números de empenho distintos para cada natureza de despesa.

## Solução

Adicionar dois empenhos específicos — um para passagem e outro para hospedagem — com campos estruturados no `WorkflowStep` para armazenar os valores cotados, débito automático separado por natureza de despesa com notificação de saldo insuficiente para SF, e visualização nos cards de orçamento em todo o sistema.

---

## Arquitetura

### 1. Schema Prisma — novos campos em `WorkflowStep`

```prisma
model WorkflowStep {
  // campos existentes mantidos sem alteração
  valorPassagem   Float?
  valorHospedagem Float?
}
```

Migration: 2 colunas opcionais (nullable). Compatibilidade retroativa: steps existentes têm `null` em ambos os campos.

### 2. Configuração do sistema — 6 novas chaves

Adicionadas via seed e gerenciadas pelo admin em `ParametrosSection`:

| Chave | Tipo | Descrição |
|-------|------|-----------|
| `NUMERO_EMPENHO_PASSAGEM` | text | Número do empenho para passagens aéreas |
| `VALOR_EMPENHO_PASSAGEM` | number | Valor total autorizado para passagens |
| `SALDO_EMPENHO_PASSAGEM` | number | Saldo disponível para passagens |
| `NUMERO_EMPENHO_HOSPEDAGEM` | text | Número do empenho para hospedagem |
| `VALOR_EMPENHO_HOSPEDAGEM` | number | Valor total autorizado para hospedagem |
| `SALDO_EMPENHO_HOSPEDAGEM` | number | Saldo disponível para hospedagem |

Os 3 campos antigos (`NUMERO_EMPENHO`, `VALOR_EMPENHO`, `SALDO_EMPENHO`) são **mantidos sem alteração**.

---

## Comportamento

### Cotação da SECOL (`SecolCotacaoClient`)

**Novos estados a adicionar:**
```ts
const [valorPassagemStr, setValorPassagemStr] = useState<string>('0')
const [valorHospedagemStr, setValorHospedagemStr] = useState<string>('0')
const [valorPassagemEditado, setValorPassagemEditado] = useState(false)
const [valorHospedagemEditado, setValorHospedagemEditado] = useState(false)
```

**Auto-cálculo com `useEffect`:**

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

**Regra de precedência manual:**
- Ao editar o campo: `setValorPassagemEditado(true)` (ou `valorHospedagem`)
- Ao limpar o campo (`value === ''`): resetar a flag para `false`, permitindo que o próximo cálculo automático preencha novamente

**Seção "Resumo Financeiro"** adicionada logo antes do botão de envio (após as tabelas de voos e hotéis):
- Campo "Valor Passagem (R$)" — input numérico, exibe `valorPassagemStr`, editável
- Campo "Valor Hospedagem (R$)" — input numérico, exibe `valorHospedagemStr`, editável
- Label indicativo: "Calculado automaticamente com base nas opções acima. Edite se necessário."

**Envio — body do POST:**
```json
{
  "decisao": "APROVADO",
  "observacao": "...",
  "valorPassagem": 1240.50,
  "valorHospedagem": 2700.00
}
```
Converter `valorPassagemStr` e `valorHospedagemStr` para `Float` com `parseCurrency()` antes de enviar.

**Atualização de `Props.budgetData`:**
```ts
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
```
Os 6 novos campos são passados para `BudgetTetoInfo` da mesma forma que os existentes.

---

### Rota de workflow (`/api/workflow/[id]`)

**Recepção dos valores (etapa `COTACAO`, decisão `APROVADO`):**

Aceitar `valorPassagem` e `valorHospedagem` no body **somente quando `transicao.etapa === 'COTACAO'`**. Em todas as outras etapas, esses campos são ignorados mesmo se presentes no body.

```ts
// No workflowStep.create():
data: {
  solicitacaoId: sol.id,
  etapa: transicao.etapa,
  atorRole: role,
  atorNome: userName,
  decisao,
  observacao: observacao || null,
  // Somente para etapa COTACAO:
  ...(transicao.etapa === 'COTACAO' && {
    valorPassagem: body.valorPassagem ?? null,
    valorHospedagem: body.valorHospedagem ?? null,
  }),
},
```

**Débito na aprovação de viabilidade (etapa `VIABILIDADE`, decisão `APROVADO`):**

O bloco existente de débito do `SALDO_EMPENHO` (linhas 93–126 de `route.ts`) é **completamente substituído** pelo bloco abaixo.

**Import necessário:** adicionar `notificarRole` ao import existente de `@/lib/email-notifications` em `route.ts`:
```ts
import {
  notificarCotacaoParaSegov,
  notificarViabilidadeAprovadaParaSecol,
  notificarAjusteParaSecol,
  notificarAjusteParaDemandante,
  notificarEmissaoParaSf,
  notificarDemandante,
  notificarRole,  // ← adicionar
} from '@/lib/email-notifications'
```

```ts
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
    }) // fim prisma.$transaction

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
      }).catch(() => {}) // silencioso — falha na nota não bloqueia o workflow
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

**Compatibilidade retroativa:** se `valorPassagem` e `valorHospedagem` forem `null`, nenhum débito é feito — sem erros.

---

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

**Modo `destacado`:** grid responsivo com até 3 cards (card existente azul + card verde Passagem + card laranja Hospedagem). Cada novo card só é renderizado se `numeroEmpenho*` ou `saldo*` for fornecido. Os novos cards seguem o mesmo padrão visual do card existente (saldo, barra de progresso, percentual restante, alertas de baixo saldo com os mesmos thresholds de 5% e 15%).

**Modo compacto:** linha flexível com blocos separados por `<div className="w-px h-8 bg-slate-200" />`. Cada bloco (empenho geral, passagem, hospedagem) é renderizado condicionalmente apenas se `numero*` ou `saldo*` for fornecido. Mínimo 1 bloco sempre renderizado (o empenho geral existente).

---

### `SegovViabilidadeClient`

O componente tem um card de orçamento inline próprio (dark mode, não usa `BudgetTetoInfo`). O grid existente (`grid-cols-1 md:grid-cols-4`) já usa todas as 4 colunas (card de empenho com `col-span-2` + Duração Total `col-span-1` + Custo Estimado `col-span-1`). **Não adicionar os novos cards nesse grid**.

Em vez disso, adicionar uma **nova linha** com um `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">` imediatamente após o grid existente, contendo:
- Card verde/escuro "Empenho Passagem" (ícone `flight`) — mostra número, saldo disponível, barra de progresso
- Card laranja/escuro "Empenho Hospedagem" (ícone `hotel`) — mesmo padrão

Cada card só é renderizado se `budgetData?.saldoEmpenhoPassagem` ou `budgetData?.saldoEmpenhoHospedagem` for fornecido, respectivamente.

**Atualização de `Props.budgetData`:**
```ts
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
```

---

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

Mesma atualização de query e props que o dashboard. Esta página também renderiza `SecolCotacaoClient` e `SegovViabilidadeClient` — passar os 6 novos campos em `budgetData` para ambos.

### Admin — `ParametrosSection`

Adicionar ao `PARAM_LABELS`:
```ts
NUMERO_EMPENHO_PASSAGEM: { label: 'Número do Empenho — Passagens', hint: 'Empenho específico para passagens aéreas.', unit: 'Nº', type: 'text' },
VALOR_EMPENHO_PASSAGEM: { label: 'Valor Total — Empenho Passagens', hint: 'Cota autorizada para passagens no período.', unit: 'R$', type: 'number' },
SALDO_EMPENHO_PASSAGEM: { label: 'Saldo Disponível — Passagens', hint: 'Saldo atualizado após débitos de passagens aprovadas.', unit: 'R$', type: 'number' },
NUMERO_EMPENHO_HOSPEDAGEM: { label: 'Número do Empenho — Hospedagem', hint: 'Empenho específico para hospedagem.', unit: 'Nº', type: 'text' },
VALOR_EMPENHO_HOSPEDAGEM: { label: 'Valor Total — Empenho Hospedagem', hint: 'Cota autorizada para hospedagem no período.', unit: 'R$', type: 'number' },
SALDO_EMPENHO_HOSPEDAGEM: { label: 'Saldo Disponível — Hospedagem', hint: 'Saldo atualizado após débitos de hospedagem aprovados.', unit: 'R$', type: 'number' },
```

Adicionar as 6 novas chaves ao array de chaves exibidas no componente.

### Seed (`prisma/seed.ts`)

Adicionar 6 novos registros em `ConfiguracaoSistema`:
```ts
{ chave: 'NUMERO_EMPENHO_PASSAGEM', valor: '2026/0002', descricao: 'Número do empenho para passagens aéreas' },
{ chave: 'VALOR_EMPENHO_PASSAGEM', valor: '50000.00', descricao: 'Valor total do empenho para passagens' },
{ chave: 'SALDO_EMPENHO_PASSAGEM', valor: '50000.00', descricao: 'Saldo disponível no empenho de passagens' },
{ chave: 'NUMERO_EMPENHO_HOSPEDAGEM', valor: '2026/0003', descricao: 'Número do empenho para hospedagem' },
{ chave: 'VALOR_EMPENHO_HOSPEDAGEM', valor: '50000.00', descricao: 'Valor total do empenho para hospedagem' },
{ chave: 'SALDO_EMPENHO_HOSPEDAGEM', valor: '50000.00', descricao: 'Saldo disponível no empenho de hospedagem' },
```

---

## File Map

| Ação | Arquivo |
|------|---------|
| Modificar | `prisma/schema.prisma` |
| Criar migration | via `npx prisma migrate dev --name add-valor-passagem-hospedagem` |
| Modificar | `prisma/seed.ts` |
| Modificar | `components/SecolCotacaoClient.tsx` |
| Modificar | `components/SegovViabilidadeClient.tsx` |
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
