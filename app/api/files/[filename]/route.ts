// app/api/files/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const user = session.user as { id: string; role: string }
  const { filename } = await params

  // Prevenir path traversal
  const safeFilename = path.basename(filename)

  try {
    // CRITICAL FIX: Verificar se o arquivo pertence ao usuário
    const anexo = await prisma.anexo.findUnique({
      where: { path: safeFilename },
      include: {
        solicitacao: true,
        prestacao: { include: { solicitacao: true } }
      }
    })

    if (!anexo) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    // Verificar permissão: usuário só pode acessar seus próprios arquivos
    const isOwner =
      (anexo.solicitacao?.userId === user.id) ||
      (anexo.prestacao?.solicitacao?.userId === user.id)

    // Admin pode acessar qualquer arquivo
    const isAdmin = user.role === 'ADMIN'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Acesso negado a este arquivo' }, { status: 403 })
    }

    const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
    const filePath = path.join(uploadDir, safeFilename)

    const file = await readFile(filePath)
    const ext = path.extname(safeFilename).toLowerCase()
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

    // Sanitizar filename para Content-Disposition
    const sanitizedName = safeFilename.replace(/"/g, '\\"')

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${sanitizedName}"`,
        'Cache-Control': 'private, max-age=3600',
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[FILE_DOWNLOAD_ERROR]', msg)
    // Não expor detalhes do erro ao cliente
    return NextResponse.json({ error: 'Erro ao baixar arquivo' }, { status: 500 })
  }
}
