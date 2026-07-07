'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/shared/lib/utils'
import {
  LayoutDashboard, Download, ShoppingBag, Package, BookOpen,
  BarChart3, Coffee, ArrowDownToLine, ArrowUpFromLine, ShoppingCart,
  Truck, ClipboardList, FileBarChart, Users, ClipboardCheck, TrendingDown,
} from 'lucide-react'
import type { UserRole, UserProfile } from '@/shared/types'
import { UserMenu } from './user-menu'

type NavItem = { href: string; label: string; icon: React.ElementType; roles: UserRole[] }

const ALL_ROLES: UserRole[] = ['sucursal', 'administrador', 'direccion']
const ADMIN_UP: UserRole[] = ['administrador', 'direccion']

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',             label: 'Dashboard',   icon: LayoutDashboard, roles: ALL_ROLES },
  { href: '/pedidos',               label: 'Pedidos',     icon: ShoppingBag,     roles: ALL_ROLES },
  { href: '/insumos',               label: 'Insumos',     icon: Package,         roles: ALL_ROLES },
  { href: '/entradas',              label: 'Entradas',    icon: ArrowDownToLine, roles: ALL_ROLES },
  { href: '/salidas',               label: 'Salidas',     icon: ArrowUpFromLine, roles: ALL_ROLES },
  { href: '/kardex',                label: 'Kardex',      icon: ClipboardList,   roles: ALL_ROLES },
  { href: '/conteo',                label: 'Conteo',      icon: ClipboardCheck,  roles: ALL_ROLES },
  { href: '/reportes/existencias',  label: 'Reportes',    icon: FileBarChart,    roles: ALL_ROLES },
  { href: '/compras',               label: 'Compras',     icon: ShoppingCart,    roles: ADMIN_UP },
  { href: '/proveedores',           label: 'Proveedores', icon: Truck,           roles: ADMIN_UP },
  { href: '/usuarios',              label: 'Usuarios',    icon: Users,           roles: ADMIN_UP },
  { href: '/extractor',             label: 'Extractor',   icon: Download,        roles: ADMIN_UP },
  { href: '/recetas',               label: 'Recetas',     icon: BookOpen,        roles: ADMIN_UP },
  { href: '/merma',                 label: 'Merma',       icon: TrendingDown,    roles: ADMIN_UP },
  { href: '/reporte',               label: 'Análisis',    icon: BarChart3,       roles: ADMIN_UP },
]

interface Props {
  profile: UserProfile
}

export function Sidebar({ profile }: Props) {
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(profile.role))

  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col shrink-0">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-700">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shrink-0">
          <Coffee size={16} className="text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">Gon-Cha</p>
          <p className="text-slate-400 text-xs">Supply Tracker</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          )
        })}
      </nav>

      <UserMenu profile={profile} />
    </aside>
  )
}
