# Design Spec: Aprovação do Secretário

**Data:** 2026-03-20
**Status:** Aprovado pelo usuário
**Projeto:** Portal de Viagens — Osasco

---

## Contexto

O Portal de Viagens atualmente encaminha os pedidos do Demandante diretamente para o SECOL (cotação). O objetivo desta feature é inserir uma etapa de **aprovação pelo Secretário** entre a submissão do Demandante e o início da cotação.

Cada Secretário é responsável por uma Secretaria (área/departamento) e só aprova pedidos de funcionários vinculados à sua secretaria.

---

## Abordagem Escolhida

**Opção A — Incremental**, reutilizando o modelo `WorkflowStep` já existente, sem criar novas tabelas de aprovação. Minimiza risco de regressão e mantém consistência com os padrões do projeto.

---

## 1. Modelo de Dados

### Nova tabela `Secretaria`

```prisma
model Secretaria {
  id        String   @id @default(cuid())
  nome      String   @unique
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now())
  users     User[]
}
```

### Mudanças em `User`

```prisma
model User {
  // campos existentes...
  secretariaId String?
  secretaria   Secretaria? @relation(fields: [secretariaId], references: [id])
}
```

- `secretariaId` é opcional no banco para não quebrar usuários existentes
- Obrigatório na camada de aplicação para papéis `DEMANDANTE` e `SECRETARIO`
  - **Ponto de validação:** API `POST /api/admin/usuarios` valida e retorna erro 400 se `secretariaId` estiver ausente para esses papéis
  - A submissão de solicitação também valida: se o Demandante não tiver `secretariaId`, retorna erro 400 com mensagem clara antes de gravar
- Opcional para `SECOL`, `SEGOV`, `SF`, `ADMIN`
- Novo papel possível: `"SECRETARIO"` (campo `role` já é String — sem migração de tipo)

### `secretariaId` na sessão (JWT)

O campo `secretariaId` é adicionado ao token JWT e ao objeto de sessão (`Session`). Isso evita uma consulta extra ao banco a cada request do Secretário para filtrar pedidos da sua secretaria.

Mudança necessária em `types/next-auth.d.ts`:
```ts
interface Session {
  user: {
    id: string
    role: string
    secretariaId?: string   // novo
  }
}
```
E no callback `jwt` / `session` do NextAuth.

### Mudanças em `Solicitacao`

Novos valores de status inseridos no fluxo:

| Status | Descrição |
|---|---|
| `AGUARDANDO_SECRETARIO` | Pedido submetido — aguardando análise do Secretário |
| `DEVOLVIDO_SECRETARIO` | Secretário devolveu para correção pelo Demandante |
| `REPROVADO_SECRETARIO` | Secretário reprovou — estado terminal |

O status atual `SUBMETIDO` é substituído por `AGUARDANDO_SECRETARIO` ao submeter.

### Mapeamento dos campos "Detalhes da Missão"

Os campos desta seção correspondem às colunas já existentes em `Solicitacao`:

| Rótulo no UI | Coluna no banco |
|---|---|
| Justificativa do Interesse Público | `justificativaPublica` |
| Nexo com as Atribuições do Cargo | `nexoCargo` |

Esses campos ficam desabilitados no form do Demandante e são preenchidos pelo Secretário durante a aprovação. São **obrigatórios** para que o Secretário possa aprovar.

### `WorkflowStep` — sem mudanças estruturais

O passo do Secretário é registrado com:

```
etapa:     "SECRETARIO"
atorRole:  "SECRETARIO"
atorNome:  "Nome do Secretário logado"   ← assinatura (padrão já existente)
decisao:   "APROVADO" | "DEVOLVIDO" | "REPROVADO"
observacao: string (obrigatória em DEVOLVIDO e REPROVADO)
createdAt:  timestamp automático
```

O `atorNome` + `createdAt` gravados no `WorkflowStep` seguem o padrão já existente para todos os passos do workflow. Nenhuma mudança estrutural é necessária.

---

## 2. Fluxo do Workflow

```
RASCUNHO
   ↓ (Demandante submete — endpoint POST /api/solicitacoes ou PUT /api/workflow/[id])
AGUARDANDO_SECRETARIO
   ├─ Secretário APROVA   → AGUARDANDO_COTACAO (fluxo existente SECOL)
   ├─ Secretário DEVOLVE  → DEVOLVIDO_SECRETARIO
   └─ Secretário REPROVA  → REPROVADO_SECRETARIO (terminal)

DEVOLVIDO_SECRETARIO
   ↓ (Demandante corrige e resubmete)
AGUARDANDO_SECRETARIO   ← volta para reavaliação do Secretário
```

**Transição inicial:** A submissão ocorre via `PATCH /api/solicitacoes/[id]` (endpoint já existente para salvar rascunho). Quando o Demandante envia o formulário com `rascunho: false`, o endpoint atualmente define `status: "AGUARDANDO_COTACAO"`. Esta lógica será alterada para:
1. Validar que o Demandante possui `secretariaId` vinculado
2. Validar que existe ao menos um Secretário ativo para essa secretaria
3. Definir `status: "AGUARDANDO_SECRETARIO"` em vez de `AGUARDANDO_COTACAO`
4. Disparar emails para os Secretários ativos

Não é criado um `WorkflowStep` nesse momento — o primeiro step do Secretário é criado quando ele toma uma decisão.

**Resubmissão após devolução:** O mesmo endpoint `PATCH /api/solicitacoes/[id]` será usado para resubmeter. O guard atual que só permite edição quando `status === 'RASCUNHO'` será estendido para também permitir `status === 'DEVOLVIDO_SECRETARIO'`. Nesse caso, ao enviar com `rascunho: false`, o status volta para `AGUARDANDO_SECRETARIO`. A tentativa de editar um pedido com status `REPROVADO_SECRETARIO` retorna erro 403.

### Múltiplos Secretários por Secretaria

Uma Secretaria pode ter mais de um usuário com papel `SECRETARIO`. Nesse caso:
- **Todos** os Secretários ativos da secretaria visualizam o pedido no dashboard e podem agir
- O primeiro a tomar uma decisão "trava" o pedido (o status muda e o pedido sai da fila dos demais)
- Não há designação de secretário primário — qualquer um pode agir

### Regras de bloqueio na submissão

1. Se o Demandante não tiver `secretariaId` → erro 400: *"Seu cadastro não possui uma secretaria vinculada. Contate o administrador."*
2. Se não houver Secretário ativo para a secretaria do Demandante → submissão bloqueada, erro 400: *"Não há Secretário ativo para sua secretaria. Contate o administrador."* + notificação por email para todos os usuários com papel `ADMIN`

### ADMIN como bypass

O ADMIN pode agir no passo `SECRETARIO` como substituto, seguindo o padrão já existente de override por `role === 'ADMIN'` no engine de workflow. Isso serve como fallback para o caso de bloqueio por ausência de Secretário.

### Concorrência entre múltiplos Secretários

Para evitar que dois Secretários atuem simultaneamente no mesmo pedido, a decisão do Secretário será gravada usando **optimistic locking**:

```ts
// Verificar e atualizar em transação Prisma
await prisma.$transaction(async (tx) => {
  const sol = await tx.solicitacao.findUnique({ where: { id } })
  if (sol.status !== 'AGUARDANDO_SECRETARIO') throw new Error('Pedido já foi processado')
  await tx.solicitacao.update({ where: { id }, data: { status: novoStatus } })
  await tx.workflowStep.create({ data: { ...stepData } })
})
```

Se o status já tiver mudado (outro Secretário agiu primeiro), o endpoint retorna erro 409 com mensagem: *"Este pedido já foi processado por outro Secretário."*

### Permissões por status

| Status | Quem age | Ações disponíveis |
|---|---|---|
| `AGUARDANDO_SECRETARIO` | SECRETARIO (mesma secretaria) ou ADMIN | Aprovar / Devolver / Reprovar |
| `DEVOLVIDO_SECRETARIO` | DEMANDANTE (dono do pedido) | Editar campos permitidos e resubmeter |
| `REPROVADO_SECRETARIO` | — | Somente leitura — estado terminal |

### Estado terminal `REPROVADO_SECRETARIO`

- O pedido não pode ser reativado
- O Demandante pode **criar uma nova solicitação** se desejar tentar novamente
- O pedido reprovado fica visível no histórico do Demandante como somente leitura
- A justificativa do Secretário aparece em destaque no histórico

### Edição no status `DEVOLVIDO_SECRETARIO`

O Demandante pode reeditar **todos os campos exceto**:
- `justificativaPublica` (Justificativa do Interesse Público)
- `nexoCargo` (Nexo com as Atribuições do Cargo)

Esses campos ficam `disabled` e exibem o badge: `"Preenchido pelo Secretário"`.

### Histórico de resubmissões

O `WorkflowStep` funciona como log imutável (padrão existente — registros nunca são deletados). Em caso de resubmissão após devolução, múltiplos steps com `etapa: "SECRETARIO"` aparecem no histórico. O `WorkflowTimeline` exibe cada step em ordem cronológica, mostrando o ciclo completo de devolução e resubmissão como parte do histórico.

---

## 3. Notificações por Email

Seguindo o padrão já existente no endpoint de workflow:

| Evento | Destinatário(s) |
|---|---|
| Demandante submete | Todos os Secretários ativos da secretaria |
| Secretário aprova | SECOL + Demandante |
| Secretário devolve | Demandante (com a justificativa no corpo do email) |
| Secretário reprova | Demandante (com a justificativa no corpo do email) |
| Bloqueio por ausência de Secretário | Todos os ADMINs |

---

## 4. Formulário de Aprovação do Secretário

Baseado no formulário do Demandante, com as seguintes diferenças:

### Campos

- Todos os campos são editáveis pelo Secretário
- A seção **"Detalhes da Missão"** é editável **apenas** pelo Secretário (desabilitada no form do Demandante)

### Seção "Detalhes da Missão"

Exibe badge: `"Preenchimento do Secretário"`

Campos:
- `justificativaPublica` — Justificativa do Interesse Público *(obrigatório para aprovar)*
- `nexoCargo` — Nexo com as Atribuições do Cargo *(obrigatório para aprovar)*

Validação: botão "Aprovar" fica desabilitado se qualquer um desses campos estiver vazio.

### Botões de ação

| Botão | Cor | Comportamento |
|---|---|---|
| **Aprovar** | Verde | Valida campos obrigatórios → grava WorkflowStep (APROVADO) → status `AGUARDANDO_COTACAO` |
| **Devolver para Correção** | Amarelo | Abre modal com campo de justificativa obrigatória → grava WorkflowStep (DEVOLVIDO) → status `DEVOLVIDO_SECRETARIO` |
| **Reprovar** | Vermelho | Abre modal com campo de justificativa obrigatória → grava WorkflowStep (REPROVADO) → status `REPROVADO_SECRETARIO` |

### Assinatura

Ao aprovar, o `WorkflowStep` grava `atorNome` com o nome do Secretário logado e `createdAt` com o timestamp. Exibido no histórico como:

> *"Aprovado por Fulano de Tal em 20/03/2026 às 14:32"*

---

## 5. Dashboard do Secretário

**Rota:** `/portal/secretario`
**Acesso:** somente papel `SECRETARIO` (e `ADMIN`)
**Controle de acesso:** usuários com outros papéis que acessarem esta rota são redirecionados para `/portal/dashboard`

### Bloco 1 — Pedidos aguardando aprovação

Lista de solicitações com status `AGUARDANDO_SECRETARIO` da secretaria do Secretário logado (`session.user.secretariaId`), ordenadas por `createdAt` ascending (mais antigas primeiro).

Colunas: Funcionário | Destino | Data Ida — Data Volta | `[Analisar →]`

### Bloco 2 — Viagens em andamento / histórico

Todas as solicitações da secretaria (exceto RASCUNHO), filtráveis por status via dropdown.

Query: `Solicitacao → user.secretariaId === session.user.secretariaId`

Colunas: Funcionário | Destino | Data Ida — Data Volta | Status | Prestação

Indicadores de prestação (leitura via join `Solicitacao.prestacao`):
- `✅ Entregue` — `prestacao.enviadoEm` não é null
- `⏳ Pendente` — `prestacao` existe, `enviadoEm` é null, `prazoFinal` >= hoje
- `⚠ Em atraso` — `prestacao` existe, `enviadoEm` é null, `prazoFinal` < hoje (linha destacada em vermelho)
- `—` — `prestacao` não existe (viagem ainda não concluída)

O link `[Ir para Prestação]` leva para `/portal/solicitacoes/[id]/prestacao`. Funciona inclusive quando o próprio Secretário é o viajante (campo `Solicitacao.userId === session.user.id`).

O Secretário tem **acesso de leitura** às prestações da sua secretaria — sem ação de aprovação ou rejeição (essa responsabilidade permanece com o SF).

### Bloco 3 — Devolvidos / Reprovados

Lista de solicitações com status `DEVOLVIDO_SECRETARIO` ou `REPROVADO_SECRETARIO` da secretaria, para acompanhamento.

Colunas: Funcionário | Destino | Status | Motivo (justificativa do WorkflowStep) | Data

---

## 6. Mudanças nos Formulários Existentes

### Form do Demandante (`SolicitacaoFormClient`)

- Campos `justificativaPublica` e `nexoCargo` sempre `disabled`, independente do status
- Badge sobre esses campos: `"Preenchido pelo Secretário"`
- Campos aparecem vazios no primeiro preenchimento (o Demandante não preenche)
- No status `DEVOLVIDO_SECRETARIO`:
  - Banner de alerta amarelo com a justificativa do Secretário: *"Devolvido para correção: [motivo]"*
  - Todos os campos editáveis **exceto** `justificativaPublica` e `nexoCargo`
  - Botão `"Resubmeter para o Secretário"` substitui o botão `"Enviar"`
- No status `REPROVADO_SECRETARIO`:
  - Banner vermelho com a justificativa: *"Pedido reprovado: [motivo]"*
  - Formulário inteiramente somente leitura
  - Botão `"Nova Solicitação"` disponível

---

## 7. Mudanças no Painel Admin

### Nova aba "Secretarias"

- Listar / Criar / Editar / Desativar secretarias
- Campos: Nome (obrigatório, único), status ativo/inativo
- Validação de unicidade no nome (erro 400 se duplicado)
- **Desativação:** soft delete via `ativo = false`. Bloqueada se houver usuários ativos (DEMANDANTE ou SECRETARIO) vinculados — exibe mensagem: *"Existem usuários ativos vinculados a esta secretaria. Desvincule-os antes de desativar."*
- Não há hard delete de secretarias

### Cadastro de Usuários

- Novo campo: `Secretaria` (dropdown com secretarias ativas)
- Obrigatório para `DEMANDANTE` e `SECRETARIO`
- Opcional para `SECOL`, `SEGOV`, `SF`, `ADMIN`
- Validação no backend (`POST /api/admin/usuarios`): retorna 400 se `secretariaId` ausente para os papéis que exigem

---

## 8. Mudanças em Componentes e Guards Existentes

### `ROLE_LABELS` (portal layout)

Adicionar entrada para o novo papel:
```ts
SECRETARIO: "Secretário"
```
Sem isso, o header exibiria a string bruta `"SECRETARIO"`.

### `ROLE_STATUS_MAP` (dashboard/page.tsx)

Adicionar entrada para SECRETARIO, mapeando os status relevantes para o dashboard padrão:
```ts
SECRETARIO: ['AGUARDANDO_SECRETARIO', 'DEVOLVIDO_SECRETARIO', 'REPROVADO_SECRETARIO']
```
Sem isso, o Secretário veria uma lista vazia no `/portal/dashboard` sem mensagem de erro.

O Secretário tem seu próprio dashboard em `/portal/secretario`. O `/portal/dashboard` funcionará como fallback, mas é esperado que o Sidebar redirecione o SECRETARIO para `/portal/secretario` como página principal.

### `Sidebar.tsx`

- Adicionar `/portal/secretario` como link de navegação principal para o papel `SECRETARIO`
- O botão `"Nova Viagem"` deve ser exibido também para `SECRETARIO`, pois o Secretário pode ser o próprio viajante
- Adicionar `SECRETARIO` nos papéis que visualizam a lista de solicitações

### `AcoesWorkflow.tsx`

Adicionar tratamento para os novos status no componente de ações:
- `AGUARDANDO_SECRETARIO`: exibe os botões de Aprovar / Devolver / Reprovar (apenas para SECRETARIO ou ADMIN)
- `DEVOLVIDO_SECRETARIO`: exibe o botão "Resubmeter para o Secretário" (apenas para o DEMANDANTE dono)
- `REPROVADO_SECRETARIO`: exibe somente leitura com banner de reprovação

### `WorkflowTimeline.tsx`

O componente usa um array `ETAPAS` fixo (`COTACAO`, `VIABILIDADE`, `EMISSAO`, `EXECUCAO`). Adicionar `SECRETARIO` como primeira etapa no array:

```ts
const ETAPAS = ['SECRETARIO', 'COTACAO', 'VIABILIDADE', 'EMISSAO', 'EXECUCAO']
```

Para lidar com múltiplos steps `SECRETARIO` (ciclos de devolução), o `WorkflowTimeline` deve renderizar os steps do banco em ordem cronológica para a etapa `SECRETARIO`, agrupando-os visualmente como sub-steps dentro da etapa. Os demais steps continuam com o comportamento atual (um step por etapa).

### `middleware.ts`

Adicionar proteção para a rota `/portal/secretario`:
- Apenas `SECRETARIO` e `ADMIN` podem acessar
- Outros papéis autenticados são redirecionados para `/portal/dashboard`

---

## Resumo de Impacto

| Área | Mudança |
|---|---|
| Banco de dados | Nova tabela `Secretaria`, campo `secretariaId` em `User`, 3 novos status em `Solicitacao` |
| JWT / Sessão | `secretariaId` adicionado ao token e ao objeto `Session` (types/next-auth.d.ts + callbacks) |
| Middleware | Proteção da rota `/portal/secretario` com redirecionamento para não-autorizados |
| `PATCH /api/solicitacoes/[id]` | Submissão redireciona para `AGUARDANDO_SECRETARIO`; guard de edição estendido para `DEVOLVIDO_SECRETARIO` |
| Workflow engine | Novo passo `SECRETARIO`, optimistic locking via transação Prisma, ADMIN bypass |
| Notificações | 5 novos eventos de email |
| `ROLE_LABELS` | Entrada `SECRETARIO: "Secretário"` adicionada |
| `ROLE_STATUS_MAP` | Entrada `SECRETARIO` adicionada para `/portal/dashboard` |
| `Sidebar.tsx` | Link `/portal/secretario`, botão "Nova Viagem" para SECRETARIO |
| `AcoesWorkflow.tsx` | Tratamento dos 3 novos status |
| `WorkflowTimeline.tsx` | `SECRETARIO` adicionado ao array `ETAPAS`, suporte a múltiplos sub-steps |
| Form Demandante | `justificativaPublica` e `nexoCargo` sempre disabled, banner de devolução/reprovação, botão "Resubmeter" |
| Form Secretário | Novo componente — todos os campos editáveis, validação de Detalhes da Missão, 3 botões de ação |
| Dashboard Secretário | Nova página `/portal/secretario` com 3 blocos |
| Admin | Gestão de secretarias (CRUD soft delete) + campo `secretariaId` no cadastro de usuário |
