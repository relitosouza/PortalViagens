import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import {
  getUnreadCount,
  getRecentNotifications,
  marcarComoLida,
  marcarTodasComoLidas,
} from '@/lib/notifications'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const userId = (session.user as { id: string }).id

  const [count, items] = await Promise.all([
    getUnreadCount(userId),
    getRecentNotifications(userId, 15),
  ])

  return NextResponse.json({ count, items })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const userId = (session.user as { id: string }).id
  const body = await req.json().catch(() => ({}))

  if (body.id) {
    await marcarComoLida(body.id, userId)
  } else {
    await marcarTodasComoLidas(userId)
  }

  return NextResponse.json({ ok: true })
}
