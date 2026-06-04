export const dynamic = 'force-dynamic'
import { getUsers, getBranches } from '@/features/users/actions/user-actions'
import { UsersManager } from '@/features/users/components/users-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function UsuariosPage() {
  const session = await getUser()
  if (!session) redirect('/login')
  if (!['administrador', 'direccion'].includes(session.profile.role)) redirect('/dashboard')

  const [users, branches] = await Promise.all([
    getUsers().catch(() => []),
    getBranches().catch(() => []),
  ])

  return <UsersManager users={users} branches={branches} currentRole={session.profile.role} />
}
