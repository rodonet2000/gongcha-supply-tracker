-- Gon-Cha Supply Tracker: Schema independiente
-- Ejecutar como superuser en Supabase Studio SQL Editor

CREATE SCHEMA IF NOT EXISTS gongcha;

-- Otorgar permisos al rol service_role
GRANT USAGE ON SCHEMA gongcha TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA gongcha TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA gongcha TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA gongcha GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA gongcha GRANT ALL ON SEQUENCES TO service_role;

-- ============================================================
-- SESIONES DE EXTRACCIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS gongcha.scraping_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | running | completed | error
  orders_total INTEGER DEFAULT 0,
  orders_processed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_week UNIQUE(week_start)
);

-- ============================================================
-- PEDIDOS
-- ============================================================
CREATE TABLE IF NOT EXISTS gongcha.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL,
  -- ejemplo: 255106739144
  pos_order_id TEXT,
  -- ejemplo: aAxfAbUhgZUb-P-33
  session_external_id TEXT,
  -- ejemplo: aAxfAbUhgZUb
  order_timestamp TIMESTAMPTZ,
  brand TEXT DEFAULT 'Gong Cha',
  order_type TEXT,
  -- takeout | entrega | para_recoger | comer_aqui
  channel TEXT,
  -- POS | UberEats | Foodbot | Rappi | Kiosk
  payment_method TEXT,
  -- Efectivo | Terminal-Manual | Terminal-Auto | Pago en Línea | AMEX | Deli
  customer_name TEXT,
  entry_code TEXT,
  order_status TEXT,
  -- Recogido | Pendiente | Cancelado | etc.
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2),
  discount DECIMAL(10,2) DEFAULT 0,
  service_charge DECIMAL(10,2) DEFAULT 0,
  tip DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2),
  week_start DATE,
  scraping_session_id UUID REFERENCES gongcha.scraping_sessions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_external_id UNIQUE(external_id)
);

-- ============================================================
-- ARTÍCULOS DEL PEDIDO
-- ============================================================
CREATE TABLE IF NOT EXISTS gongcha.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES gongcha.orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  instructions TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2)
);

-- ============================================================
-- MODIFICADORES DE ARTÍCULO (ingredientes por pedido)
-- ============================================================
CREATE TABLE IF NOT EXISTS gongcha.order_item_modifiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_item_id UUID NOT NULL REFERENCES gongcha.order_items(id) ON DELETE CASCADE,
  modifier_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- CATÁLOGO DE INSUMOS
-- ============================================================
CREATE TABLE IF NOT EXISTS gongcha.supplies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  -- g | ml | kg | L | unidades | porciones
  category TEXT,
  -- leche | tapioca | te | jarabe | topping | base | vaso | otro
  cost_per_unit DECIMAL(10,4),
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_supply_name UNIQUE(name)
);

-- ============================================================
-- CATÁLOGO DE PRODUCTOS DEL MENÚ (se sincroniza automáticamente)
-- ============================================================
CREATE TABLE IF NOT EXISTS gongcha.menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  -- te_con_leche | smoothie | te_fruta | tapioca | otro
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_menu_item_name UNIQUE(name)
);

-- ============================================================
-- RECETAS BASE: insumos por producto + tamaño
-- ============================================================
CREATE TABLE IF NOT EXISTS gongcha.recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES gongcha.menu_items(id) ON DELETE CASCADE,
  supply_id UUID NOT NULL REFERENCES gongcha.supplies(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL,
  size TEXT,
  -- Mediano | Grande | null = aplica a todos los tamaños
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_recipe UNIQUE(menu_item_id, supply_id, size)
);

-- ============================================================
-- REQUERIMIENTOS DE INSUMOS POR MODIFICADOR
-- ============================================================
CREATE TABLE IF NOT EXISTS gongcha.modifier_supply_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  modifier_name TEXT NOT NULL,
  supply_id UUID NOT NULL REFERENCES gongcha.supplies(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL,
  is_override BOOLEAN DEFAULT FALSE,
  -- TRUE = reemplaza cantidad base; FALSE = suma a la cantidad base
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_modifier_supply UNIQUE(modifier_name, supply_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_week_start ON gongcha.orders(week_start);
CREATE INDEX IF NOT EXISTS idx_orders_external_id ON gongcha.orders(external_id);
CREATE INDEX IF NOT EXISTS idx_orders_session ON gongcha.orders(scraping_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON gongcha.orders(order_timestamp);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON gongcha.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_modifiers_item ON gongcha.order_item_modifiers(order_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON gongcha.recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_modifier_reqs_name ON gongcha.modifier_supply_requirements(modifier_name);

-- ============================================================
-- VISTA: Resumen de ventas por semana
-- ============================================================
CREATE OR REPLACE VIEW gongcha.weekly_summary AS
SELECT
  week_start,
  COUNT(DISTINCT id) AS total_orders,
  SUM(total) AS total_revenue,
  AVG(total) AS avg_order_value,
  COUNT(DISTINCT CASE WHEN channel = 'POS' THEN id END) AS pos_orders,
  COUNT(DISTINCT CASE WHEN channel = 'UberEats' THEN id END) AS ubereats_orders,
  COUNT(DISTINCT CASE WHEN channel = 'Rappi' THEN id END) AS rappi_orders,
  COUNT(DISTINCT CASE WHEN channel = 'Foodbot' THEN id END) AS foodbot_orders
FROM gongcha.orders
GROUP BY week_start
ORDER BY week_start DESC;

-- ============================================================
-- VISTA: Productos más vendidos por semana
-- ============================================================
CREATE OR REPLACE VIEW gongcha.top_items_by_week AS
SELECT
  o.week_start,
  oi.item_name,
  SUM(oi.quantity) AS total_quantity,
  SUM(oi.total) AS total_revenue
FROM gongcha.orders o
JOIN gongcha.order_items oi ON oi.order_id = o.id
GROUP BY o.week_start, oi.item_name
ORDER BY o.week_start DESC, total_quantity DESC;
