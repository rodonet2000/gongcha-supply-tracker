import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Auth client — reads/writes session cookies. Uses anon key.
export async function createAuthClient() {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
  console.log('[createAuthClient] storageKey derived:', storageKey)

  return createSSRClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          const all = cookieStore.getAll()
          console.log('[createAuthClient.getAll] cookies:', all.map(c => c.name))
          return all
        },
        setAll: (cookiesToSet) => {
          console.log('[createAuthClient.setAll] setting:', cookiesToSet.map(c => ({ name: c.name, value: c.value?.slice(0, 40) })))
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (e) {
            console.error('[createAuthClient.setAll] error:', e)
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
