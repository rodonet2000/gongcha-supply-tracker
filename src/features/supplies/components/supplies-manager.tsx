'use client'

import { useState, useTransition } from 'react'
import { createSupply, updateSupply, deleteSupply } from '@/features/supplies/actions/supply-actions'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import type { Supply } from '@/shared/types'

const CATEGORIES = ['leche', 'tapioca', 'te', 'jarabe', 'topping', 'base', 'vaso', 'otro']
const UNITS = ['g', 'kg', 'ml', 'L', 'unidades', 'porciones']

interface Props { initialSupplies: Supply[] }

export function SuppliesManager({ initialSupplies }: Props) {
  const [supplies, setSupplies] = useState(initialSupplies)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createSupply(formData)
      if (result.success) {
        setShowForm(false)
        setError('')
        // Refresh page data
        window.location.reload()
      } else {
        setError(result.error ?? 'Error al crear')
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este insumo?')) return
    startTransition(async () => {
      await deleteSupply(id)
      setSupplies((prev) => prev.filter((s) => s.id !== id))
    })
  }

  const grouped = supplies.reduce<Record<string, Supply[]>>((acc, s) => {
    const cat = s.category ?? 'otro'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Insumos</h1>
          <p className="text-slate-500 text-sm mt-1">{supplies.length} insumos registrados</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nuevo insumo
        </button>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Nuevo insumo</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form action={handleCreate} className="space-y-4">
              <Field label="Nombre *" name="name" placeholder="Tapioca negra" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Unidad *</label>
                  <select name="unit" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoría</label>
                  <select name="category" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Sin categoría</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <Field label="Costo por unidad (MXN)" name="cost_per_unit" type="number" placeholder="0.50" />
              <Field label="Notas" name="notes" placeholder="Notas opcionales..." />

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                  {isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista agrupada por categoría */}
      {Object.entries(grouped).length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <p className="text-slate-400 text-sm">No hay insumos registrados.</p>
          <p className="text-slate-400 text-xs mt-1">Agrega los insumos para calcular requerimientos semanales.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
            <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide capitalize">{category}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400">Nombre</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400">Unidad</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-400">Costo/unidad</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400">Notas</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((supply) => (
                    <tr key={supply.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{supply.name}</td>
                      <td className="px-5 py-3 text-slate-500">{supply.unit}</td>
                      <td className="px-5 py-3 text-right text-slate-600">
                        {supply.cost_per_unit != null ? `$${supply.cost_per_unit}` : '--'}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{supply.notes ?? '--'}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleDelete(supply.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, name, placeholder, type = 'text' }: { label: string; name: string; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        step={type === 'number' ? '0.0001' : undefined}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  )
}
