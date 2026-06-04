export const dynamic = 'force-dynamic'
import { getEntries } from '@/features/inventory/actions/entry-actions'
import { getSupplies } from '@/features/supplies/actions/supply-actions'
import { EntryManager } from '@/features/inventory/components/entry-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function EntradasPage() {
  const session = await getUser()
  if (!session) redirect('/login')

  const branchId = session.profile.role === 'sucursal'
    ? session.profile.branch_id ?? undefined
    : undefined

  const [entries, supplies] = await Promise.all([
    getEntries(branchId).catch(() => []),
    getSupplies().catch(() => []),
  ])

  return <EntryManager entries={entries} supplies={supplies} />
}
