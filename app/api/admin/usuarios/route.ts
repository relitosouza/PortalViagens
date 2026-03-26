import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
// HIGH PRIORITY FIX: Use safe auth type instead of unsafe casting
import { getAuthUser, requireAdmin as checkAdmin } from '@/lib/types/auth'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  const user = getAuthUser(session.user)
  if (!user || !checkAdmin(user)) return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const usuarios = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      cpfBloqueado: true,
      ativo: true,
      createdAt: true,
      secretariaId: true,
    },
  })

  return NextResponse.json(usuarios)
}

// CRITICAL FIX: Adicionar validação de entrada
function validateUsuarioInput(body: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (typeof body !== 'object' || body === null) {
    return { valid: false, errors: ['Corpo da requisição inválido'] }
  }

  const data = body as Record<string, unknown>

  // Campos obrigatórios
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('name: campo obrigatório e deve ser uma string válida')
  }

  if (!data.email || typeof data.email !== 'string') {
    errors.push('email: campo obrigatório')
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      errors.push('email: formato de email inválido')
    }
  }

  if (!data.password || typeof data.password !== 'string' || data.password.length < 8) {
    errors.push('password: campo obrigatório com mínimo 8 caracteres')
  }

  if (!data.role || typeof data.role !== 'string') {
    errors.push('role: campo obrigatório')
  } else {
    const validRoles = ['DEMANDANTE', 'SECOL', 'SEGOV', 'SF', 'ADMIN', 'SECRETARIO']
    if (!validRoles.includes(data.role)) {
      errors.push(`role: deve ser um dos valores: ${validRoles.join(', ')}`)
    }
  }

  // Validar tamanho máximo do name
  if (data.name && String(data.name).length > 255) {
    errors.push('name: máximo 255 caracteres')
  }

  // Se role é DEMANDANTE ou SECRETARIO, secretariaId é obrigatório
  if ((data.role === 'DEMANDANTE' || data.role === 'SECRETARIO') && !data.secretariaId) {
    errors.push('secretariaId: obrigatório para perfil DEMANDANTE ou SECRETARIO')
  }

  return { valid: errors.length === 0, errors }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Formato JSON inválido' }, { status: 400 })
  }

  // CRITICAL FIX: Validar entrada
  const validation = validateUsuarioInput(body)
  if (!validation.valid) {
    return NextResponse.json({
      error: 'Validação falhou',
      details: validation.errors
    }, { status: 400 })
  }

  const bodyData = body as Record<string, unknown>
  const name = String(bodyData.name).trim()
  const email = String(bodyData.email).toLowerCase().trim()
  const password = String(bodyData.password)
  const role = String(bodyData.role)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const usuario = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        secretariaId: (bodyData.secretariaId ? String(bodyData.secretariaId) : null)
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cpfBloqueado: true,
        ativo: true,
        createdAt: true,
        secretariaId: true
      },
    })

    return NextResponse.json(usuario, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[USER_CREATE_ERROR]', msg)

    // Não expor detalhes do erro
    if (msg.includes('secretariaId')) {
      return NextResponse.json({ error: 'Secretaria não encontrada' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
  }
}
