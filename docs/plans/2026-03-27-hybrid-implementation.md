# Plano de Implementação Híbrida — PortalViagens (React Native + Expo)

## 🎯 Objetivo Geral

Criar um aplicativo mobile nativo (React Native + Expo) que **reutiliza a lógica, tipos e serviços** do backend web (Next.js), mantendo a mesma funcionalidade core enquanto adapta a UI/UX para mobile-first com bottom navigation.

---

## 📊 Visão Geral da Arquitetura Híbrida

```
┌─────────────────────────────────────────┐
│       Backend Compartilhado              │
│   (Next.js 15 + Prisma + SQLite)        │
│   • NextAuth (API de autenticação)       │
│   • Endpoints REST: /api/*               │
│   • Notificações por email               │
│   • Regras de negócio                    │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌────────▼──────────┐
│  Web Frontend   │   │  Mobile Frontend  │
│  (Next.js 15)   │   │ (React Native)    │
│ • Desktop-first │   │ • Mobile-first    │
│ • Tailwind CSS  │   │ • Bottom nav      │
│ • Sidebar nav   │   │ • Expo SDK        │
└─────────────────┘   └───────────────────┘

Shared Code (monorepo):
├── lib/          (Hooks, types, utilities)
├── types/        (TypeScript interfaces)
├── prisma/       (Schemas — compartilhado)
└── services/     (Chamadas API)
```

---

## 🔄 Estratégia de Compartilhamento

### Camada 1: Tipos & Interfaces (100% reutilizável)
```
types/
├── next-auth.d.ts       (User, Session, Role)
├── Solicitacao.ts
├── WorkflowStep.ts
├── Prestacao.ts
└── ...
```

### Camada 2: Services & API (100% reutilizável)
```
lib/
├── services/
│   ├── api.ts           (Cliente HTTP/Axios)
│   ├── auth.service.ts  (Login/logout/refresh)
│   ├── solicitacao.service.ts
│   ├── prestacao.service.ts
│   └── ...
└── utils/
    ├── validation.ts
    ├── formatting.ts
    └── date-utils.ts
```

### Camada 3: Hooks Customizados (95% reutilizável)
```
lib/hooks/
├── useAuth.ts           (Mesma lógica, compat mobile)
├── useSolicitacao.ts
├── usePrestacao.ts
└── useWorkflow.ts
```

### Camada 4: Componentes Base (60% reutilizável com adaptações)
```
components/shared/
├── Button.tsx           (React.FC genérico)
├── Input.tsx
├── Card.tsx
├── Modal.tsx
└── FormField.tsx

web/components/         (Desktop-specific)
├── Sidebar.tsx
├── Header.tsx
└── ...

mobile/components/      (Mobile-specific)
├── BottomNav.tsx
├── MobileHeader.tsx
└── ...
```

### Camada 5: Layouts (0% reutilizável)
```
web/layouts/           (Next.js layouts)
└── MainLayout.tsx

mobile/screens/        (React Native screens)
├── DashboardScreen.tsx
├── SolicitacoesScreen.tsx
└── ...
```

---

## 📱 Estrutura do Monorepo

```
PortalViagens/
├── package.json                (raiz — scripts comuns)
├── tsconfig.json               (compartilhado)
├── prisma/                     (Schemas — compartilhado)
│   ├── schema.prisma
│   └── migrations/
│
├── # CAMADAS COMPARTILHADAS
├── types/                      (100% shared)
│   ├── index.ts
│   ├── Solicitacao.ts
│   └── ...
├── lib/                        (90% shared)
│   ├── services/               (API calls)
│   ├── hooks/                  (Custom hooks)
│   ├── utils/                  (Helpers)
│   └── constants/
│
├── # WEB (Next.js)
├── app/                        (Next.js app router)
├── components/web/             (Web-specific components)
├── public/
└── next.config.ts
│
├── # MOBILE (React Native)
├── mobile/
│   ├── app.json                (Expo config)
│   ├── package.json            (Mobile-only deps)
│   ├── tsconfig.json
│   ├── src/
│   │   ├── screens/            (React Native screens)
│   │   ├── components/         (Mobile components)
│   │   ├── navigation/         (React Navigation)
│   │   ├── stores/             (Zustand/Jotai state)
│   │   ├── services/           (Links to ../lib)
│   │   └── types/              (Links to ../types)
│   ├── assets/
│   └── eas.json                (EAS Build config)
│
├── # SCRIPTS COMUNS
├── scripts/
│   ├── setup-mobile.sh         (Setup Expo)
│   ├── sync-schemas.sh         (Sync Prisma schemas)
│   └── build-both.sh           (Build web + mobile)
│
└── docs/
    └── plans/
        └── 2026-03-27-hybrid-implementation.md
```

---

## 🏗️ FASE 0: Preparação (Análise + Setup)

### Duração: 3-4 dias
### Objetivo: Preparar fundação para desenvolvimento híbrido

#### Atividades:
1. Analisar estrutura de componentes web existentes
2. Mapear serviços e hooks reutilizáveis
3. Revisar tipos TypeScript
4. Instalar Expo CLI
5. Criar estrutura base do monorepo
6. Setup de tsconfig compartilhado
7. Configurar auth compartilhada
8. Testes de import compartilhado

#### Checklist:
- [ ] Analisados todos os componentes web
- [ ] Mapeados tipos e interfaces
- [ ] Criada estrutura base do monorepo
- [ ] Instalado Expo CLI e inicializado projeto mobile
- [ ] Criados arquivos de configuração (app.json, eas.json, tsconfig)
- [ ] Configurado compartilhamento de tipos e serviços
- [ ] Testado que imports funcionam em ambos os lados

**Tempo estimado:** 3-4 dias
**Recursos:** 1 dev (arquiteto/senior)

---

## 🚀 FASE 1: MVP Mínimo (1-2 semanas)

### Objetivo: App funcional com funcionalidades críticas

#### Telas a implementar:
1. **Login Screen**
2. **Dashboard Screen** (lista de solicitações)
3. **Solicitação Detail Screen**
4. **Bottom Navigation** (4 abas)

#### Componentes base:
- Button (compartilhado)
- Input (compartilhado)
- Card (compartilhado)
- BottomNav (mobile-específico)

#### Features MVP:
- Login com email/senha
- Token persistence (AsyncStorage)
- Listar solicitações
- Detalhe de solicitação
- Logout

#### Testes:
- Unitários dos serviços
- Integração Login → Dashboard
- Navegação entre abas

**Tempo estimado:** 10-12 dias úteis
**Recursos:** 2 devs

---

## 🛠️ FASE 2: Features Completas (2-3 semanas)

### Objetivo: App totalmente funcional com sincronização e offline

#### Features por Role:

**DEMANDANTE:**
- Editar rascunho
- Reenviar após devolução
- Alertas de CPF bloqueado
- Histórico de viagens

**SECOL:**
- Fila de cotação
- Confirmar cotação + valores
- Fila de emissão
- Emitir OS e vouchers

**SEGOV:**
- Fila de viabilidade
- Aprovar ou reprovar
- Adicionar observações

**SF:**
- Fila de execução
- Confirmar BRS
- Finalizar

#### Features técnicas:
- Sincronização de dados automática
- Offline support
- Push notifications
- Upload de arquivos
- Estado global (Zustand)
- Validação completa de forms

**Tempo estimado:** 15-18 dias úteis
**Recursos:** 2-3 devs

---

## ✨ FASE 3: Polish & Deploy (1 semana)

### Objetivo: App pronto para produção

#### Atividades:
1. Otimizações de performance
2. Testing completo (unit + E2E)
3. Segurança (tokens, SSL pinning)
4. Build iOS + Android
5. Distribuição (App Store + Google Play)
6. Monitoramento (Sentry, analytics)
7. Documentação final

#### Métricas:
- Bundle size < 50MB
- Performance < 3s startup
- Zero crash rate
- Coverage 80%+

**Tempo estimado:** 5-7 dias úteis
**Recursos:** 2-3 devs + 1 QA

---

## 📊 Timeline Completa

```
FASE 0 (Setup)              ████ 3-4 dias
FASE 1 (MVP)               ████████████ 10-12 dias
FASE 2 (Full Features)      ████████████████ 15-18 dias
FASE 3 (Polish + Deploy)    ███████ 5-7 dias
─────────────────────────────────────────────
TOTAL                       ██████████████████████████ 33-41 dias úteis

Com parallelização:  ~6 semanas com 3 devs
```

---

## 🎯 Milestones

### Semana 1:
- ✅ Setup completo (Fase 0)
- ✅ Auth + Dashboard (Fase 1 início)

### Semana 2:
- ✅ MVP completo (Fase 1 fim)
- ✅ Início de filas (Fase 2)

### Semana 3-4:
- ✅ Features completas (Fase 2)
- ✅ Sync + offline (Fase 2 fim)

### Semana 5:
- ✅ Testing completo
- ✅ Builds (iOS + Android)

### Semana 6:
- ✅ App Store + Google Play
- ✅ Go-live

---

## 💡 Tecnologias Principais

```json
{
  "shared": {
    "language": "TypeScript 5",
    "types": "Zod + Yup",
    "http": "Axios"
  },
  "web": {
    "framework": "Next.js 15",
    "ui": "React 19",
    "styling": "Tailwind CSS",
    "auth": "NextAuth v5"
  },
  "mobile": {
    "framework": "React Native",
    "builder": "Expo",
    "navigation": "React Navigation",
    "state": "Zustand",
    "storage": "AsyncStorage + SecureStore"
  }
}
```

---

## ✅ Checklist de Sucesso

### MVP (Fim Fase 1):
- [ ] App instalável em simuladores
- [ ] Login funcional
- [ ] Dashboard mostra solicitações
- [ ] Bottom nav com 4 abas
- [ ] Testes unitários dos serviços

### Full Feature (Fim Fase 2):
- [ ] Todas as 4 roles funcionando
- [ ] Sync automático
- [ ] Offline support
- [ ] Push notifications
- [ ] Upload de arquivos

### Production (Fim Fase 3):
- [ ] App no App Store
- [ ] App no Google Play
- [ ] Zero crashes
- [ ] Performance aceitável
- [ ] Documentação completa

---

## 📞 Próximos Passos

1. **Validar plano com equipe**
2. **Ajustar duração/recursos conforme realidade**
3. **Começar Fase 0 (setup)**
4. **Definir sprints de 1-2 semanas**
5. **Setup de CI/CD para ambos (web + mobile)**

---

**Documento criado:** 27/03/2026
**Abordagem:** Híbrida com máxima reutilização de código
**Status:** Pronto para implementação
