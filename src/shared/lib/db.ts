import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

export async function runMigration(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.warn('[migration] DATABASE_URL no configurada, omitiendo migración automática')
    return
  }

  const db = getPool()
  const client = await db.connect()

  try {
    // Verificar si el schema ya existe
    const { rows } = await client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'gongcha'"
    )

    if (rows.length > 0) {
      console.log('[migration] Schema gongcha ya existe, omitiendo migración')
      return
    }

    console.log('[migration] Ejecutando migración del schema gongcha...')

    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '001_gongcha_schema.sql')
    const sql = readFileSync(migrationPath, 'utf-8')

    await client.query(sql)
    console.log('[migration] ✅ Schema gongcha creado exitosamente')
  } catch (err) {
    console.error('[migration] ❌ Error en migración:', err)
    throw err
  } finally {
    client.release()
  }
}
