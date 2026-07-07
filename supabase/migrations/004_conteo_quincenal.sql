-- supabase/migrations/004_conteo_quincenal.sql
-- Biweekly physical inventory count (Conteo Quincenal)
-- and yield factors for merma variance detection (Rendimiento por Unidad)

-- ── INVENTORY COUNT SESSIONS ──────────────────────────────────────────────────
-- One row per biweekly count event per branch.
-- Lifecycle: draft (being filled) → submitted (sent for review) → approved (kardex adjusted)
CREATE TABLE IF NOT EXISTS gongcha.inventory_count_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id     UUID NOT NULL REFERENCES gongcha.branches(id),
  period_label  TEXT NOT NULL,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',
  notes         TEXT,
  created_by    UUID NOT NULL,
  submitted_by  UUID,
  submitted_at  TIMESTAMPTZ,
  approved_by   UUID,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_count_status CHECK (status IN ('draft', 'submitted', 'approved'))
);

CREATE INDEX IF NOT EXISTS idx_count_sessions_branch ON gongcha.inventory_count_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_count_sessions_status ON gongcha.inventory_count_sessions(status);
CREATE INDEX IF NOT EXISTS idx_count_sessions_period ON gongcha.inventory_count_sessions(period_end DESC);

-- ── INVENTORY COUNT ITEMS ─────────────────────────────────────────────────────
-- One row per supply per session. physical_qty = NULL means not yet counted.
-- This table is pre-populated with all active supplies when a session is created.
CREATE TABLE IF NOT EXISTS gongcha.inventory_count_items (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   UUID NOT NULL REFERENCES gongcha.inventory_count_sessions(id) ON DELETE CASCADE,
  supply_id    UUID NOT NULL REFERENCES gongcha.supplies(id),
  physical_qty DECIMAL(12,3),
  lot_no       TEXT,
  expiry_date  DATE,
  notes        TEXT,
  CONSTRAINT unique_session_supply UNIQUE(session_id, supply_id)
);

CREATE INDEX IF NOT EXISTS idx_count_items_session ON gongcha.inventory_count_items(session_id);
CREATE INDEX IF NOT EXISTS idx_count_items_supply  ON gongcha.inventory_count_items(supply_id);

-- ── YIELD FACTORS (Rendimiento por Unidad) ───────────────────────────────────
-- Expected output per unit consumed. Used to detect merma (unexpected loss).
-- factor = expected usable output / input unit (e.g. 0.92 = 92% yield)
CREATE TABLE IF NOT EXISTS gongcha.yield_factors (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supply_id        UUID NOT NULL REFERENCES gongcha.supplies(id) ON DELETE CASCADE,
  factor           DECIMAL(8,4) NOT NULL CHECK (factor > 0 AND factor <= 1),
  unit_description TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_supply_yield UNIQUE(supply_id)
);

-- ── GRANTS ────────────────────────────────────────────────────────────────────
GRANT ALL ON gongcha.inventory_count_sessions TO service_role;
GRANT ALL ON gongcha.inventory_count_items    TO service_role;
GRANT ALL ON gongcha.yield_factors            TO service_role;

GRANT SELECT ON gongcha.inventory_count_sessions TO authenticator, anon, authenticated;
GRANT SELECT ON gongcha.inventory_count_items    TO authenticator, anon, authenticated;
GRANT SELECT ON gongcha.yield_factors            TO authenticator, anon, authenticated;
