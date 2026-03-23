import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = params
  const { nome, ativo } = await req.json()

  try {
    const secretaria = await prisma.secretaria.update({
      where: { id },
      data: { 
        ...(nome !== undefined && { nome }),
        ...(ativo !== undefined && { ativo })
      }
    })
    return NextResponse.json(secretaria)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe uma secretaria com este nome' }, { status: 400 })
    }
    console.error('Erro ao atualizar secretaria:', error)
    return NextResponse.json({ error: 'Erro ao atualizar secretaria' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = params

  try {
    // Check if there are users linked to this secretaria
    const usersCount = await prisma.user.count({
      where: { secretariaId: id }
    })

    if (usersCount > 0) {
      return NextResponse.json({ error: 'Não é possível excluir uma secretaria com usuários vinculados. Tente desativá-la.' }, { status: 400 })
    }

    await prisma.secretaria.delete({
      where: { id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir secretaria:', error)
    return NextResponse.json({ error: 'Erro ao excluir secretaria' }, { status: 500 })
  }
}
