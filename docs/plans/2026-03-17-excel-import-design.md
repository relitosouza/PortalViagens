# Design: Importação de Solicitação de Viagem via Excel

**Data:** 2026-03-17
**Status:** Aprovado

## Contexto

O formulário de solicitação de viagem (`SolicitacaoFormClient.tsx`) tem 15 campos obrigatórios/opcionais distribuídos em 4 seções. Servidores que precisam preencher a mesma solicitação repetidamente (ou que já têm os dados em planilhas internas) devem poder importar um `.xlsx` para pré-preencher o formulário, revisando antes de enviar.

## Abordagem

SheetJS (`xlsx`) com parsing **client-side** (import dinâmico para não impactar bundle inicial). Sem rota de API extra.

## Template Excel

**Arquivo:** `public/modelo-solicitacao-viagem.xlsx` (estático, servido diretamente pelo Next.js)

| Linha | Conteúdo |
|-------|----------|
| 1 | Cabeçalhos em português |
| 2 | Linha de exemplo (orientação ao usuário) |
| 3+ | Área de preenchimento |

**Colunas e mapeamento:**

| Cabeçalho da planilha | Campo interno |
|----------------------|--------------|
| Nome Completo | `nomeCompleto` |
| Matrícula | `matricula` |
| CPF | `cpf` |
| Data de Nascimento | `dataNascimento` (formato DD/MM/AAAA) |
| Telefone/WhatsApp | `celular` |
| E-mail Institucional | `emailServidor` |
| Justificativa do Interesse Público | `justificativaPublica` |
| Nexo com as Atribuições do Cargo | `nexoCargo` |
| Destino | `destino` |
| Data de Ida | `dataIda` (formato DD/MM/AAAA) |
| Data de Volta | `dataVolta` (formato DD/MM/AAAA) |
| Justificativa de Localização | `justificativaLocal` |
| Indicação de Voo | `indicacaoVoo` |
| Indicação de Hospedagem | `indicacaoHospedagem` |
| Ficha Orçamentária | `fichaOrcamentaria` |

## UI

Barra de importação no topo do formulário (`SolicitacaoFormClient.tsx`), acima do card principal:

```
[ 📥 Baixar modelo (.xlsx) ]   [ 📤 Importar planilha ]
```

- **Baixar modelo**: link `<a href="/modelo-solicitacao-viagem.xlsx" download>`
- **Importar planilha**: `<input type="file" accept=".xlsx,.xls">` oculto, ativado pelo botão

## Fluxo de importação

1. Usuário seleciona arquivo `.xlsx`
2. `FileReader.readAsArrayBuffer` carrega o arquivo
3. Import dinâmico de `xlsx` (SheetJS) para não impactar bundle
4. Parser lê a linha 3 (índice 2) — pula cabeçalho (linha 1) e exemplo (linha 2)
5. Mapeia colunas → campos do formulário; datas convertidas de serial Excel ou string `DD/MM/AAAA` para `YYYY-MM-DD` (formato exigido pelo `<input type="date">`)
6. `setForm` atualiza o estado do formulário com os dados importados
7. Se campos obrigatórios estiverem vazios → exibe aviso não-bloqueante; usuário completa manualmente

## Arquitetura

### Novo arquivo: `lib/utils/parse-excel-solicitacao.ts`

Função pura: `parseExcelSolicitacao(buffer: ArrayBuffer): Partial<FormData>`

Responsabilidades:
- Import e uso do SheetJS
- Leitura da linha de dados (índice 2)
- Mapeamento cabeçalho → campo
- Normalização de datas (serial Excel → `YYYY-MM-DD` e `DD/MM/AAAA` → `YYYY-MM-DD`)
- Retornar apenas campos com valor não-vazio

### Alteração: `components/SolicitacaoFormClient.tsx`

- Adicionar barra de importação acima do card
- Handler `handleImport(file: File)`: lê o arquivo, chama `parseExcelSolicitacao`, chama `setForm`
- Estado `importWarning: string` para avisos de campos faltantes

## Dependência nova

```bash
npm install xlsx
```

`xlsx` ~500KB — usar `import('xlsx')` dinâmico dentro do handler para não incluir na bundle do SSR.

## Geração do template

O arquivo `public/modelo-solicitacao-viagem.xlsx` é gerado por um script Node.js (`scripts/gerar-template-excel.ts`) executado uma única vez e commitado no repositório. Não há geração em runtime.
