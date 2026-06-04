'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/features/auth/actions/auth-actions'
import type { UserRole } from '@/shared/types'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function getUsers() {
  const db = createServerClient()
  const { data, error } = await db
    .from('user_profiles')
    .select('*, branches(name, code)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getBranches() {
  const db = createServerClient()
  const { data } = await db.from('branches').select('*').eq('active', true)
  return data ?? []
}

export async function createUser(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentUser()
  if (!session || !['administrador', 'direccion'].includes(session.profile.role)) {
    return { success: false, error: 'Sin permisos' }
  }

  const email     = formData.get('email') as string
  const password  = formData.get('password') as string
  const full_name = formData.get('full_name') as string
  const role      = formData.get('role') as UserRole
  const branch_id = formData.get('branch_id') as string || null

  if (session.profile.role === 'administrador' && role === 'direccion') {
    return { success: false, error: 'Sin permisos para crear dirección' }
  }

  const admin = createAdminClient()
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authErr) return { success: false, error: authErr.message }

  const db = createServerClient()
  const { error: profileErr } = await db.from('user_profiles').insert({
    user_id: authUser.user.id, full_name, role,
    branch_id: branch_id || null,
  })
  if (profileErr) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { success: false, error: profileErr.message }
  }

  revalidatePath('/usuarios')
  return { success: true }
}

export async function toggleUserActive(userId: string, active: boolean) {
  const db = createServerClient()
  await db.from('user_profiles').update({ active }).eq('user_id', userId)
  revalidatePath('/usuarios')
}
