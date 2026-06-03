'use client'

import { createClient } from '@supabase/supabase-js'

// Cliente con anon key — para componentes client-side (solo lectura en esta app)
let client: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: 'gongcha' as unknown as undefined } }
    )
  }
  return client
}
