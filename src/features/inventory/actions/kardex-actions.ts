'use server'

import { createServerClient } from '@/shared/lib/supabase/server'

export async function getKardex(branchId?: string, supplyId?: string) {
  const db = createServerClient()
  let query = db
    .from('stock_kardex')
    .select('*')
    .order('supply_name', { ascending: true })
    .order('fecha', { ascending: true })
    .limit(500)
  if (branchId) query = query.eq('branch_id', branchId)
  if (supplyId) query = query.eq('supply_id', supplyId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getCurrentStock(branchId?: string) {
  const db = createServerClient()
  let query = db
    .from('stock_current')
    .select('*, supplies(name, unit, category), branches(name)')
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).filter(r => (r.saldo_actual ?? 0) !== 0)
}
