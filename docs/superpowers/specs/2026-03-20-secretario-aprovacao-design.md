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

- `secretariaId` é opcional para não quebrar usuários existentes
- Obrigatório para papéis `DEMANDANTE` e `SECRETARIO` (validado na aplicação)
- Opcional para `SECOL`, `SEGOV`, `SF`, `ADMIN`
- Novo papel possível: `"SECRETARIO"` (campo `role` já é String — sem migração de tipo)

### Mudanças em `Solicitacao`

Novos valores de status inseridos no fluxo:

| Status | Descrição |
|---|---|
| `AGUARDANDO_SECRETARIO` | Pedido submetido, aguardando análise do Secretário |
| `DEVOLVIDO_SECRETARIO` | Secretário devolveu para correção pelo Demandante |
| `REPROVADO_SECRETARIO` | Secretário reprovou — fim do fluxo |

O status `SUBMETIDO` passa a ser substituído por `AGUARDANDO_SECRETARIO` ao submeter.

### `WorkflowStep` — sem mudanças estruturais

O passo do Secretário é registrado com:

```
etapa:    "SECRETARIO"
atorRole: "SECRETARIO"
atorNome: "Nome do Secretário logado"   ← funciona como assinatura
decisao:  "APROVADO" | "DEVOLVIDO" | "REPROVADO"
observacao: string (obrigatória em DEVOLVIDO e REPROVADO)
createdAt: timestamp automático
```

---

## 2. Fluxo do Workflow

```
RASCUNHO
   ↓ (Demandante submete)
AGUARDANDO_SECRETARIO
   ├─ Secretário APROVA   → AGUARDANDO_COTACAO (fluxo existente SECOL)
   ├─ Secretário DEVOLVE  → DEVOLVIDO_SECRETARIO
   └─ Secretário REPROVA  → REPROVADO_SECRETARIO (fim)

DEVOLVIDO_SECRETARIO
   ↓ (Demandante corrige e resubmete)
AGUARDANDO_SECRETARIO   ← volta para reavaliação do Secretário
```

### Regras de roteamento

- O sistema usa `solicitacao.user.secretariaId` para identificar qual Secretário deve analisar o pedido
- Se o Demandante não tiver secretaria vinculada → erro de validação ao submeter, com mensagem clara
- Se não houver Secretário ativo para a secretaria → submissão bloqueada com aviso ao ADMIN

### Permissões por status

| Status | Quem age | Ações disponíveis |
|---|---|---|
| `AGUARDANDO_SECRETARIO` | SECRETARIO (mesma secretaria) | Aprovar / Devolver / Reprovar |
| `DEVOLVIDO_SECRETARIO` | DEMANDANTE (dono do pedido) | Editar e resubmeter |
| `REPROVADO_SECRETARIO` | — | Somente leitura |

### Edição no status `DEVOLVIDO_SECRETARIO`

O Demandante pode reeditar **todos os campos exceto**:
- Justificativa do Interesse Público
- Nexo com as Atribuições do Cargo

Esses campos ficam `disabled` e exibem o badge: `"Preenchido pelo Secretário"`.

---

## 3. Formulário de Aprovação do Secretário

Baseado no formulário do Demandante, com as seguintes diferenças:

### Campos

- Todos os campos são editáveis pelo Secretário
- A seção **"Detalhes da Missão"** é exclusiva do Secretário (habilitada aqui, desabilitada no form do Demandante)

### Seção "Detalhes da Missão"

Exibe badge: `"Preenchimento do Secretário"`

Campos:
- Justificativa do Interesse Público *(obrigatório para aprovar)*
- Nexo com as Atribuições do Cargo *(obrigatório para aprovar)*

Validação: não é possível clicar em "Aprovar" sem preencher esses dois campos.

### Botões de ação

| Botão | Cor | Comportamento |
|---|---|---|
| **Aprovar** | Verde | Valida "Detalhes da Missão" → grava WorkflowStep → status `AGUARDANDO_COTACAO` |
| **Devolver para Correção** | Amarelo | Abre modal com justificativa obrigatória → status `DEVOLVIDO_SECRETARIO` |
| **Reprovar** | Vermelho | Abre modal com justificativa obrigatória → status `REPROVADO_SECRETARIO` |

### Assinatura

Ao aprovar, o `WorkflowStep` grava `atorNome` com o nome do Secretário logado e `createdAt` com o timestamp. Exibido no histórico como:

> *"Aprovado por Fulano de Tal em 20/03/2026 às 14:32"*

---

## 4. Dashboard do Secretário

**Rota:** `/portal/secretario`
**Acesso:** somente papel `SECRETARIO`

### Bloco 1 — Pedidos aguardando aprovação

Lista de solicitações com status `AGUARDANDO_SECRETARIO` da secretaria do Secretário logado, ordenadas por data de criação (mais antigas primeiro).

Colunas: Funcionário | Destino | Datas | `[Analisar]`

### Bloco 2 — Viagens em andamento / histórico

Todas as solicitações da secretaria, filtráveis por status.

Colunas: Funcionário | Destino | Datas | Status | Prestação

Indicadores de prestação:
- `✅ Entregue` — prestação enviada no prazo
- `⏳ Pendente` — prazo em aberto + link `[Ir para Prestação]`
- `⚠ Em atraso` — prazo vencido, destaque em vermelho + link `[Ir para Prestação]`

O link `[Ir para Prestação]` funciona inclusive quando o próprio Secretário é o viajante.

### Bloco 3 — Devolvidos / Reprovados

Lista de solicitações com status `DEVOLVIDO_SECRETARIO` ou `REPROVADO_SECRETARIO` para acompanhamento.

---

## 5. Mudanças nos Formulários Existentes

### Form do Demandante (`SolicitacaoFormClient`)

- Campos `Justificativa do Interesse Público` e `Nexo com as Atribuições do Cargo` sempre `disabled`
- Badge: `"Preenchido pelo Secretário"`
- Campos aparecem vazios no primeiro preenchimento (Demandante não preenche)
- No status `DEVOLVIDO_SECRETARIO`:
  - Banner de alerta com a justificativa do Secretário
  - Botão `"Resubmeter para o Secretário"` substitui `"Enviar"`

---

## 6. Mudanças no Painel Admin

### Nova aba "Secretarias"

- Listar / Criar / Editar / Desativar secretarias
- Campos: Nome, status ativo/inativo

### Cadastro de Usuários

- Novo campo: `Secretaria` (dropdown com secretarias ativas)
- Obrigatório para `DEMANDANTE` e `SECRETARIO`
- Opcional para demais papéis

---

## Resumo de Impacto

| Área | Mudança |
|---|---|
| Banco de dados | Nova tabela `Secretaria`, campo `secretariaId` em `User`, 3 novos status |
| Autenticação / Middleware | Novo papel `SECRETARIO` com proteção de rotas |
| Workflow | Novo passo entre submissão e SECOL |
| Form Demandante | Detalhes da Missão desabilitados, banner de devolução, resubmissão |
| Form Secretário | Novo componente — todos os campos editáveis |
| Dashboard Secretário | Nova página `/portal/secretario` com 3 blocos |
| Admin | Gestão de secretarias + campo no cadastro de usuário |
