# Design — Módulo de Relatórios do Portal de Viagens

**Data:** 2026-03-30
**Status:** Aprovado

---

## Contexto

O Portal de Viagens é um sistema de solicitações de viagens corporativas com workflow multi-etapa (DEMANDANTE → SECOL → SEGOV → SF → SECRETARIO), controle orçamentário por secretaria, prestação de contas e gestão de usuários.

## Abordagem Escolhida: Dashboard Executivo + Relatórios Detalhados (Opção C)

- `/dashboard` — KPIs executivos e gráficos de alto nível (expandir o existente)
- `/relatorios` — Hub de relatórios detalhados por categoria
- `/relatorios/[slug]` — Relatório individual com filtros e exportação

## Controle de Acesso por Perfil

| Perfil | Escopo |
|---|---|
| ADMIN | Todos os dados, todas as secretarias |
| SECRETARIO | Apenas sua secretaria |
| SECOL / SEGOV / SF | Relatórios operacionais do seu workflow |
| DEMANDANTE | Apenas suas próprias solicitações |

## Formato de Saída

- Visualização na tela (tabelas + gráficos)
- Exportação: PDF e Excel/CSV

---

## Catálogo de Relatórios

### Categoria F — Financeiro / Orçamentário
*Perfis: ADMIN, SECRETARIO, SF*

| ID | Nome | Descrição | Exporta |
|---|---|---|---|
| F1 | Gastos por Secretaria | Total de passagens + hospedagem aprovadas por secretaria, por período | PDF, Excel |
| F2 | Orçado vs Executado | Comparativo entre teto orçamentário e valor efetivamente gasto | PDF, Excel |
| F3 | Saldo Disponível por Secretaria | Quanto cada secretaria ainda pode gastar no período | PDF |
| F4 | Gastos por Ficha Orçamentária | Detalhamento por dotação específica (fichaOrcamentaria) | Excel |
| F5 | Evolução Mensal de Gastos | Gráfico de linha com gastos mês a mês no ano | PDF |
| F6 | Top 10 Viagens por Valor | Solicitações com maior custo (passagem + hospedagem) | PDF, Excel |

### Categoria W — Workflow / Operacional
*Perfis: ADMIN, SECOL, SEGOV, SF, SECRETARIO*

| ID | Nome | Descrição | Exporta |
|---|---|---|---|
| W1 | Solicitações por Status | Quantitativo por status com filtro de período | PDF, Excel |
| W2 | Fila por Etapa | Solicitações aguardando em cada etapa do workflow | PDF |
| W3 | Tempo Médio de Aprovação | SLA médio por etapa (dias entre criação e aprovação) | PDF, Excel |
| W4 | Solicitações Rejeitadas/Devolvidas | Lista com motivo de rejeição por etapa | PDF, Excel |
| W5 | Histórico de Ações por Solicitação | Timeline completa de quem fez o quê em cada solicitação | PDF |
| W6 | Solicitações com Urgência | Detecta solicitações criadas com menos de N dias úteis antes da viagem | PDF |

### Categoria S — Servidores / Viajantes
*Perfis: ADMIN, SECRETARIO*

| ID | Nome | Descrição | Exporta |
|---|---|---|---|
| S1 | Viagens por Servidor | Total de viagens, dias, valores gastos por CPF/matrícula | Excel |
| S2 | Servidores com Mais Viagens | Ranking de viajantes frequentes no período | PDF, Excel |
| S3 | Destinos Mais Frequentes | Ranking de cidades/estados de destino | PDF |
| S4 | CPFs Bloqueados | Lista de servidores com CPF bloqueado | PDF |
| S5 | Viagens por Secretaria e Servidor | Cruzamento secretaria × servidor × período | Excel |

### Categoria P — Prestação de Contas
*Perfis: ADMIN, SECRETARIO, SF, DEMANDANTE (própria)*

| ID | Nome | Descrição | Exporta |
|---|---|---|---|
| P1 | Prestações em Atraso | Viagens realizadas sem prestação enviada após prazo | PDF, Excel |
| P2 | Prestações Pendentes | Por secretaria/servidor com prazo restante | PDF |
| P3 | Prestações por Status | Quantitativo de enviadas, pendentes, bloqueadas | PDF |
| P4 | Histórico Completo de Prestações | Todas as prestações com documentos, datas e responsável | Excel |
| P5 | Alerta de Vencimento Próximo | Prestações que vencem nos próximos 5/10/15 dias | PDF |

### Categoria A — Auditoria / Compliance
*Perfis: ADMIN*

| ID | Nome | Descrição | Exporta |
|---|---|---|---|
| A1 | Log de Ações por Usuário | Todas as ações nos WorkflowSteps por ator, com data/hora | PDF, Excel |
| A2 | Solicitações Acima do Teto | Detecta valores que ultrapassaram o limite configurado | PDF, Excel |
| A3 | Atividade por Perfil | Quantas solicitações cada perfil processou no período | PDF |
| A4 | Funil do Workflow | Criadas vs Aprovadas vs Rejeitadas por período | PDF |
| A5 | Gargalos por Etapa | Etapas onde solicitações ficam paradas por mais tempo | Excel |

---

## KPIs do Dashboard Executivo (/dashboard)

Cartões de destaque visíveis ao entrar no portal:

- Total de solicitações no mês / no ano
- Valor total gasto no mês (passagens + hospedagem)
- Saldo orçamentário consolidado
- Prestações em atraso (número + alerta vermelho)
- Solicitações aguardando aprovação por etapa
- Tempo médio de aprovação (dias)

---

## Decisões Técnicas

- Server Components para busca de dados (Prisma direto, sem API intermediária)
- Exportação PDF via `lib/utils/pdf-generator.ts` (já existente)
- Exportação Excel via `xlsx` ou `exceljs`
- Gráficos via `recharts` (compatível com Next.js App Router)
- Filtros de período, secretaria e status como `searchParams` na URL
- Acesso verificado via `auth()` + comparação de role/secretariaId
