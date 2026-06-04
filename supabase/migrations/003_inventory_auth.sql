-- supabase/migrations/003_inventory_auth.sql
-- Auth: branches + user profiles
-- Inventory: suppliers, purchases, stock entries/exits, kardex view

-- ── BRANCHES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.branches (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name      TEXT NOT NULL,
  code      TEXT NOT NULL,
  active    BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_branch_code UNIQUE(code)
);

-- Insert default branch
INSERT INTO gongcha.branches (name, code) VALUES ('Puerto Escondido', 'PTO-ESC')
ON CONFLICT (code) DO NOTHING;

-- ── USER PROFILES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.user_profiles (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'sucursal',
  branch_id  UUID REFERENCES gongcha.branches(id),
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user UNIQUE(user_id),
  CONSTRAINT valid_role CHECK (role IN ('sucursal', 'administrador', 'direccion'))
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON gongcha.user_profiles(user_id);

-- ── SUPPLIERS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.suppliers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  rfc        TEXT,
  contact    TEXT,
  phone      TEXT,
  email      TEXT,
  notes      TEXT,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_supplier_name UNIQUE(name)
);

-- ── PURCHASES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.purchases (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id    UUID NOT NULL REFERENCES gongcha.branches(id),
  supplier_id  UUID REFERENCES gongcha.suppliers(id),
  fecha        DATE NOT NULL,
  folio        TEXT,
  notes        TEXT,
  total        DECIMAL(12,2),
  user_id      UUID NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gongcha.purchase_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES gongcha.purchases(id) ON DELETE CASCADE,
  supply_id   UUID NOT NULL REFERENCES gongcha.supplies(id),
  cantidad    DECIMAL(12,3) NOT NULL,
  unit_cost   DECIMAL(10,4),
  subtotal    DECIMAL(12,2)
);

-- ── STOCK ENTRIES (entradas) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.stock_entries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id   UUID NOT NULL REFERENCES gongcha.branches(id),
  supply_id   UUID NOT NULL REFERENCES gongcha.supplies(id),
  fecha       DATE NOT NULL,
  cantidad    DECIMAL(12,3) NOT NULL,
  unit_cost   DECIMAL(10,4),
  source      TEXT NOT NULL DEFAULT 'manual',
  purchase_id UUID REFERENCES gongcha.purchases(id),
  notes       TEXT,
  user_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_entry_source CHECK (source IN ('manual', 'purchase', 'adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_stock_entries_branch_supply ON gongcha.stock_entries(branch_id, supply_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_fecha ON gongcha.stock_entries(fecha);

-- ── STOCK EXITS (salidas) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.stock_exits (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id            UUID NOT NULL REFERENCES gongcha.branches(id),
  supply_id            UUID NOT NULL REFERENCES gongcha.supplies(id),
  fecha                DATE NOT NULL,
  cantidad             DECIMAL(12,3) NOT NULL,
  source               TEXT NOT NULL DEFAULT 'manual',
  scraping_session_id  UUID REFERENCES gongcha.scraping_sessions(id),
  notes                TEXT,
  user_id              UUID NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_exit_source CHECK (source IN ('manual', 'auto', 'waste', 'adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_stock_exits_branch_supply ON gongcha.stock_exits(branch_id, supply_id);
CREATE INDEX IF NOT EXISTS idx_stock_exits_fecha ON gongcha.stock_exits(fecha);

-- ── KARDEX VIEW ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW gongcha.stock_kardex AS
WITH movements AS (
  SELECT
    supply_id, branch_id, fecha, 'entrada' AS tipo,
    cantidad, purchase_id::TEXT AS referencia, user_id, created_at, notes
  FROM gongcha.stock_entries
  UNION ALL
  SELECT
    supply_id, branch_id, fecha, source AS tipo,
    cantidad, scraping_session_id::TEXT AS referencia, user_id, created_at, notes
  FROM gongcha.stock_exits
)
SELECT
  m.supply_id,
  s.name        AS supply_name,
  s.unit,
  s.category,
  m.branch_id,
  b.name        AS branch_name,
  m.fecha,
  m.tipo,
  CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END      AS entrada,
  CASE WHEN m.tipo != 'entrada' THEN m.cantidad ELSE 0 END     AS salida,
  SUM(
    CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE -m.cantidad END
  ) OVER (
    PARTITION BY m.supply_id, m.branch_id
    ORDER BY m.fecha, m.created_at
    ROWS UNBOUNDED PRECEDING
  )                                                             AS saldo,
  m.notes       AS referencia,
  m.created_at
FROM movements m
JOIN gongcha.supplies s ON s.id = m.supply_id
JOIN gongcha.branches b ON b.id = m.branch_id;

-- ── STOCK CURRENT (resumen de saldos) ────────────────────────────────────────
CREATE OR REPLACE VIEW gongcha.stock_current AS
SELECT
  supply_id,
  branch_id,
  COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE -cantidad END), 0) AS saldo_actual
FROM (
  SELECT supply_id, branch_id, cantidad, 'entrada' AS tipo FROM gongcha.stock_entries
  UNION ALL
  SELECT supply_id, branch_id, cantidad, 'salida' AS tipo FROM gongcha.stock_exits
) m
GROUP BY supply_id, branch_id;

-- ── GRANTS ────────────────────────────────────────────────────────────────────
GRANT ALL ON gongcha.branches          TO service_role;
GRANT ALL ON gongcha.user_profiles     TO service_role;
GRANT ALL ON gongcha.suppliers         TO service_role;
GRANT ALL ON gongcha.purchases         TO service_role;
GRANT ALL ON gongcha.purchase_items    TO service_role;
GRANT ALL ON gongcha.stock_entries     TO service_role;
GRANT ALL ON gongcha.stock_exits       TO service_role;
GRANT ALL ON gongcha.stock_kardex      TO service_role;
GRANT ALL ON gongcha.stock_current     TO service_role;

GRANT SELECT ON gongcha.branches       TO authenticator, anon, authenticated;
GRANT SELECT ON gongcha.stock_kardex   TO authenticator, anon, authenticated;
GRANT SELECT ON gongcha.stock_current  TO authenticator, anon, authenticated;
