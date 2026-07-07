export const dynamic = 'force-dynamic'

import { getCountSessions } from '@/features/conteo/actions/conteo-actions'
import { ConteoManager } from '@/features/conteo/components/conteo-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function ConteoPage() {
  const session = await getUser()
  if (!session) redirect('/login')

  const branchId = session.profile.role === 'sucursal'
    ? session.profile.branch_id ?? undefined
    : undefined

  const sessions = await getCountSessions(branchId).catch(() => [])

  return (
    <ConteoManager
      sessions={sessions}
      canCreate={true}
    />
  )
}
