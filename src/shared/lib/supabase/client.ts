'use client'

import { createBrowserClient } from '@supabase/ssr'

// Auth browser client — for client components that need session awareness
export function getSupabaseAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
