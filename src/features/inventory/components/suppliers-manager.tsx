'use client'

import { useState, useTransition } from 'react'
import { createSupplier, toggleSupplierActive } from '../actions/supplier-actions'
import { Plus, X, CheckCircle2, XCircle } from 'lucide-react'

interface Supplier {
  id: string; name: string; rfc: string | null; contact: string | null
  phone: string | null; email: string | null; notes: string | null; active: boolean
}

export function SuppliersManager({ suppliers }: { suppliers: Supplier[] }) {
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createSupplier(fd)
      if (result.success) { setShowForm(false) } else { setError(result.error ?? 'Error') }
    })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proveedores</h1>
          <p className="text-slate-500 text-sm mt-1">{suppliers.length} proveedores registrados</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Nuevo proveedor
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Nuevo proveedor</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              {[
                { label: 'Nombre *', name: 'name', placeholder: 'Empresa S.A. de C.V.' },
                { label: 'RFC', name: 'rfc', placeholder: 'EMP123456ABC' },
                { label: 'Contacto', name: 'contact', placeholder: 'Nombre del contacto' },
                { label: 'Teléfono', name: 'phone', placeholder: '+52 954 000 0000' },
                { label: 'Correo', name: 'email', placeholder: 'ventas@empresa.mx', type: 'email' },
                { label: 'Notas', name: 'notes', placeholder: 'Condiciones de pago, etc.' },
              ].map(({ label, name, placeholder, type }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input name={name} type={type ?? 'text'} placeholder={placeholder}
                    required={label.includes('*')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              ))}
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                  {isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="p-16 text-center"><p className="text-slate-400 text-sm">No hay proveedores registrados.</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">RFC</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.rfc ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.contact ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => startTransition(() => toggleSupplierActive(s.id, !s.active))}
                      className={`flex items-center gap-1 text-xs ${s.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {s.active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {s.active ? 'Activo' : 'Inactivo'}
                    </button>
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
