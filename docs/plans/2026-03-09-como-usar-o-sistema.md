# Como Usar o Sistema — Guia de Uso do Sistema de Aprovação de Viagens

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Criar um guia de uso completo do Sistema de Aprovação de Viagens da Prefeitura de Osasco, cobrindo todos os perfis de usuário, o fluxo de aprovação e as regras de negócio.

**Architecture:** O guia será um documento Markdown em `docs/` que descreve cada tela e ação do sistema para cada um dos 4 papéis (DEMANDANTE, SECOL, SEGOV, SF). Será estruturado em seções por papel e por fluxo de status, com capturas de tela representadas por descrições das telas reais do código.

**Tech Stack:** Next.js 15, NextAuth v5 (Credentials), Prisma 7, SQLite, Tailwind CSS. Documento final: Markdown (`docs/como-usar-o-sistema.md`).

---

### Task 1: Estrutura e Cabeçalho do Guia

**Files:**
- Create: `docs/como-usar-o-sistema.md`

**Step 1: Criar o arquivo com cabeçalho e índice**

Criar `docs/como-usar-o-sistema.md` com o seguinte conteúdo inicial:

```markdown
# Guia de Uso — Sistema de Aprovação de Viagens
## Prefeitura de Osasco

> Versão 1.0 · Sistema interno restrito a servidores autorizados (Art. 3º)

## Índice

1. [Visão Geral do Sistema](#visão-geral-do-sistema)
2. [Acesso e Login](#acesso-e-login)
3. [Perfis de Usuário (Roles)](#perfis-de-usuário-roles)
4. [Fluxo de Aprovação](#fluxo-de-aprovação)
5. [Guia por Perfil](#guia-por-perfil)
   - [DEMANDANTE — Secretaria Demandante](#demandante--secretaria-demandante)
   - [SECOL — Secretaria de Compras e Licitações](#secol--secretaria-de-compras-e-licitações)
   - [SEGOV — Gabinete do Prefeito](#segov--gabinete-do-prefeito)
   - [SF — Secretaria de Finanças](#sf--secretaria-de-finanças)
6. [Prestação de Contas](#prestação-de-contas)
7. [Regras e Vedações Legais](#regras-e-vedações-legais)
8. [Perguntas Frequentes](#perguntas-frequentes)
```

**Step 2: Verificar que o arquivo foi criado**

```bash
ls -la /e/projetos/Viagens/docs/como-usar-o-sistema.md
```

Esperado: arquivo listado com tamanho > 0.

**Step 3: Commit**

```bash
git add docs/como-usar-o-sistema.md
git commit -m "docs: inicia guia de uso — estrutura e índice"
```

---

### Task 2: Visão Geral e Acesso ao Sistema

**Files:**
- Modify: `docs/como-usar-o-sistema.md`

**Step 1: Adicionar seção de Visão Geral**

Acrescentar ao documento:

```markdown
---

## Visão Geral do Sistema

O **Sistema de Aprovação de Viagens** da Prefeitura de Osasco é uma plataforma web 100% digital
para solicitação, aprovação e prestação de contas de viagens a serviço.

**Características principais:**
- Tramitação 100% digital — sem envio de documentos físicos entre secretarias (Art. 3º)
- Segregação de funções: cada secretaria aprova apenas sua etapa — nenhum usuário acumula dois papéis
- Rastreabilidade completa: todo passo do workflow é registrado com nome do ator, data e hora
- Bloqueio automático de CPF para novos pedidos em caso de prestação de contas em atraso (Art. 4º)
- Notificações por e-mail a cada mudança de status

**Tecnologia:** Next.js 15 · NextAuth v5 · Prisma 7 · SQLite · Tailwind CSS

---

## Acesso e Login

**URL do sistema:** `http://localhost:3000` (ambiente de desenvolvimento)

### Como fazer login

1. Acesse a URL do sistema — você será redirecionado automaticamente para `/login`
2. Informe seu **e-mail institucional** (ex.: `servidor@osasco.sp.gov.br`)
3. Informe sua **senha**
4. Clique em **Entrar**

> Acesso restrito a servidores previamente cadastrados pelo administrador do sistema.
> Em caso de erro "E-mail ou senha inválidos", entre em contato com a TI.

Após o login bem-sucedido, você é redirecionado para o **Dashboard** — sua tela principal.
```

**Step 2: Verificar conteúdo adicionado**

```bash
grep -c "Visão Geral" /e/projetos/Viagens/docs/como-usar-o-sistema.md
```

Esperado: `1` (seção encontrada).

**Step 3: Commit**

```bash
git add docs/como-usar-o-sistema.md
git commit -m "docs: adiciona visão geral e instruções de login"
```

---

### Task 3: Perfis de Usuário e Fluxo de Aprovação

**Files:**
- Modify: `docs/como-usar-o-sistema.md`

**Step 1: Adicionar seção de Perfis de Usuário**

```markdown
---

## Perfis de Usuário (Roles)

O sistema possui **4 perfis**, cada um com acesso restrito à sua etapa do fluxo:

| Role | Nome no sistema | Responsabilidade |
|------|----------------|-----------------|
| `DEMANDANTE` | Secretaria Demandante | Abre solicitações de viagem; visualiza apenas suas próprias solicitações |
| `SECOL` | SECOL / DRP | Realiza cotação técnica (Ata de Registro de Preços) e emite a Ordem de Serviço + vouchers |
| `SEGOV` | SEGOV — Gabinete | Aprova ou reprova a viabilidade político-financeira da missão |
| `SF` | Secretaria de Finanças | Confirma a execução orçamentária (recebimento da BRS) |

> **Segregação de funções:** SECOL e SEGOV nunca atuam na mesma etapa. Um usuário com papel SECOL
> não pode executar ações de SEGOV e vice-versa — isso é garantido tecnicamente pelo sistema.

---

## Fluxo de Aprovação

O ciclo de vida de uma solicitação segue os seguintes **status** em ordem:

```
RASCUNHO
    ↓  (DEMANDANTE envia)
AGUARDANDO_COTACAO
    ↓  (SECOL confirma cotação)
AGUARDANDO_VIABILIDADE
    ↓  (SEGOV aprova)           → REPROVADA (SEGOV reprova)
AGUARDANDO_EMISSAO
    ↓  (SECOL emite OS)
AGUARDANDO_EXECUCAO
    ↓  (SF confirma BRS)
CONCLUIDA
```

### Detalhamento das Etapas

| Etapa | Status de entrada | Ator | Ação | Próximo status |
|-------|------------------|------|------|----------------|
| Cotação Técnica | `AGUARDANDO_COTACAO` | SECOL | Confirmar cotação da Ata de Registro de Preços | `AGUARDANDO_VIABILIDADE` |
| Análise de Viabilidade | `AGUARDANDO_VIABILIDADE` | SEGOV | Aprovar ou reprovar a viabilidade | `AGUARDANDO_EMISSAO` ou `REPROVADA` |
| Emissão de OS e Vouchers | `AGUARDANDO_EMISSAO` | SECOL | Emitir Ordem de Serviço e enviar vouchers | `AGUARDANDO_EXECUCAO` |
| Execução Orçamentária (BRS) | `AGUARDANDO_EXECUCAO` | SF | Confirmar recebimento da BRS | `CONCLUIDA` |

### Notificações automáticas por e-mail

- **Cotação concluída:** servidor é notificado que aguarda análise de viabilidade
- **Reprovação:** servidor recebe e-mail com o motivo da reprovação
- **Aprovação final:** servidor recebe e-mail com os vouchers e o prazo de prestação de contas
```

**Step 2: Verificar seção de fluxo**

```bash
grep -c "AGUARDANDO_COTACAO" /e/projetos/Viagens/docs/como-usar-o-sistema.md
```

Esperado: ao menos `2`.

**Step 3: Commit**

```bash
git add docs/como-usar-o-sistema.md
git commit -m "docs: adiciona perfis de usuário e fluxo de aprovação"
```

---

### Task 4: Guia do Perfil DEMANDANTE

**Files:**
- Modify: `docs/como-usar-o-sistema.md`

**Step 1: Adicionar guia completo do DEMANDANTE**

```markdown
---

## Guia por Perfil

---

### DEMANDANTE — Secretaria Demandante

#### O que o DEMANDANTE vê no Dashboard

Após o login, o DEMANDANTE vê:
- Cabeçalho: **"Aprovação de Viagens — Osasco"** com seu nome e a indicação **"Secretaria Demandante"**
- Seção **"Minhas Solicitações"** — lista apenas as solicitações criadas por ele
- Botão **"+ Nova Solicitação"** no canto superior direito
- Alertas de prestação de contas pendentes (se houver)

> Usuários DEMANDANTE **não visualizam** solicitações de outros servidores.

#### Criar uma Nova Solicitação de Viagem

Clique em **"+ Nova Solicitação"**. O formulário é dividido em **4 passos**:

##### Passo 1 — Dados do Servidor

Preencha obrigatoriamente:
- **Nome Completo** — nome do servidor que realizará a viagem
- **Matrícula** — matrícula funcional
- **CPF** — no formato `000.000.000-00`
- **Data de Nascimento**
- **Celular** — no formato `(11) 99999-9999`
- **E-mail do Servidor** — e-mail institucional (para receber notificações)

Clique em **"Próximo →"**.

##### Passo 2 — A Missão

Preencha obrigatoriamente:
- **Justificativa do Interesse Público** — descreva o benefício para a administração pública,
  o objetivo da missão e os resultados esperados
- **Nexo com o Cargo** — explique como a viagem se relaciona diretamente com as atribuições do cargo

Clique em **"Próximo →"**.

##### Passo 3 — Logística

Preencha obrigatoriamente:
- **Destino** — cidade, estado ou país
- **Data de Ida** e **Data de Volta** — a data de volta deve ser posterior à de ida
- **Justificativa de Localização (Economicidade)** — justifique a escolha de localização e
  hospedagem seguindo o princípio da economicidade
- **Ficha Orçamentária de Contrapartida** — código da ficha orçamentária,
  ex: `01.001.04.122.0001.2001.339030`

> **Atenção — Vedação Legal (Art. 4º, § 2º):** O pagamento por adiantamento é **vedado**.
> Toda despesa será processada pela Secretaria de Finanças após aprovação.

Clique em **"Próximo →"**.

##### Passo 4 — Documentos

- Anexe o **convite, folder ou pauta do evento** que comprova a missão
- Formatos aceitos: PDF, JPG, JPEG, PNG, DOC, DOCX
- É possível anexar múltiplos arquivos

Clique em **"✓ Enviar Solicitação"**.

> **Tramitação Digital (Art. 3º):** Toda a tramitação é 100% digital.
> Não é necessário enviar documentos físicos entre secretarias.

#### Acompanhar o Status de uma Solicitação

No Dashboard, clique em qualquer solicitação para ver os detalhes. Você verá:
- **Dados do Servidor**
- **A Missão** (justificativas)
- **Logística** (destino, datas, ficha orçamentária)
- **Documentos Anexados** (links para download)
- **Fluxo de Aprovação** — timeline visual com todas as etapas

##### Entendendo a Timeline

Cada etapa aparece com um dos seguintes estados:
- **Azul pulsante** — etapa atual, em análise
- **Verde com ✓** — etapa aprovada
- **Vermelho com ✗** — etapa reprovada
- **Cinza** — etapa pendente (aguardando as anteriores)

Quando uma etapa é concluída, o nome do ator responsável e a data/hora ficam registrados.
```

**Step 2: Verificar seção do DEMANDANTE**

```bash
grep -c "DEMANDANTE" /e/projetos/Viagens/docs/como-usar-o-sistema.md
```

Esperado: ao menos `5`.

**Step 3: Commit**

```bash
git add docs/como-usar-o-sistema.md
git commit -m "docs: guia completo do perfil DEMANDANTE"
```

---

### Task 5: Guia dos Perfis SECOL, SEGOV e SF

**Files:**
- Modify: `docs/como-usar-o-sistema.md`

**Step 1: Adicionar guia do SECOL**

```markdown
---

### SECOL — Secretaria de Compras e Licitações / DRP

#### O que a SECOL vê no Dashboard

O Dashboard da SECOL exibe a **"Fila de Aprovação"** — somente solicitações nos status:
- `AGUARDANDO_COTACAO` — aguardando cotação técnica
- `AGUARDANDO_EMISSAO` — aguardando emissão de OS e vouchers

Para cada solicitação, são exibidos: nome do servidor, destino, datas e o status atual.

#### Etapa 1 — Cotação Técnica (`AGUARDANDO_COTACAO`)

1. Clique na solicitação
2. Revise todos os dados do servidor, missão e logística
3. Consulte a **Ata de Registro de Preços** e levante as opções de voos/hotéis
4. Na seção **"Ação Requerida"**, leia a descrição da ação:
   *"Confirma que a cotação da Ata de Registro de Preços foi consultada e as opções de voos/hotéis foram anexadas."*
5. Opcionalmente, adicione uma **observação** no campo de texto
6. Clique em **"Confirmar Cotação e Avançar"**

A solicitação passa para `AGUARDANDO_VIABILIDADE` (fila da SEGOV).

#### Etapa 3 — Emissão de OS e Vouchers (`AGUARDANDO_EMISSAO`)

1. Clique na solicitação aprovada pela SEGOV
2. Na seção **"Ação Requerida"**:
   *"Confirma a emissão da Ordem de Serviço e o envio dos vouchers ao servidor."*
3. Emita a Ordem de Serviço externamente e envie os vouchers ao servidor
4. Opcionalmente, registre uma observação
5. Clique em **"Emitir OS e Enviar Vouchers"**

A solicitação passa para `AGUARDANDO_EXECUCAO` (fila da SF).

> **Nota:** A SECOL atua em duas etapas não consecutivas (Cotação e Emissão). Isso é parte
> intencional da segregação de funções — a SEGOV decide a viabilidade entre as duas atuações da SECOL.
```

**Step 2: Adicionar guia do SEGOV**

```markdown
---

### SEGOV — Gabinete do Prefeito

#### O que a SEGOV vê no Dashboard

O Dashboard da SEGOV exibe a **"Fila de Aprovação"** — somente solicitações no status:
- `AGUARDANDO_VIABILIDADE` — aguardando análise de viabilidade político-financeira

#### Etapa 2 — Análise de Viabilidade (`AGUARDANDO_VIABILIDADE`)

1. Clique na solicitação
2. Leia com atenção a **Justificativa do Interesse Público** e o **Nexo com o Cargo**
3. Analise a logística (destino, datas, ficha orçamentária)
4. Na seção **"Ação Requerida"**, escolha uma das opções:

##### Aprovar

- Clique em **"Aprovar Viabilidade"**
- Confirma a solicitação com base na conveniência e oportunidade político-financeira
- A solicitação avança para `AGUARDANDO_EMISSAO`

##### Reprovar

- Informe o **motivo da reprovação** no campo de observação (obrigatório)
- Clique em **"Reprovar Solicitação"**
- A solicitação vai para `REPROVADA`
- O servidor recebe notificação por e-mail com o motivo

> **Segregação de funções:** A SEGOV **não pode** executar ações das etapas da SECOL ou da SF.
> Qualquer tentativa retorna erro 403 (Proibido).
```

**Step 3: Adicionar guia da SF**

```markdown
---

### SF — Secretaria de Finanças

#### O que a SF vê no Dashboard

O Dashboard da SF exibe a **"Fila de Aprovação"** — somente solicitações no status:
- `AGUARDANDO_EXECUCAO` — aguardando confirmação de execução orçamentária

#### Etapa 4 — Execução Orçamentária (`AGUARDANDO_EXECUCAO`)

1. Clique na solicitação que chegou após emissão da OS pela SECOL
2. Verifique o recebimento da **BRS (Boletim de Registro de Serviços)**
3. Na seção **"Ação Requerida"**:
   *"Confirma o recebimento da BRS e autoriza o processo para liquidação e pagamento."*
4. Opcionalmente, registre uma observação
5. Clique em **"Confirmar Execução Orçamentária (BRS)"**

A solicitação passa para `CONCLUIDA`.

Após a conclusão:
- O servidor recebe e-mail com confirmação de aprovação e link para os vouchers
- O sistema cria automaticamente um prazo de **prestação de contas (5 dias úteis)** a partir da data de retorno
```

**Step 4: Verificar seções SECOL, SEGOV, SF**

```bash
grep -E "^### (SECOL|SEGOV|SF)" /e/projetos/Viagens/docs/como-usar-o-sistema.md | wc -l
```

Esperado: `3`.

**Step 5: Commit**

```bash
git add docs/como-usar-o-sistema.md
git commit -m "docs: guia dos perfis SECOL, SEGOV e SF"
```

---

### Task 6: Prestação de Contas e Regras Legais

**Files:**
- Modify: `docs/como-usar-o-sistema.md`

**Step 1: Adicionar seção de Prestação de Contas**

```markdown
---

## Prestação de Contas

Após a conclusão de uma viagem (`CONCLUIDA`), o DEMANDANTE deve enviar a **prestação de contas**
em até **5 dias úteis** após a data de retorno (Art. 4º).

### Como acessar a Prestação de Contas

**Via alerta no Dashboard:**
- Se houver prestação pendente, um alerta vermelho aparece no topo do Dashboard
- O alerta mostra o destino, o prazo final e a quantidade de dias restantes
- Clique em **"Enviar Agora →"**

**Via detalhe da solicitação:**
- Acesse a solicitação com status `CONCLUIDA`
- No rodapé da página, veja a seção **"Prestação de Contas — Art. 4º"**
- Clique em **"Enviar Prestação de Contas →"**

### Formulário de Prestação de Contas

Preencha obrigatoriamente:
1. **Relatório de Atividades** — descreva detalhadamente:
   - Atividades realizadas durante a missão
   - Eventos em que participou
   - Conhecimentos adquiridos
   - Contatos estabelecidos
   - Resultados que beneficiam a administração pública municipal

2. **Evidências (opcional mas recomendado)** — anexe documentos comprobatórios:
   - Fotos, certificados, lista de presença
   - Formatos aceitos: PDF, JPG, PNG

Clique em **"✓ Enviar Prestação de Contas"**.

### Consequências do Não Cumprimento

> **Atenção (Art. 4º):** O não envio da prestação de contas no prazo resulta em:
> - **Bloqueio do CPF** — impedimento de abertura de novas solicitações de viagem
> - O alerta no Dashboard passa a exibir a mensagem:
>   *"⛔ CPF bloqueado para novas solicitações até o envio do relatório"*
```

**Step 2: Adicionar seção de Regras e Vedações Legais**

```markdown
---

## Regras e Vedações Legais

### Art. 3º — Tramitação Digital

> Toda a tramitação é **100% digital**. Não é necessário o envio de documentos físicos entre
> as secretarias da Prefeitura de Osasco.

### Art. 4º, § 2º — Vedação de Adiantamento

> O pagamento por **adiantamento é vedado** neste fluxo. Toda despesa será processada pela
> Secretaria de Finanças após aprovação e emissão da Ordem de Serviço.

### Art. 4º — Prazo de Prestação de Contas

> O servidor tem **5 dias úteis** após a data de retorno para enviar a prestação de contas.
> O descumprimento resulta em bloqueio de CPF para novas solicitações.

### Segregação de Funções

O sistema garante tecnicamente que:
- **SECOL** só pode agir nos status `AGUARDANDO_COTACAO` e `AGUARDANDO_EMISSAO`
- **SEGOV** só pode agir no status `AGUARDANDO_VIABILIDADE`
- **SF** só pode agir no status `AGUARDANDO_EXECUCAO`
- **DEMANDANTE** não pode executar nenhuma ação de aprovação — apenas abre e acompanha solicitações
- Qualquer tentativa de ação não autorizada retorna erro HTTP 403 com mensagem explicativa
```

**Step 3: Adicionar Perguntas Frequentes**

```markdown
---

## Perguntas Frequentes

**Posso editar uma solicitação após enviá-la?**
Não. Após o envio, a solicitação entra em `AGUARDANDO_COTACAO` e não pode ser editada.
Se houver erro, entre em contato com a SECOL para que a solicitação seja tratada internamente.

**Não vejo o botão de ação na solicitação. Por quê?**
O botão de ação só aparece quando a solicitação está no status correto para o seu perfil.
Verifique o status atual na timeline e confirme que é sua etapa de atuação.

**A solicitação foi reprovada. O que fazer?**
Você receberá um e-mail com o motivo. Crie uma nova solicitação corrigindo os pontos indicados.

**Como vejo os vouchers após a aprovação?**
Você receberá um e-mail com o link. Também é possível acessar os documentos na página de
detalhes da solicitação, na seção "Documentos Anexados".

**Não recebi o e-mail de notificação. O que fazer?**
Verifique a pasta de spam. Se o problema persistir, entre em contato com a TI para verificar
o endereço de e-mail cadastrado no sistema.

**Meu CPF está bloqueado. Como desbloquear?**
Envie a prestação de contas pendente acessando o alerta no Dashboard.
O desbloqueio é automático após o envio.

**Posso usar o sistema pelo celular?**
Sim. O sistema é responsivo e pode ser acessado pelo navegador do celular.
```

**Step 4: Verificar documento completo**

```bash
wc -l /e/projetos/Viagens/docs/como-usar-o-sistema.md
```

Esperado: mais de 150 linhas.

**Step 5: Commit final**

```bash
git add docs/como-usar-o-sistema.md
git commit -m "docs: adiciona prestação de contas, regras legais e FAQ — guia completo"
```

---

### Task 7: Revisão e Formatação Final

**Files:**
- Modify: `docs/como-usar-o-sistema.md`

**Step 1: Verificar links internos do índice**

Abra o arquivo em um visualizador Markdown (ex.: VS Code preview) e confirme:
- Todos os links do Índice navegam para as seções corretas
- Nenhum bloco de código está mal fechado
- Todas as tabelas renderizam corretamente

**Step 2: Conferir cobertura de todos os 4 perfis**

```bash
grep -E "^### (DEMANDANTE|SECOL|SEGOV|SF)" /e/projetos/Viagens/docs/como-usar-o-sistema.md
```

Esperado: 4 linhas, uma para cada perfil.

**Step 3: Conferir cobertura de todos os status**

```bash
grep -c "AGUARDANDO_\|CONCLUIDA\|REPROVADA\|RASCUNHO" /e/projetos/Viagens/docs/como-usar-o-sistema.md
```

Esperado: ao menos `10` ocorrências.

**Step 4: Commit final de revisão**

```bash
git add docs/como-usar-o-sistema.md
git commit -m "docs: revisão e formatação final do guia de uso"
```
