'use client'

import { useState, useTransition } from 'react'
import { createPurchase, type PurchaseItemInput } from '../actions/purchase-actions'
import { Plus, X, Trash2, ChevronLeft } from 'lucide-react'
import type { Supply } from '@/shared/types'

interface Supplier { id: string; name: string }
interface PurchaseRow {
  id: string; fecha: string; folio: string | null; total: number | null
  suppliers: { name: string } | null
  purchase_items: { id: string; supplies: { name: string; unit: string } | null; cantidad: number; unit_cost: number | null }[]
}

interface Meta { supplier_id: string; fecha: string; folio: string; notes: string }

interface Props { purchases: PurchaseRow[]; suppliers: Supplier[]; supplies: Supply[] }

export function PurchaseManager({ purchases, suppliers, supplies }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [stage, setStage] = useState<1 | 2>(1)
  const [meta, setMeta] = useState<Meta>({ supplier_id: '', fecha: new Date().toISOString().split('T')[0], folio: '', notes: '' })
  const [items, setItems] = useState<PurchaseItemInput[]>([{ supply_id: '', cantidad: 1, unit_cost: null }])
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const resetForm = () => { setStage(1); setMeta({ supplier_id: '', fecha: new Date().toISOString().split('T')[0], folio: '', notes: '' }); setItems([{ supply_id: '', cantidad: 1, unit_cost: null }]); setError('') }

  const addItem = () => setItems(prev => [...prev, { supply_id: '', cantidad: 1, unit_cost: null }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: keyof PurchaseItemInput, value: string) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: field === 'supply_id' ? value : parseFloat(value) || 0 } : item))
  }

  const handleSubmit = () => {
    setError('')
    const validItems = items.filter(i => i.supply_id && i.cantidad > 0)
    if (validItems.length === 0) { setError('Agrega al menos un insumo válido'); return }
    startTransition(async () => {
      const result = await createPurchase(meta, validItems)
      if (result.success) { setShowForm(false); resetForm() } else { setError(result.error ?? 'Error') }
    })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compras</h1>
          <p className="text-slate-500 text-sm mt-1">Registro de compras a proveedores</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Nueva compra
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">
                {stage === 1 ? 'Nueva compra (1/2)' : 'Agregar insumos (2/2)'}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm() }}><X size={18} className="text-slate-400" /></button>
            </div>

            {stage === 1 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Proveedor</label>
                  <select value={meta.supplier_id} onChange={e => setMeta(m => ({ ...m, supplier_id: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Sin proveedor</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha *</label>
                    <input type="date" value={meta.fecha} onChange={e => setMeta(m => ({ ...m, fecha: e.target.value }))} required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Folio / Factura</label>
                    <input type="text" value={meta.folio} onChange={e => setMeta(m => ({ ...m, folio: e.target.value }))} placeholder="FAC-001"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas</label>
                  <input type="text" value={meta.notes} onChange={e => setMeta(m => ({ ...m, notes: e.target.value }))} placeholder="Observaciones..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                    className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm">Cancelar</button>
                  <button type="button" onClick={() => setStage(2)} disabled={!meta.fecha}
                    className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                    Siguiente →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Insumo</label>
                        <select value={item.supply_id} onChange={e => updateItem(i, 'supply_id', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                          <option value="">Seleccionar...</option>
                          {supplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="w-20">
                        <label className="block text-xs text-slate-500 mb-1">Cantidad</label>
                        <input type="number" step="0.001" min="0.001" value={item.cantidad}
                          onChange={e => updateItem(i, 'cantidad', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div className="w-24">
                        <label className="block text-xs text-slate-500 mb-1">Costo unit.</label>
                        <input type="number" step="0.0001" min="0" value={item.unit_cost ?? ''}
                          onChange={e => updateItem(i, 'unit_cost', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-500 mb-0.5">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1.5 text-brand-600 hover:text-brand-700 text-sm">
                  <Plus size={14} /> Agregar insumo
                </button>
                <div className="pt-1 border-t border-slate-100 text-right text-sm font-semibold text-slate-700">
                  Total: ${items.reduce((s, i) => s + (i.cantidad * (i.unit_cost ?? 0)), 0).toFixed(2)}
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStage(1)}
                    className="flex items-center gap-1 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
                    <ChevronLeft size={14} /> Atrás
                  </button>
                  <button type="button" onClick={handleSubmit} disabled={isPending}
                    className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                    {isPending ? 'Guardando...' : 'Confirmar compra'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {purchases.length === 0 ? (
          <div className="p-16 text-center"><p className="text-slate-400 text-sm">No hay compras registradas.</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Folio</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Insumos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 text-xs">{p.fecha}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.suppliers?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.folio ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{p.purchase_items?.length ?? 0} insumos</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {p.total != null ? `$${p.total.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
