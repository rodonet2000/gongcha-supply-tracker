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

  const supabase = await createAuthClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: 'Credenciales incorrectas' }

  // @supabase/ssr writes session cookies automatically via the setAll callback
  // in createAuthClient(). No manual cookie writing needed.

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const db = createServerClient()
    const { data: profile } = await db
      .from('user_profiles')
      .select('*, branches(name, code)')
      .eq('user_id', user.id)
      .single()

    if (!profile) return null
    return { userId: user.id, profile: profile as UserProfile }
  } catch {
    return null
  }
}
