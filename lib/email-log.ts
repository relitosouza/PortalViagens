// lib/email-log.ts
import fs from 'fs'
import path from 'path'

const LOG_PATH = path.join(process.cwd(), 'email-logs.json')

type EmailLog = {
  id: string
  para: string
  assunto: string
  corpo: string
  timestamp: string
  tipo: string
}

export function logEmail(email: Omit<EmailLog, 'id' | 'timestamp'>) {
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
  // Manter apenas os últimos 500 registros
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs.slice(0, 500), null, 2))
  console.log(`[EMAIL LOG] Para: ${email.para} | Assunto: ${email.assunto}`)
}
