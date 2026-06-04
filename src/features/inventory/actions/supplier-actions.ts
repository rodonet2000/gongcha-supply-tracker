'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getSuppliers() {
  const db = createServerClient()
  const { data, error } = await db.from('suppliers').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function createSupplier(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const db = createServerClient()
  const { error } = await db.from('suppliers').insert({
    name:    formData.get('name') as string,
    rfc:     (formData.get('rfc') as string) || null,
    contact: (formData.get('contact') as string) || null,
    phone:   (formData.get('phone') as string) || null,
    email:   (formData.get('email') as string) || null,
    notes:   (formData.get('notes') as string) || null,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/proveedores')
  return { success: true }
}

export async function toggleSupplierActive(id: string, active: boolean) {
  const db = createServerClient()
  await db.from('suppliers').update({ active }).eq('id', id)
  revalidatePath('/proveedores')
}
