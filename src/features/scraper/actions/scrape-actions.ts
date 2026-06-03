'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { toISODateString, getWeekRange } from '@/shared/lib/utils'
import { addDays } from 'date-fns'
import { revalidatePath } from 'next/cache'

export async function createScrapingSession(weekStart: string): Promise<{
  success: boolean
  sessionId?: string
  error?: string
  alreadyExists?: boolean
}> {
  const supabase = createServerClient()

  // Verificar si ya existe una sesión completada para esta semana
  const { data: existing } = await supabase
    .from('scraping_sessions')
    .select('id, status')
    .eq('week_start', weekStart)
    .single()

  if (existing?.status === 'completed') {
    return { success: false, alreadyExists: true, error: 'Esta semana ya fue extraída correctamente.' }
  }

  // Si existe pero está en error o pendiente, reutilizar
  if (existing) {
    await supabase
      .from('scraping_sessions')
      .update({ status: 'pending', error_message: null, orders_processed: 0, orders_total: 0 })
      .eq('id', existing.id)
    return { success: true, sessionId: existing.id }
  }

  const weekStartDate = new Date(weekStart + 'T00:00:00')
  const weekEnd = toISODateString(addDays(weekStartDate, 6))

  const { data, error } = await supabase
    .from('scraping_sessions')
    .insert({ week_start: weekStart, week_end: weekEnd, status: 'pending' })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/extractor')
  return { success: true, sessionId: data.id }
}

export async function getScrapingSessions() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('scraping_sessions')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(20)

  if (error) throw error
  return data ?? []
}

export async function deleteScrapingSession(sessionId: string): Promise<void> {
  const supabase = createServerClient()

  // Eliminar pedidos asociados (cascade elimina items y modificadores)
  await supabase.from('orders').delete().eq('scraping_session_id', sessionId)
  await supabase.from('scraping_sessions').delete().eq('id', sessionId)

  revalidatePath('/extractor')
  revalidatePath('/pedidos')
}
