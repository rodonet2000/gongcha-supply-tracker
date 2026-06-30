'use server'

import { createAuthClient } from '@/shared/lib/supabase/server'
import { createServerClient } from '@/shared/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserProfile } from '@/shared/types'

export async function signIn(
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  console.log('[signIn] starting for email:', email)
  const supabase = await createAuthClient()
  console.log('[signIn] client created, calling signInWithPassword')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  console.log('[signIn] signInWithPassword result:', {
    error: error?.message,
    hasSession: !!data?.session,
    user: data?.user?.email,
  })

  if (error) return { error: 'Credenciales incorrectas' }

  // @supabase/ssr writes session cookies automatically via the setAll callback
  // in createAuthClient(). No manual cookie writing needed.

  const cookieStore = (await import('next/headers')).cookies
  const cs = await cookieStore()
  console.log('[signIn] cookies after signIn (before redirect):', cs.getAll().map(c => c.name))

  console.log('[signIn] redirecting to /dashboard')
  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createAuthClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getCurrentUser(): Promise<{
  userId: string
  profile: UserProfile
} | null> {
  try {
    const supabase = await createAuthClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('[getCurrentUser] getUser result:', { user: user?.email, error: userError?.message })
    if (!user) return null

    const db = createServerClient()
    const { data: profile, error: profileError } = await db
      .from('user_profiles')
      .select('*, branches(name, code)')
      .eq('user_id', user.id)
      .single()
    console.log('[getCurrentUser] profile lookup:', { found: !!profile, error: profileError?.message, userId: user.id })

    if (!profile) return null
    return { userId: user.id, profile: profile as UserProfile }
  } catch (e) {
    console.error('[getCurrentUser] exception:', e)
    return null
  }
}
