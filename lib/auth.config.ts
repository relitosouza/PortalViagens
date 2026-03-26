import type { NextAuthConfig } from 'next-auth'

// MEDIUM FIX: Configure session timeout and security
export const authConfig: NextAuthConfig = {
  providers: [], // providers defined in auth.ts with full Node.js access
  pages: { signIn: '/login' },
  // MEDIUM FIX: Session configuration with expiration
  session: {
    strategy: 'jwt',
    // MEDIUM FIX: Set session timeout to 24 hours
    maxAge: 24 * 60 * 60,
    // Update session every hour
    updateAge: 60 * 60,
  },
  // MEDIUM FIX: JWT configuration with expiration
  jwt: {
    // Token expires in 24 hours
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isLoginPage = nextUrl.pathname === '/login'
      const isAdminRoute = nextUrl.pathname.startsWith('/admin')

      if (!isLoggedIn && !isLoginPage) return false
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }
      // MEDIUM FIX: Use safer role check
      if (isAdminRoute) {
        const userRole = (auth?.user as { role?: string })?.role
        if (userRole !== 'ADMIN') {
          return Response.redirect(new URL('/dashboard', nextUrl))
        }
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role
        token.id = user.id as string
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = token.role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.id;
      }
      return session
    }
  },
}
