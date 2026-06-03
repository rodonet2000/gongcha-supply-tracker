import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/shared/lib/supabase/server'
import { getWeekRange, toISODateString } from '@/shared/lib/utils'
import { subWeeks } from 'date-fns'

// Endpoint llamado por el cron job cada lunes para extraer la semana anterior
// GET /api/cron?secret=CRON_SECRET
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lastWeek = subWeeks(new Date(), 1)
  const { start } = getWeekRange(lastWeek)
  const weekStart = toISODateString(start)

  const supabase = createServerClient()

  // Verificar si ya existe
  const { data: existing } = await supabase
    .from('scraping_sessions')
    .select('id, status')
    .eq('week_start', weekStart)
    .single()

  if (existing?.status === 'completed') {
    return NextResponse.json({ message: 'Semana ya extraída', weekStart })
  }

  // Crear sesión si no existe
  let sessionId = existing?.id
  if (!sessionId) {
    const weekEnd = toISODateString(new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000))
    const { data, error } = await supabase
      .from('scraping_sessions')
      .insert({ week_start: weekStart, week_end: weekEnd, status: 'pending' })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    sessionId = data.id
  }

  // Lanzar scraping en background (fire and forget)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  fetch(`${appUrl}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekStart, sessionId }),
  }).catch(() => {})

  return NextResponse.json({ message: 'Scraping iniciado', weekStart, sessionId })
}
