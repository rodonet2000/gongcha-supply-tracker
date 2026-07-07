export const dynamic = 'force-dynamic'

import { getMermaReport } from '@/features/conteo/actions/conteo-actions'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'
import { TrendingDown, AlertTriangle, Info } from 'lucide-react'

export default async function MermaPage() {
  const session = await getUser()
  if (!session) redirect('/login')
  if (!['administrador', 'direccion'].includes(session.profile.role)) redirect('/dashboard')

  const branchId = session.profile.branch_id ?? ''
  const report   = await getMermaReport(branchId).catch(() => null)

  if (!report || report.needsMoreCounts) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingDown size={24} className="text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900">Análisis de Merma</h1>
        </div>
        <p className="text-slate-500 text-sm mb-8">Varianza entre consumo esperado y consumo real</p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
          <Info size={36} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">Se necesitan al menos 2 conteos aprobados</p>
          <p className="text-slate-400 text-xs mt-1">
            El análisis de merma compara dos quincenas consecutivas. Aprueba el primer conteo y luego el segundo.
          </p>
        </div>
      </div>
    )
  }

  const [latest, previous] = report.sessions
  const alertRows  = report.rows.filter((r) => r.alert)
  const normalRows = report.rows.filter((r) => !r.alert)

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-1">
        <TrendingDown size={24} className="text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-900">Análisis de Merma</h1>
      </div>
      <p className="text-slate-500 text-sm mb-6">
        Comparando <strong>{previous.period_label}</strong> → <strong>{latest.period_label}</strong>
      </p>

      {alertRows.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-red-700">
              {alertRows.length} insumo{alertRows.length !== 1 ? 's' : ''} con merma superior al rendimiento esperado
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-200">
                  <th className="text-left py-2 text-xs font-semibold text-red-500 uppercase">Insumo</th>
                  <th className="text-right py-2 text-xs font-semibold text-red-500 uppercase">Esperado</th>
                  <th className="text-right py-2 text-xs font-semibold text-red-500 uppercase">Contado</th>
                  <th className="text-right py-2 text-xs font-semibold text-red-500 uppercase">Merma</th>
                  <th className="text-right py-2 text-xs font-semibold text-red-500 uppercase">Rendimiento</th>
                </tr>
              </thead>
              <tbody>
                {alertRows.map((r) => (
                  <tr key={r.supply_id} className="border-b border-red-100">
                    <td className="py-2 font-medium text-slate-800">{r.supply_name}</td>
                    <td className="py-2 text-right text-slate-600">{r.expected.toFixed(3)} {r.unit}</td>
                    <td className="py-2 text-right text-slate-600">{r.actual.toFixed(3)} {r.unit}</td>
                    <td className="py-2 text-right font-semibold text-red-600">
                      {r.variance > 0 ? '+' : ''}{r.variance.toFixed(3)} {r.unit}
                    </td>
                    <td className="py-2 text-right text-slate-400 text-xs">
                      {r.yield_factor != null ? `${(r.yield_factor * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {normalRows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              Varianza normal ({normalRows.length} insumos)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Insumo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Anterior</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Entradas</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Salidas auto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Esperado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Contado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {normalRows.map((r) => (
                  <tr key={r.supply_id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{r.supply_name}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 text-xs">{r.prev_qty.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600 text-xs">+{r.entries.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400 text-xs">-{r.auto_exits.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600 text-xs">{r.expected.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600 text-xs">{r.actual.toFixed(3)}</td>
                    <td className={`px-4 py-2.5 text-right text-xs font-medium ${r.variance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {r.variance > 0 ? '+' : ''}{r.variance.toFixed(3)} {r.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report.rows.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-12 text-center">
          <p className="text-emerald-700 font-medium text-sm">Sin varianza detectada</p>
          <p className="text-emerald-600 text-xs mt-1">El inventario físico coincide exactamente con el kardex teórico.</p>
        </div>
      )}
    </div>
  )
}
