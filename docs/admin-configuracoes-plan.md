# Plano: Tela de Configurações do Administrador

## Contexto do Sistema

O sistema possui 5 perfis: `DEMANDANTE`, `SECOL`, `SEGOV`, `SF` e `ADMIN`.
A tela de configurações é **exclusiva do ADMIN** e centraliza todas as operações administrativas do portal.

---

## Seções Planejadas

### 1. Gestão de Usuários
**O que resolve:** Atualmente usuários só podem ser criados via `prisma/seed.ts`. Não há interface para gerenciar contas.

| Funcionalidade | Detalhe |
|---|---|
| Listar todos os usuários | Nome, e-mail, papel, data de criação, status do CPF |
| Criar novo usuário | Nome, e-mail, senha temporária, papel |
| Editar usuário | Alterar nome, papel e redefinir senha |
| Desbloquear CPF manualmente | Botão de desbloqueio em usuários com `cpfBloqueado: true` |
| Desativar conta | Impede login sem excluir histórico |

**Campos afetados:** `User.name`, `User.email`, `User.role`, `User.cpfBloqueado`

---

### 2. Parâmetros Operacionais
**O que resolve:** Valores como "15 dias úteis" e "5 dias úteis" estão hardcoded no código. O admin deve poder ajustá-los sem deploy.

| Parâmetro | Valor atual | Onde está hardcoded |
|---|---|---|
| Antecedência mínima para solicitação | **15 dias úteis** | `app/api/solicitacoes/route.ts:30` |
| Prazo de prestação de contas | **5 dias úteis** | `app/api/workflow/[id]/route.ts:86` |
| Dias de alerta antes do vencimento | **2 dias** | `app/api/cron/verificar-prestacoes/route.ts:50` |
| Tamanho máximo de upload | **10 MB** | `app/api/upload/route.ts:8` |

> **Implementação sugerida:** Criar modelo `ConfiguracaoSistema` no Prisma com chave/valor, lido dinamicamente nas APIs.

---

### 3. Monitoramento de Prestações de Contas
**O que resolve:** Atualmente o admin não tem visão centralizada de quais prestações estão atrasadas ou quais CPFs estão bloqueados.

| Funcionalidade | Detalhe |
|---|---|
| Lista de prestações vencidas | Servidor, destino, prazo, dias em atraso |
| Lista de CPFs bloqueados | Nome, e-mail, motivo, data do bloqueio |
| Desbloquear CPF em lote | Seleção múltipla + botão de desbloqueio |
| Gráfico de prestações no prazo vs. atrasadas | Visão mensal |

---

### 4. Log de Notificações (E-mail)
**O que resolve:** Os logs ficam em `email-logs.json` sem interface visual. O admin não consegue auditar o que foi enviado.

| Funcionalidade | Detalhe |
|---|---|
| Listar últimos emails enviados | Destinatário, assunto, tipo, timestamp |
| Filtrar por tipo | `VOUCHER_APROVACAO`, `REPROVACAO`, `BLOQUEIO_CPF`, etc. |
| Buscar por servidor | Filtro por nome ou e-mail |
| Limpar logs antigos | Botão para truncar o arquivo de logs |

**Tipos de email existentes:** `VOUCHER_APROVACAO`, `REPROVACAO`, `COTACAO_CONCLUIDA`, `PRESTACAO_RECEBIDA`, `BLOQUEIO_CPF`, `ALERTA_PRAZO`

---

### 5. Painel de Auditoria do Workflow
**O que resolve:** Permite ao admin acompanhar todo o ciclo de aprovação de qualquer solicitação.

| Funcionalidade | Detalhe |
|---|---|
| Visão de todas as solicitações | Qualquer status, qualquer usuário |
| Filtros | Por status, por período, por secretaria |
| Timeline completa por solicitação | Todos os `WorkflowStep` com ator e decisão |
| Exportar dados | CSV das solicitações do período |

---

### 6. Configurações do Sistema
**O que resolve:** Informações técnicas e de ambiente que o admin deve poder visualizar.

| Item | Detalhe |
|---|---|
| Versão do sistema | Data do último deploy |
| Status do cron | Última execução de `verificar-prestacoes` |
| Total de registros no banco | Contagem por modelo |
| Espaço usado em uploads | Tamanho total da pasta `/uploads` |

---

## Estrutura de Navegação da Tela

```
/admin
├── /admin/usuarios          → Gestão de Usuários
├── /admin/parametros        → Parâmetros Operacionais
├── /admin/prestacoes        → Monitoramento de Prestações
├── /admin/emails            → Log de Notificações
├── /admin/auditoria         → Auditoria do Workflow
└── /admin/sistema           → Informações do Sistema
```

---

## Escopo da Implementação (MVP)

Para a primeira versão, implementar as seções de maior impacto operacional:

| Prioridade | Seção | Justificativa |
|---|---|---|
| 🔴 Alta | Gestão de Usuários | Sem isso, criar novos usuários requer acesso ao banco |
| 🔴 Alta | Monitoramento de Prestações / CPF | Principal ponto de atrito operacional atual |
| 🟡 Média | Log de E-mails | Auditar comunicações é requisito de conformidade |
| 🟡 Média | Parâmetros Operacionais | Prazos mudam com regulamentação; não pode exigir deploy |
| 🟢 Baixa | Auditoria do Workflow | Admin já consegue ver isso no dashboard |
| 🟢 Baixa | Info do Sistema | Informativo apenas |

---

## Schema: Novo Modelo `ConfiguracaoSistema`

```prisma
model ConfiguracaoSistema {
  chave     String   @id
  valor     String
  descricao String
  updatedAt DateTime @updatedAt
}
```

**Valores iniciais (seed):**
```
DIAS_UTEIS_ANTECEDENCIA_MINIMA  = "15"
DIAS_UTEIS_PRAZO_PRESTACAO      = "5"
DIAS_ALERTA_VENCIMENTO          = "2"
UPLOAD_MAX_MB                   = "10"
```

---

## Layout Visual

- Segue o padrão do dashboard (sidebar + main)
- Sidebar com seções de configuração como itens de navegação
- Cada seção é uma "tab" no conteúdo principal
- Design consistente com os layouts já implementados (Public Sans, cores primárias `#135bec`)

---

## Proteção de Rota

- Middleware: bloquear acesso a `/admin/**` para qualquer papel que não seja `ADMIN`
- APIs em `/api/admin/**` verificam `session.user.role === 'ADMIN'`
- ADMIN pode ver o dashboard normal mas acessa `/admin` para configurações avançadas
