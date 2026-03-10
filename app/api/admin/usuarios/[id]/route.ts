import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// PATCH - update user (name, role, password, cpfBloqueado)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const u = session?.user as { role?: string } | undefined
  if (!u || u.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}

  if (body.name !== undefined) data.name = body.name
  if (body.role !== undefined) data.role = body.role
  if (body.cpfBloqueado !== undefined) data.cpfBloqueado = body.cpfBloqueado
  if (body.password) data.password = await bcrypt.hash(body.password, 10)

  const user = await prisma.user.update({ where: { id }, data })
  return NextResponse.json({ id: user.id })
}

// DELETE - deactivate (soft delete by setting role to INATIVO)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const u = session?.user as { role?: string } | undefined
  if (!u || u.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  // Deactivate by setting a special role that blocks login
  await prisma.user.update({ where: { id }, data: { role: 'INATIVO' } })
  return NextResponse.json({ ok: true })
}
