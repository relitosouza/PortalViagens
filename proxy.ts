import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextRequest, NextResponse } from 'next/server'

// MEDIUM FIX: Create NextAuth middleware wrapper
const { auth } = NextAuth(authConfig)

// MEDIUM FIX: HTTPS enforcement and security middleware
export async function middleware(request: NextRequest) {
  // MEDIUM FIX: Enforce HTTPS in production
  const protocol = request.headers.get('x-forwarded-proto')
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction && protocol === 'http') {
    const url = new URL(request.url)
    url.protocol = 'https:'
    return NextResponse.redirect(url)
  }

  // Run NextAuth middleware
  return await auth(request)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)']
}
