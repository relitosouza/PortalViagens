import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userIds } = await req.json()
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'userIds required' }, { status: 400 })
  }

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { cpfBloqueado: false }
  })

  return NextResponse.json({ desbloqueados: userIds.length })
}
