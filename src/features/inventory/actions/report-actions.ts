'use server'

import { createServerClient } from '@/shared/lib/supabase/server'

export async function getExistenciasReport(params: {
  branchId?: string
  dateFrom?: string
  dateTo?: string
}) {
  const db = createServerClient()
  const { dateFrom, dateTo, branchId } = params

  let stockQuery = db
    .from('stock_current')
    .select('*, supplies(name, unit, category, cost_per_unit), branches(name)')
  if (branchId) stockQuery = stockQuery.eq('branch_id', branchId)
  const { data: stock } = await stockQuery

  let entryQuery = db
    .from('stock_entries')
    .select('supply_id, branch_id, cantidad, fecha, supplies(name, unit, category)')
  if (branchId) entryQuery = entryQuery.eq('branch_id', branchId)
  if (dateFrom) entryQuery = entryQuery.gte('fecha', dateFrom)
  if (dateTo)   entryQuery = entryQuery.lte('fecha', dateTo)
  const { data: entries } = await entryQuery

  let exitQuery = db
    .from('stock_exits')
    .select('supply_id, branch_id, cantidad, fecha, source, supplies(name, unit, category)')
  if (branchId) exitQuery = exitQuery.eq('branch_id', branchId)
  if (dateFrom) exitQuery = exitQuery.gte('fecha', dateFrom)
  if (dateTo)   exitQuery = exitQuery.lte('fecha', dateTo)
  const { data: exits } = await exitQuery

  return {
    stock: stock ?? [],
    entries: entries ?? [],
    exits: exits ?? [],
  }
}
