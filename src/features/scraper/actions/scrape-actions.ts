'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { toISODateString, getWeekRange } from '@/shared/lib/utils'
import { addDays } from 'date-fns'
import { revalidatePath } from 'next/cache'

export async function createScrapingSession(weekStart: string): Promise<{
  success: boolean
  sessionId?: string
  error?: string
  alreadyExists?: boolean
}> {
  const supabase = createServerClient()

  // Verificar si ya existe una sesión completada para esta semana
  const { data: existing } = await supabase
    .from('scraping_sessions')
    .select('id, status')
    .eq('week_start', weekStart)
    .single()

  if (existing?.status === 'completed') {
    return { success: false, alreadyExists: true, error: 'Esta semana ya fue extraída correctamente.' }
  }

  // Si existe pero está en error o pendiente, reutilizar
  if (existing) {
    await supabase
      .from('scraping_sessions')
      .update({ status: 'pending', error_message: null, orders_processed: 0, orders_total: 0 })
      .eq('id', existing.id)
    return { success: true, sessionId: existing.id }
  }

  const weekStartDate = new Date(weekStart + 'T00:00:00')
  const weekEnd = toISODateString(addDays(weekStartDate, 6))

  const { data, error } = await supabase
    .from('scraping_sessions')
    .insert({ week_start: weekStart, week_end: weekEnd, status: 'pending' })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/extractor')
  return { success: true, sessionId: data.id }
}

export async function getScrapingSessions() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('scraping_sessions')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(20)

  if (error) throw error
  return data ?? []
}

export async function deleteScrapingSession(sessionId: string): Promise<void> {
  const supabase = createServerClient()

  // Eliminar pedidos asociados (cascade elimina items y modificadores)
  await supabase.from('orders').delete().eq('scraping_session_id', sessionId)
  await supabase.from('scraping_sessions').delete().eq('id', sessionId)

  revalidatePath('/extractor')
  revalidatePath('/pedidos')
}

export async function calculateAndInsertAutoExits(
  sessionId: string,
  weekStart: string,
  branchId: string,
  userId: string
): Promise<void> {
  const supabase = createServerClient()

  // Get all order items for this week
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('week_start', weekStart)

  if (!orders?.length) return
  const orderIds = orders.map(o => o.id)

  const { data: items } = await supabase
    .from('order_items')
    .select('item_name, quantity, order_id')
    .in('order_id', orderIds)

  if (!items?.length) return

  // Aggregate by item_name
  const itemCounts: Record<string, number> = {}
  for (const item of items) {
    itemCounts[item.item_name] = (itemCounts[item.item_name] ?? 0) + item.quantity
  }

  // Aggregate modifiers
  const { data: mods } = await supabase
    .from('order_item_modifiers')
    .select('modifier_name, quantity, order_item_id')
    .in('order_item_id',
      (await supabase.from('order_items').select('id').in('order_id', orderIds)).data?.map(i => i.id) ?? []
    )

  const modCounts: Record<string, number> = {}
  for (const mod of mods ?? []) {
    modCounts[mod.modifier_name] = (modCounts[mod.modifier_name] ?? 0) + mod.quantity
  }

  // Get recipes
  const { data: recipes } = await supabase
    .from('recipes')
    .select('quantity, supply_id, menu_items(name)')

  // Get modifier requirements
  const { data: modReqs } = await supabase
    .from('modifier_supply_requirements')
    .select('modifier_name, supply_id, quantity')

  // Calculate consumption
  const supplyConsumption: Record<string, number> = {}

  for (const recipe of recipes ?? []) {
    const menuName = (recipe.menu_items as { name: string } | null)?.name ?? ''
    const orderedQty = itemCounts[menuName] ?? 0
    if (orderedQty === 0) continue
    supplyConsumption[recipe.supply_id] = (supplyConsumption[recipe.supply_id] ?? 0) + recipe.quantity * orderedQty
  }

  for (const req of modReqs ?? []) {
    const modQty = modCounts[req.modifier_name] ?? 0
    if (modQty === 0) continue
    supplyConsumption[req.supply_id] = (supplyConsumption[req.supply_id] ?? 0) + req.quantity * modQty
  }

  const exits = Object.entries(supplyConsumption)
    .filter(([, qty]) => qty > 0)
    .map(([supply_id, cantidad]) => ({
      branch_id: branchId,
      supply_id,
      fecha: weekStart,
      cantidad: Math.round(cantidad * 1000) / 1000,
      source: 'auto' as const,
      scraping_session_id: sessionId,
      notes: `Auto — semana ${weekStart}`,
      user_id: userId,
    }))

  if (exits.length > 0) {
    await supabase.from('stock_exits').insert(exits)
  }
}
