# Design: Notificações por Email por Fase do Workflow

**Data:** 2026-03-17
**Status:** Aprovado

## Contexto

O PortalViagens já possui uma infraestrutura de email via `logEmail` (`lib/email-log.ts`) que registra emails em `email-logs.json`. Atualmente apenas 3 eventos disparam emails (cotação concluída, aprovação com voucher, reprovação). O objetivo é cobrir todas as transições do workflow, notificando o setor responsável pela próxima ação.

## Matriz de Notificações

| Evento | Destinatário | Tipo |
|--------|-------------|------|
| Demandante submete solicitação (→ AGUARDANDO_COTACAO) | Todos os usuários SECOL | `NOVA_SOLICITACAO_SECOL` |
| SECOL conclui cotação (→ AGUARDANDO_VIABILIDADE) | Todos os usuários SEGOV | `NOVA_VIABILIDADE_SEGOV` |
| SECOL conclui cotação (→ AGUARDANDO_VIABILIDADE) | Demandante | `COTACAO_CONCLUIDA` *(já existe)* |
| SEGOV aprova viabilidade (→ AGUARDANDO_EMISSAO) | Todos os usuários SECOL | `EMISSAO_NECESSARIA_SECOL` |
| SEGOV reprova (→ REPROVADA) | Demandante | `REPROVACAO` *(já existe)* |
| SEGOV pede ajuste → SECOL (→ AGUARDANDO_COTACAO) | Todos os usuários SECOL | `AJUSTE_SECOL` |
| SEGOV pede ajuste → demandante (→ RASCUNHO) | Demandante | `AJUSTE_DEMANDANTE` |
| SECOL emite vouchers (→ AGUARDANDO_EXECUCAO) | Todos os usuários SF | `EXECUCAO_SF` |
| SF aprova execução (→ CONCLUIDA) | Demandante | `VOUCHER_APROVACAO` *(já existe)* |

## Arquitetura

### Novo módulo: `lib/email-notifications.ts`

Responsabilidade única: encapsular toda a lógica de notificação por email do workflow.

**Funções exportadas:**

```ts
notificarRole(role: string, assunto: string, corpo: string, tipo: string): Promise<void>
// Busca prisma.user.findMany({ where: { role, ativo: true } }) e chama logEmail para cada usuário

notificarDemandante(sol: SolicitacaoComUser, assunto: string, corpo: string, tipo: string): void
// Chama logEmail diretamente com sol.emailServidor
```

**Tipos de email por função helper:**
- `notificarNovaSOlicitacaoParaSecol(sol)`
- `notificarCotacaoParaSegov(sol)`
- `notificarViabilidadeAprovadaParaSecol(sol)`
- `notificarAjusteParaSecol(sol, observacao)`
- `notificarAjusteParaDemandante(sol, observacao)`
- `notificarEmissaoParaSf(sol)`

### Arquivos alterados

1. **`app/api/solicitacoes/route.ts`** (POST)
   Ao submeter solicitação (status → AGUARDANDO_COTACAO): chamar `notificarNovaSOlicitacaoParaSecol(sol)`.

2. **`app/api/workflow/[id]/route.ts`**
   Substituir `logEmail` diretos pelas funções do novo módulo e adicionar os casos faltantes.

## Decisões

- Manter `logEmail` como a camada de transporte (arquivo JSON) — não introduzir SMTP neste escopo
- Buscar usuários do role alvo via `prisma.user.findMany` em tempo real (não cache)
- `notificarRole` é `async` pois faz query ao banco; `notificarDemandante` é síncrono
- Não quebrar o workflow se o email falhar — notificações são fire-and-forget (`.catch(() => {})`)
