import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'

// Prisma 7 requires a driver adapter with a URL config object
const dbUrl = `file:${path.resolve('./dev.db')}`
const adapter = new PrismaBetterSqlite3({ url: dbUrl })
const prisma = new PrismaClient({ adapter })

async function main() {
  const usuarios = [
    { name: 'Ricardo Master', email: 'ricardo@osasco.sp.gov.br', role: 'ADMIN' },
    { name: 'Maria Silva', email: 'demandante@osasco.sp.gov.br', role: 'DEMANDANTE' },
    { name: 'João Santos', email: 'secol@osasco.sp.gov.br', role: 'SECOL' },
    { name: 'Ana Gabinete', email: 'segov@osasco.sp.gov.br', role: 'SEGOV' },
    { name: 'Carlos Finanças', email: 'sf@osasco.sp.gov.br', role: 'SF' },
  ]

  for (const u of usuarios) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: await bcrypt.hash('senha123', 10) },
    })
  }
  console.log('Seed concluído. Senha padrão: senha123')
}

main().catch(console.error).finally(() => prisma.$disconnect())
