#!/usr/bin/env node
/**
 * Ejecuta la migración directamente via postgres-meta API
 * Uso: node scripts/migrate.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_META_URL = 'http://5.252.53.169:8001'
const SERVICE_ROLE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3ODI2NjkyMCwiZXhwIjo0OTMzOTQwNTIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.afyYqe5VU94qajrs1j1vue2EtFPbaVbcHt79TCBpVME'

const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '001_gongcha_schema.sql')
const migrationSQL = readFileSync(migrationPath, 'utf-8')

async function execSQL(query) {
  const response = await fetch(`${SUPABASE_META_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  return JSON.parse(text)
}

async function main() {
  console.log('🚀 Iniciando migración del schema gongcha...\n')

  // Verificar si ya existe
  const schemaCheck = await execSQL(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'gongcha'"
  )

  if (schemaCheck.length > 0) {
    console.log('⚠️  Schema gongcha ya existe. Ejecutando de todas formas (CREATE IF NOT EXISTS)...\n')
  }

  // Ejecutar la migración completa
  try {
    await execSQL(migrationSQL)
    console.log('✅ Migración ejecutada exitosamente!\n')
  } catch (err) {
    // Si falla como bloque, intentar statement por statement
    console.log('ℹ️  Ejecutando statement por statement...')

    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    let success = 0
    let errors = 0

    for (const stmt of statements) {
      try {
        await execSQL(stmt)
        success++
        process.stdout.write('.')
      } catch (stmtErr) {
        errors++
        const msg = stmtErr.message
        // Ignorar errores "already exists"
        if (!msg.includes('already exists') && !msg.includes('duplicate')) {
          console.error(`\n⚠️  ${msg.substring(0, 100)}`)
        } else {
          process.stdout.write('s') // s = skipped
        }
      }
    }
    console.log(`\n\n✅ ${success} statements OK, ${errors} errores`)
  }

  // Verificar tablas creadas
  const tables = await execSQL(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'gongcha' ORDER BY table_name"
  )

  console.log(`\n📋 Tablas en schema gongcha (${tables.length}):`)
  tables.forEach(t => console.log(`  - ${t.table_name}`))
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
