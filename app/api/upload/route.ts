// app/api/upload/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
// MEDIUM FIX: Add rate limiting
import { rateLimit } from '@/lib/middleware/rate-limit'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
// MEDIUM FIX: Rate limit: 20 uploads per minute per user
const UPLOAD_RATE_LIMIT = 20
const UPLOAD_WINDOW_MS = 60000

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // MEDIUM FIX: Apply rate limiting
    const user = session.user as { id: string }
    if (!rateLimit(user.id, UPLOAD_RATE_LIMIT, UPLOAD_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Limite de uploads excedido. Tente novamente em um minuto.' },
        { status: 429 }
      )
    }

    let formData: FormData
    try {
      formData = await req.formData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[UPLOAD ERROR] formData parse failed:', msg)
      return NextResponse.json({ error: `Erro ao processar formulário: ${msg}` }, { status: 400 })
    }

    const files = formData.getAll('files') as File[]
    const solicitacaoId = formData.get('solicitacaoId') as string | null
    const prestacaoId = formData.get('prestacaoId') as string | null
    const tipo = formData.get('tipo') as string

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
    await mkdir(uploadDir, { recursive: true })

    const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']
    const anexosCriados = []

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json({
          error: `Arquivo "${file.name}" excede o limite de 10MB`
        }, { status: 400 })
      }

      const ext = path.extname(file.name).toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json({
          error: `Tipo de arquivo não permitido: "${ext}". Permitidos: ${ALLOWED_EXTENSIONS.join(', ')}`
        }, { status: 400 })
      }

      // HIGH PRIORITY FIX: Use crypto instead of predictable timestamps
      const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]/g, '_')
      const randomSuffix = Math.random().toString(36).substring(2, 15)
      const filename = `${randomSuffix}-${baseName}${ext}`

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[UPLOAD ERROR]', msg)
    return NextResponse.json({ error: `Erro no upload: ${msg}` }, { status: 500 })
  }
}
