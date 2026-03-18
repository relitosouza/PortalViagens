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
  - `cpfsBloqueados: { id: string; name: string | null; email: string; role: string }[]`
  - `prestacoesPendentes: PrestacaoPendente[]` (tipo já definido em `admin/page.tsx`)
- Estado local:
  - `modalUsuario: { id: string; name: string | null; email: string } | null` — usuário selecionado para desbloqueio
  - `justificativa: string` — campo opcional do modal
  - `loading: boolean` — durante a requisição
  - `lista: typeof cpfsBloqueados` — cópia local para remoção otimista após desbloqueio

### Modificação

**`app/(portal)/admin/page.tsx`**

- Importar `BloqueiosSection`
- Substituir o bloco JSX estático da seção "Bloqueios Art. 4" pelo componente:
  ```tsx
  <BloqueiosSection cpfsBloqueados={cpfsBloqueados} prestacoesPendentes={prestacoesPendentes} />
  ```

### API — sem mudança

`PUT /api/admin/usuarios/[id]` com `{ cpfBloqueado: false }` já existe e está funcional.

---

## Comportamento

### Lista de bloqueados

Cada card exibe:
- Avatar "CPF" (vermelho)
- Nome e email do usuário
- Botão **"Desbloquear"** (outline vermelho) — substitui o badge estático "Bloqueado"

Para `prestacoesPendentes`: exibe também destino e dias de atraso (mantém dados atuais).

### Modal de confirmação

Abre ao clicar em "Desbloquear". Contém:
- Título: "Desbloquear CPF"
- Texto: nome + email do usuário
- Campo de texto opcional: `<textarea>` com placeholder "Justificativa (opcional)"
- Botão **Cancelar** — fecha o modal, limpa estado
- Botão **Confirmar desbloqueio** — vermelho, desabilitado durante loading
- Spinner/loading enquanto `PUT` está em andamento

### Pós-desbloqueio

- Remove o card da `lista` local (remoção otimista)
- Fecha o modal
- Exibe mensagem de sucesso por 3 segundos (padrão do projeto)
- Prestação de contas pendente: **permanece no sistema** sem alteração

### Erro

- Se a requisição falhar: exibe mensagem de erro inline no modal, não fecha

---

## Padrões visuais

Segue o design system já usado no projeto:
- `border border-red-100 bg-red-50/20 rounded-lg` para cards de bloqueio
- `text-sm`, `font-bold`, `text-slate-900` para textos
- `material-symbols-outlined` para ícones
- Botão primário destrutivo: `bg-red-600 text-white hover:bg-red-700`
- Botão cancelar: `border border-slate-200 text-slate-600 hover:bg-slate-50`

---

## Fora do escopo

- Log de auditoria em banco de dados — a justificativa é capturada no frontend mas não persistida
- Desbloqueio em lote
- Alteração na prestação de contas pendente
