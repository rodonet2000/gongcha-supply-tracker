'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCountSession } from '../actions/conteo-actions'
import { Plus, X, ClipboardCheck, ChevronRight } from 'lucide-react'
import type { InventoryCountSession, CountStatus } from '@/shared/types'

const STATUS_LABELS: Record<CountStatus, string> = {
  draft: 'Borrador',
  submitted: 'Enviado',
  approved: 'Aprobado',
}

const STATUS_COLORS: Record<CountStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
}

function StatusBadge({ status }: { status: CountStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

interface Props {
  sessions: InventoryCountSession[]
  canCreate: boolean
}

export function ConteoManager({ sessions, canCreate }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [error, setError]       = useState('')
  const [isPending, startTransition] = useTransition()

  // Generate a default period label for the current biweek
  const today = new Date()
  const day   = today.getDate()
  const month = today.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const defaultLabel = `Quincena ${day <= 15 ? '1' : '2'} — ${month.charAt(0).toUpperCase() + month.slice(1)}`

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createCountSession(fd)
      if (result.success && result.id) {
        setShowForm(false)
        router.push(`/conteo/${result.id}`)
      } else {
        setError(result.error ?? 'Error al crear el conteo')
      }
    })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conteo Quincenal</h1>
          <p className="text-slate-500 text-sm mt-1">Inventario físico por quincena</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Nuevo conteo
          </button>
        )}
      </div>

      {/* New count modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Nuevo conteo quincenal</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Etiqueta del período *</label>
                <input
                  name="period_label"
                  type="text"
                  required
                  defaultValue={defaultLabel}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Quincena 1 — Julio 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Inicio del período *</label>
                  <input
                    name="period_start"
                    type="date"
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fin del período *</label>
                  <input
                    name="period_end"
                    type="date"
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Se pre-cargarán todos los insumos activos. Al aprobar el conteo se generarán ajustes automáticos en el kardex.
              </p>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {isPending ? 'Creando...' : 'Crear conteo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="p-16 text-center">
            <ClipboardCheck size={40} className="text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 text-sm">No hay conteos registrados.</p>
            {canCreate && (
              <p className="text-slate-400 text-xs mt-1">Crea el primer conteo quincenal para iniciar el inventario.</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Período</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fechas</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Sucursal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Aprobado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => router.push(`/conteo/${s.id}`)}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{s.period_label}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {s.period_start} → {s.period_end}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {(s.branches as { name: string } | null)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 text-xs">
                    {s.approved_at
                      ? new Date(s.approved_at).toLocaleDateString('es-MX')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <ChevronRight size={16} />
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
