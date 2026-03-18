# Desbloqueio Manual de CPF — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar botão de desbloqueio manual de CPF diretamente na seção "Bloqueios Art. 4" do painel admin, com modal de confirmação.

**Architecture:** Criar `BloqueiosSection.tsx` (client component) seguindo o padrão de `UsuariosSection.tsx`. Atualizar `page.tsx` para incluir `userId` na query de prestações pendentes e substituir o bloco JSX estático pelo novo componente. A API `PUT /api/admin/usuarios/[id]` já existe e não precisa de modificação.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Prisma (SQLite)

---

## File Map

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Modificar | `app/(portal)/admin/page.tsx` | Adicionar `userId` à query de prestações; importar e usar `BloqueiosSection` |
| Criar | `app/(portal)/admin/components/BloqueiosSection.tsx` | Componente client com lista unificada, modal e lógica de desbloqueio |

---

## Chunk 1: Atualizar page.tsx e criar BloqueiosSection

### Task 1: Atualizar a query e interfaces em `page.tsx`

**Files:**
- Modify: `app/(portal)/admin/page.tsx`

> **Contexto:** O arquivo `page.tsx` é um Server Component. A query de `prestacoesPendentes` atualmente usa `select` e não retorna `userId` da solicitação, o que impede identificar o usuário para o desbloqueio. Precisamos mudar para `include` com `select` explícito adicionando `userId`.

- [ ] **Step 1: Atualizar a interface `SolicitacaoSummary`**

Abrir `app/(portal)/admin/page.tsx`. Localizar:

```ts
interface SolicitacaoSummary {
  nomeCompleto: string;
  destino: string;
  dataVolta: Date | null;
}
```

Substituir por:

```ts
interface SolicitacaoSummary {
  nomeCompleto: string;
  destino: string;
  dataVolta: Date | null;
  userId: string;
}
```

- [ ] **Step 2: Atualizar a query `prestacoesPendentes`**

Localizar no `Promise.all` a query:

```ts
prisma.prestacao.findMany({
  where: { enviadoEm: null, prazoFinal: { lt: new Date() } },
  include: { solicitacao: { select: { nomeCompleto: true, destino: true, dataVolta: true } } },
  orderBy: { prazoFinal: 'asc' },
  take: 10,
}),
```

Substituir por:

```ts
prisma.prestacao.findMany({
  where: { enviadoEm: null, prazoFinal: { lt: new Date() } },
  include: {
    solicitacao: {
      select: { nomeCompleto: true, destino: true, dataVolta: true, userId: true }
    }
  },
  orderBy: { prazoFinal: 'asc' },
  take: 10,
}),
```

- [ ] **Step 3: Verificar build**

```bash
cd C:/projects/PortalViagens && npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript relacionados a `SolicitacaoSummary`.

---

### Task 2: Criar `BloqueiosSection.tsx`

**Files:**
- Create: `app/(portal)/admin/components/BloqueiosSection.tsx`

> **Contexto:** Seguir o padrão de `app/(portal)/admin/components/UsuariosSection.tsx`. O componente recebe as props do server component, constrói uma lista unificada de bloqueados (deduplicando por `userId`), e renderiza cards com botão "Desbloquear". Ao clicar, abre modal de confirmação que chama `PUT /api/admin/usuarios/[id]` com `{ cpfBloqueado: false }`.

- [ ] **Step 1: Criar o arquivo**

Criar `app/(portal)/admin/components/BloqueiosSection.tsx` com o seguinte conteúdo:

```tsx
'use client'

import { useState, useMemo } from 'react'

type BloqueadoEntry = {
  id: string
  name: string
  email: string
}

type SolicitacaoSummary = {
  nomeCompleto: string
  destino: string
  dataVolta: Date | null
  userId: string
}

type PrestacaoPendente = {
  id: string
  enviadoEm: Date | null
  prazoFinal: Date
  solicitacao: SolicitacaoSummary
}

type Props = {
  cpfsBloqueados: { id: string; name: string | null; email: string; role: string }[]
  prestacoesPendentes: PrestacaoPendente[]
}

export default function BloqueiosSection({ cpfsBloqueados, prestacoesPendentes }: Props) {
  const hoje = new Date()

  // Lista unificada: inicia com cpfsBloqueados, adiciona prestações cujo userId não está ainda
  const listaInicial = useMemo<BloqueadoEntry[]>(() => {
    const base: BloqueadoEntry[] = cpfsBloqueados.map(u => ({
      id: u.id,
      name: u.name ?? '',
      email: u.email,
    }))
    const ids = new Set(base.map(u => u.id))

    for (const p of prestacoesPendentes) {
      if (!ids.has(p.solicitacao.userId)) {
        base.push({
          id: p.solicitacao.userId,
          name: p.solicitacao.nomeCompleto,
          email: '',
        })
        ids.add(p.solicitacao.userId)
      }
    }

    return base
  }, [cpfsBloqueados, prestacoesPendentes])

  const [lista, setLista] = useState<BloqueadoEntry[]>(listaInicial)
  const [modalUsuario, setModalUsuario] = useState<BloqueadoEntry | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [erro, setErro] = useState('')

  function abrirModal(u: BloqueadoEntry) {
    setModalUsuario(u)
    setJustificativa('')
    setErro('')
  }

  function fecharModal() {
    setModalUsuario(null)
    setJustificativa('')
    setErro('')
  }

  async function confirmarDesbloqueio() {
    if (!modalUsuario) return
    setLoading(true)
    setErro('')

    try {
      const res = await fetch(`/api/admin/usuarios/${modalUsuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpfBloqueado: false }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErro(data.error ?? 'Erro ao desbloquear. Tente novamente.')
        setLoading(false)
        return
      }

      // Sucesso: remover da lista e fechar modal
      setLista(prev => prev.filter(u => u.id !== modalUsuario.id))
      fecharModal()
      setSuccessMsg(`CPF de ${modalUsuario.name || 'usuário'} desbloqueado.`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch {
      setErro('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Para cada entrada da lista, verificar se veio de prestação (para exibir detalhes extras)
  function getPrestacaoInfo(userId: string): { destino: string; diasAtraso: number } | null {
    const p = prestacoesPendentes.find(p => p.solicitacao.userId === userId)
    if (!p) return null
    const diasAtraso = Math.floor((hoje.getTime() - new Date(p.prazoFinal).getTime()) / 86400000)
    return { destino: p.solicitacao.destino, diasAtraso }
  }

  return (
    <>
      {successMsg && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
          {successMsg}
        </div>
      )}

      <div className="p-6">
        <p className="text-sm text-slate-500 mb-6">
          Servidores bloqueados por pendência na prestação de contas (&gt; 5 dias úteis).
        </p>

        {lista.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <span className="material-symbols-outlined text-[36px] block mb-2">check_circle</span>
            <p className="text-sm">Nenhum bloqueio ativo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map(u => {
              const info = getPrestacaoInfo(u.id)
              return (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50/20">
                  <div className="flex items-center gap-3">
                    <div className="size-9 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold text-xs uppercase">
                      CPF
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{u.name || '—'}</p>
                      <p className="text-[11px] text-slate-500">
                        {info
                          ? `${info.destino} | Atraso: ${info.diasAtraso} dia${info.diasAtraso !== 1 ? 's' : ''}`
                          : u.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => abrirModal(u)}
                    className="text-xs font-bold px-3 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Desbloquear
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {modalUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-500">lock_open</span>
              <h3 className="text-base font-bold text-slate-900">Desbloquear CPF</h3>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-sm font-bold text-slate-900">{modalUsuario.name || '—'}</p>
              {modalUsuario.email && (
                <p className="text-xs text-slate-500">{modalUsuario.email}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Justificativa (opcional)
              </label>
              <textarea
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                placeholder="Ex: Servidor apresentou comprovantes presencialmente."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-200"
                disabled={loading}
              />
            </div>

            {erro && (
              <p className="text-xs text-red-600 font-medium">{erro}</p>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={fecharModal}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDesbloqueio}
                disabled={loading}
                className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {loading && (
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                )}
                Confirmar desbloqueio
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd C:/projects/PortalViagens && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros.

---

### Task 3: Integrar `BloqueiosSection` no `page.tsx`

**Files:**
- Modify: `app/(portal)/admin/page.tsx`

> **Contexto:** A seção "Bloqueios Art. 4" atualmente é JSX estático renderizado diretamente no server component. Vamos substituir pelo novo componente client.

- [ ] **Step 1: Adicionar o import**

No topo de `app/(portal)/admin/page.tsx`, após os imports existentes, adicionar:

```ts
import BloqueiosSection from './components/BloqueiosSection'
```

- [ ] **Step 2: Substituir o bloco JSX estático**

Localizar e remover o bloco `<div className="p-6">` abaixo do header da section (linhas 161–201 do arquivo atual). O bloco a remover é exatamente:

```tsx
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-6">
                Servidores bloqueados por pendência na prestação de contas (&gt; 5 dias úteis).
              </p>
              {cpfsBloqueados.length === 0 && prestacoesPendentes.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <span className="material-symbols-outlined text-[36px] block mb-2">check_circle</span>
                  <p className="text-sm">Nenhum bloqueio ativo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prestacoesPendentes.map((p: PrestacaoPendente) => {
                    const diasAtraso = Math.floor((hoje.getTime() - new Date(p.prazoFinal).getTime()) / 86400000)
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50/20">
                        <div className="flex items-center gap-3">
                          <div className="size-9 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold text-xs uppercase">CPF</div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{p.solicitacao.nomeCompleto}</p>
                            <p className="text-[11px] text-slate-500">{p.solicitacao.destino} | Atraso: {diasAtraso} dia{diasAtraso !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-red-600 font-bold uppercase px-2 py-0.5 bg-red-100 rounded">Bloqueado</span>
                      </div>
                    )
                  })}
                  {cpfsBloqueados.filter((u: BlockedUser) => !prestacoesPendentes.some((p: PrestacaoPendente) => p.solicitacao.nomeCompleto === u.name)).map((u: BlockedUser) => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50/20">
                      <div className="flex items-center gap-3">
                        <div className="size-9 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold text-xs uppercase">CPF</div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-slate-500">{u.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-red-600 font-bold uppercase px-2 py-0.5 bg-red-100 rounded">Bloqueado</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
```

Substituir pelo componente (colocar logo após o header `<div className="px-6 py-5 ...">`):

```tsx
          <BloqueiosSection cpfsBloqueados={cpfsBloqueados} prestacoesPendentes={prestacoesPendentes} />
```

O resultado final da section deve ser:

```tsx
<section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm h-full" id="blocks">
  <div className="px-6 py-5 border-b border-slate-100 bg-red-50/30 flex justify-between items-center">
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-red-500">warning</span>
      <h2 className="text-lg font-bold text-slate-900">Bloqueios Art. 4</h2>
    </div>
    {totalCpfsBloqueados > 0 && (
      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">Crítico</span>
    )}
  </div>
  <BloqueiosSection cpfsBloqueados={cpfsBloqueados} prestacoesPendentes={prestacoesPendentes} />
</section>
```

- [ ] **Step 3: Verificar build completo**

```bash
cd C:/projects/PortalViagens && npm run build 2>&1 | tail -30
```

Esperado: `✓ Compiled successfully` sem erros de TypeScript ou ESLint.

- [ ] **Step 4: Commit**

```bash
cd C:/projects/PortalViagens && git add app/\(portal\)/admin/page.tsx app/\(portal\)/admin/components/BloqueiosSection.tsx && git commit -m "feat: add manual CPF unblock button to Bloqueios Art. 4 section"
```

---

## Verificação Manual (sem test framework)

> O projeto não possui framework de testes configurado. Verificar manualmente no browser após `npm run dev`.

- [ ] Acessar `/admin` com usuário de role `ADMIN`
- [ ] Verificar que a seção "Bloqueios Art. 4" renderiza normalmente
- [ ] Se houver CPF bloqueado: verificar que o botão "Desbloquear" aparece no card
- [ ] Clicar em "Desbloquear" — modal deve abrir com nome/email do usuário
- [ ] Clicar em "Cancelar" — modal deve fechar sem mudanças
- [ ] Clicar em "Confirmar desbloqueio" — card deve sumir da lista, banner verde deve aparecer
- [ ] Verificar no banco que `cpfBloqueado = false` para o usuário desbloqueado
