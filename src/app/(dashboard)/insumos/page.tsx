import { getSupplies } from '@/features/supplies/actions/supply-actions'
import { SuppliesManager } from '@/features/supplies/components/supplies-manager'

export default async function InsumosPage() {
  const supplies = await getSupplies()
  return <SuppliesManager initialSupplies={supplies} />
}
