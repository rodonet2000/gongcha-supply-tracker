import { NextRequest } from 'next/server'
import { FoodbotScraper } from '@/features/scraper/lib/foodbot-scraper'
import { createServerClient } from '@/shared/lib/supabase/server'
import type { ScrapeProgressEvent } from '@/shared/types'
import { addDays } from 'date-fns'
import { toISODateString } from '@/shared/lib/utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 600 // 10 min máximo

export async function POST(request: NextRequest) {
  const { weekStart, sessionId } = await request.json()

  if (!weekStart || !sessionId) {
    return new Response('weekStart y sessionId son requeridos', { status: 400 })
  }

  const weekEnd = toISODateString(addDays(new Date(weekStart + 'T00:00:00'), 6))

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ScrapeProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Stream closed
        }
      }

      const scraper = new FoodbotScraper()
      try {
        await scraper.scrape(weekStart, weekEnd, sessionId, send)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send({ type: 'error', message: msg })
      } finally {
        try { controller.close() } catch { /* ignore */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
