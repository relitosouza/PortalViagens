import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

function adminOnly(session: Awaited<ReturnType<typeof auth>>) {
  return !session?.user || session.user.role !== 'ADMIN'
}

// GET - list all users
export async function GET() {
  const session = await auth()
  if (adminOnly(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, cpfBloqueado: true, createdAt: true }
  })
  return NextResponse.json(users)
}

// POST - create user
export async function POST(req: NextRequest) {
  const session = await auth()
  if (adminOnly(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role } = await req.json()
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { name, email, password: hashed, role } })
  return NextResponse.json({ id: user.id }, { status: 201 })
}
