export const dynamic = 'force-dynamic'
import { getPurchases } from '@/features/inventory/actions/purchase-actions'
import { getSuppliers } from '@/features/inventory/actions/supplier-actions'
import { getSupplies } from '@/features/supplies/actions/supply-actions'
import { PurchaseManager } from '@/features/inventory/components/purchase-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function ComprasPage() {
  const session = await getUser()
  if (!session) redirect('/login')
  if (!['administrador', 'direccion'].includes(session.profile.role)) redirect('/dashboard')

  const branchId = session.profile.branch_id ?? undefined
  const [purchases, suppliers, supplies] = await Promise.all([
    getPurchases(branchId).catch(() => []),
    getSuppliers().catch(() => []),
    getSupplies().catch(() => []),
  ])

  return <PurchaseManager purchases={purchases} suppliers={suppliers} supplies={supplies} />
}
