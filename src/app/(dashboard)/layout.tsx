import { Sidebar } from '@/shared/components/sidebar'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getUser()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={session.profile} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
