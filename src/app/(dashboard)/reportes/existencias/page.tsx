export const dynamic = 'force-dynamic'
import { getExistenciasReport } from '@/features/inventory/actions/report-actions'
import { ExistenciasReport } from '@/features/inventory/components/existencias-report'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<{ from?: string; to?: string; branch?: string }>
}

export default async function ExistenciasPage({ searchParams }: Props) {
  const session = await getUser()
  if (!session) redirect('/login')

  const params = await searchParams
  const branchId = session.profile.role === 'sucursal'
    ? session.profile.branch_id ?? undefined
    : params.branch

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = (await getExistenciasReport({
    branchId,
    dateFrom: params.from,
    dateTo: params.to,
  }).catch(() => ({ stock: [], entries: [], exits: [] }))) as any

  return <ExistenciasReport report={report} role={session.profile.role} />
}
