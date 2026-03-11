import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SolicitacaoFormClient } from '@/components/SolicitacaoFormClient'

export default async function NovaSolicitacaoPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="p-8">
      <SolicitacaoFormClient userName={session.user.name ?? ''} />
    </div>
  )
}
