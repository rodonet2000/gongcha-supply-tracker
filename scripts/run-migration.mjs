#!/usr/bin/env node
/**
 * Script para ejecutar la migración del schema gongcha en Supabase
 * Uso: node scripts/run-migration.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Leer variables de entorno del .env.local
const envPath = join(__dirname, '..', '.env.local')
let envVars = {}
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...valueParts] = trimmed.split('=')
    if (key && valueParts.length) {
      envVars[key.trim()] = valueParts.join('=').trim()
    }
  }
} catch (e) {
  console.error('No se pudo leer .env.local:', e.message)
  process.exit(1)
}

const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan variables NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const migrationSQL = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '001_gongcha_schema.sql'),
  'utf-8'
)

// Usar la API de Supabase para ejecutar SQL arbitrario via pg_service
// La API de Supabase no tiene endpoint de SQL directo, necesitamos usar la DB directamente
// Usamos el endpoint de PostgREST con el header apropiado

console.log('🚀 Ejecutando migración gongcha en:', SUPABASE_URL)
console.log('📋 SQL migration length:', migrationSQL.length, 'chars')

// Hacer POST al endpoint de Supabase Studio SQL
const studioUrl = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`

// Intentar con el endpoint de Supabase Management API
const response = await fetch(`${SUPABASE_URL}/pg/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'apikey': SERVICE_ROLE_KEY,
  },
  body: JSON.stringify({ query: migrationSQL }),
})

if (response.ok) {
  const data = await response.json()
  console.log('✅ Migración ejecutada exitosamente:', data)
} else {
  console.log('ℹ️  El endpoint /pg/query no está disponible. Intentando método alternativo...')

  // Intentar dividir y ejecutar statements individuales via fetch a PostgREST
  // Para crear el schema y tablas, necesitamos acceso directo a PostgreSQL
  // La forma correcta es ejecutar via Supabase Studio o psql

  console.log('\n📌 INSTRUCCIONES MANUALES:')
  console.log('1. Abre Supabase Studio en:', SUPABASE_URL)
  console.log('2. Ve a SQL Editor')
  console.log('3. Pega y ejecuta el contenido de: supabase/migrations/001_gongcha_schema.sql')
  console.log('\nAlternativamente, ejecuta en el VPS:')
  console.log(`docker exec supabase-db-h8occ6uko144qwdes4o43t7r psql -U postgres -c "\\i /migration.sql"`)
}
