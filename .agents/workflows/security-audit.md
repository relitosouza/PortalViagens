---
description: Realiza uma auditoria de segurança completa no projeto (Next.js, Prisma, Auth)
---

Este workflow executa verificações automáticas e manuais para garantir a segurança do código.

// turbo
1. Verificar vulnerabilidades em dependências:
   `npm audit`

2. Executar Linter para detectar padrões inseguros:
   `npm run lint`

// turbo
3. Procurar por segredos e chaves expostas no código:
   `grep -rnE 'API_KEY|SECRET|PASSWORD|TOKEN|AUTH_SECRET' . --exclude-dir={.git,node_modules,.next}`

4. Analisar a configuração do NextAuth/Auth.js:
   - Verifique o arquivo `auth.ts` ou `lib/auth.ts`.
   - Garanta que `AUTH_SECRET` esteja configurado apenas via variável de ambiente.
   - Verifique se o hashing de senhas está usando `bcryptjs` corretamente.

5. Analisar consultas ao banco de dados (Prisma):
   - Verifique se não há Raw Queries (`$queryRaw`) sem sanitização.
   - Garanta que dados sensíveis de usuários (senhas) não sejam retornados nas seleções.

6. Verificar variáveis de ambiente:
   - Garanta que o arquivo `.env` está no `.gitignore`.
   - Verifique se não há variáveis sensíveis com o prefixo `NEXT_PUBLIC_`.

7. Gerar relatório final:
   - Liste as vulnerabilidades encontradas.
   - Sugira correções imediatas para cada item crítico.
