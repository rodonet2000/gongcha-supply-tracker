'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

interface StockRow {
  supply_id: string; supply_name: string; unit: string; category: string | null
  branch_name: string; fecha: string; tipo: string
  entrada: number; salida: number; saldo: number; referencia: string | null
}

interface CurrentRow {
  supply_id: string; branch_id: string; saldo_actual: number
  supplies: { name: string; unit: string; category: string | null } | null
  branches: { name: string } | null
}

interface Props { kardex: StockRow[]; currentStock: CurrentRow[] }

export function KardexTable({ kardex, currentStock }: Props) {
  const [view, setView] = useState<'resumen' | 'movimientos'>('resumen')
  const [filter, setFilter] = useState('')

  const filteredCurrent = currentStock.filter(r =>
    r.supplies?.name.toLowerCase().includes(filter.toLowerCase())
  )

  const exportCSV = () => {
    const rows = kardex.map(r =>
      [r.fecha, r.supply_name, r.branch_name, r.tipo, r.entrada, r.salida, r.saldo, r.referencia ?? ''].join(',')
    )
    const csv = ['Fecha,Insumo,Sucursal,Tipo,Entrada,Salida,Saldo,Referencia', ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kardex-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kardex</h1>
          <p className="text-slate-500 text-sm mt-1">Control de existencias por insumo</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            <button onClick={() => setView('resumen')}
              className={`px-3 py-2 ${view === 'resumen' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              Saldo actual
            </button>
            <button onClick={() => setView('movimientos')}
              className={`px-3 py-2 ${view === 'movimientos' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              Movimientos
            </button>
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-2 border border-slate-300 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors">
            <Download size={15} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar insumo..."
          className="w-64 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      {view === 'resumen' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Insumo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Sucursal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Saldo actual</th>
              </tr>
            </thead>
            <tbody>
              {filteredCurrent.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm">Sin existencias registradas</td></tr>
              ) : filteredCurrent.map(r => (
                <tr key={`${r.supply_id}-${r.branch_id}`} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.supplies?.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs capitalize">{r.supplies?.category ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.branches?.name}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${r.saldo_actual > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {r.saldo_actual} {r.supplies?.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Insumo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Entrada</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Salida</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {kardex.filter(r => r.supply_name.toLowerCase().includes(filter.toLowerCase())).length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Sin movimientos registrados</td></tr>
              ) : kardex.filter(r => r.supply_name.toLowerCase().includes(filter.toLowerCase())).map((r, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.fecha}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.supply_name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs capitalize">{r.tipo}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{r.entrada > 0 ? r.entrada : '—'}</td>
                  <td className="px-4 py-3 text-right text-red-500">{r.salida > 0 ? r.salida : '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${r.saldo > 0 ? 'text-slate-800' : 'text-red-500'}`}>{r.saldo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
