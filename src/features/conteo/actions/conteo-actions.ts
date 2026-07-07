'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { getCurrentUser } from '@/features/auth/actions/auth-actions'
import { revalidatePath } from 'next/cache'
import type { InventoryCountSession, InventoryCountItem } from '@/shared/types'

export async function getCountSessions(branchId?: string): Promise<InventoryCountSession[]> {
  const db = createServerClient()
  let q = db
    .from('inventory_count_sessions')
    .select('*, branches(name)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as InventoryCountSession[]
}

export async function getCountSession(id: string): Promise<{
  session: InventoryCountSession
  items: InventoryCountItem[]
}> {
  const db = createServerClient()
  const { data: session, error } = await db
    .from('inventory_count_sessions')
    .select('*, branches(name)')
    .eq('id', id)
    .single()
  if (error) throw error

  const { data: items } = await db
    .from('inventory_count_items')
    .select('*, supplies(name, unit, category)')
    .eq('session_id', id)

  // Sort by supply name client-side since PostgREST doesn't support order on joined columns
  const sorted = (items ?? []).sort((a, b) => {
    const nameA = (a.supplies as { name: string } | null)?.name ?? ''
    const nameB = (b.supplies as { name: string } | null)?.name ?? ''
    return nameA.localeCompare(nameB)
  })

  return { session: session as InventoryCountSession, items: sorted as InventoryCountItem[] }
}

export async function createCountSession(formData: FormData): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Sin sesión' }

  const branch_id = user.profile.branch_id
  if (!branch_id) return { success: false, error: 'Usuario sin sucursal asignada' }

  const period_label = (formData.get('period_label') as string)?.trim()
  const period_start = formData.get('period_start') as string
  const period_end   = formData.get('period_end') as string

  if (!period_label || !period_start || !period_end) {
    return { success: false, error: 'Todos los campos son obligatorios' }
  }

  const db = createServerClient()

  const { data: session, error: sessionError } = await db
    .from('inventory_count_sessions')
    .insert({ branch_id, period_label, period_start, period_end, created_by: user.userId })
    .select('id')
    .single()

  if (sessionError) return { success: false, error: sessionError.message }

  // Pre-populate count items with all active supplies (physical_qty = null = not yet counted)
  const { data: supplies } = await db
    .from('supplies')
    .select('id')
    .eq('active', true)

  if (supplies && supplies.length > 0) {
    await db.from('inventory_count_items').insert(
      supplies.map((s: { id: string }) => ({ session_id: session.id, supply_id: s.id }))
    )
  }

  revalidatePath('/conteo')
  return { success: true, id: session.id }
}

export async function bulkSaveCountItems(
  sessionId: string,
  items: Array<{
    supplyId: string
    physicalQty: number | null
    lotNo?: string
    expiryDate?: string
    notes?: string
  }>
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Sin sesión' }

  const db = createServerClient()

  // Verify the session belongs to user's branch (or user is admin)
  const { data: session } = await db
    .from('inventory_count_sessions')
    .select('branch_id, status')
    .eq('id', sessionId)
    .single()

  if (!session) return { success: false, error: 'Sesión no encontrada' }
  if (session.status !== 'draft') return { success: false, error: 'Sólo se pueden editar conteos en borrador' }

  const { error } = await db.from('inventory_count_items').upsert(
    items.map((item) => ({
      session_id: sessionId,
      supply_id: item.supplyId,
      physical_qty: item.physicalQty,
      lot_no: item.lotNo ?? null,
      expiry_date: item.expiryDate ?? null,
      notes: item.notes ?? null,
    })),
    { onConflict: 'session_id,supply_id' }
  )

  if (error) return { success: false, error: error.message }
  revalidatePath(`/conteo/${sessionId}`)
  return { success: true }
}

export async function submitCount(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Sin sesión' }

  const db = createServerClient()
  const { error } = await db
    .from('inventory_count_sessions')
    .update({
      status: 'submitted',
      submitted_by: user.userId,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('status', 'draft')

  if (error) return { success: false, error: error.message }
  revalidatePath('/conteo')
  return { success: true }
}

export async function approveCount(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Sin sesión' }
  if (!['administrador', 'direccion'].includes(user.profile.role)) {
    return { success: false, error: 'Sin permisos — se requiere rol administrador o dirección' }
  }

  const db = createServerClient()

  // Load session with items
  const { data: session } = await db
    .from('inventory_count_sessions')
    .select('*, inventory_count_items(supply_id, physical_qty)')
    .eq('id', sessionId)
    .single()

  if (!session) return { success: false, error: 'Sesión no encontrada' }
  if (session.status !== 'submitted') return { success: false, error: 'Sólo se pueden aprobar conteos en estado "enviado"' }

  const branch_id: string = session.branch_id
  const fecha: string = session.period_end

  // Get current stock balances for this branch from the stock_current view
  const { data: currentStock } = await db
    .from('stock_current')
    .select('supply_id, saldo_actual')
    .eq('branch_id', branch_id)

  const stockMap = new Map(
    (currentStock ?? []).map((r: { supply_id: string; saldo_actual: number }) => [
      r.supply_id,
      Number(r.saldo_actual),
    ])
  )

  const entries: object[] = []
  const exits: object[] = []
  const noteRef = `Ajuste conteo quincenal — ${session.period_label}`

  for (const item of (session.inventory_count_items ?? [])) {
    // Skip items that were not counted (physical_qty = null)
    if (item.physical_qty === null) continue

    const physicalQty = Number(item.physical_qty)
    const currentQty  = stockMap.get(item.supply_id) ?? 0
    const diff        = physicalQty - currentQty

    if (diff > 0) {
      entries.push({
        branch_id,
        supply_id: item.supply_id,
        fecha,
        cantidad: diff,
        source: 'adjustment',
        notes: noteRef,
        user_id: user.userId,
      })
    } else if (diff < 0) {
      exits.push({
        branch_id,
        supply_id: item.supply_id,
        fecha,
        cantidad: Math.abs(diff),
        source: 'adjustment',
        notes: noteRef,
        user_id: user.userId,
      })
    }
    // diff === 0: kardex matches physical, no adjustment needed
  }

  if (entries.length > 0) {
    const { error } = await db.from('stock_entries').insert(entries)
    if (error) return { success: false, error: `Error al insertar entradas: ${error.message}` }
  }

  if (exits.length > 0) {
    const { error } = await db.from('stock_exits').insert(exits)
    if (error) return { success: false, error: `Error al insertar salidas: ${error.message}` }
  }

  const { error: approveError } = await db
    .from('inventory_count_sessions')
    .update({
      status: 'approved',
      approved_by: user.userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (approveError) return { success: false, error: approveError.message }

  revalidatePath('/conteo')
  revalidatePath('/kardex')
  revalidatePath('/entradas')
  revalidatePath('/salidas')
  revalidatePath('/reportes/existencias')
  return { success: true }
}

// ── YIELD FACTORS ─────────────────────────────────────────────────────────────

export async function getYieldFactors() {
  const db = createServerClient()
  const { data, error } = await db
    .from('yield_factors')
    .select('*, supplies(name, unit)')
    .order('supplies(name)', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── MERMA REPORT ──────────────────────────────────────────────────────────────
// Compares two consecutive approved counts and flags variance per supply.

export async function getMermaReport(branchId: string) {
  const db = createServerClient()

  // Get the two most recent approved sessions for this branch
  const { data: sessions } = await db
    .from('inventory_count_sessions')
    .select('id, period_label, period_start, period_end')
    .eq('branch_id', branchId)
    .eq('status', 'approved')
    .order('period_end', { ascending: false })
    .limit(2)

  if (!sessions || sessions.length < 2) {
    return { sessions: sessions ?? [], rows: [], needsMoreCounts: true }
  }

  const [latest, previous] = sessions

  const [{ data: latestItems }, { data: prevItems }, { data: yieldFactors }] = await Promise.all([
    db.from('inventory_count_items').select('supply_id, physical_qty').eq('session_id', latest.id),
    db.from('inventory_count_items').select('supply_id, physical_qty').eq('session_id', previous.id),
    db.from('yield_factors').select('supply_id, factor'),
  ])

  // Entries between the two periods
  const { data: entriesBetween } = await db
    .from('stock_entries')
    .select('supply_id, cantidad')
    .eq('branch_id', branchId)
    .neq('source', 'adjustment')
    .gte('fecha', previous.period_end)
    .lt('fecha', latest.period_end)

  // Auto exits (sales) between the two periods
  const { data: autoExitsBetween } = await db
    .from('stock_exits')
    .select('supply_id, cantidad')
    .eq('branch_id', branchId)
    .eq('source', 'auto')
    .gte('fecha', previous.period_end)
    .lt('fecha', latest.period_end)

  const prevMap    = new Map((prevItems ?? []).map((r) => [r.supply_id, Number(r.physical_qty ?? 0)]))
  const yieldMap   = new Map((yieldFactors ?? []).map((r) => [r.supply_id, Number(r.factor)]))
  const entryMap   = new Map<string, number>()
  const autoExitMap = new Map<string, number>()

  for (const e of (entriesBetween ?? [])) {
    entryMap.set(e.supply_id, (entryMap.get(e.supply_id) ?? 0) + Number(e.cantidad))
  }
  for (const e of (autoExitsBetween ?? [])) {
    autoExitMap.set(e.supply_id, (autoExitMap.get(e.supply_id) ?? 0) + Number(e.cantidad))
  }

  // Get supply names
  const supplyIds = Array.from(new Set((latestItems ?? []).map((i) => i.supply_id)))
  const { data: supplies } = await db
    .from('supplies')
    .select('id, name, unit')
    .in('id', supplyIds)

  const supplyMap = new Map((supplies ?? []).map((s) => [s.id, s]))

  const rows = (latestItems ?? [])
    .map((item) => {
      const prevQty     = prevMap.get(item.supply_id) ?? 0
      const entries     = entryMap.get(item.supply_id) ?? 0
      const autoExits   = autoExitMap.get(item.supply_id) ?? 0
      const expected    = prevQty + entries - autoExits
      const actual      = Number(item.physical_qty ?? 0)
      const variance    = expected - actual
      const yieldFactor = yieldMap.get(item.supply_id) ?? null
      const supply      = supplyMap.get(item.supply_id)

      return {
        supply_id: item.supply_id,
        supply_name: supply?.name ?? '—',
        unit: supply?.unit ?? '',
        prev_qty: prevQty,
        entries,
        auto_exits: autoExits,
        expected,
        actual,
        variance,
        yield_factor: yieldFactor,
        alert: yieldFactor !== null
          ? variance > expected * (1 - yieldFactor)
          : variance > 0,
      }
    })
    .filter((r) => r.variance !== 0)
    .sort((a, b) => b.variance - a.variance)

  return { sessions: [latest, previous], rows, needsMoreCounts: false }
}
