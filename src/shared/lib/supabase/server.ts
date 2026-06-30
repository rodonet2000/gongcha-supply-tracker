import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Auth client — reads/writes session cookies. Uses anon key.
// @supabase/ssr derives the cookie name as `sb-{hostname-prefix}-auth-token`
// from NEXT_PUBLIC_SUPABASE_URL — this must match middleware.ts's check.
export async function createAuthClient() {
  const cookieStore = await cookies()

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (e) {
            // Expected when called from a Server Component (e.g. signOut()
            // inside the dashboard layout) — cookies can only be written
            // from a Server Action or Route Handler in Next.js.
            console.error('[createAuthClient.setAll]', e)
          }
        },
      },
    }
  )
}

// Data client — service_role key bypasses RLS. Use for all DB operations.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'gongcha' as unknown as undefined },
      auth: { persistSession: false },
    }
  )
}
