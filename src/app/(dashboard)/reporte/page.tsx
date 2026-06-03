import { calculateWeeklySupplyRequirements } from '@/features/reports/actions/report-actions'
import { getScrapingSessions } from '@/features/scraper/actions/scrape-actions'
import { formatWeekLabel, formatCurrency, getWeekRange, toISODateString } from '@/shared/lib/utils'
import Link from 'next/link'
import { Download } from 'lucide-react'

interface Props {
  searchParams: Promise<{ week?: string }>
}

export default async function ReportePage({ searchParams }: Props) {
  const params = await searchParams
  const sessions = await getScrapingSessions()
  const completedSessions = sessions.filter((s) => s.status === 'completed')
  const availableWeeks = completedSessions.map((s) => s.week_start)

  const selectedWeek = params.week ?? availableWeeks[0] ?? toISODateString(getWeekRange(new Date()).start)
  const requirements = selectedWeek ? await calculateWeeklySupplyRequirements(selectedWeek) : []

  const selectedSession = completedSessions.find((s) => s.week_start === selectedWeek)
  const totalCost = requirements.reduce((sum, r) => sum + (r.estimated_cost ?? 0), 0)

  const groupedByCategory = requirements.reduce<Record<string, typeof requirements>>((acc, r) => {
    const cat = r.category ?? 'otro'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(r)
    return acc
  }, {})

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reporte de insumos</h1>
          <p className="text-slate-500 text-sm mt-1">
            Insumos requeridos para la semana según ventas reales
          </p>
        </div>
        <div className="flex items-center gap-3">
          {availableWeeks.length > 0 && (
            <form method="get">
              <select
                name="week"
                defaultValue={selectedWeek}
                onChange={(e) => {
                  const url = new URL(window.location.href)
                  url.searchParams.set('week', e.target.value)
                  window.location.href = url.toString()
                }}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {availableWeeks.map((w) => (
                  <option key={w} value={w}>{formatWeekLabel(w)}</option>
                ))}
              </select>
            </form>
          )}
        </div>
      </div>

      {availableWeeks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <p className="text-slate-400 text-sm mb-2">No hay semanas extraídas.</p>
          <Link href="/extractor" className="text-brand-600 text-sm hover:underline">Ir al extractor →</Link>
        </div>
      ) : requirements.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <p className="text-slate-400 text-sm mb-2">No hay datos de recetas configuradas para esta semana.</p>
          <p className="text-slate-400 text-xs">Configura recetas e insumos en el módulo de <Link href="/recetas" className="text-brand-600 hover:underline">Recetas</Link>.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Semana</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{formatWeekLabel(selectedWeek)}</p>
              <p className="text-xs text-slate-400 mt-1">{selectedSession?.orders_processed ?? 0} pedidos</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Tipos de insumo</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{requirements.length}</p>
              <p className="text-xs text-slate-400 mt-1">{Object.keys(groupedByCategory).length} categorías</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Costo estimado total</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalCost || null)}</p>
              <p className="text-xs text-slate-400 mt-1">Basado en costos configurados</p>
            </div>
          </div>

          {/* Tabla por categoría */}
          {Object.entries(groupedByCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items]) => (
              <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide capitalize">{category}</p>
                  <p className="text-xs text-slate-400">{items.length} insumos</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400">Insumo</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-400">Cantidad total</th>
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400">Unidad</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-400">Costo estimado</th>
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((req) => (
                      <tr key={req.supply_id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-800">{req.supply_name}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-semibold text-brand-700 text-base">{req.total_quantity.toFixed(2)}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{req.unit}</td>
                        <td className="px-5 py-3 text-right text-slate-700">
                          {req.estimated_cost != null ? formatCurrency(req.estimated_cost) : <span className="text-slate-300">--</span>}
                        </td>
                        <td className="px-5 py-3">
                          <details className="text-xs text-slate-400">
                            <summary className="cursor-pointer hover:text-slate-600 select-none">
                              {req.breakdown.length} fuentes
                            </summary>
                            <div className="mt-1 space-y-0.5 pl-3 border-l border-slate-200">
                              {req.breakdown.map((b) => (
                                <p key={b.source} className="text-slate-400">
                                  <span className="text-slate-600">{b.source}</span>
                                  {' '}×{b.source_count} = {b.quantity.toFixed(2)} {req.unit}
                                </p>
                              ))}
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </>
      )}
    </div>
  )
}
