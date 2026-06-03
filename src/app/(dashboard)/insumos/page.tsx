export const dynamic = 'force-dynamic'
import { getSupplies } from '@/features/supplies/actions/supply-actions'
import { SuppliesManager } from '@/features/supplies/components/supplies-manager'

export default async function InsumosPage() {
  let supplies: Awaited<ReturnType<typeof getSupplies>> = []
  try { supplies = await getSupplies() } catch { /* schema not ready */ }
  return <SuppliesManager initialSupplies={supplies} />
}
