# Excel Import — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que usuários baixem um template `.xlsx` e importem os dados para pré-preencher o formulário de solicitação de viagem.

**Architecture:** Instalar SheetJS (`xlsx`), gerar o template estático via script Node.js e commitá-lo em `public/`, criar um parser client-side puro em `lib/utils/`, e adicionar a barra de download/importação ao `SolicitacaoFormClient.tsx` usando import dinâmico para não impactar a bundle do SSR.

**Tech Stack:** Next.js 15, TypeScript, SheetJS (`xlsx`), `tsx` (para executar o script de geração)

---

### Task 1: Instalar xlsx e gerar o template Excel

**Files:**
- Modify: `package.json` (via npm install)
- Create: `scripts/gerar-template-excel.ts`
- Create: `public/modelo-solicitacao-viagem.xlsx` (gerado pelo script)

**Step 1: Instalar a dependência**

```bash
npm install xlsx
npm install --save-dev tsx
```

Expected: `xlsx` aparece em `dependencies` no `package.json`.

**Step 2: Criar o script de geração**

Criar `scripts/gerar-template-excel.ts` com o conteúdo exato abaixo:

```typescript
// scripts/gerar-template-excel.ts
import * as XLSX from 'xlsx'
import path from 'path'

const HEADERS = [
  'Nome Completo',
  'Matrícula',
  'CPF',
  'Data de Nascimento',
  'Telefone/WhatsApp',
  'E-mail Institucional',
  'Justificativa do Interesse Público',
  'Nexo com as Atribuições do Cargo',
  'Destino',
  'Data de Ida',
  'Data de Volta',
  'Justificativa de Localização',
  'Indicação de Voo',
  'Indicação de Hospedagem',
  'Ficha Orçamentária',
]

const EXAMPLE = [
  'João da Silva',
  '123456-7',
  '000.000.000-00',
  '15/06/1985',
  '(11) 99999-9999',
  'joao.silva@osasco.sp.gov.br',
  'Participação em congresso nacional de gestão pública para capacitação da equipe.',
  'O cargo de Analista de Políticas Públicas exige atualização constante em gestão municipal.',
  'Brasília, DF',
  '20/04/2026',
  '23/04/2026',
  'O evento ocorre exclusivamente em Brasília, sede do governo federal.',
  'Voo das 06h30 (LATAM LA3456)',
  'Hotel próximo ao centro de convenções',
  '02.10.01.001',
]

const wb = XLSX.utils.book_new()
const ws = XLSX.utils.aoa_to_sheet([HEADERS, EXAMPLE])

// Largura das colunas
ws['!cols'] = HEADERS.map((_, i) => ({
  wch: i >= 6 && i <= 7 ? 50 : i === 0 ? 30 : 22,
}))

// Estilo do cabeçalho (negrito via comentário — SheetJS community não tem estilos sem xlsx-style)
// Linha de exemplo marcada como orientação
XLSX.utils.book_append_sheet(wb, ws, 'Solicitação de Viagem')

const outputPath = path.join(process.cwd(), 'public', 'modelo-solicitacao-viagem.xlsx')
XLSX.writeFile(wb, outputPath)
console.log(`Template gerado: ${outputPath}`)
```

**Step 3: Executar o script para gerar o arquivo**

```bash
npx tsx scripts/gerar-template-excel.ts
```

Expected: `Template gerado: .../public/modelo-solicitacao-viagem.xlsx`

Verificar que o arquivo existe:
```bash
ls public/modelo-solicitacao-viagem.xlsx
```

**Step 4: Verificar build**

```bash
npm run build
```

Expected: compilado sem erros.

**Step 5: Commit**

```bash
git add scripts/gerar-template-excel.ts public/modelo-solicitacao-viagem.xlsx package.json package-lock.json
git commit -m "feat: add Excel template for travel request import"
```

---

### Task 2: Criar lib/utils/parse-excel-solicitacao.ts

**Files:**
- Create: `lib/utils/parse-excel-solicitacao.ts`

**Context:** Esta função recebe um `ArrayBuffer` do arquivo `.xlsx` selecionado pelo usuário e retorna `Partial<FormData>` compatível com o estado do `SolicitacaoFormClient`. Datas vêm do Excel como serial numérico (ex: `46000`) ou string `DD/MM/AAAA` — ambos devem ser convertidos para `YYYY-MM-DD`.

**Step 1: Criar o arquivo**

```typescript
// lib/utils/parse-excel-solicitacao.ts
import type * as XLSXType from 'xlsx'

type FormData = {
  nomeCompleto: string
  matricula: string
  cpf: string
  dataNascimento: string
  celular: string
  emailServidor: string
  justificativaPublica: string
  nexoCargo: string
  destino: string
  dataIda: string
  dataVolta: string
  justificativaLocal: string
  indicacaoVoo: string
  indicacaoHospedagem: string
  fichaOrcamentaria: string
}

const COLUMN_MAP: Record<string, keyof FormData> = {
  'Nome Completo': 'nomeCompleto',
  'Matrícula': 'matricula',
  'CPF': 'cpf',
  'Data de Nascimento': 'dataNascimento',
  'Telefone/WhatsApp': 'celular',
  'E-mail Institucional': 'emailServidor',
  'Justificativa do Interesse Público': 'justificativaPublica',
  'Nexo com as Atribuições do Cargo': 'nexoCargo',
  'Destino': 'destino',
  'Data de Ida': 'dataIda',
  'Data de Volta': 'dataVolta',
  'Justificativa de Localização': 'justificativaLocal',
  'Indicação de Voo': 'indicacaoVoo',
  'Indicação de Hospedagem': 'indicacaoHospedagem',
  'Ficha Orçamentária': 'fichaOrcamentaria',
}

const DATE_FIELDS = new Set<keyof FormData>(['dataNascimento', 'dataIda', 'dataVolta'])

/** Converte serial Excel ou string DD/MM/AAAA para YYYY-MM-DD */
function toISODate(value: unknown): string {
  if (typeof value === 'number') {
    // Serial Excel: dias desde 1900-01-01 (com bug leap year do Excel)
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (match) return `${match[3]}-${match[2]}-${match[1]}`
    // Já está em YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  }
  return ''
}

export async function parseExcelSolicitacao(buffer: ArrayBuffer): Promise<Partial<FormData>> {
  const XLSX: typeof XLSXType = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // sheet_to_json com header: 1 retorna array de arrays
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })

  // Linha 0: cabeçalhos, Linha 1: exemplo, Linha 2: primeiro dado real
  const headers = rows[0] as string[]
  const dataRow = rows[2] as (string | number)[]

  if (!headers || !dataRow) return {}

  const result: Partial<FormData> = {}

  headers.forEach((header, i) => {
    const field = COLUMN_MAP[header?.trim()]
    if (!field) return
    const raw = dataRow[i]
    if (raw === '' || raw === undefined || raw === null) return

    if (DATE_FIELDS.has(field)) {
      const iso = toISODate(raw)
      if (iso) (result as Record<string, string>)[field] = iso
    } else {
      (result as Record<string, string>)[field] = String(raw).trim()
    }
  })

  return result
}
```

**Step 2: Verificar build**

```bash
npm run build
```

Expected: sem erros de TypeScript.

**Step 3: Commit**

```bash
git add lib/utils/parse-excel-solicitacao.ts
git commit -m "feat: add Excel parser utility for travel request import"
```

---

### Task 3: Adicionar barra de importação ao SolicitacaoFormClient

**Files:**
- Modify: `components/SolicitacaoFormClient.tsx`

**Context:** O componente já tem estado `form` com `setForm`. Adicionar:
1. Estado `importWarning: string` para avisar campos faltantes após import
2. Handler `handleImport(file: File)` que usa `parseExcelSolicitacao` e chama `setForm`
3. Barra de UI acima do card principal com botão "Baixar modelo" e botão "Importar planilha"

**Step 1: Adicionar import e estado**

No topo do componente, após os imports existentes, adicionar:
```typescript
import { parseExcelSolicitacao } from '@/lib/utils/parse-excel-solicitacao'
```

Após `const [salvando, setSalvando] = useState(false)`, adicionar:
```typescript
const [importWarning, setImportWarning] = useState('')
```

**Step 2: Adicionar handler de importação**

Após a função `update`, adicionar:

```typescript
  async function handleImport(file: File) {
    setImportWarning('')
    try {
      const buffer = await file.arrayBuffer()
      const dados = await parseExcelSolicitacao(buffer)
      setForm(f => ({ ...f, ...dados }))

      // Avisar sobre campos obrigatórios vazios
      const obrigatorios: (keyof FormData)[] = [
        'nomeCompleto', 'matricula', 'cpf', 'dataNascimento', 'celular', 'emailServidor',
        'justificativaPublica', 'nexoCargo', 'destino', 'dataIda', 'dataVolta',
        'justificativaLocal', 'fichaOrcamentaria',
      ]
      const faltando = obrigatorios.filter(k => !dados[k])
      if (faltando.length > 0) {
        setImportWarning(`Campos não encontrados na planilha: complete-os manualmente antes de enviar.`)
      }
    } catch {
      setImportWarning('Erro ao ler a planilha. Verifique se o arquivo é um .xlsx válido.')
    }
  }
```

**Step 3: Adicionar a barra de UI**

Após a tag `<header>` (linha ~128) e antes de `<div className="space-y-8 bg-white...">`, inserir:

```tsx
      {/* Importação via Excel */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <a
          href="/modelo-solicitacao-viagem.xlsx"
          download
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <span className="material-symbols-outlined text-base">download</span>
          Baixar modelo (.xlsx)
        </a>
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm font-medium hover:bg-blue-50 transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-base">upload_file</span>
          Importar planilha
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleImport(file)
              e.target.value = ''
            }}
          />
        </label>
        {importWarning && (
          <span className="text-amber-700 text-xs font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">warning</span>
            {importWarning}
          </span>
        )}
      </div>
```

**Step 4: Verificar build**

```bash
npm run build
```

Expected: compilado sem erros.

**Step 5: Smoke test manual**

1. `npm run dev`
2. Acessar o formulário de nova solicitação
3. Clicar "Baixar modelo (.xlsx)" — deve baixar o arquivo
4. Preencher a linha 3 da planilha baixada, salvar
5. Clicar "Importar planilha", selecionar o arquivo
6. Verificar que os campos do formulário foram preenchidos corretamente
7. Verificar que datas aparecem no formato correto no `<input type="date">`

**Step 6: Commit**

```bash
git add components/SolicitacaoFormClient.tsx
git commit -m "feat: add Excel download/import bar to travel request form"
```
