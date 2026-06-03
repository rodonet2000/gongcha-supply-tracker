// ============================================================
// Tipos del dominio Gon-Cha Supply Tracker
// ============================================================

export interface ScrapingSession {
  id: string
  week_start: string
  week_end: string
  status: 'pending' | 'running' | 'completed' | 'error'
  orders_total: number
  orders_processed: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Order {
  id: string
  external_id: string
  pos_order_id: string | null
  session_external_id: string | null
  order_timestamp: string | null
  brand: string
  order_type: string | null
  channel: string | null
  payment_method: string | null
  customer_name: string | null
  entry_code: string | null
  order_status: string | null
  subtotal: number | null
  tax: number | null
  discount: number | null
  service_charge: number | null
  tip: number | null
  delivery_fee: number | null
  total: number | null
  week_start: string | null
  scraping_session_id: string | null
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  item_name: string
  instructions: string | null
  quantity: number
  unit_price: number | null
  tax: number | null
  total: number | null
  modifiers?: OrderItemModifier[]
}

export interface OrderItemModifier {
  id: string
  order_item_id: string
  modifier_name: string
  quantity: number
}

export interface Supply {
  id: string
  name: string
  unit: string
  category: string | null
  cost_per_unit: number | null
  notes: string | null
  active: boolean
  created_at: string
}

export interface MenuItem {
  id: string
  name: string
  category: string | null
  active: boolean
  created_at: string
}

export interface Recipe {
  id: string
  menu_item_id: string
  supply_id: string
  quantity: number
  size: string | null
  notes: string | null
  created_at: string
  menu_item?: MenuItem
  supply?: Supply
}

export interface ModifierSupplyRequirement {
  id: string
  modifier_name: string
  supply_id: string
  quantity: number
  is_override: boolean
  notes: string | null
  supply?: Supply
}

export interface WeeklySummary {
  week_start: string
  total_orders: number
  total_revenue: number
  avg_order_value: number
  pos_orders: number
  ubereats_orders: number
  rappi_orders: number
  foodbot_orders: number
}

// Resultado del cálculo de insumos para un reporte semanal
export interface SupplyRequirement {
  supply_id: string
  supply_name: string
  unit: string
  category: string | null
  total_quantity: number
  estimated_cost: number | null
  breakdown: Array<{
    source: string  // nombre del producto o modificador
    quantity: number
    source_count: number
  }>
}

// Evento de progreso del scraper
export type ScrapeProgressEvent =
  | { type: 'started'; sessionId: string; message: string }
  | { type: 'progress'; current: number; total: number; message: string }
  | { type: 'order_saved'; orderId: string; external_id: string }
  | { type: 'completed'; ordersCount: number; sessionId: string }
  | { type: 'error'; message: string }
  | { type: 'duplicate'; external_id: string }
