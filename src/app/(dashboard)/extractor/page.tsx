export const dynamic = 'force-dynamic'
import { getScrapingSessions } from '@/features/scraper/actions/scrape-actions'
import { ExtractorPanel } from '@/features/scraper/components/extractor-panel'
import { formatWeekLabel } from '@/shared/lib/utils'

export default async function ExtractorPage() {
  const sessions = await getScrapingSessions()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Extractor de datos</h1>
        <p className="text-slate-500 text-sm mt-1">
          Selecciona la semana y extrae los pedidos desde Foodbot.ai
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ExtractorPanel />

        {/* Historial de sesiones */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Sesiones de extracción</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No hay sesiones registradas</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.id} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-slate-800">{formatWeekLabel(s.week_start)}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>{s.orders_processed}/{s.orders_total} pedidos</span>
                    {s.status === 'running' && (
                      <span className="text-blue-500 animate-pulse">En progreso...</span>
                    )}
                    {s.error_message && (
                      <span className="text-red-500 truncate max-w-40" title={s.error_message}>
                        Error: {s.error_message}
                      </span>
                    )}
                  </div>
                  {s.status === 'running' && s.orders_total > 0 && (
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${(s.orders_processed / s.orders_total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700',
    running: 'bg-blue-50 text-blue-700',
    error: 'bg-red-50 text-red-700',
    pending: 'bg-slate-50 text-slate-600',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? map.pending}`}>
      {status}
    </span>
  )
}
