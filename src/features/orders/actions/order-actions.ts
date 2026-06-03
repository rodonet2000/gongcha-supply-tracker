'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import type { Order, OrderItem, OrderItemModifier } from '@/shared/types'

export async function getOrdersByWeek(weekStart: string): Promise<Order[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('week_start', weekStart)
    .order('order_timestamp', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getOrderDetail(orderId: string): Promise<{
  order: Order
  items: Array<OrderItem & { modifiers: OrderItemModifier[] }>
} | null> {
  const supabase = createServerClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !order) return null

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)

  if (itemsError) throw itemsError

  const itemsWithModifiers = await Promise.all(
    (items ?? []).map(async (item) => {
      const { data: modifiers } = await supabase
        .from('order_item_modifiers')
        .select('*')
        .eq('order_item_id', item.id)
      return { ...item, modifiers: modifiers ?? [] }
    })
  )

  return { order, items: itemsWithModifiers }
}

export async function getWeeklySummary() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('weekly_summary')
    .select('*')
    .limit(12)

  if (error) throw error
  return data ?? []
}

export async function getTopItemsByWeek(weekStart: string) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('top_items_by_week')
    .select('*')
    .eq('week_start', weekStart)
    .limit(20)

  if (error) throw error
  return data ?? []
}

export async function getOrdersStats(weekStart: string) {
  const supabase = createServerClient()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, channel, order_type')
    .eq('week_start', weekStart)

  if (!orders) return null

  const total = orders.reduce((sum, o) => sum + (o.total ?? 0), 0)
  const byChannel = orders.reduce<Record<string, number>>((acc, o) => {
    const ch = o.channel ?? 'Otro'
    acc[ch] = (acc[ch] ?? 0) + 1
    return acc
  }, {})

  return {
    totalOrders: orders.length,
    totalRevenue: total,
    avgOrderValue: orders.length ? total / orders.length : 0,
    byChannel,
  }
}
