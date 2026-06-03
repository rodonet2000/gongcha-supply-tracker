import { createClient } from '@supabase/supabase-js'

// Cliente con service_role key — bypassa RLS, solo usar en server-side
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
