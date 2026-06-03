'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Recipe, ModifierSupplyRequirement, MenuItem } from '@/shared/types'

export async function getMenuItems(): Promise<MenuItem[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getRecipesByMenuItem(menuItemId: string): Promise<Recipe[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('*, supply:supplies(*)')
    .eq('menu_item_id', menuItemId)
    .order('size', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function upsertRecipe(recipe: {
  menuItemId: string
  supplyId: string
  quantity: number
  size?: string | null
  notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient()
  const { error } = await supabase.from('recipes').upsert({
    menu_item_id: recipe.menuItemId,
    supply_id: recipe.supplyId,
    quantity: recipe.quantity,
    size: recipe.size ?? null,
    notes: recipe.notes ?? null,
  }, { onConflict: 'menu_item_id,supply_id,size' })

  if (error) return { success: false, error: error.message }

  revalidatePath('/recetas')
  return { success: true }
}

export async function deleteRecipe(recipeId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient()
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/recetas')
  return { success: true }
}

export async function getModifierRequirements(): Promise<ModifierSupplyRequirement[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('modifier_supply_requirements')
    .select('*, supply:supplies(*)')
    .order('modifier_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getKnownModifiers(): Promise<string[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .rpc('get_known_modifiers')
    .limit(200)

  // Fallback si el RPC no existe: query directa
  if (!data) {
    const supabase2 = createServerClient()
    const { data: raw } = await supabase2
      .from('order_item_modifiers')
      .select('modifier_name')
      .order('modifier_name')

    return Array.from(new Set((raw ?? []).map((r) => r.modifier_name)))
  }

  return data ?? []
}

export async function upsertModifierRequirement(req: {
  modifierName: string
  supplyId: string
  quantity: number
  isOverride?: boolean
  notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient()
  const { error } = await supabase.from('modifier_supply_requirements').upsert({
    modifier_name: req.modifierName,
    supply_id: req.supplyId,
    quantity: req.quantity,
    is_override: req.isOverride ?? false,
    notes: req.notes ?? null,
  }, { onConflict: 'modifier_name,supply_id' })

  if (error) return { success: false, error: error.message }

  revalidatePath('/recetas')
  return { success: true }
}

export async function deleteModifierRequirement(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient()
  const { error } = await supabase.from('modifier_supply_requirements').delete().eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/recetas')
  return { success: true }
}
