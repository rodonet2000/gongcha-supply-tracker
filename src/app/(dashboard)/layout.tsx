import { Sidebar } from '@/shared/components/sidebar'
import { getUser } from '@/shared/lib/user'
import { createAuthClient } from '@/shared/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getUser()

  if (!session) {
    // Sign out to clear any stale JWT that has no matching user_profile.
    // Without this, the middleware sees a valid JWT and redirects /login → /dashboard
    // indefinitely, causing ERR_TOO_MANY_REDIRECTS.
    try {
      const supabase = await createAuthClient()
      await supabase.auth.signOut()
    } catch { /* ignore signout errors */ }
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={session.profile} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
