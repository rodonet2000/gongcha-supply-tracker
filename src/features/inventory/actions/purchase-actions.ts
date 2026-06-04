'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { getCurrentUser } from '@/features/auth/actions/auth-actions'
import { revalidatePath } from 'next/cache'

export async function getPurchases(branchId?: string) {
  const db = createServerClient()
  let query = db
    .from('purchases')
    .select('*, suppliers(name), branches(name), purchase_items(*, supplies(name, unit))')
    .order('fecha', { ascending: false })
    .limit(50)
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export type PurchaseItemInput = { supply_id: string; cantidad: number; unit_cost: number | null }

export async function createPurchase(
  meta: { supplier_id: string | null; fecha: string; folio: string; notes: string },
  items: PurchaseItemInput[]
): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentUser()
  if (!session) return { success: false, error: 'Sin sesión' }

  const branch_id = session.profile.branch_id
  if (!branch_id) return { success: false, error: 'Usuario sin sucursal asignada' }
  if (items.length === 0) return { success: false, error: 'Agrega al menos un insumo' }

  const total = items.reduce((s, i) => s + (i.cantidad * (i.unit_cost ?? 0)), 0)
  const db = createServerClient()

  const { data: purchase, error: purchaseErr } = await db
    .from('purchases')
    .insert({
      branch_id, supplier_id: meta.supplier_id || null,
      fecha: meta.fecha, folio: meta.folio || null,
      notes: meta.notes || null, total, user_id: session.userId,
    })
    .select().single()

  if (purchaseErr || !purchase) return { success: false, error: purchaseErr?.message }

  const purchaseItems = items.map(i => ({
    purchase_id: purchase.id, supply_id: i.supply_id,
    cantidad: i.cantidad, unit_cost: i.unit_cost,
    subtotal: i.cantidad * (i.unit_cost ?? 0),
  }))

  const stockEntries = items.map(i => ({
    branch_id, supply_id: i.supply_id, fecha: meta.fecha,
    cantidad: i.cantidad, unit_cost: i.unit_cost,
    source: 'purchase' as const, purchase_id: purchase.id,
    notes: `Compra ${meta.folio || purchase.id}`, user_id: session.userId,
  }))

  const [{ error: itemsErr }, { error: entryErr }] = await Promise.all([
    db.from('purchase_items').insert(purchaseItems),
    db.from('stock_entries').insert(stockEntries),
  ])

  if (itemsErr || entryErr) return { success: false, error: itemsErr?.message ?? entryErr?.message }

  revalidatePath('/compras')
  revalidatePath('/entradas')
  revalidatePath('/kardex')
  return { success: true }
}
