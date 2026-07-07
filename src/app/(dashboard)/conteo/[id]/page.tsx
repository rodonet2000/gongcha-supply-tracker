export const dynamic = 'force-dynamic'

import { getCountSession } from '@/features/conteo/actions/conteo-actions'
import { ConteoForm } from '@/features/conteo/components/conteo-form'
import { getUser } from '@/shared/lib/user'
import { redirect, notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ConteoDetailPage({ params }: Props) {
  const { id } = await params
  const userSession = await getUser()
  if (!userSession) redirect('/login')

  let data: Awaited<ReturnType<typeof getCountSession>>
  try {
    data = await getCountSession(id)
  } catch {
    notFound()
  }

  const canApprove = ['administrador', 'direccion'].includes(userSession.profile.role)

  return (
    <ConteoForm
      session={data.session}
      items={data.items}
      canApprove={canApprove}
    />
  )
}
