export const dynamic = 'force-dynamic'
import { getExits } from '@/features/inventory/actions/exit-actions'
import { getSupplies } from '@/features/supplies/actions/supply-actions'
import { ExitManager } from '@/features/inventory/components/exit-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function SalidasPage() {
  const session = await getUser()
  if (!session) redirect('/login')

  const branchId = session.profile.role === 'sucursal'
    ? session.profile.branch_id ?? undefined
    : undefined

  const [exits, supplies] = await Promise.all([
    getExits(branchId).catch(() => []),
    getSupplies().catch(() => []),
  ])

  return <ExitManager exits={exits} supplies={supplies} />
}
