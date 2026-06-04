'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/shared/types'

interface StockRow {
  supply_id: string; branch_id: string; saldo_actual: number
  supplies: { name: string; unit: string; category: string | null; cost_per_unit: number | null } | null
  branches: { name: string } | null
}
interface MovRow {
  supply_id: string; branch_id: string; cantidad: number; fecha: string
  source?: string
  supplies: { name: string; unit: string; category: string | null } | null
}

interface Report {
  stock: StockRow[]
  entries: MovRow[]
  exits: MovRow[]
}

interface Props { report: Report; role: UserRole }

export function ExistenciasReport({ report, role }: Props) {
  const router = useRouter()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo)   params.set('to', dateTo)
    router.push(`/reportes/existencias?${params.toString()}`)
  }

  const totalEntradas = report.entries.reduce((s, e) => s + e.cantidad, 0)
  const totalSalidas  = report.exits.reduce((s, e) => s + e.cantidad, 0)
  const mermas        = report.exits.filter(e => e.source === 'waste').reduce((s, e) => s + e.cantidad, 0)
  const autoSalidas   = report.exits.filter(e => e.source === 'auto').reduce((s, e) => s + e.cantidad, 0)

  const exportCSV = () => {
    const rows = report.stock.map(r =>
      [r.supplies?.name, r.supplies?.category, r.branches?.name, r.saldo_actual, r.supplies?.unit, r.supplies?.cost_per_unit ?? ''].join(',')
    )
    const csv = ['Insumo,Categoría,Sucursal,Saldo,Unidad,Costo unitario', ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `existencias-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reporte de Existencias</h1>
          <p className="text-slate-500 text-sm mt-1">Entradas, salidas y saldos de inventario</p>
        </div>
        <button onClick={exportCSV}
          className="border border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition-colors">
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <button onClick={applyFilters}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Aplicar filtros
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total entradas', value: totalEntradas.toFixed(2), color: 'text-emerald-600' },
          { label: 'Total salidas', value: totalSalidas.toFixed(2), color: 'text-red-500' },
          { label: 'Mermas', value: mermas.toFixed(2), color: 'text-orange-500' },
          { label: 'Salidas automáticas', value: autoSalidas.toFixed(2), color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Stock table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saldos actuales ({report.stock.length} insumos)</p>
        </div>
        {report.stock.length === 0 ? (
          <div className="p-12 text-center"><p className="text-slate-400 text-sm">Sin datos de existencias</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Insumo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Sucursal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Saldo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Costo unit.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Valor est.</th>
              </tr>
            </thead>
            <tbody>
              {report.stock
                .filter(r => (r.saldo_actual ?? 0) !== 0)
                .sort((a, b) => (a.supplies?.category ?? '').localeCompare(b.supplies?.category ?? ''))
                .map(r => {
                  const valorEst = r.saldo_actual * (r.supplies?.cost_per_unit ?? 0)
                  return (
                    <tr key={`${r.supply_id}-${r.branch_id}`} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.supplies?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs capitalize">{r.supplies?.category ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{r.branches?.name ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${r.saldo_actual > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {r.saldo_actual} {r.supplies?.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        {r.supplies?.cost_per_unit != null ? `$${r.supplies.cost_per_unit}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">
                        {r.supplies?.cost_per_unit != null ? `$${valorEst.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
