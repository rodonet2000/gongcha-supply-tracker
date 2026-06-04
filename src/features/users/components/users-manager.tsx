'use client'

import { useState, useTransition } from 'react'
import { createUser, toggleUserActive } from '../actions/user-actions'
import { Plus, X, UserCheck, UserX } from 'lucide-react'
import type { UserProfile, Branch, UserRole } from '@/shared/types'

const ROLE_LABELS: Record<UserRole, string> = {
  sucursal: 'Sucursal',
  administrador: 'Administrador',
  direccion: 'Dirección',
}

interface Props {
  users: (UserProfile & { branches?: Branch | null })[]
  branches: Branch[]
  currentRole: UserRole
}

export function UsersManager({ users, branches, currentRole }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createUser(formData)
      if (result.success) { setShowForm(false) } else { setError(result.error ?? 'Error') }
    })
  }

  const availableRoles: UserRole[] =
    currentRole === 'direccion'
      ? ['sucursal', 'administrador', 'direccion']
      : ['sucursal', 'administrador']

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
          <p className="text-slate-500 text-sm mt-1">{users.length} usuarios registrados</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Nuevo usuario</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Nombre completo *" name="full_name" placeholder="Juan Pérez" />
              <Field label="Correo electrónico *" name="email" type="email" placeholder="juan@gongcha.mx" />
              <Field label="Contraseña temporal *" name="password" type="password" placeholder="min. 8 caracteres" />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Rol *</label>
                <select name="role" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  {availableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Sucursal</label>
                <select name="branch_id" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Sin sucursal asignada</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                  {isPending ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Nombre</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Rol</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Sucursal</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm">No hay usuarios registrados</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{u.full_name}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.role === 'direccion' ? 'bg-purple-50 text-purple-700' :
                    u.role === 'administrador' ? 'bg-blue-50 text-blue-700' :
                    'bg-slate-50 text-slate-600'
                  }`}>{ROLE_LABELS[u.role]}</span>
                </td>
                <td className="px-5 py-3 text-slate-500">{(u.branches as Branch | null)?.name ?? '—'}</td>
                <td className="px-5 py-3">
                  <button onClick={() => startTransition(() => toggleUserActive(u.user_id, !u.active))}
                    className={`flex items-center gap-1 text-xs ${u.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {u.active ? <UserCheck size={14} /> : <UserX size={14} />}
                    {u.active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Field({ label, name, type = 'text', placeholder }: { label: string; name: string; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input name={name} type={type} placeholder={placeholder} required={label.includes('*')}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  )
}
