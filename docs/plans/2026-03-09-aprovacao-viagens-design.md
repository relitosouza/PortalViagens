# Design: Sistema de Aprovação de Despesas com Viagem
**Data:** 2026-03-09
**Status:** Aprovado

## Stack Tecnológica
- **Framework:** Next.js 14 (App Router)
- **Banco de dados:** SQLite via Prisma ORM
- **Autenticação:** NextAuth.js (login e-mail + senha com bcrypt)
- **Estilo:** Tailwind CSS
- **Uploads:** pasta local `/uploads`
- **E-mails:** log em arquivo (sem envio real)

## Roles de Usuário
`DEMANDANTE` | `SECOL` | `SEGOV` | `SF`

## Estados da Solicitação
```
RASCUNHO → AGUARDANDO_COTACAO → AGUARDANDO_VIABILIDADE →
AGUARDANDO_EMISSAO → AGUARDANDO_EXECUCAO → CONCLUIDA
                                         ↘ REPROVADA
                                         ↘ BLOQUEADA_PRESTACAO
```

## Arquitetura
```
viagens/
├── app/
│   ├── (auth)/login/
│   ├── dashboard/
│   ├── solicitacoes/
│   │   ├── nova/
│   │   ├── [id]/
│   │   └── [id]/prestacao/
│   └── api/
│       ├── auth/
│       ├── solicitacoes/
│       └── workflow/
├── prisma/schema.prisma
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   └── email-log.ts
└── uploads/
```

## Modelos de Dados
- **User:** id, name, email, password(hash), role, cpfBloqueado
- **Solicitacao:** dados do servidor, missão, logística, fichaOrcamentaria, status, datas
- **WorkflowStep:** etapa, atorRole, decisao, observacao
- **Prestacao:** relatorio, prazoFinal, bloqueado, anexos
- **Anexo:** nome, path, tipo (CONVITE|VOUCHER|EVIDENCIA|COTACAO)

## Workflow (4 Etapas)
1. **COTACAO** — SECOL/DRP: upload de cotações da agência
2. **VIABILIDADE** — SEGOV: aprovar ou reprovar com base em custo + justificativa
3. **EMISSAO** — SECOL: emitir OS e anexar vouchers (gatilho: aprovação SEGOV)
4. **EXECUCAO** — SF: receber BRS e autorizar liquidação/pagamento

## Regras de Negócio (Hard Rules)
- Antecedência mínima de 15 dias úteis bloqueada no formulário
- Vedação total de "Adiantamento" como forma de pagamento
- Segregação de funções: SECOL não pode aprovar passo da SEGOV
- Prazo de 5 dias úteis para prestação de contas após retorno
- CPF bloqueado automaticamente se prestação não enviada no prazo
- Tramitação 100% digital (Art. 3º)

## Telas
| Tela | Role | Descrição |
|------|------|-----------|
| Login | Todos | E-mail + senha |
| Dashboard | Todos | Fila personalizada por role |
| Nova Solicitação | DEMANDANTE | Formulário 4 passos + validações |
| Detalhe | Todos | Timeline do workflow + ações |
| Prestação de Contas | DEMANDANTE | Relatório + upload de evidências |
