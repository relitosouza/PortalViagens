// app/api/solicitacoes/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calcularDiasUteisAte } from '@/lib/utils/diasUteis'
import {
  notificarNovaSolicitacaoParaSecol,
  notificarSecretarioParaAprovacao
} from '@/lib/email-notifications'
// HIGH PRIORITY FIX: Use safe auth type instead of unsafe casting
import { getAuthUser } from '@/lib/types/auth'
// MEDIUM FIX: Add validators
import { isValidCPF } from '@/lib/validators/cpf'
import { isValidBirthDate, isValidTravelDate, isValidDateRange } from '@/lib/validators/dates'

// CRITICAL FIX: Adicionar validação de entrada com schema
function validateSolicitacaoInput(body: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (typeof body !== 'object' || body === null) {
    return { valid: false, errors: ['Corpo da requisição inválido'] }
  }

  const data = body as Record<string, unknown>

  // Campos obrigatórios
  const requiredFields = [
    'nomeCompleto', 'matricula', 'cpf', 'dataNascimento', 'celular',
    'emailServidor', 'justificativaPublica', 'nexoCargo', 'destino',
    'dataIda', 'dataVolta', 'justificativaLocal', 'fichaOrcamentaria'
  ]

  requiredFields.forEach(field => {
    if (!data[field] || typeof data[field] !== 'string') {
      errors.push(`Campo obrigatório: ${field}`)
    }
  })

  // MEDIUM FIX: Validar CPF com checksum
  if (data.cpf && !isValidCPF(String(data.cpf))) {
    errors.push('cpf: CPF inválido (checksum falhou)')
  }

  // MEDIUM FIX: Validar data de nascimento (sanity check)
  if (data.dataNascimento && !isValidBirthDate(String(data.dataNascimento))) {
    errors.push('dataNascimento: data de nascimento inválida (deve ser no passado, maior de 18 anos)')
  }

  // MEDIUM FIX: Validar datas de viagem
  if (data.dataIda && !isValidTravelDate(String(data.dataIda))) {
    errors.push('dataIda: data de ida deve ser no futuro')
  }

  if (data.dataVolta && !isValidTravelDate(String(data.dataVolta))) {
    errors.push('dataVolta: data de volta deve ser no futuro')
  }

  // MEDIUM FIX: Validar intervalo de datas
  if (data.dataIda && data.dataVolta && !isValidDateRange(String(data.dataIda), String(data.dataVolta))) {
    errors.push('dataVolta: data de volta deve ser após data de ida')
  }

  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (data.emailServidor && !emailRegex.test(String(data.emailServidor))) {
    errors.push('emailServidor: formato de email inválido')
  }

  // Validar celular (mínimo 10 dígitos)
  const celular = String(data.celular).replace(/\D/g, '')
  if (celular.length < 10) {
    errors.push('celular: deve conter pelo menos 10 dígitos')
  }

  // Validar tamanho máximo dos campos de texto
  const textFields: Record<string, number> = {
    nomeCompleto: 255,
    matricula: 50,
    cpf: 14,
    destino: 255,
    nexoCargo: 255,
    justificativaPublica: 2000,
    justificativaLocal: 2000,
    fichaOrcamentaria: 1000
  }

  Object.entries(textFields).forEach(([field, maxLength]) => {
    if (data[field] && String(data[field]).length > maxLength) {
      errors.push(`${field}: máximo ${maxLength} caracteres`)
    }
  })

  return { valid: errors.length === 0, errors }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // HIGH PRIORITY FIX: Use safe type extraction instead of unsafe casting
  const user = getAuthUser(session.user)
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }

  const PERFIS_AUTORIZADOS: typeof user.role[] = ['DEMANDANTE', 'SECRETARIO', 'ADMIN']
  if (!PERFIS_AUTORIZADOS.includes(user.role)) {
    return NextResponse.json({ error: 'Você não tem permissão para criar solicitações' }, { status: 403 })
  }

  // Verificar bloqueio do CPF
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  if (dbUser.cpfBloqueado) {
    return NextResponse.json({
      error: 'CPF bloqueado por prestação de contas pendente. Envie o relatório para desbloquear.'
    }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Formato JSON inválido' }, { status: 400 })
  }

  // CRITICAL FIX: Validar entrada
  const validation = validateSolicitacaoInput(body)
  if (!validation.valid) {
    return NextResponse.json({
      error: 'Validação falhou',
      details: validation.errors
    }, { status: 400 })
  }

  const bodyData = body as Record<string, unknown>
  const isRascunho = bodyData.rascunho === true

  let dataIda: Date
  try {
    dataIda = new Date(String(bodyData.dataIda))
  } catch {
    return NextResponse.json({ error: 'dataIda: data inválida' }, { status: 400 })
  }

  if (!isRascunho) {
    // Validar antecedência de 15 dias úteis (Art. 1º)
    const diasUteis = calcularDiasUteisAte(dataIda)
    if (diasUteis < 15 && user.role !== 'ADMIN') {
      return NextResponse.json({
        error: `Antecedência insuficiente: apenas ${diasUteis} dia(s) útil(is). Mínimo exigido: 15 dias úteis (Art. 1º).`
      }, { status: 422 })
    }
  }

  const solicitacao = await prisma.solicitacao.create({
    data: {
      nomeCompleto: String(bodyData.nomeCompleto),
      matricula: String(bodyData.matricula),
      cpf: String(bodyData.cpf),
      dataNascimento: new Date(String(bodyData.dataNascimento)),
      celular: String(bodyData.celular),
      emailServidor: String(bodyData.emailServidor),
      justificativaPublica: String(bodyData.justificativaPublica),
      nexoCargo: String(bodyData.nexoCargo),
      destino: String(bodyData.destino),
      dataIda,
      dataVolta: new Date(String(bodyData.dataVolta)),
      justificativaLocal: String(bodyData.justificativaLocal),
      fichaOrcamentaria: String(bodyData.fichaOrcamentaria),
      indicacaoVoo: (bodyData.indicacaoVoo ? String(bodyData.indicacaoVoo) : null),
      indicacaoHospedagem: (bodyData.indicacaoHospedagem ? String(bodyData.indicacaoHospedagem) : null),
      status: isRascunho ? 'RASCUNHO' : (dbUser.role === 'SECRETARIO' ? 'EM_COTACAO' : 'AGUARDANDO_APROVACAO_PASTA'),
      userId: user.id,
      secretariaId: dbUser.secretariaId,
    },
    include: { user: true },
  })

  if (!isRascunho) {
    if (solicitacao.status === 'EM_COTACAO') {
      notificarNovaSolicitacaoParaSecol(solicitacao).catch(() => {})
    } else if (solicitacao.status === 'AGUARDANDO_APROVACAO_PASTA') {
      notificarSecretarioParaAprovacao(solicitacao).catch(() => {})
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user: _user, ...solicitacaoResponse } = solicitacao
  return NextResponse.json(solicitacaoResponse, { status: 201 })
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // HIGH PRIORITY FIX: Use safe type extraction
  const user = getAuthUser(session.user)
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }
  
  let where = {}
  if (user.role === 'DEMANDANTE') {
    where = { userId: user.id }
  } else if (user.role === 'SECRETARIO') {
    // Secretário vê apenas solicitações da sua secretaria que aguardam aprovação
    // ou que ele já aprovou (opcional, mas seguindo a regra de visibilidade solicitada)
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    where = {
      secretariaId: dbUser?.secretariaId,
      status: 'AGUARDANDO_APROVACAO_PASTA'
    }
  }

  const solicitacoes = await prisma.solicitacao.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nomeCompleto: true,
      matricula: true,
      destino: true,
      dataIda: true,
      dataVolta: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      justificativaPublica: true,
      nexoCargo: true,
      justificativaLocal: true,
      fichaOrcamentaria: true,
      indicacaoVoo: true,
      indicacaoHospedagem: true,
      // cpf, dataNascimento, celular, emailServidor omitidos da listagem
      user: { select: { name: true } }
    }
  })

  return NextResponse.json(solicitacoes)
}
