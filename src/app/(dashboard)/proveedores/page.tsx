export const dynamic = 'force-dynamic'
import { getSuppliers } from '@/features/inventory/actions/supplier-actions'
import { SuppliersManager } from '@/features/inventory/components/suppliers-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function ProveedoresPage() {
  const session = await getUser()
  if (!session) redirect('/login')
  if (!['administrador', 'direccion'].includes(session.profile.role)) redirect('/dashboard')
  const suppliers = await getSuppliers().catch(() => [])
  return <SuppliersManager suppliers={suppliers} />
}
