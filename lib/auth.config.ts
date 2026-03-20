import type { NextAuthConfig } from 'next-auth'

// Lightweight auth config for middleware (no Prisma/bcrypt - Edge compatible)
export const authConfig: NextAuthConfig = {
  providers: [], // providers defined in auth.ts with full Node.js access
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isLoginPage = nextUrl.pathname === '/login'
      const isAdminRoute = nextUrl.pathname.startsWith('/admin')

      if (!isLoggedIn && !isLoginPage) return false
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }
      if (isAdminRoute && (auth?.user as { role?: string })?.role !== 'ADMIN') {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }
      const isSecretarioRoute = nextUrl.pathname.startsWith('/portal/secretario')
      if (isSecretarioRoute) {
        const role = (auth?.user as { role?: string })?.role
        if (role !== 'SECRETARIO' && role !== 'ADMIN') {
          return Response.redirect(new URL('/dashboard', nextUrl))
        }
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role
        token.id = user.id as string
        token.secretariaId = (user as { secretariaId?: string }).secretariaId ?? undefined
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = token.role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).secretariaId = token.secretariaId;
      }
      return session
    }
  },
}
