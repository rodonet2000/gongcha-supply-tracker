export async function register() {
  // Solo en el servidor (no en Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigration } = await import('@/shared/lib/db')
    await runMigration()
  }
}
