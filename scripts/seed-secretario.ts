import { config } from 'dotenv'
config()

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 1. Cria a Secretaria
  const secretaria = await prisma.secretaria.upsert({
    where: { nome: 'Secretaria Municipal de Saúde' },
    update: {},
    create: { nome: 'Secretaria Municipal de Saúde' },
  })
  console.log('✅ Secretaria criada:', secretaria.nome, '| id:', secretaria.id)

  // 2. Cria o usuário Secretário
  const secretario = await prisma.user.upsert({
    where: { email: 'secretario@osasco.sp.gov.br' },
    update: { secretariaId: secretaria.id },
    create: {
      name: 'Secretário de Saúde',
      email: 'secretario@osasco.sp.gov.br',
      password: await bcrypt.hash('senha123', 10),
      role: 'SECRETARIO',
      secretariaId: secretaria.id,
    },
  })
  console.log('✅ Secretário criado:', secretario.email)

  // 3. Vincula o demandante existente à secretaria
  const demandante = await prisma.user.update({
    where: { email: 'demandante@osasco.sp.gov.br' },
    data: { secretariaId: secretaria.id },
  })
  console.log('✅ Demandante vinculado:', demandante.email)

  console.log('\n--- Credenciais ---')
  console.log('Secretário: secretario@osasco.sp.gov.br / senha123')
  console.log('Demandante: demandante@osasco.sp.gov.br / senha123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
