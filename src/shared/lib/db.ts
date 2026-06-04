import { Pool } from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

let pool: Pool | null = null

export function getPool(): Pool {
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
    // Tabla de control de migraciones aplicadas
    await client.query(`
      CREATE TABLE IF NOT EXISTS gongcha.schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const filename of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM gongcha.schema_migrations WHERE filename = $1',
        [filename]
      )
      if (rows.length > 0) continue

      console.log(`[migration] Aplicando ${filename}...`)
      const sql = readFileSync(join(migrationsDir, filename), 'utf-8')
      await client.query(sql)
      await client.query(
        'INSERT INTO gongcha.schema_migrations (filename) VALUES ($1)',
        [filename]
      )
      console.log(`[migration] ✅ ${filename} aplicado`)
    }
  } catch (err) {
    console.error('[migration] ❌ Error en migración:', err)
    throw err
  } finally {
    client.release()
  }
}
