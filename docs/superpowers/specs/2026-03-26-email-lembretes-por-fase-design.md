# Design: Email de Alerta e Lembretes Automáticos por Fase

**Data:** 2026-03-26
**Status:** Aprovado

---

## Resumo

Implementar dois comportamentos de notificação por email no Portal Viagens Osasco:

1. **Corrigir lacunas** nas notificações das transições do SECRETÁRIO (3 casos sem email)
2. **Lembretes automáticos diários** para o responsável de cada fase pendente, com escalonamento para SEGOV após 5 dias sem ação

---

## Lacunas a Corrigir

As seguintes transições existem no workflow mas não disparam email:

| Transição | Status resultante | Quem deve ser notificado |
|---|---|---|
| SECRETARIO → APROVADO | `EM_COTACAO` | SECOL (nova cotação pendente) |
| SECRETARIO → AJUSTE_DEMANDANTE | `DEVOLVIDO_SECRETARIO` | DEMANDANTE (ajuste necessário) |
| SECRETARIO → REPROVADO | `REPROVADA` | DEMANDANTE (solicitação reprovada) |

---

## Lembretes Automáticos

### Modelo de Dados

Dois campos adicionados ao modelo `Solicitacao` no Prisma:

```prisma
model Solicitacao {
  // campos existentes...
  ultimoLembrete  DateTime?
  qtdLembretes    Int        @default(0)
}
```

- `ultimoLembrete`: timestamp do último lembrete enviado (null = nenhum enviado ainda)
- `qtdLembretes`: contador de lembretes enviados na fase atual

**Reset ao avançar de fase:** sempre que o workflow avança, ambos os campos são resetados (`ultimoLembrete = null`, `qtdLembretes = 0`).

### Mapeamento Fase → Responsável

| Status pendente | Role notificado | Observação |
|---|---|---|
| `AGUARDANDO_APROVACAO_PASTA` | `SECRETARIO` | Apenas da secretaria da solicitação |
| `EM_COTACAO` | `SECOL` | Todos os usuários ativos do role |
| `AGUARDANDO_VIABILIDADE` | `SEGOV` | Todos os usuários ativos do role |
| `AGUARDANDO_EMISSAO` | `SECOL` | Todos os usuários ativos do role |
| `AGUARDANDO_EXECUCAO` | `SF` | Todos os usuários ativos do role |
| `DEVOLVIDO_SECRETARIO` | `DEMANDANTE` | Via `emailServidor` da solicitação |

### Lógica do Cron

```
1. Validar CRON_SECRET no header Authorization: Bearer <token>
2. Buscar solicitações com status IN [AGUARDANDO_APROVACAO_PASTA, EM_COTACAO,
   AGUARDANDO_VIABILIDADE, AGUARDANDO_EMISSAO, AGUARDANDO_EXECUCAO, DEVOLVIDO_SECRETARIO]
   WHERE (ultimoLembrete IS NULL OR ultimoLembrete <= now() - 24h)
3. Para cada solicitação:
   a. qtdLembretes < 5  → notificarLembreteFase(sol)
   b. qtdLembretes === 5 → notificarEscalonamento(sol) para SEGOV
   c. qtdLembretes > 5  → skip (já escalou, não envia mais)
   d. UPDATE ultimoLembrete = now(), qtdLembretes += 1
4. Retornar { processadas, lembretes, escalamentos }
```

### Endpoint

```
GET /api/cron/lembretes
Authorization: Bearer <CRON_SECRET>
```

Resposta de sucesso:
```json
{ "ok": true, "processadas": 3, "lembretes": 2, "escalamentos": 1 }
```

---

## Arquivos Afetados

| Arquivo | Tipo de mudança |
|---|---|
| `prisma/schema.prisma` | Adicionar `ultimoLembrete` e `qtdLembretes` ao modelo `Solicitacao` |
| `lib/email-notifications.ts` | Adicionar `notificarSecretarioAprovacaoParaSecol`, `notificarSecretarioAjusteParaDemandante`, `notificarSecretarioReprovacaoParaDemandante`, `notificarLembreteFase`, `notificarEscalonamento` |
| `app/api/workflow/[id]/route.ts` | Adicionar 3 disparos de email nas transições do SECRETÁRIO + reset de contadores |
| `app/api/cron/lembretes/route.ts` | Novo arquivo — endpoint do cron |

---

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `CRON_SECRET` | Token secreto para autenticar chamadas ao endpoint do cron |
| `EMAIL_USER` | Já existente |
| `EMAIL_PASSWORD` | Já existente |
| `APP_URL` | Já existente |

---

## Tratamento de Erros

- Falha de email nunca bloqueia o cron nem o workflow — todos os envios têm `.catch(() => {})` isolado
- Falha em uma solicitação não interrompe o processamento das demais — loop com `try/catch` por item
- `CRON_SECRET` ausente ou inválido → resposta `401`
- Logs via `console.log` em cada envio (visível no Vercel/servidor)

---

## Configuração Vercel (opcional)

```json
// vercel.json
{
  "crons": [{ "path": "/api/cron/lembretes", "schedule": "0 8 * * *" }]
}
```

Roda todo dia às 8h. Compatível também com cron-job.org ou qualquer serviço externo de cron.
