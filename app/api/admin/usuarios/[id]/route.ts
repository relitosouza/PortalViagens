import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  const user = session.user as { id: string; role: string }
  if (user.role !== 'ADMIN') return null
  return session
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.role !== undefined) updateData.role = body.role
  if (body.ativo !== undefined) updateData.ativo = body.ativo
  if (body.cpfBloqueado !== undefined) updateData.cpfBloqueado = body.cpfBloqueado
  if (body.password) updateData.password = await bcrypt.hash(body.password, 10)

  const usuario = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, cpfBloqueado: true, ativo: true, createdAt: true },
  })

  return NextResponse.json(usuario)
}
