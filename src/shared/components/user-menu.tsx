'use client'

import { useTransition } from 'react'
import { signOut } from '@/features/auth/actions/auth-actions'
import { LogOut, User } from 'lucide-react'
import type { UserProfile } from '@/shared/types'

const ROLE_LABELS: Record<string, string> = {
  sucursal: 'Sucursal',
  administrador: 'Administrador',
  direccion: 'Dirección',
}

export function UserMenu({ profile }: { profile: UserProfile }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="px-4 py-4 border-t border-slate-700">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
          <User size={14} className="text-slate-300" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-xs font-medium truncate">{profile.full_name}</p>
          <p className="text-slate-400 text-xs">
            {ROLE_LABELS[profile.role]} · {profile.branches?.name ?? '—'}
          </p>
        </div>
      </div>
      <button
        onClick={() => startTransition(() => signOut())}
        disabled={isPending}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-xs
                   transition-colors w-full disabled:opacity-50"
      >
        <LogOut size={13} />
        {isPending ? 'Saliendo...' : 'Cerrar sesión'}
      </button>
    </div>
  )
}
