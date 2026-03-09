import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'better-sqlite3', '@prisma/adapter-better-sqlite3'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Externalize all Prisma/sqlite server-only modules from client bundle
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []),
        ({ request }: { request?: string }, callback: Function) => {
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
