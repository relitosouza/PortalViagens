import type { NextAuthConfig } from 'next-auth'

// Lightweight auth config for middleware (no Prisma/bcrypt - Edge compatible)
export const authConfig: NextAuthConfig = {
  providers: [], // providers defined in auth.ts with full Node.js access
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isLoginPage = nextUrl.pathname === '/login'

      if (!isLoggedIn && !isLoginPage) return false
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }
      return true
    },
  },
}
