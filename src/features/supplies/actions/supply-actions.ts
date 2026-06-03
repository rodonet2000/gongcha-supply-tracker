'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Supply } from '@/shared/types'

const supplySchema = z.object({
  name: z.string().min(1).max(100),
  unit: z.string().min(1).max(20),
  category: z.string().optional(),
  cost_per_unit: z.number().positive().optional(),
  notes: z.string().optional(),
})

export async function getSupplies(): Promise<Supply[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('supplies')
    .select('*')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createSupply(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const raw = {
    name: formData.get('name') as string,
    unit: formData.get('unit') as string,
    category: formData.get('category') as string | undefined,
    cost_per_unit: formData.get('cost_per_unit') ? parseFloat(formData.get('cost_per_unit') as string) : undefined,
    notes: formData.get('notes') as string | undefined,
  }

  const parsed = supplySchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const supabase = createServerClient()
  const { error } = await supabase.from('supplies').insert(parsed.data)

  if (error) return { success: false, error: error.message }

  revalidatePath('/insumos')
  return { success: true }
}

export async function updateSupply(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  const raw = {
    name: formData.get('name') as string,
    unit: formData.get('unit') as string,
    category: formData.get('category') as string | undefined,
    cost_per_unit: formData.get('cost_per_unit') ? parseFloat(formData.get('cost_per_unit') as string) : undefined,
    notes: formData.get('notes') as string | undefined,
  }

  const parsed = supplySchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const supabase = createServerClient()
  const { error } = await supabase.from('supplies').update(parsed.data).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/insumos')
  return { success: true }
}

export async function deleteSupply(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient()
  const { error } = await supabase.from('supplies').update({ active: false }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/insumos')
  return { success: true }
}
