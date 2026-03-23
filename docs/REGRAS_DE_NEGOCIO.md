# Regras de Negócio — Sistema de Aprovação de Viagens

**Documento:** Regras de Negócio (Parte de Negócio)
**Versão:** 1.0
**Data:** Março de 2026
**Sistema:** Portal de Viagens — Prefeitura de Osasco

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Papéis e Responsabilidades](#papéis-e-responsabilidades)
3. [Ciclo de Vida de uma Solicitação](#ciclo-de-vida-de-uma-solicitação)
4. [Regras de Submissão](#regras-de-submissão)
5. [Regras de Aprovação](#regras-de-aprovação)
6. [Regras de Orçamento e Empenho](#regras-de-orçamento-e-empenho)
7. [Regras de Prestação de Contas](#regras-de-prestação-de-contas)
8. [Regras de Bloqueio e Segurança](#regras-de-bloqueio-e-segurança)
9. [Vedações Legais](#vedações-legais)
10. [Notificações e Comunicações](#notificações-e-comunicações)

---

## 🎯 Visão Geral

O **Sistema de Aprovação de Viagens** é uma plataforma digital para gerenciar solicitações de deslocamento de servidores públicos a serviço da Prefeitura de Osasco.

### Objetivos Principais

- **Tramitação 100% digital** — sem envio de documentos físicos entre secretarias
- **Segregação de funções** — cada órgão aprova apenas sua etapa
- **Rastreabilidade completa** — registro detalhado de todas as ações
- **Controle orçamentário** — gestão de empenhos e saldos disponíveis
- **Prestação de contas obrigatória** — acompanhamento pós-viagem

---

## 👥 Papéis e Responsabilidades

### 1. DEMANDANTE (Secretaria Demandante)

**Quem?** Servidores da secretaria que precisa autorizar uma viagem.

**Responsabilidades:**
- Preencher e submeter solicitações de viagem
- Revisar solicitações devolvidas pelo Secretário
- Acompanhar o status da aprovação
- Realizar prestação de contas ao final da viagem

**Permissões:**
- Visualizar e editar apenas suas próprias solicitações
- Enviar solicitações inicialmente em RASCUNHO
- Reenviar solicitações devolvidas pelo Secretário para revisão

---

### 2. SECRETÁRIO (Secretária/Gabinete da Demandante)

**Quem?** Gestor ou coordenador da secretaria demandante (elo entre demandante e sistema de compras).

**Responsabilidades:**
- Revisar e analisar a pertinência das solicitações de seus subordinados
- Aprovar solicitações que estejam corretas
- Devolver para correção solicitações incompletas
- Reprovar solicitações que não atendam critérios de interesse público

**Permissões:**
- Visualizar apenas solicitações de sua secretaria
- Editar campos da solicitação (justificativas, dados de logística)
- Aprovar, devolver ou reprovar uma solicitação

**Nota:** Cada Secretário é vinculado a uma secretaria específica.

---

### 3. SECOL (Secretaria de Compras e Licitações)

**Quem?** Departamento de Registro de Preços e Cotação.

**Responsabilidades:**
- Cotação técnica de passagens e hospedagem
- Emissão de Ordem de Serviço (OS)
- Emissão de vouchers para o viajante
- Confirmação de valores nas duas etapas do fluxo

**Permissões:**
- Visualizar todas as solicitações em status AGUARDANDO_COTACAO ou AGUARDANDO_EMISSAO
- Lançar valores de passagem e hospedagem
- Emitir documentos (OS e vouchers)
- Confirmar ou ajustar cotações

---

### 4. SEGOV (Gabinete do Prefeito)

**Quem?** Coordenação de políticas públicas ou assessoria do Gabinete.

**Responsabilidades:**
- Análise de viabilidade político-administrativa da missão
- Aprovação ou rejeição com base em critérios de oportunidade e conveniência
- Validação do interesse público

**Permissões:**
- Visualizar todas as solicitações em status AGUARDANDO_VIABILIDADE
- Aprovar ou reprovar uma solicitação
- Registrar motivo da decisão

---

### 5. SF (Secretaria de Finanças)

**Quem?** Departamento de Execução Orçamentária ou Contabilidade.

**Responsabilidades:**
- Confirmação da execução orçamentária
- Processamento de pagamentos
- Validação da BRS (Biblioteca de Requisições de Serviço) / autorização de despesa
- Detecção de overdraft em empenhos

**Permissões:**
- Visualizar todas as solicitações em status AGUARDANDO_EXECUCAO
- Confirmar recebimento de documentação de despesa
- Consultar saldos de empenho

---

### 6. ADMIN (Administrador do Sistema)

**Quem?** Gestor de TI ou operador do sistema.

**Responsabilidades:**
- Gerenciar usuários e papéis
- Manter configurações do sistema
- Gerenciar secretarias
- Monitorar logs e erros

**Permissões:**
- Criar, editar e desativar usuários
- Associar usuários a secretarias
- Gerenciar configurações globais (prazos, limites, empenhos)

---

## 📊 Ciclo de Vida de uma Solicitação

### Estados e Transições

Uma solicitação de viagem passa pelos seguintes estados, **em ordem obrigatória**:

```
┌─────────────────────────────────────────────────────────────┐
│                         RASCUNHO                             │
│                  (Demandante preenche)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ Demandante submete
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  AGUARDANDO_SECRETARIO                       │
│                   (Secretário revisa)                        │
└──────────────┬───────────────────────────┬──────────────────┘
               │ Aprova                     │ Devolve ou reprova
               ▼                            ▼
     ┌──────────────────┐         ┌────────────────────┐
     │ AGUARDANDO_      │         │ DEVOLVIDO_         │
     │ COTACAO          │         │ SECRETARIO         │
     │ (SECOL cotação)  │         │ (Volta ao Demandante)
     └────────┬─────────┘         └────────┬───────────┘
              │                            │ Demandante reenviar
              │ Confirma cotação           │
              ▼                            │
     ┌──────────────────┐                 │
     │ AGUARDANDO_      │◄────────────────┘
     │ VIABILIDADE      │
     │ (SEGOV aprova)   │
     └───┬──────────┬───┘
         │ Aprova   │ Reprova
         ▼          ▼
   ┌──────────┐  ┌──────────────────┐
   │AGUARDANDO│  │REPROVADA         │
   │_EMISSAO  │  │(FIM — não segue) │
   │(SECOL    │  └──────────────────┘
   │ emite OS)│
   └────┬─────┘
        │ Emite
        ▼
   ┌──────────────────────┐
   │AGUARDANDO_EXECUCAO   │
   │(SF confirma BRS)     │
   └────┬─────────────────┘
        │ Confirma
        ▼
   ┌──────────────────────┐
   │CONCLUIDA             │
   │(Agenda prestação)    │
   └──────────────────────┘
```

### Estados Especiais

- **RASCUNHO:** Solicitação não enviada. Demandante pode editar livremente e descartar.
- **REPROVADA:** Estado final. Solicitação negada. Não pode ser reativada (novo pedido necessário).
- **DEVOLVIDO_SECRETARIO:** Solicitação devolvida para correção. Demandante recebe e pode reenviar.

---

## ✍️ Regras de Submissão

### Dados Obrigatórios

Toda solicitação deve conter:

#### A. Dados do Servidor
- Nome completo
- Matrícula funcional
- CPF
- Data de nascimento
- Celular (telefone de contato)
- E-mail institucional

#### B. A Missão
- **Justificativa de Interesse Público** — descrição do benefício para a administração, objetivo da missão e resultados esperados
- **Nexo com o Cargo** — explicação de como a viagem se relaciona com as atribuições funcionais do servidor

#### C. Logística
- Destino (cidade, estado ou país)
- Data de ida e data de volta (volta > ida)
- Justificativa de localização (economicidade) — por que essa localização e hospedagem específicas
- Ficha orçamentária de contrapartida (código do programa de despesa)

#### D. Documentos
- Mínimo 1 anexo: convite, folder, pauta ou termo de aceite do evento que comprova a missão
- Formatos aceitos: PDF, imagens (JPG, JPEG, PNG), documentos (DOC, DOCX)

### Validações na Submissão

- **CPF bloqueado?** Se o servidor tem prestação de contas pendente e vencida, a submissão é impedida
- **Antecedência mínima?** A solicitação deve ser feita no mínimo **5 dias úteis** antes da data de ida
- **Tamanho de anexos?** Máximo **10 MB** por arquivo, **50 MB** total

### Primeira Aprovação

Ao submeter (DEMANDANTE → AGUARDANDO_SECRETARIO):
1. Solicitação entra em status AGUARDANDO_SECRETARIO
2. Secretários da mesma secretaria recebem notificação por e-mail
3. Demandante pode continuar editando enquanto estiver em RASCUNHO (antes de enviar)

---

## ✅ Regras de Aprovação

### Etapa 1: Revisão do Secretário

**Ator:** SECRETARIO
**Status de entrada:** AGUARDANDO_SECRETARIO
**Ações permitidas:**
1. **Aprovar** → vai para AGUARDANDO_COTACAO
2. **Devolver para correção** → vai para DEVOLVIDO_SECRETARIO, notifica Demandante
3. **Reprovar** → vai para REPROVADA (final), notifica Demandante

**Campos editáveis pelo Secretário:**
- Justificativa de interesse público
- Nexo com o cargo
- Destino
- Datas (ida e volta)
- Justificativa de localização
- Ficha orçamentária

**Critérios de Aprovação:**
- A missão tem real benefício para a administração
- O nexo com o cargo do servidor é claro
- A logística está bem fundamentada
- Os documentos estão anexados

---

### Etapa 2: Cotação Técnica (SECOL)

**Ator:** SECOL
**Status de entrada:** AGUARDANDO_COTACAO
**Ações permitidas:**
1. **Confirmar cotação** → vai para AGUARDANDO_VIABILIDADE, notifica SEGOV

**Operações de SECOL:**
- Lançar valores estimados de **passagem aérea**
- Lançar valores estimados de **hospedagem**
- Registrar observações técnicas (ex.: sobre a Ata de Registro de Preços usada)
- Adicionar indicação de voo e hotel (opcional)

**Regra:** Os valores de passagem e hospedagem são **auto-calculados** a partir das opções selecionadas, mas podem ser **editados manualmente** por SECOL se necessário.

---

### Etapa 3: Viabilidade (SEGOV)

**Ator:** SEGOV
**Status de entrada:** AGUARDANDO_VIABILIDADE
**Ações permitidas:**
1. **Aprovar** → vai para AGUARDANDO_EMISSAO, **DÉBITO DE EMPENHO ocorre aqui**
2. **Reprovar** → vai para REPROVADA (final), notifica Demandante

**Critérios de Aprovação:**
- Interesse político-administrativo da viagem
- Disponibilidade orçamentária (não há overdraft nos empenhos)
- Alinhamento com diretrizes do Gabinete do Prefeito

**Nota Importante:** Ao aprovar em VIABILIDADE, o sistema automaticamente **deduz os valores de passagem e hospedagem** dos empenhos específicos. Se não houver saldo suficiente, o SF é notificado de overdraft.

---

### Etapa 4: Emissão de Documentos (SECOL)

**Ator:** SECOL
**Status de entrada:** AGUARDANDO_EMISSAO
**Ações permitidas:**
1. **Emitir OS e Vouchers** → vai para AGUARDANDO_EXECUCAO, notifica SF

**Operações:**
- Gerar Ordem de Serviço (documento fiscal)
- Emitir vouchers/créditos para o viajante
- Confirmar fornecedores (passagem e hospedagem)

---

### Etapa 5: Confirmação de Despesa (SF)

**Ator:** SF
**Status de entrada:** AGUARDANDO_EXECUCAO
**Ações permitidas:**
1. **Confirmar recebimento da BRS** → vai para CONCLUIDA, notifica Demandante

**Operações:**
- Receber e validar Bilhete de Requisição de Serviço (BRS)
- Confirmar que a despesa foi registrada no sistema contábil
- Criar automaticamente a Prestação de Contas com prazo

---

## 💰 Regras de Orçamento e Empenho

### Empenhos Separados

O sistema gerencia **dois empenhos independentes:**

1. **Empenho de Passagens Aéreas**
   - Número: configurável (ex.: 2026/0002)
   - Valor total anual: configurável (ex.: R$ 50.000,00)
   - Saldo disponível: atualizado a cada aprovação

2. **Empenho de Hospedagem**
   - Número: configurável (ex.: 2026/0003)
   - Valor total anual: configurável (ex.: R$ 50.000,00)
   - Saldo disponível: atualizado a cada aprovação

### Débito Automático

Ao **SEGOV aprovar uma solicitação em VIABILIDADE:**

1. Sistema busca os valores de passagem e hospedagem lançados por SECOL
2. Deduz **passagem** do saldo de EMPENHO_PASSAGEM
3. Deduz **hospedagem** do saldo de EMPENHO_HOSPEDAGEM
4. Novos saldos são registrados

### Notificação de Overdraft

Se **não houver saldo suficiente** em qualquer empenho:

1. A aprovação é **rejeitada automaticamente** (não avança para AGUARDANDO_EMISSAO)
2. SEGOV recebe mensagem de erro
3. **SF é notificado por e-mail** sobre o overdraft
4. Solicitação fica em AGUARDANDO_VIABILIDADE até que saldo seja regularizado

### Saldos Negativos — Política de Ajuste

Se um empenho fica com saldo negativo (por ajustes administrativos), o sistema:
- Continua a aceitar solicitações (as negativas não impedem novas viagens)
- Notifica SF imediatamente
- Requer ação manual de SF (reforço orçamentário) para regularizar

---

## 📋 Regras de Prestação de Contas

### Criação Automática

Quando uma solicitação vai para **CONCLUIDA**, o sistema cria automaticamente uma **Prestação de Contas** com:

- Prazo final = data de retorno + **30 dias úteis** (configurável)
- Status inicial: ABERTA (não bloqueado)
- Anexos vazios (aguardando documentação de despesa)

### Documentação Obrigatória

O servidor deve anexar à prestação de contas:

1. **Notas fiscais e recibos** de passagem aérea
2. **Notas de hospedagem** (comprovante de estadia)
3. **Comprovantes de refeição** (se aplicável)
4. **Relatório descritivo** da viagem (em arquivo ou texto)

### Prazos

- **Prazo normal:** 30 dias úteis após o retorno
- **Alerta:** Notificação de vencimento com **10 dias úteis** de antecedência
- **Vencimento:** Após 30 dias úteis, prestação é marcada como **BLOQUEADA**

### Consequências do Atraso

Se a prestação de contas **venceu sem ser entregue:**

1. CPF do servidor é **bloqueado** no sistema
2. **Nenhuma nova solicitação** pode ser criada por esse servidor
3. Secretários dessa secretaria são **notificados**
4. SF acompanha a regularização

### Desbloqueio

O CPF é desbloqueado quando:
- Servidor entrega a prestação de contas (envio de documentos)
- Administrativo valida e marca como CONCLUÍDA
- Status volta para ABERTA → FINALIZADA

---

## 🔒 Regras de Bloqueio e Segurança

### Bloqueio de CPF

Um servidor não pode criar novas solicitações se:
- Possui uma prestação de contas **BLOQUEADA** e **VENCIDA**
- Sistema verifica automaticamente na submissão

**Ação do sistema:**
- Bloqueia a tentativa de criar nova solicitação
- Exibe mensagem: "Seu CPF está bloqueado. Finalize a prestação de contas de viagem anterior."
- SF recebe notificação

### Segregação de Funções

- **DEMANDANTE** e **SECRETARIO** não podem ser o mesmo usuário em papéis simultaneamente
- Um usuário com papel **SECOL** não pode ter papel **SEGOV**
- Um usuário pode ter apenas **um papel operacional** (DEMANDANTE, SECOL, SEGOV, SF)
- **ADMIN** é papel complementar (pode coexistir com outro)

### Acesso a Dados

- **DEMANDANTE:** visualiza apenas suas solicitações
- **SECRETARIO:** visualiza apenas solicitações de sua secretaria
- **SECOL, SEGOV, SF:** visualizam solicitações em sua etapa
- **ADMIN:** visualiza tudo

### Sigilo e Confidencialidade

- Dados de CPF, matrícula e salário não são exibidos em relatórios públicos
- Justificativas de rejeição (SEGOV ou SECRETARIO) são visíveis apenas ao requerente
- Senhas são criptografadas com hash bcrypt

---

## 🚫 Vedações Legais

### Vedação 1: Pagamento por Adiantamento

**Regra:** É **vedado** o pagamento de despesas de viagem por adiantamento em dinheiro.

**Consequência:**
- Sistema não permite lançar opções de pagamento em dinheiro
- Apenas cartão corporativo, voucher e faturamento direto com fornecedor

**Implementação:** SECOL só pode registrar passagens e hospedagens via prestadores credenciados (Ata de Registro de Preços).

### Vedação 2: Acúmulo de Papéis

**Regra:** Um usuário não pode exercer **dois papéis operacionais diferentes** simultaneamente.

**Exemplo de violação:** Um servidor ser SECOL e SEGOV ao mesmo tempo.

**Validação:** Sistema impede atribuição de papéis conflitantes.

### Vedação 3: Uso Pessoal de Recursos

**Regra:** Viagens devem ter **interesse público comprovado** e nexo claro com o cargo.

**Validação:** SECRETARIO e SEGOV avaliam a justificativa de interesse público.

### Vedação 4: Rejeição sem Fundamentação

**Regra:** Toda rejeição (SEGOV ou SECRETARIO) deve conter **motivo registrado**.

**Campo obrigatório:** Campo "Motivo da rejeição" no formulário de reprovação.

### Vedação 5: Viagem Não Autorizada

**Regra:** Servidor não pode viajar antes de receber aprovação em todas as etapas.

**Implementação:** Apenas servidores com solicitação em CONCLUIDA recebem OS e vouchers.

---

## 📧 Notificações e Comunicações

### Tipos de Notificação

| Evento | Destinatário | Assunto | Momento |
|--------|--------------|---------|---------|
| Nova submissão | Secretários | "Nova solicitação aguardando sua aprovação" | Demandante envia |
| Aprovação do Secretário | Demandante | "Solicitação aprovada pelo Secretário" | Secretário aprova |
| Devolução do Secretário | Demandante | "Solicitação devolvida para correção" | Secretário devolve |
| Reprovação do Secretário | Demandante | "Solicitação reprovada" | Secretário reprova |
| Cotação concluída | SEGOV | "Cotação pronta, aguardando análise de viabilidade" | SECOL confirma |
| Aprovação de viabilidade | SECOL | "Viagem aprovada, prosseguir com emissão de OS" | SEGOV aprova |
| Reprovação de viabilidade | Demandante | "Solicitação reprovada pelo Gabinete" | SEGOV reprova |
| Emissão de OS | SF | "Nova solicitação concluída, aguardando confirmação de BRS" | SECOL emite |
| Conclusão da viagem | Demandante | "Viagem concluída, prazo para prestação de contas" | SF confirma BRS |
| Alerta de vencimento | Demandante | "Sua prestação de contas vence em 10 dias" | 10 dias antes do prazo |
| Vencimento da prestação | SF, SECRETARIO | "Prestação de contas vencida — CPF bloqueado" | Após prazo |
| Overdraft de empenho | SF | "Empenho com saldo insuficiente" | Aprovação negada |

### Canais

- **E-mail:** Notificações via sistema de e-mail institucional
- **Dashboard:** Alertas visuais na página inicial
- **Registro em log:** Todas as ações são registradas no banco de dados

---

## 📌 Resumo das Regras-Chave

| Regra | Descrição |
|-------|-----------|
| **Tramitação 100% digital** | Nenhum documento físico trocado entre secretarias |
| **5 etapas de aprovação** | SECRETARIO → SECOL (cotação) → SEGOV (viabilidade) → SECOL (emissão) → SF (execução) |
| **Segregação de funções** | Um usuário, um papel operacional |
| **Bloqueio de CPF** | Servidor com prestação de contas vencida não pode solicitar novas viagens |
| **Empenhos separados** | Passagem e hospedagem em orçamentos distintos |
| **Antecedência mínima** | Solicitação feita no mínimo 5 dias úteis antes da ida |
| **Prazo de prestação** | 30 dias úteis após o retorno |
| **Vedação de adiantamento** | Sem pagamento prévio em dinheiro |
| **Interesse público** | Toda viagem deve estar fundamentada em benefício administrativo |
| **Rastreabilidade** | Cada ação registra ator, data, hora e decisão |

---

## 📞 Contato e Suporte

Para dúvidas sobre as regras de negócio:

- **Secretaria de Finanças:** Questões sobre orçamento e empenhos
- **SECOL:** Questões sobre cotação e fornecedores
- **TI/Admin:** Problemas de acesso ou login
- **Gabinete do Prefeito:** Questões sobre viabilidade político-administrativa

---

**Documento aprovado:** Administração do Sistema
**Última atualização:** Março 2026
**Status:** Versão de Produção 1.0
