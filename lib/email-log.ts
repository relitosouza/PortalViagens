// lib/email-log.ts
import fs from 'fs'
import path from 'path'
import nodemailer from 'nodemailer'

const LOG_PATH = path.join(process.cwd(), 'email-logs.json')

type EmailLog = {
  id: string
  para: string
  assunto: string
  corpo: string
  timestamp: string
  tipo: string
}

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  })
}

export function logEmail(email: Omit<EmailLog, 'id' | 'timestamp'>) {
  // Registrar no arquivo de log
  let logs: EmailLog[] = []
  if (fs.existsSync(LOG_PATH)) {
    try {
      logs = JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'))
    } catch {
      logs = []
    }
  }
  const entry: EmailLog = {
    ...email,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString()
  }
  logs.unshift(entry)
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs.slice(0, 500), null, 2))
  console.log(`[EMAIL LOG] Para: ${email.para} | Assunto: ${email.assunto}`)

  // Enviar email real se credenciais configuradas
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    const transporter = createTransporter()
    transporter.sendMail({
      from: `"${process.env.EMAIL_FROM ?? 'Portal Viagens Osasco'}" <${process.env.EMAIL_USER}>`,
      to: email.para,
      subject: email.assunto,
      text: email.corpo,
    }).catch((err: unknown) => {
      console.error('[EMAIL SEND ERROR]', err instanceof Error ? err.message : String(err))
    })
  }
}
