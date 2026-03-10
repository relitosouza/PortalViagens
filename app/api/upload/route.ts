// app/api/upload/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getConfigInt } from '@/lib/config'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]
  const solicitacaoId = formData.get('solicitacaoId') as string | null
  const prestacaoId = formData.get('prestacaoId') as string | null
  const tipo = formData.get('tipo') as string

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
  }

  const uploadMaxMb = await getConfigInt('UPLOAD_MAX_MB')
  const MAX_SIZE = uploadMaxMb * 1024 * 1024

  const uploadDir = path.join(process.cwd(), 'uploads')
  await mkdir(uploadDir, { recursive: true })

  const anexosCriados = []

  for (const file of files) {
    // Validar tamanho
    if (file.size > MAX_SIZE) {
      return NextResponse.json({
        error: `Arquivo "${file.name}" excede o limite de ${uploadMaxMb}MB`
      }, { status: 400 })
    }

    // Sanitizar nome do arquivo
    const ext = path.extname(file.name)
    const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]/g, '_')
    const filename = `${Date.now()}-${baseName}${ext}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(path.join(uploadDir, filename), buffer)

    const anexo = await prisma.anexo.create({
      data: {
        nome: file.name,
        path: filename,
        tipo: tipo ?? 'OUTRO',
        solicitacaoId: solicitacaoId || null,
        prestacaoId: prestacaoId || null,
      }
    })
    anexosCriados.push(anexo)
  }

  return NextResponse.json({ anexos: anexosCriados })
}
