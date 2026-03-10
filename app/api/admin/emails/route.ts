import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const LOG_PATH = path.join(process.cwd(), 'email-logs.json')

interface EmailLog {
  id: string
  para: string
  assunto: string
  corpo: string
  timestamp: string
  tipo: string
}

async function readLogs(): Promise<EmailLog[]> {
  try {
    const content = await fs.readFile(LOG_PATH, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

// GET - list email logs
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo')
  const busca = searchParams.get('busca')?.toLowerCase()

  let logs = await readLogs()

  if (tipo) logs = logs.filter(l => l.tipo === tipo)
  if (busca) {
    logs = logs.filter(l =>
      l.para?.toLowerCase().includes(busca) ||
      l.assunto?.toLowerCase().includes(busca)
    )
  }

  // Already stored newest-first (unshift), limit to 200
  return NextResponse.json(logs.slice(0, 200))
}

// DELETE - clear logs
export async function DELETE() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await fs.writeFile(LOG_PATH, JSON.stringify([]))
  return NextResponse.json({ ok: true })
}
