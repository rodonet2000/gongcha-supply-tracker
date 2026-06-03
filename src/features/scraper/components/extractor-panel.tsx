'use client'

import { useState } from 'react'
import { createScrapingSession } from '@/features/scraper/actions/scrape-actions'
import { getAvailableWeeks } from '@/shared/lib/utils'
import { useRouter } from 'next/navigation'
import { Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

type LogLine = { type: 'info' | 'success' | 'error' | 'warn'; text: string }

export function ExtractorPanel() {
  const [selectedWeek, setSelectedWeek] = useState('')
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [log, setLog] = useState<LogLine[]>([])
  const router = useRouter()

  const weeks = getAvailableWeeks(16)

  const addLog = (type: LogLine['type'], text: string) => {
    setLog((prev) => [...prev.slice(-49), { type, text }])
  }

  const handleStart = async () => {
    if (!selectedWeek) return

    setStatus('starting')
    setLog([])
    setProgress({ current: 0, total: 0 })

    const result = await createScrapingSession(selectedWeek)

    if (!result.success) {
      if (result.alreadyExists) {
        addLog('warn', result.error ?? 'La semana ya fue extraída.')
        setStatus('error')
      } else {
        addLog('error', result.error ?? 'Error al crear la sesión')
        setStatus('error')
      }
      return
    }

    setStatus('running')

    // SSE stream
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart: selectedWeek, sessionId: result.sessionId }),
    })

    if (!response.body) {
      addLog('error', 'No se pudo iniciar el stream')
      setStatus('error')
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value)
      const lines = text.split('\n').filter((l) => l.startsWith('data: '))

      for (const line of lines) {
        try {
          const event = JSON.parse(line.slice(6))

          switch (event.type) {
            case 'started':
              addLog('info', event.message)
              break
            case 'progress':
              setProgress({ current: event.current, total: Math.max(event.total, 1) })
              addLog('info', event.message)
              break
            case 'order_saved':
              addLog('success', `✓ Pedido ${event.external_id} guardado`)
              break
            case 'duplicate':
              addLog('warn', `↩ Pedido ${event.external_id} ya existe, omitido`)
              break
            case 'completed':
              addLog('success', `Extracción completada: ${event.ordersCount} pedidos`)
              setStatus('done')
              router.refresh()
              break
            case 'error':
              addLog('error', `Error: ${event.message}`)
              setStatus('error')
              break
          }
        } catch {
          // ignore malformed events
        }
      }
    }

    if (status === 'running') setStatus('done')
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const isRunning = status === 'starting' || status === 'running'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-800 mb-5">Nueva extracción</h2>

      {/* Selección de semana */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Semana a extraer
        </label>
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          disabled={isRunning}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
        >
          <option value="">Seleccionar semana...</option>
          {weeks.map((w) => (
            <option key={w.start} value={w.start}>{w.label}</option>
          ))}
        </select>
      </div>

      {/* Progress bar */}
      {(status === 'running' || status === 'done') && progress.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{progress.current} / {progress.total} pedidos</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Status messages */}
      {status === 'done' && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg text-sm mb-4">
          <CheckCircle2 size={15} />
          <span>Extracción completada exitosamente</span>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 px-3 py-2 rounded-lg text-sm mb-4">
          <AlertCircle size={15} />
          <span>{log.findLast((l) => l.type === 'error')?.text ?? 'Error en la extracción'}</span>
        </div>
      )}

      {/* Botón */}
      <button
        onClick={handleStart}
        disabled={!selectedWeek || isRunning}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isRunning ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Extrayendo...
          </>
        ) : (
          <>
            <Download size={16} />
            Iniciar extracción
          </>
        )}
      </button>

      {/* Log */}
      {log.length > 0 && (
        <div className="mt-4 bg-slate-900 rounded-lg p-3 h-48 overflow-y-auto scrollbar-thin">
          {log.map((line, i) => (
            <p key={i} className={`text-xs font-mono leading-relaxed ${
              line.type === 'success' ? 'text-emerald-400' :
              line.type === 'error' ? 'text-red-400' :
              line.type === 'warn' ? 'text-yellow-400' :
              'text-slate-400'
            }`}>
              {line.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
