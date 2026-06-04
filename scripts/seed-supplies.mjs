#!/usr/bin/env node
/**
 * Lee productos.xlsx y carga el catálogo completo en gongcha.supplies del VPS.
 * Uso: node scripts/seed-supplies.mjs
 *
 * Requiere: npm install xlsx --save-dev
 */

import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_META_URL = 'http://5.252.53.169:8001'
const SERVICE_ROLE_KEY =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3ODI2NjkyMCwiZXhwIjo0OTMzOTQwNTIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.afyYqe5VU94qajrs1j1vue2EtFPbaVbcHt79TCBpVME'

async function execSQL(query) {
  const response = await fetch(`${SUPABASE_META_URL}/pg/query`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`)
  return JSON.parse(text)
}

/** Escapa un valor para SQL: NULL o string con comillas simples. */
function esc(val) {
  if (val === null || val === undefined) return 'NULL'
  return `'${String(val).replace(/'/g, "''")}'`
}

async function main() {
  // ── 1. Ejecutar migración 002 para agregar columnas ────────────────────────
  const migrationPath = join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '002_adjust_supplies_catalog.sql'
  )
  const migrationSQL = readFileSync(migrationPath, 'utf-8')

  console.log('📐 Aplicando migración 002_adjust_supplies_catalog...')
  try {
    await execSQL(migrationSQL)
    console.log('✅ Migración aplicada\n')
  } catch (err) {
    // Los errores "already exists" son esperados en re-ejecuciones
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      console.log('ℹ️  Columnas/índices ya existen (OK)\n')
    } else {
      throw err
    }
  }

  // ── 2. Leer productos.xlsx ─────────────────────────────────────────────────
  const xlsxPath = join(__dirname, '..', 'productos.xlsx')
  const wb = XLSX.readFile(xlsxPath)
  const ws = wb.Sheets[wb.SheetNames[0]] // hoja "Catalogo"

  // range: 1 → salta la fila de título y usa la segunda fila como encabezados
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, range: 1 })

  // Deduplicar por nombre (hay un producto duplicado: MAM002022)
  const seenNames = new Set()
  const products = []
  for (const row of rows) {
    const name = row['Descripción']
    if (!name || seenNames.has(name)) continue
    seenNames.add(name)
    products.push(row)
  }

  console.log(`📦 ${products.length} productos únicos cargados del Excel`)

  // ── 3. Insertar en lotes de 50 ─────────────────────────────────────────────
  const BATCH = 50
  let inserted = 0

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH)

    const values = batch.map((row) => {
      const name         = esc(row['Descripción'])
      const unit         = esc(row['Detalles'])
      const category     = esc(row['Categoria'])
      const costPerUnit  = row['Importe'] !== null ? Number(row['Importe']) : 'NULL'
      const codigo       = esc(String(row['Codigo']))
      const refInterna   = esc(row['Referencia interna'])
      const iva          = row['Iva']  === 'Si' ? 'TRUE' : 'FALSE'
      const ieps         = row['IEPS'] === 'Si' ? 'TRUE' : 'FALSE'
      const piezasPorCaja = Number(row['Pc por box']) || 1

      return (
        `(${name}, ${unit}, ${category}, ${costPerUnit}, ` +
        `${codigo}, ${refInterna}, ${iva}, ${ieps}, ${piezasPorCaja})`
      )
    })

    const sql = `
INSERT INTO gongcha.supplies
  (name, unit, category, cost_per_unit, codigo, referencia_interna, iva, ieps, piezas_por_caja)
VALUES
  ${values.join(',\n  ')}
ON CONFLICT (name) DO UPDATE SET
  unit             = EXCLUDED.unit,
  category         = EXCLUDED.category,
  cost_per_unit    = EXCLUDED.cost_per_unit,
  codigo           = EXCLUDED.codigo,
  referencia_interna = EXCLUDED.referencia_interna,
  iva              = EXCLUDED.iva,
  ieps             = EXCLUDED.ieps,
  piezas_por_caja  = EXCLUDED.piezas_por_caja
`

    await execSQL(sql)
    inserted += batch.length
    process.stdout.write(`  ${inserted}/${products.length} insertados...\r`)
  }

  console.log(`\n✅ ${inserted} productos cargados en gongcha.supplies\n`)

  // ── 4. Verificar conteo final ──────────────────────────────────────────────
  const result = await execSQL(
    "SELECT COUNT(*) AS total, COUNT(DISTINCT category) AS categorias FROM gongcha.supplies WHERE active = TRUE"
  )
  const { total, categorias } = result[0]
  console.log(`📊 Total en BD: ${total} insumos, ${categorias} categorías`)

  // Resumen por categoría
  const byCategory = await execSQL(
    `SELECT category, COUNT(*) AS total
     FROM gongcha.supplies
     WHERE active = TRUE
     GROUP BY category
     ORDER BY total DESC`
  )
  console.log('\nDistribución por categoría:')
  byCategory.forEach((r) => console.log(`  ${r.category.padEnd(15)} ${r.total}`))
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
