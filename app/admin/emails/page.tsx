import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { EmailsClient } from './EmailsClient'

export default async function AdminEmailsPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/dashboard')
  return <EmailsClient />
}
