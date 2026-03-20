import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  // If deactivating, check no active users
  if (body.ativo === false) {
    const ativos = await prisma.user.count({
      where: { secretariaId: id, ativo: true },
    })
    if (ativos > 0) {
      return NextResponse.json(
        { error: `Não é possível desativar: existem ${ativos} usuário(s) ativo(s) nesta secretaria.` },
        { status: 409 }
      )
    }
  }

  const data: { nome?: string; ativo?: boolean } = {}
  if (body.nome !== undefined) data.nome = body.nome.trim()
  if (body.ativo !== undefined) data.ativo = body.ativo

  try {
    const updated = await prisma.secretaria.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe uma secretaria com esse nome.' }, { status: 409 })
    }
    throw err
  }
}
