export const dynamic = 'force-dynamic'
import { getKardex, getCurrentStock } from '@/features/inventory/actions/kardex-actions'
import { KardexTable } from '@/features/inventory/components/kardex-table'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function KardexPage() {
  const session = await getUser()
  if (!session) redirect('/login')

  const branchId = session.profile.role === 'sucursal'
    ? session.profile.branch_id ?? undefined
    : undefined

  const [kardex, currentStock] = await Promise.all([
    getKardex(branchId).catch(() => []),
    getCurrentStock(branchId).catch(() => []),
  ])

  return <KardexTable kardex={kardex} currentStock={currentStock} />
}
