import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { PrestacaoFormClient } from '@/components/PrestacaoFormClient'

export default async function PrestacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id } = await params
  const userId = session.user.id

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: { prestacao: true },
  })

  if (!sol) notFound()
  if (sol.userId !== userId) notFound()
  if (sol.status !== 'CONCLUIDA') redirect(`/solicitacoes/${id}`)

  const iniciais = (session.user.name ?? 'U')
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()

  return (
    <PrestacaoFormClient
      solicitacaoId={id}
      destino={sol.destino}
      dataIda={sol.dataIda.toISOString()}
      dataVolta={sol.dataVolta.toISOString()}
      prazoFinal={sol.prestacao?.prazoFinal?.toISOString() ?? null}
      jaEnviada={!!sol.prestacao?.enviadoEm}
      iniciais={iniciais}
    />
  )
}
