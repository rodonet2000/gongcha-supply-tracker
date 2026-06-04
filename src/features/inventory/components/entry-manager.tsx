'use client'

import { useState, useTransition } from 'react'
import { createEntry } from '../actions/entry-actions'
import { Plus, X } from 'lucide-react'
import type { Supply } from '@/shared/types'

interface Entry {
  id: string; fecha: string; cantidad: number; unit_cost: number | null
  notes: string | null; source: string
  supplies: { name: string; unit: string; category: string | null } | null
}

interface Props { entries: Entry[]; supplies: Supply[] }

export function EntryManager({ entries, supplies }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createEntry(fd)
      if (result.success) { setShowForm(false); (e.target as HTMLFormElement).reset() }
      else setError(result.error ?? 'Error')
    })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Entradas</h1>
          <p className="text-slate-500 text-sm mt-1">Registro de entradas al inventario</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Nueva entrada
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Registrar entrada</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Insumo *</label>
                <select name="supply_id" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecciona un insumo...</option>
                  {supplies.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cantidad *</label>
                  <input name="cantidad" type="number" step="0.001" min="0.001" required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha *</label>
                  <input name="fecha" type="date" required defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Costo unitario (MXN)</label>
                <input name="unit_cost" type="number" step="0.0001" min="0"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas / Referencia</label>
                <input name="notes" type="text" placeholder="Número de remisión, observaciones..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                  {isPending ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {entries.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-400 text-sm">No hay entradas registradas.</p>
            <p className="text-slate-400 text-xs mt-1">Registra la primera entrada de inventario.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Insumo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Categoría</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cantidad</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Costo unit.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 text-xs">{e.fecha}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{e.supplies?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs capitalize">{e.supplies?.category ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">+{e.cantidad} {e.supplies?.unit}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{e.unit_cost != null ? `$${e.unit_cost}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{e.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
