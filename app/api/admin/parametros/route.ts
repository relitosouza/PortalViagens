import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = await prisma.configuracaoSistema.findMany({ orderBy: { chave: 'asc' } })
  return NextResponse.json(params)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const VALID_CHAVES = [
    'DIAS_UTEIS_ANTECEDENCIA_MINIMA',
    'DIAS_UTEIS_PRAZO_PRESTACAO',
    'DIAS_ALERTA_VENCIMENTO',
    'UPLOAD_MAX_MB',
  ]

  const updates: { chave: string; valor: string }[] = await req.json()

  for (const { chave, valor } of updates) {
    if (!VALID_CHAVES.includes(chave)) {
      return NextResponse.json({ error: `Parâmetro inválido: "${chave}"` }, { status: 400 })
    }
    const num = parseInt(valor, 10)
    if (isNaN(num) || num <= 0) {
      return NextResponse.json({ error: `Valor inválido para "${chave}": deve ser um número inteiro positivo` }, { status: 400 })
    }
    await prisma.configuracaoSistema.update({ where: { chave }, data: { valor: String(num) } })
  }

  return NextResponse.json({ ok: true })
}
