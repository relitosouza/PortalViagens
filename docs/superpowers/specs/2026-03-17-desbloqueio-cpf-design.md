# Desbloqueio Manual de CPF — Design Spec

**Data:** 2026-03-17
**Status:** Aprovado

---

## Problema

A seção "Bloqueios Art. 4" do painel admin mostra CPFs bloqueados por pendência de prestação de contas, mas não oferece ação de desbloqueio. O admin precisa navegar até a tabela de Usuários, localizar o servidor e clicar no botão de desbloqueio — fluxo pouco visível e ineficiente.

## Solução

Converter a seção estática "Bloqueios Art. 4" em um componente client interativo com botão de desbloqueio e modal de confirmação por usuário.

---

## Arquitetura

### Novo arquivo

**`app/(portal)/admin/components/BloqueiosSection.tsx`**

- `'use client'` — componente React client-side
- Props:
  - `cpfsBloqueados: { id: string; name: string; email: string; role: string }[]`
  - `prestacoesPendentes: PrestacaoPendente[]` — tipo estendido (ver abaixo)
- Estado local:
  - `modalUsuario: { id: string; name: string; email: string } | null`
  - `justificativa: string`
  - `loading: boolean`
  - `lista: { id: string; name: string; email: string }[]` — lista unificada de bloqueados
  - `successMsg: string`
  - `erro: string`

### Modificação em `page.tsx`

1. Importar `BloqueiosSection`
2. Substituir o bloco JSX estático da seção "Bloqueios Art. 4" pelo componente:
   ```tsx
   <BloqueiosSection cpfsBloqueados={cpfsBloqueados} prestacoesPendentes={prestacoesPendentes} />
   ```
3. Atualizar a query `prestacoesPendentes` para incluir `userId` da solicitação:
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
   })
   ```
4. Atualizar a interface `PrestacaoPendente` em `page.tsx` para incluir `solicitacao.userId: string`

### API — sem mudança

`PUT /api/admin/usuarios/[id]` com `{ cpfBloqueado: false }` já existe e está funcional.

---

## Comportamento

### Lista unificada de bloqueados

O componente constrói internamente uma lista unificada de usuários bloqueados:
1. Inicializa `lista` mapeando `cpfsBloqueados` para `{ id: u.id, name: u.name ?? '', email: u.email }` (descarta `role`, trata `name` nulo com fallback `''`)
2. Adiciona entradas de `prestacoesPendentes` cujo `solicitacao.userId` ainda não está na lista (deduplicação por ID, não por nome)

Cada entrada na lista unificada tem: `{ id, name, email }` suficiente para chamar a API.

Cada card exibe:
- Avatar "CPF" (vermelho)
- Nome e email do usuário
- Para entradas vindas de `prestacoesPendentes`: também exibe destino e dias de atraso
- Botão **"Desbloquear"** (outline vermelho) — presente em **todos** os cards, independentemente da origem

### Modal de confirmação

Abre ao clicar em "Desbloquear". Contém:
- Título: "Desbloquear CPF"
- Nome e email do usuário selecionado
- `<textarea>` opcional com placeholder "Justificativa (opcional)"
- `erro`: mensagem de erro inline se a requisição falhar
- Botão **Cancelar** — fecha modal, limpa `justificativa` e `erro`
- Botão **Confirmar desbloqueio** — vermelho, desabilitado durante `loading`

### Fluxo de desbloqueio

1. Admin clica em "Desbloquear" → `modalUsuario` recebe o usuário, modal abre
2. Admin (opcionalmente) preenche justificativa — capturada apenas para UX, **não enviada à API**
3. Admin clica em "Confirmar desbloqueio" → `loading = true`
4. `PUT /api/admin/usuarios/[id]` com `{ cpfBloqueado: false }`
5. **Sucesso**: fecha modal, remove card da `lista` local, exibe `successMsg` por 3 segundos
6. **Erro**: mantém modal aberto, `loading = false`, exibe mensagem de erro inline via `erro`

> Remoção do card ocorre **somente após sucesso** (não otimista), para evitar inconsistência visual em caso de falha.

---

## Padrões visuais

Segue o design system já usado no projeto:
- `border border-red-100 bg-red-50/20 rounded-lg` para cards
- `text-sm`, `font-bold`, `text-slate-900` para textos
- `material-symbols-outlined` para ícones
- Botão destrutivo: `bg-red-600 text-white hover:bg-red-700`
- Botão cancelar: `border border-slate-200 text-slate-600 hover:bg-slate-50`
- Success banner: `bg-green-50 border border-green-200 text-green-700` (padrão do `UsuariosSection`)

---

## Fora do escopo

- Persistência da justificativa no banco
- Log de auditoria
- Desbloqueio em lote
- Alteração na prestação de contas pendente
