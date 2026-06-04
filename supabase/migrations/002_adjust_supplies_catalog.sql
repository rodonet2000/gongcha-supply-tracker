-- Ajustar tabla supplies para el catálogo del archivo productos.xlsx
-- Agrega campos faltantes: codigo, referencia_interna, iva, ieps, piezas_por_caja

ALTER TABLE gongcha.supplies
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS referencia_interna TEXT,
  ADD COLUMN IF NOT EXISTS iva BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ieps BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS piezas_por_caja INTEGER DEFAULT 1;

-- Índice único por código de franquicia (puede ser NULL en registros sin código)
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplies_codigo
  ON gongcha.supplies(codigo)
  WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplies_referencia
  ON gongcha.supplies(referencia_interna);

CREATE INDEX IF NOT EXISTS idx_supplies_category
  ON gongcha.supplies(category);
