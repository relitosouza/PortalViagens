// app/api/files/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// HIGH PRIORITY FIX: Use safe auth type instead of unsafe casting
import { getAuthUser } from '@/lib/types/auth'

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

  // HIGH PRIORITY FIX: Use safe type extraction
  const user = getAuthUser(session.user)
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }
  const { filename } = await params

  // Prevenir path traversal
  const safeFilename = path.basename(filename)

  try {
    // CRITICAL FIX: Verificar se o arquivo pertence ao usuário
    const anexo = await (prisma.anexo as any).findFirst({
      where: { path: safeFilename },
      include: {
        solicitacao: true,
        prestacao: { include: { solicitacao: true } }
      }
    }) as any

    if (!anexo) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    // Verificar permissão
    const isOwner =
      (anexo.solicitacao?.userId === user.id) ||
      (anexo.prestacao?.solicitacao?.userId === user.id)

    // Admin pode acessar qualquer arquivo
    const isAdmin = user.role === 'ADMIN'

    // Papéis técnicos podem acessar arquivos de solicitações em estados que lhes competem
    let isTechnicalAllowed = false
    const solStatus = anexo.solicitacao?.status || anexo.prestacao?.solicitacao?.status
    
    if (solStatus) {
      if (user.role === 'SECOL' && ['EM_COTACAO', 'AGUARDANDO_EMISSAO', 'CONCLUIDA'].includes(solStatus)) isTechnicalAllowed = true
      if (user.role === 'SEGOV' && ['AGUARDANDO_VIABILIDADE', 'CONCLUIDA'].includes(solStatus)) isTechnicalAllowed = true
      if (user.role === 'SF' && ['AGUARDANDO_EXECUCAO', 'CONCLUIDA'].includes(solStatus)) isTechnicalAllowed = true
      if (user.role === 'SECRETARIO' && solStatus === 'AGUARDANDO_APROVACAO_PASTA') isTechnicalAllowed = true
    }

    if (!isOwner && !isAdmin && !isTechnicalAllowed) {
      return NextResponse.json({ error: 'Acesso negado a este arquivo' }, { status: 403 })
    }

    const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
    const filePath = path.join(uploadDir, safeFilename)

    const file = await readFile(filePath)
    const ext = path.extname(safeFilename).toLowerCase()
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

    // MEDIUM FIX: Properly escape and encode filename for Content-Disposition
    // Use RFC 5987 encoding for non-ASCII characters
    const isASCII = /^[\x20-\x7E]*$/.test(safeFilename)
    let dispositionValue: string

    if (isASCII) {
      // For ASCII filenames, just escape quotes
      const sanitizedName = safeFilename.replace(/"/g, '\\"')
      dispositionValue = `inline; filename="${sanitizedName}"`
    } else {
      // For non-ASCII, use RFC 5987 encoding
      const encodedName = encodeURIComponent(safeFilename)
      dispositionValue = `inline; filename*=UTF-8''${encodedName}; filename="${safeFilename}"`
    }

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': dispositionValue,
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
