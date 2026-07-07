'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkSaveCountItems, submitCount, approveCount } from '../actions/conteo-actions'
import { Check, Save, Send, CheckCircle, ArrowLeft, AlertTriangle } from 'lucide-react'
import type { InventoryCountSession, InventoryCountItem, CountStatus } from '@/shared/types'

const STATUS_LABELS: Record<CountStatus, string> = {
  draft: 'Borrador',
  submitted: 'Enviado — pendiente de aprobación',
  approved: 'Aprobado — kardex ajustado',
}

const STATUS_COLORS: Record<CountStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
}

type ItemValues = {
  physical_qty: string
  lot_no: string
  expiry_date: string
  notes: string
}

interface Props {
  session: InventoryCountSession
  items: InventoryCountItem[]
  canApprove: boolean
}

export function ConteoForm({ session, items, canApprove }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const [values, setValues] = useState<Record<string, ItemValues>>(
    Object.fromEntries(
      items.map((item) => [
        item.supply_id,
        {
          physical_qty: item.physical_qty != null ? String(item.physical_qty) : '',
          lot_no:       item.lot_no ?? '',
          expiry_date:  item.expiry_date ?? '',
          notes:        item.notes ?? '',
        },
      ])
    )
  )

  const countedCount = Object.values(values).filter((v) => v.physical_qty !== '').length
  const totalCount   = items.length
  const isEditable   = session.status === 'draft'

  const buildPayload = () =>
    items.map((item) => {
      const v = values[item.supply_id]
      return {
        supplyId:    item.supply_id,
        physicalQty: v?.physical_qty !== '' ? parseFloat(v.physical_qty) : null,
        lotNo:       v?.lot_no || undefined,
        expiryDate:  v?.expiry_date || undefined,
        notes:       v?.notes || undefined,
      }
    })

  const handleChange = (supplyId: string, field: keyof ItemValues, value: string) => {
    setValues((prev) => ({ ...prev, [supplyId]: { ...prev[supplyId], [field]: value } }))
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await bulkSaveCountItems(session.id, buildPayload())
      setMessage({ text: result.success ? 'Borrador guardado' : (result.error ?? 'Error'), ok: result.success })
    })
  }

  const handleSubmit = () => {
    startTransition(async () => {
      await bulkSaveCountItems(session.id, buildPayload())
      const result = await submitCount(session.id)
      setMessage({
        text: result.success ? 'Conteo enviado para aprobación' : (result.error ?? 'Error'),
        ok: result.success,
      })
      if (result.success) router.push('/conteo')
    })
  }

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveCount(session.id)
      setMessage({
        text: result.success
          ? `Aprobado — ${countedCount} insumos reconciliados en el kardex`
          : (result.error ?? 'Error'),
        ok: result.success,
      })
      if (result.success) router.push('/conteo')
    })
  }

  return (
    <div className="p-8">
      {/* Back + Header */}
      <button
        onClick={() => router.push('/conteo')}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm mb-4"
      >
        <ArrowLeft size={14} /> Volver al listado
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{session.period_label}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {session.period_start} — {session.period_end}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[session.status]}`}>
              {STATUS_LABELS[session.status]}
            </span>
            <span className="text-xs text-slate-400">
              {countedCount} / {totalCount} insumos contados
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          {isEditable && (
            <>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <Save size={15} /> Guardar borrador
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                <Send size={15} /> Enviar para aprobación
              </button>
            </>
          )}
          {canApprove && session.status === 'submitted' && (
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle size={15} /> Aprobar y ajustar kardex
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
          message.ok
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.ok
            ? <Check size={14} />
            : <AlertTriangle size={14} />}
          {message.text}
        </div>
      )}

      {/* Approve warning */}
      {canApprove && session.status === 'submitted' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          Al aprobar se generarán ajustes automáticos en el kardex para los {countedCount} insumos contados.
          Los insumos sin cantidad registrada (—) serán ignorados.
        </div>
      )}

      {/* Count table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Insumo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cat.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Unidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-32">Cantidad física</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-28">Lote</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-32">Caducidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const v       = values[item.supply_id]
                const counted = v?.physical_qty !== ''
                const supply  = item.supplies

                return (
                  <tr
                    key={item.supply_id}
                    className={`border-b border-slate-50 ${counted ? 'bg-emerald-50/30' : ''}`}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {counted
                          ? <Check size={12} className="text-emerald-500 shrink-0" />
                          : <div className="w-3 shrink-0" />}
                        <span className="font-medium text-slate-800">{supply?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs capitalize">{supply?.category ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{supply?.unit ?? ''}</td>

                    {/* Quantity */}
                    <td className="px-4 py-2">
                      {isEditable ? (
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={v?.physical_qty ?? ''}
                          onChange={(e) => handleChange(item.supply_id, 'physical_qty', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                          placeholder="—"
                        />
                      ) : (
                        <span className="text-slate-700">{v?.physical_qty || '—'}</span>
                      )}
                    </td>

                    {/* Lot number */}
                    <td className="px-4 py-2">
                      {isEditable ? (
                        <input
                          type="text"
                          value={v?.lot_no ?? ''}
                          onChange={(e) => handleChange(item.supply_id, 'lot_no', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                          placeholder="Lote"
                        />
                      ) : (
                        <span className="text-slate-400 text-xs">{v?.lot_no || '—'}</span>
                      )}
                    </td>

                    {/* Expiry date */}
                    <td className="px-4 py-2">
                      {isEditable ? (
                        <input
                          type="date"
                          value={v?.expiry_date ?? ''}
                          onChange={(e) => handleChange(item.supply_id, 'expiry_date', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                        />
                      ) : (
                        <span className="text-slate-400 text-xs">{v?.expiry_date || '—'}</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-2">
                      {isEditable ? (
                        <input
                          type="text"
                          value={v?.notes ?? ''}
                          onChange={(e) => handleChange(item.supply_id, 'notes', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                          placeholder="Observaciones..."
                        />
                      ) : (
                        <span className="text-slate-400 text-xs">{v?.notes || '—'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom action bar for long lists */}
      {isEditable && items.length > 20 && (
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <Save size={15} /> Guardar borrador
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            <Send size={15} /> Enviar para aprobación
          </button>
        </div>
      )}
    </div>
  )
}
