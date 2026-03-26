import type { NextConfig } from "next";

const securityHeaders = [
  // Clickjacking protection
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // MIME type sniffing protection
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer policy
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissions policy - disable dangerous APIs
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // XSS protection (legacy, but still useful)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // HSTS - Force HTTPS (HIGH PRIORITY FIX)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // Content Security Policy (HIGH PRIORITY FIX)
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https:; frame-ancestors 'self';"
  },
  // Prevent browsers from MIME-sniffing a response away from the declared Content-Type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Block against cross-domain policies
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  // Search engine indexing control (HIGH PRIORITY FIX)
  { key: 'X-Robots-Tag', value: 'index, follow' },
]

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  serverExternalPackages: ['@prisma/client', 'better-sqlite3', '@prisma/adapter-better-sqlite3', 'pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/quote-parse': [
      './node_modules/pdf-parse/**/*',
      './node_modules/pdfjs-dist/**/*',
      './node_modules/@napi-rs/canvas/**/*',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**/*',
      './node_modules/@napi-rs/canvas-linux-x64-musl/**/*',
      './node_modules/@napi-rs/canvas-linux-arm64-gnu/**/*',
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Externalize all Prisma/sqlite server-only modules from client bundle
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []),
        ({ request }: { request?: string }, callback: (...args: unknown[]) => void) => {
          if (
            request &&
            (request.startsWith('node:') ||
              request.includes('prisma') ||
              request.includes('better-sqlite3'))
          ) {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        },
      ]
    }
    return config
  },
};

export default nextConfig;
