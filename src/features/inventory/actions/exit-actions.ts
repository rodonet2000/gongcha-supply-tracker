'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { getCurrentUser } from '@/features/auth/actions/auth-actions'
import { revalidatePath } from 'next/cache'

export async function getExits(branchId?: string) {
  const db = createServerClient()
  let query = db
    .from('stock_exits')
    .select('*, supplies(name, unit, category), branches(name)')
    .order('fecha', { ascending: false })
    .limit(100)
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createExit(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentUser()
  if (!session) return { success: false, error: 'Sin sesión' }

  const supply_id = formData.get('supply_id') as string
  const cantidad  = parseFloat(formData.get('cantidad') as string)
  const fecha     = formData.get('fecha') as string
  const source    = (formData.get('source') as string) || 'manual'
  const notes     = formData.get('notes') as string || null
  const branch_id = session.profile.branch_id
  if (!branch_id) return { success: false, error: 'Usuario sin sucursal asignada' }

  const db = createServerClient()
  const { error } = await db.from('stock_exits').insert({
    supply_id, branch_id, fecha, cantidad, source, notes, user_id: session.userId,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/salidas')
  revalidatePath('/kardex')
  return { success: true }
}
