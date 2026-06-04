# Auth + Inventory Modules — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Supabase Auth with role-based access (sucursal/administrador/dirección), inventory modules (entradas, salidas, compras, proveedores, kardex, reportes), and fix the pedidos empty-state UX.

**Architecture:** `@supabase/ssr` handles cookie-based sessions in Next.js middleware + Server Components. A separate `service_role` client continues to handle all DB data operations (unchanged). Role is loaded from `gongcha.user_profiles` on each request via the middleware and injected as a header. All new inventory tables live in the `gongcha` schema with `branch_id` for future multi-branch support.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr`, Supabase Auth (self-hosted), `@supabase/supabase-js` (existing, kept for data), PostgreSQL views for kardex/stock summary.

---

## Task 1: Database migration 003

**Files:**
- Create: `supabase/migrations/003_inventory_auth.sql`

**Step 1: Write the migration SQL**

```sql
-- supabase/migrations/003_inventory_auth.sql
-- Auth: branches + user profiles
-- Inventory: suppliers, purchases, stock entries/exits, kardex view

-- ── BRANCHES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.branches (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name      TEXT NOT NULL,
  code      TEXT NOT NULL,
  active    BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_branch_code UNIQUE(code)
);

-- Insert default branch
INSERT INTO gongcha.branches (name, code) VALUES ('Puerto Escondido', 'PTO-ESC')
ON CONFLICT (code) DO NOTHING;

-- ── USER PROFILES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.user_profiles (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'sucursal',
  branch_id  UUID REFERENCES gongcha.branches(id),
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user UNIQUE(user_id),
  CONSTRAINT valid_role CHECK (role IN ('sucursal', 'administrador', 'direccion'))
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON gongcha.user_profiles(user_id);

-- ── SUPPLIERS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.suppliers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  rfc        TEXT,
  contact    TEXT,
  phone      TEXT,
  email      TEXT,
  notes      TEXT,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_supplier_name UNIQUE(name)
);

-- ── PURCHASES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.purchases (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id    UUID NOT NULL REFERENCES gongcha.branches(id),
  supplier_id  UUID REFERENCES gongcha.suppliers(id),
  fecha        DATE NOT NULL,
  folio        TEXT,
  notes        TEXT,
  total        DECIMAL(12,2),
  user_id      UUID NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gongcha.purchase_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES gongcha.purchases(id) ON DELETE CASCADE,
  supply_id   UUID NOT NULL REFERENCES gongcha.supplies(id),
  cantidad    DECIMAL(12,3) NOT NULL,
  unit_cost   DECIMAL(10,4),
  subtotal    DECIMAL(12,2)
);

-- ── STOCK ENTRIES (entradas) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.stock_entries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id   UUID NOT NULL REFERENCES gongcha.branches(id),
  supply_id   UUID NOT NULL REFERENCES gongcha.supplies(id),
  fecha       DATE NOT NULL,
  cantidad    DECIMAL(12,3) NOT NULL,
  unit_cost   DECIMAL(10,4),
  source      TEXT NOT NULL DEFAULT 'manual',
  purchase_id UUID REFERENCES gongcha.purchases(id),
  notes       TEXT,
  user_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_entry_source CHECK (source IN ('manual', 'purchase', 'adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_stock_entries_branch_supply ON gongcha.stock_entries(branch_id, supply_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_fecha ON gongcha.stock_entries(fecha);

-- ── STOCK EXITS (salidas) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gongcha.stock_exits (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id            UUID NOT NULL REFERENCES gongcha.branches(id),
  supply_id            UUID NOT NULL REFERENCES gongcha.supplies(id),
  fecha                DATE NOT NULL,
  cantidad             DECIMAL(12,3) NOT NULL,
  source               TEXT NOT NULL DEFAULT 'manual',
  scraping_session_id  UUID REFERENCES gongcha.scraping_sessions(id),
  notes                TEXT,
  user_id              UUID NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_exit_source CHECK (source IN ('manual', 'auto', 'waste', 'adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_stock_exits_branch_supply ON gongcha.stock_exits(branch_id, supply_id);
CREATE INDEX IF NOT EXISTS idx_stock_exits_fecha ON gongcha.stock_exits(fecha);

-- ── KARDEX VIEW ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW gongcha.stock_kardex AS
WITH movements AS (
  SELECT
    supply_id, branch_id, fecha, 'entrada' AS tipo,
    cantidad, purchase_id::TEXT AS referencia, user_id, created_at, notes
  FROM gongcha.stock_entries
  UNION ALL
  SELECT
    supply_id, branch_id, fecha, source AS tipo,
    cantidad, scraping_session_id::TEXT AS referencia, user_id, created_at, notes
  FROM gongcha.stock_exits
)
SELECT
  m.supply_id,
  s.name        AS supply_name,
  s.unit,
  s.category,
  m.branch_id,
  b.name        AS branch_name,
  m.fecha,
  m.tipo,
  CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END      AS entrada,
  CASE WHEN m.tipo != 'entrada' THEN m.cantidad ELSE 0 END     AS salida,
  SUM(
    CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE -m.cantidad END
  ) OVER (
    PARTITION BY m.supply_id, m.branch_id
    ORDER BY m.fecha, m.created_at
    ROWS UNBOUNDED PRECEDING
  )                                                             AS saldo,
  m.notes       AS referencia,
  m.created_at
FROM movements m
JOIN gongcha.supplies s ON s.id = m.supply_id
JOIN gongcha.branches b ON b.id = m.branch_id;

-- ── STOCK CURRENT (resumen de saldos) ────────────────────────────────────────
CREATE OR REPLACE VIEW gongcha.stock_current AS
SELECT
  supply_id,
  branch_id,
  COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE -cantidad END), 0) AS saldo_actual
FROM (
  SELECT supply_id, branch_id, cantidad, 'entrada' AS tipo FROM gongcha.stock_entries
  UNION ALL
  SELECT supply_id, branch_id, cantidad, 'salida' AS tipo FROM gongcha.stock_exits
) m
GROUP BY supply_id, branch_id;

-- ── GRANTS ────────────────────────────────────────────────────────────────────
GRANT ALL ON gongcha.branches          TO service_role;
GRANT ALL ON gongcha.user_profiles     TO service_role;
GRANT ALL ON gongcha.suppliers         TO service_role;
GRANT ALL ON gongcha.purchases         TO service_role;
GRANT ALL ON gongcha.purchase_items    TO service_role;
GRANT ALL ON gongcha.stock_entries     TO service_role;
GRANT ALL ON gongcha.stock_exits       TO service_role;
GRANT ALL ON gongcha.stock_kardex      TO service_role;
GRANT ALL ON gongcha.stock_current     TO service_role;

GRANT SELECT ON gongcha.branches       TO authenticator, anon, authenticated;
GRANT SELECT ON gongcha.stock_kardex   TO authenticator, anon, authenticated;
GRANT SELECT ON gongcha.stock_current  TO authenticator, anon, authenticated;
```

**Step 2: Apply migration to VPS**

```bash
# From project root — uses the Python+SSH pattern established in previous sessions
python3 scripts/apply-migration.mjs 003_inventory_auth.sql
```

Create `scripts/apply_migration.py`:

```python
#!/usr/bin/env python3
import paramiko, sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('5.252.53.169', username='root', password='Rodonet7012', timeout=15)

sql_file = sys.argv[1]
DB = 'supabase-db-h8occ6uko144qwdes4o43t7r'

sftp = ssh.open_sftp()
sftp.put(f'supabase/migrations/{sql_file}', f'/tmp/{sql_file}')
sftp.close()

ssh.exec_command(f'docker cp /tmp/{sql_file} {DB}:/tmp/{sql_file}')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {DB} psql -U supabase_admin -d postgres -f /tmp/{sql_file} 2>&1'
)
exit_status = stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))
print('Exit:', exit_status)
ssh.close()
```

Run: `python3 scripts/apply_migration.py 003_inventory_auth.sql`
Expected: `CREATE TABLE` × 6, `CREATE VIEW` × 2, `GRANT` × 9

**Step 3: Commit**

```bash
git add supabase/migrations/003_inventory_auth.sql scripts/apply_migration.py
git commit -m "feat: add inventory + auth schema (migration 003)"
```

---

## Task 2: Install @supabase/ssr, update Supabase clients

**Files:**
- Modify: `package.json`
- Modify: `src/shared/lib/supabase/server.ts`
- Modify: `src/shared/lib/supabase/client.ts`
- Create: `src/shared/lib/supabase/middleware.ts`

**Step 1: Install package**

```bash
npm install @supabase/ssr
```

**Step 2: Update `src/shared/lib/supabase/server.ts`**

Replace entire file:

```typescript
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Auth client — reads/writes session cookies. Uses anon key.
export async function createAuthClient() {
  const cookieStore = await cookies()
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Data client — service_role key bypasses RLS. Use for all DB operations.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'gongcha' as unknown as undefined },
      auth: { persistSession: false },
    }
  )
}
```

**Step 3: Update `src/shared/lib/supabase/client.ts`**

```typescript
'use client'

import { createBrowserClient } from '@supabase/ssr'

// Auth browser client — for client components that need session awareness
export function getSupabaseAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 4: Create `src/shared/lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublic = pathname === '/login' || pathname.startsWith('/_next') ||
                   pathname.startsWith('/api') || pathname === '/favicon.ico'

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}
```

**Step 5: Commit**

```bash
git add package.json package-lock.json src/shared/lib/supabase/
git commit -m "feat: add @supabase/ssr auth client alongside data client"
```

---

## Task 3: Middleware + auth actions

**Files:**
- Create: `middleware.ts` (project root, next to `next.config.ts`)
- Create: `src/features/auth/actions/auth-actions.ts`
- Create: `src/shared/lib/user.ts`

**Step 1: Create `middleware.ts`**

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/shared/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Step 2: Create `src/features/auth/actions/auth-actions.ts`**

```typescript
'use server'

import { createAuthClient } from '@/shared/lib/supabase/server'
import { createServerClient } from '@/shared/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserProfile } from '@/shared/types'

export async function signIn(
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createAuthClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: 'Credenciales incorrectas' }
  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createAuthClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getCurrentUser(): Promise<{
  userId: string
  profile: UserProfile
} | null> {
  try {
    const supabase = await createAuthClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const db = createServerClient()
    const { data: profile } = await db
      .from('user_profiles')
      .select('*, branches(name, code)')
      .eq('user_id', user.id)
      .single()

    if (!profile) return null
    return { userId: user.id, profile: profile as UserProfile }
  } catch {
    return null
  }
}
```

**Step 3: Create `src/shared/lib/user.ts`** (lightweight cached version for layouts)

```typescript
import { cache } from 'react'
import { getCurrentUser } from '@/features/auth/actions/auth-actions'

export const getUser = cache(getCurrentUser)
```

**Step 4: Add `UserProfile` type to `src/shared/types/index.ts`**

Append to existing file:

```typescript
export interface Branch {
  id: string
  name: string
  code: string
  active: boolean
}

export type UserRole = 'sucursal' | 'administrador' | 'direccion'

export interface UserProfile {
  id: string
  user_id: string
  full_name: string
  role: UserRole
  branch_id: string | null
  active: boolean
  created_at: string
  branches?: Branch | null
}
```

**Step 5: Commit**

```bash
git add middleware.ts src/features/auth/ src/shared/lib/user.ts src/shared/types/index.ts
git commit -m "feat: add auth middleware and server actions"
```

---

## Task 4: Login page

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/login-form.tsx`

**Step 1: Create `src/app/login/login-form.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { signIn } from '@/features/auth/actions/auth-actions'
import { Coffee } from 'lucide-react'

export function LoginForm() {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center">
            <Coffee size={22} className="text-white" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-slate-900 text-center mb-1">Gon-Cha</h1>
        <p className="text-slate-500 text-sm text-center mb-6">Supply Tracker</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Correo electrónico
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="usuario@gongcha.mx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Contraseña
            </label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium
                       py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {isPending ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 2: Create `src/app/login/page.tsx`**

```tsx
import { LoginForm } from './login-form'

export default function LoginPage() {
  return <LoginForm />
}
```

**Step 3: Update `src/app/page.tsx`** — root now redirects to /login (middleware handles the rest)

```tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/login')
}
```

**Step 4: Commit**

```bash
git add src/app/login/ src/app/page.tsx
git commit -m "feat: add login page with Supabase Auth"
```

---

## Task 5: Layout con UserMenu + Sidebar dinámico por rol

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/shared/components/sidebar.tsx`
- Create: `src/shared/components/user-menu.tsx`

**Step 1: Create `src/shared/components/user-menu.tsx`**

```tsx
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
```

**Step 2: Rewrite `src/shared/components/sidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/shared/lib/utils'
import {
  LayoutDashboard, Download, ShoppingBag, Package, BookOpen,
  BarChart3, Coffee, ArrowDownToLine, ArrowUpFromLine, ShoppingCart,
  Truck, ClipboardList, FileBarChart, Users,
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
  { href: '/reportes/existencias',  label: 'Reportes',    icon: FileBarChart,    roles: ALL_ROLES },
  { href: '/compras',               label: 'Compras',     icon: ShoppingCart,    roles: ADMIN_UP },
  { href: '/proveedores',           label: 'Proveedores', icon: Truck,           roles: ADMIN_UP },
  { href: '/usuarios',              label: 'Usuarios',    icon: Users,           roles: ADMIN_UP },
  { href: '/extractor',             label: 'Extractor',   icon: Download,        roles: ADMIN_UP },
  { href: '/recetas',               label: 'Recetas',     icon: BookOpen,        roles: ADMIN_UP },
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
```

**Step 3: Update `src/app/(dashboard)/layout.tsx`**

```tsx
import { Sidebar } from '@/shared/components/sidebar'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getUser()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={session.profile} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/layout.tsx src/shared/components/
git commit -m "feat: role-aware sidebar + user menu with session"
```

---

## Task 6: Gestión de Usuarios (/usuarios)

**Files:**
- Create: `src/app/(dashboard)/usuarios/page.tsx`
- Create: `src/features/users/actions/user-actions.ts`
- Create: `src/features/users/components/users-manager.tsx`

**Step 1: Create `src/features/users/actions/user-actions.ts`**

```typescript
'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/features/auth/actions/auth-actions'
import type { UserRole } from '@/shared/types'

// Admin client for auth.admin operations
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function getUsers() {
  const db = createServerClient()
  const { data, error } = await db
    .from('user_profiles')
    .select('*, branches(name, code)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getBranches() {
  const db = createServerClient()
  const { data } = await db.from('branches').select('*').eq('active', true)
  return data ?? []
}

export async function createUser(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentUser()
  if (!session || !['administrador', 'direccion'].includes(session.profile.role)) {
    return { success: false, error: 'Sin permisos' }
  }

  const email     = formData.get('email') as string
  const password  = formData.get('password') as string
  const full_name = formData.get('full_name') as string
  const role      = formData.get('role') as UserRole
  const branch_id = formData.get('branch_id') as string || null

  // Sucursal can only create sucursal users
  if (session.profile.role === 'administrador' && role === 'direccion') {
    return { success: false, error: 'Sin permisos para crear dirección' }
  }

  const admin = createAdminClient()
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authErr) return { success: false, error: authErr.message }

  const db = createServerClient()
  const { error: profileErr } = await db.from('user_profiles').insert({
    user_id: authUser.user.id, full_name, role,
    branch_id: branch_id || null,
  })
  if (profileErr) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { success: false, error: profileErr.message }
  }

  revalidatePath('/usuarios')
  return { success: true }
}

export async function toggleUserActive(userId: string, active: boolean) {
  const db = createServerClient()
  await db.from('user_profiles').update({ active }).eq('user_id', userId)
  revalidatePath('/usuarios')
}
```

**Step 2: Create `src/features/users/components/users-manager.tsx`**

```tsx
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
      if (result.success) {
        setShowForm(false)
      } else {
        setError(result.error ?? 'Error')
      }
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
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white
                     px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* Modal */}
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
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium
                             hover:bg-brand-700 disabled:opacity-50">
                  {isPending ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
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
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{u.full_name}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.role === 'direccion' ? 'bg-purple-50 text-purple-700' :
                    u.role === 'administrador' ? 'bg-blue-50 text-blue-700' :
                    'bg-slate-50 text-slate-600'
                  }`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">{u.branches?.name ?? '—'}</td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => startTransition(() => toggleUserActive(u.user_id, !u.active))}
                    className={`flex items-center gap-1 text-xs ${
                      u.active ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
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

function Field({ label, name, type = 'text', placeholder }: {
  label: string; name: string; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input name={name} type={type} placeholder={placeholder} required={label.includes('*')}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  )
}
```

**Step 3: Create `src/app/(dashboard)/usuarios/page.tsx`**

```tsx
export const dynamic = 'force-dynamic'
import { getUsers, getBranches } from '@/features/users/actions/user-actions'
import { UsersManager } from '@/features/users/components/users-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function UsuariosPage() {
  const session = await getUser()
  if (!session) redirect('/login')
  if (!['administrador', 'direccion'].includes(session.profile.role)) redirect('/dashboard')

  const [users, branches] = await Promise.all([getUsers(), getBranches()])

  return <UsersManager users={users} branches={branches} currentRole={session.profile.role} />
}
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/usuarios/ src/features/users/
git commit -m "feat: add user management page with role-based CRUD"
```

---

## Task 7: Módulo Entradas

**Files:**
- Create: `src/features/inventory/actions/entry-actions.ts`
- Create: `src/features/inventory/components/entry-manager.tsx`
- Create: `src/app/(dashboard)/entradas/page.tsx`

**Step 1: Create `src/features/inventory/actions/entry-actions.ts`**

```typescript
'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { getCurrentUser } from '@/features/auth/actions/auth-actions'
import { revalidatePath } from 'next/cache'

export async function getEntries(branchId?: string) {
  const db = createServerClient()
  let query = db
    .from('stock_entries')
    .select('*, supplies(name, unit, category), branches(name)')
    .order('fecha', { ascending: false })
    .limit(100)
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createEntry(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentUser()
  if (!session) return { success: false, error: 'Sin sesión' }

  const supply_id = formData.get('supply_id') as string
  const cantidad  = parseFloat(formData.get('cantidad') as string)
  const fecha     = formData.get('fecha') as string
  const unit_cost = formData.get('unit_cost') ? parseFloat(formData.get('unit_cost') as string) : null
  const notes     = formData.get('notes') as string || null

  const branch_id = session.profile.branch_id
  if (!branch_id) return { success: false, error: 'Usuario sin sucursal asignada' }

  const db = createServerClient()
  const { error } = await db.from('stock_entries').insert({
    supply_id, branch_id, fecha, cantidad, unit_cost,
    source: 'manual', notes, user_id: session.userId,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/entradas')
  revalidatePath('/kardex')
  return { success: true }
}
```

**Step 2: Create `src/features/inventory/components/entry-manager.tsx`**

```tsx
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

interface Props {
  entries: Entry[]
  supplies: Supply[]
}

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
      if (result.success) {
        setShowForm(false)
        ;(e.target as HTMLFormElement).reset()
      } else {
        setError(result.error ?? 'Error')
      }
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
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white
                     px-4 py-2 rounded-lg text-sm font-medium transition-colors">
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
                <select name="supply_id" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecciona un insumo...</option>
                  {supplies.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cantidad *</label>
                  <input name="cantidad" type="number" step="0.001" min="0.001" required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha *</label>
                  <input name="fecha" type="date" required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Costo unitario (MXN)</label>
                <input name="unit_cost" type="number" step="0.0001" min="0"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas / Referencia</label>
                <input name="notes" type="text" placeholder="Número de remisión, observaciones..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium
                             hover:bg-brand-700 disabled:opacity-50">
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
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                    +{e.cantidad} {e.supplies?.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {e.unit_cost != null ? `$${e.unit_cost}` : '—'}
                  </td>
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
```

**Step 3: Create `src/app/(dashboard)/entradas/page.tsx`**

```tsx
export const dynamic = 'force-dynamic'
import { getEntries } from '@/features/inventory/actions/entry-actions'
import { getSupplies } from '@/features/supplies/actions/supply-actions'
import { EntryManager } from '@/features/inventory/components/entry-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function EntradasPage() {
  const session = await getUser()
  if (!session) redirect('/login')

  const branchId = session.profile.role === 'sucursal'
    ? session.profile.branch_id ?? undefined
    : undefined

  const [entries, supplies] = await Promise.all([
    getEntries(branchId).catch(() => []),
    getSupplies().catch(() => []),
  ])

  return <EntryManager entries={entries} supplies={supplies} />
}
```

**Step 4: Commit**

```bash
git add src/features/inventory/actions/entry-actions.ts \
        src/features/inventory/components/entry-manager.tsx \
        src/app/(dashboard)/entradas/
git commit -m "feat: add stock entries module (entradas)"
```

---

## Task 8: Módulo Salidas (mirrors Entradas)

**Files:**
- Create: `src/features/inventory/actions/exit-actions.ts`
- Create: `src/features/inventory/components/exit-manager.tsx`
- Create: `src/app/(dashboard)/salidas/page.tsx`

**Step 1: Create `src/features/inventory/actions/exit-actions.ts`**

```typescript
'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { getCurrentUser } from '@/features/auth/actions/auth-actions'
import { revalidatePath } from 'next/cache'

export async function getExits(branchId?: string) {
  const db = createServerClient()
  let query = db
    .from('stock_exits')
    .select('*, supplies(name, unit, category), branches(name)')
    .order('fecha', { ascending: false })
    .limit(100)
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createExit(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentUser()
  if (!session) return { success: false, error: 'Sin sesión' }

  const supply_id = formData.get('supply_id') as string
  const cantidad  = parseFloat(formData.get('cantidad') as string)
  const fecha     = formData.get('fecha') as string
  const source    = (formData.get('source') as string) || 'manual'
  const notes     = formData.get('notes') as string || null

  const branch_id = session.profile.branch_id
  if (!branch_id) return { success: false, error: 'Usuario sin sucursal asignada' }

  const db = createServerClient()
  const { error } = await db.from('stock_exits').insert({
    supply_id, branch_id, fecha, cantidad, source, notes, user_id: session.userId,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/salidas')
  revalidatePath('/kardex')
  return { success: true }
}
```

**Step 2: Create `src/features/inventory/components/exit-manager.tsx`**

Identical structure to `entry-manager.tsx` but with:
- Title: "Salidas"
- Form source options: `manual` | `waste` (merma) | `adjustment`
- Quantity displayed in red: `-{cantidad}`
- No `unit_cost` field

```tsx
'use client'

import { useState, useTransition } from 'react'
import { createExit } from '../actions/exit-actions'
import { Plus, X } from 'lucide-react'
import type { Supply } from '@/shared/types'

interface Exit {
  id: string; fecha: string; cantidad: number; notes: string | null; source: string
  supplies: { name: string; unit: string; category: string | null } | null
}

interface Props { exits: Exit[]; supplies: Supply[] }

export function ExitManager({ exits, supplies }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createExit(fd)
      if (result.success) { setShowForm(false) } else { setError(result.error ?? 'Error') }
    })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salidas</h1>
          <p className="text-slate-500 text-sm mt-1">Registro de salidas del inventario</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white
                     px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Nueva salida
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">Registrar salida</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Insumo *</label>
                <select name="supply_id" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecciona un insumo...</option>
                  {supplies.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Motivo *</label>
                <select name="source" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="manual">Uso / Consumo manual</option>
                  <option value="waste">Merma / Desperdicio</option>
                  <option value="adjustment">Ajuste de inventario</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cantidad *</label>
                  <input name="cantidad" type="number" step="0.001" min="0.001" required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha *</label>
                  <input name="fecha" type="date" required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas</label>
                <input name="notes" type="text" placeholder="Observaciones..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium
                             hover:bg-red-700 disabled:opacity-50">
                  {isPending ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {exits.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-400 text-sm">No hay salidas registradas.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Insumo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Motivo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cantidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Notas</th>
              </tr>
            </thead>
            <tbody>
              {exits.map(ex => (
                <tr key={ex.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 text-xs">{ex.fecha}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{ex.supplies?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs capitalize">{ex.source}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">
                    -{ex.cantidad} {ex.supplies?.unit}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{ex.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Create `src/app/(dashboard)/salidas/page.tsx`**

```tsx
export const dynamic = 'force-dynamic'
import { getExits } from '@/features/inventory/actions/exit-actions'
import { getSupplies } from '@/features/supplies/actions/supply-actions'
import { ExitManager } from '@/features/inventory/components/exit-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function SalidasPage() {
  const session = await getUser()
  if (!session) redirect('/login')

  const branchId = session.profile.role === 'sucursal'
    ? session.profile.branch_id ?? undefined
    : undefined

  const [exits, supplies] = await Promise.all([
    getExits(branchId).catch(() => []),
    getSupplies().catch(() => []),
  ])

  return <ExitManager exits={exits} supplies={supplies} />
}
```

**Step 4: Commit**

```bash
git add src/features/inventory/actions/exit-actions.ts \
        src/features/inventory/components/exit-manager.tsx \
        src/app/(dashboard)/salidas/
git commit -m "feat: add stock exits module (salidas)"
```

---

## Task 9: Módulo Proveedores

**Files:**
- Create: `src/features/inventory/actions/supplier-actions.ts`
- Create: `src/features/inventory/components/suppliers-manager.tsx`
- Create: `src/app/(dashboard)/proveedores/page.tsx`

**Step 1: Create `src/features/inventory/actions/supplier-actions.ts`**

```typescript
'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getSuppliers() {
  const db = createServerClient()
  const { data, error } = await db
    .from('suppliers')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createSupplier(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const db = createServerClient()
  const { error } = await db.from('suppliers').insert({
    name:    formData.get('name') as string,
    rfc:     (formData.get('rfc') as string) || null,
    contact: (formData.get('contact') as string) || null,
    phone:   (formData.get('phone') as string) || null,
    email:   (formData.get('email') as string) || null,
    notes:   (formData.get('notes') as string) || null,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/proveedores')
  return { success: true }
}

export async function toggleSupplierActive(id: string, active: boolean) {
  const db = createServerClient()
  await db.from('suppliers').update({ active }).eq('id', id)
  revalidatePath('/proveedores')
}
```

**Step 2: Create `src/features/inventory/components/suppliers-manager.tsx`**

CRUD table with columns: Nombre | RFC | Contacto | Teléfono | Email | Estado.
Modal form with fields: name*, rfc, contact, phone, email, notes.
Toggle active/inactive button per row.
(Full implementation mirrors users-manager.tsx pattern — same modal + table pattern.)

**Step 3: Create `src/app/(dashboard)/proveedores/page.tsx`**

```tsx
export const dynamic = 'force-dynamic'
import { getSuppliers } from '@/features/inventory/actions/supplier-actions'
import { SuppliersManager } from '@/features/inventory/components/suppliers-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function ProveedoresPage() {
  const session = await getUser()
  if (!session) redirect('/login')
  if (!['administrador', 'direccion'].includes(session.profile.role)) redirect('/dashboard')

  const suppliers = await getSuppliers().catch(() => [])
  return <SuppliersManager suppliers={suppliers} />
}
```

**Step 4: Commit**

```bash
git add src/features/inventory/actions/supplier-actions.ts \
        src/features/inventory/components/suppliers-manager.tsx \
        src/app/(dashboard)/proveedores/
git commit -m "feat: add suppliers management (proveedores)"
```

---

## Task 10: Módulo Compras (genera Entrada automáticamente)

**Files:**
- Create: `src/features/inventory/actions/purchase-actions.ts`
- Create: `src/features/inventory/components/purchase-manager.tsx`
- Create: `src/app/(dashboard)/compras/page.tsx`

**Step 1: Create `src/features/inventory/actions/purchase-actions.ts`**

Key logic: `createPurchase` inserts into `purchases` + `purchase_items` + one `stock_entry` per item with `source='purchase'`.

```typescript
'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import { getCurrentUser } from '@/features/auth/actions/auth-actions'
import { revalidatePath } from 'next/cache'

export async function getPurchases(branchId?: string) {
  const db = createServerClient()
  let query = db
    .from('purchases')
    .select('*, suppliers(name), branches(name), purchase_items(*, supplies(name, unit))')
    .order('fecha', { ascending: false })
    .limit(50)
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export type PurchaseItemInput = {
  supply_id: string
  cantidad: number
  unit_cost: number | null
}

export async function createPurchase(
  meta: { supplier_id: string | null; fecha: string; folio: string; notes: string },
  items: PurchaseItemInput[]
): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentUser()
  if (!session) return { success: false, error: 'Sin sesión' }

  const branch_id = session.profile.branch_id
  if (!branch_id) return { success: false, error: 'Usuario sin sucursal asignada' }

  if (items.length === 0) return { success: false, error: 'Agrega al menos un insumo' }

  const total = items.reduce((s, i) => s + (i.cantidad * (i.unit_cost ?? 0)), 0)
  const db = createServerClient()

  // 1. Insert purchase header
  const { data: purchase, error: purchaseErr } = await db
    .from('purchases')
    .insert({
      branch_id,
      supplier_id: meta.supplier_id || null,
      fecha: meta.fecha,
      folio: meta.folio || null,
      notes: meta.notes || null,
      total,
      user_id: session.userId,
    })
    .select()
    .single()

  if (purchaseErr || !purchase) return { success: false, error: purchaseErr?.message }

  // 2. Insert purchase items + stock entries (one per item)
  const purchaseItems = items.map(i => ({
    purchase_id: purchase.id,
    supply_id: i.supply_id,
    cantidad: i.cantidad,
    unit_cost: i.unit_cost,
    subtotal: i.cantidad * (i.unit_cost ?? 0),
  }))

  const stockEntries = items.map(i => ({
    branch_id,
    supply_id: i.supply_id,
    fecha: meta.fecha,
    cantidad: i.cantidad,
    unit_cost: i.unit_cost,
    source: 'purchase' as const,
    purchase_id: purchase.id,
    notes: `Compra ${meta.folio || purchase.id}`,
    user_id: session.userId,
  }))

  const [{ error: itemsErr }, { error: entryErr }] = await Promise.all([
    db.from('purchase_items').insert(purchaseItems),
    db.from('stock_entries').insert(stockEntries),
  ])

  if (itemsErr || entryErr) return { success: false, error: itemsErr?.message ?? entryErr?.message }

  revalidatePath('/compras')
  revalidatePath('/entradas')
  revalidatePath('/kardex')
  return { success: true }
}
```

**Step 2: Create `src/features/inventory/components/purchase-manager.tsx`**

Two-stage form:
- Stage 1: Proveedor, fecha, folio, notas
- Stage 2: Add items (supply_id + cantidad + unit_cost) with a dynamic list
- On submit: calls `createPurchase(meta, items)`

Table shows: Fecha | Proveedor | Folio | # items | Total | expand to see items.

**Step 3: Create `src/app/(dashboard)/compras/page.tsx`**

```tsx
export const dynamic = 'force-dynamic'
import { getPurchases } from '@/features/inventory/actions/purchase-actions'
import { getSuppliers } from '@/features/inventory/actions/supplier-actions'
import { getSupplies } from '@/features/supplies/actions/supply-actions'
import { PurchaseManager } from '@/features/inventory/components/purchase-manager'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function ComprasPage() {
  const session = await getUser()
  if (!session) redirect('/login')
  if (!['administrador', 'direccion'].includes(session.profile.role)) redirect('/dashboard')

  const branchId = session.profile.branch_id ?? undefined
  const [purchases, suppliers, supplies] = await Promise.all([
    getPurchases(branchId).catch(() => []),
    getSuppliers().catch(() => []),
    getSupplies().catch(() => []),
  ])

  return <PurchaseManager purchases={purchases} suppliers={suppliers} supplies={supplies} />
}
```

**Step 4: Commit**

```bash
git add src/features/inventory/actions/purchase-actions.ts \
        src/features/inventory/components/purchase-manager.tsx \
        src/app/(dashboard)/compras/
git commit -m "feat: add purchases module — auto-generates stock entry"
```

---

## Task 11: Kardex

**Files:**
- Create: `src/features/inventory/actions/kardex-actions.ts`
- Create: `src/features/inventory/components/kardex-table.tsx`
- Create: `src/app/(dashboard)/kardex/page.tsx`

**Step 1: Create `src/features/inventory/actions/kardex-actions.ts`**

```typescript
'use server'

import { createServerClient } from '@/shared/lib/supabase/server'

export async function getKardex(branchId?: string, supplyId?: string) {
  const db = createServerClient()
  let query = db
    .from('stock_kardex')
    .select('*')
    .order('supply_name', { ascending: true })
    .order('fecha', { ascending: true })
    .limit(500)
  if (branchId) query = query.eq('branch_id', branchId)
  if (supplyId) query = query.eq('supply_id', supplyId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getCurrentStock(branchId?: string) {
  const db = createServerClient()
  let query = db
    .from('stock_current')
    .select('*, supplies(name, unit, category), branches(name)')
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).filter(r => (r.saldo_actual ?? 0) !== 0)
}
```

**Step 2: Create `src/features/inventory/components/kardex-table.tsx`**

```tsx
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

interface Props {
  kardex: StockRow[]
  currentStock: CurrentRow[]
}

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
            className="flex items-center gap-2 border border-slate-300 text-slate-600
                       hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors">
            <Download size={15} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Buscar insumo..."
          className="w-64 border border-slate-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
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
                <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm">
                  Sin existencias registradas
                </td></tr>
              ) : filteredCurrent.map(r => (
                <tr key={`${r.supply_id}-${r.branch_id}`} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.supplies?.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs capitalize">{r.supplies?.category ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.branches?.name}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${
                    r.saldo_actual > 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
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
              {kardex.filter(r => r.supply_name.toLowerCase().includes(filter.toLowerCase())).map((r, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.fecha}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.supply_name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs capitalize">{r.tipo}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{r.entrada > 0 ? r.entrada : '—'}</td>
                  <td className="px-4 py-3 text-right text-red-500">{r.salida > 0 ? r.salida : '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${
                    r.saldo > 0 ? 'text-slate-800' : 'text-red-500'
                  }`}>{r.saldo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Create `src/app/(dashboard)/kardex/page.tsx`**

```tsx
export const dynamic = 'force-dynamic'
import { getKardex, getCurrentStock } from '@/features/inventory/actions/kardex-actions'
import { KardexTable } from '@/features/inventory/components/kardex-table'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'

export default async function KardexPage() {
  const session = await getUser()
  if (!session) redirect('/login')

  const branchId = session.profile.role === 'sucursal'
    ? session.profile.branch_id ?? undefined
    : undefined

  const [kardex, currentStock] = await Promise.all([
    getKardex(branchId).catch(() => []),
    getCurrentStock(branchId).catch(() => []),
  ])

  return <KardexTable kardex={kardex} currentStock={currentStock} />
}
```

**Step 4: Commit**

```bash
git add src/features/inventory/actions/kardex-actions.ts \
        src/features/inventory/components/kardex-table.tsx \
        src/app/(dashboard)/kardex/
git commit -m "feat: add kardex view (stock movements + current balance)"
```

---

## Task 12: Salidas automáticas desde Extractor

**Files:**
- Modify: `src/features/scraper/actions/scrape-actions.ts`

**Step 1: Find the session completion point in scrape-actions.ts**

After a scraping session is marked `status: 'completed'`, calculate and insert stock exits.

**Step 2: Add `calculateAndInsertAutoExits` function**

```typescript
// Add inside scrape-actions.ts

async function calculateAndInsertAutoExits(
  sessionId: string,
  weekStart: string,
  branchId: string,
  userId: string
): Promise<void> {
  const supabase = createServerClient()

  // Get all orders for this week
  const { data: items } = await supabase
    .from('order_items')
    .select('item_name, quantity, order_id, orders!inner(week_start)')
    .eq('orders.week_start', weekStart)

  if (!items?.length) return

  // Aggregate quantities by item_name
  const itemCounts: Record<string, number> = {}
  for (const item of items) {
    itemCounts[item.item_name] = (itemCounts[item.item_name] ?? 0) + item.quantity
  }

  // Get all modifiers for these orders
  const orderIds = [...new Set(items.map(i => i.order_id))]
  const { data: mods } = await supabase
    .from('order_item_modifiers')
    .select('modifier_name, quantity, order_item_id, order_items!inner(order_id)')
    .in('order_items.order_id', orderIds)

  const modCounts: Record<string, number> = {}
  for (const mod of mods ?? []) {
    modCounts[mod.modifier_name] = (modCounts[mod.modifier_name] ?? 0) + mod.quantity
  }

  // Get recipes
  const { data: recipes } = await supabase
    .from('recipes')
    .select('quantity, supply_id, menu_items(name), size')

  // Get modifier requirements
  const { data: modReqs } = await supabase
    .from('modifier_supply_requirements')
    .select('modifier_name, supply_id, quantity, is_override')

  // Calculate total supply consumption
  const supplyConsumption: Record<string, number> = {}

  for (const recipe of recipes ?? []) {
    const menuName = (recipe.menu_items as { name: string } | null)?.name ?? ''
    const orderedQty = itemCounts[menuName] ?? 0
    if (orderedQty === 0) continue
    const supplyId = recipe.supply_id
    supplyConsumption[supplyId] = (supplyConsumption[supplyId] ?? 0) + recipe.quantity * orderedQty
  }

  for (const req of modReqs ?? []) {
    const modQty = modCounts[req.modifier_name] ?? 0
    if (modQty === 0) continue
    supplyConsumption[req.supply_id] = (supplyConsumption[req.supply_id] ?? 0) + req.quantity * modQty
  }

  // Insert stock exits
  const exits = Object.entries(supplyConsumption)
    .filter(([, qty]) => qty > 0)
    .map(([supply_id, cantidad]) => ({
      branch_id: branchId,
      supply_id,
      fecha: weekStart,
      cantidad: Math.round(cantidad * 1000) / 1000,
      source: 'auto' as const,
      scraping_session_id: sessionId,
      notes: `Auto — semana ${weekStart}`,
      user_id: userId,
    }))

  if (exits.length > 0) {
    await supabase.from('stock_exits').insert(exits)
  }
}
```

**Step 3: Call it when session completes**

Find where scraping session status is set to 'completed' and add:

```typescript
// After session.status = 'completed', before return:
const defaultBranch = await supabase
  .from('branches')
  .select('id')
  .eq('active', true)
  .limit(1)
  .single()

if (defaultBranch.data) {
  await calculateAndInsertAutoExits(
    sessionId, weekStart, defaultBranch.data.id, userId
  ).catch(err => console.error('[auto-exits] Error:', err))
}
```

**Step 4: Commit**

```bash
git add src/features/scraper/actions/scrape-actions.ts
git commit -m "feat: auto-calculate stock exits from completed scraping sessions"
```

---

## Task 13: Reporte de Existencias

**Files:**
- Create: `src/features/inventory/actions/report-actions.ts`
- Create: `src/features/inventory/components/existencias-report.tsx`
- Create: `src/app/(dashboard)/reportes/existencias/page.tsx`

**Step 1: Create `src/features/inventory/actions/report-actions.ts`**

```typescript
'use server'

import { createServerClient } from '@/shared/lib/supabase/server'

export async function getExistenciasReport(params: {
  branchId?: string
  dateFrom?: string
  dateTo?: string
  category?: string
}) {
  const db = createServerClient()
  const { dateFrom, dateTo, branchId, category } = params

  // Summary: current stock per supply per branch
  let stockQuery = db
    .from('stock_current')
    .select('*, supplies(name, unit, category, cost_per_unit), branches(name)')
  if (branchId) stockQuery = stockQuery.eq('branch_id', branchId)
  const { data: stock } = await stockQuery

  // Movement totals in date range
  let entryQuery = db
    .from('stock_entries')
    .select('supply_id, branch_id, cantidad, fecha, supplies(name, unit, category)')
  if (branchId)  entryQuery = entryQuery.eq('branch_id', branchId)
  if (dateFrom)  entryQuery = entryQuery.gte('fecha', dateFrom)
  if (dateTo)    entryQuery = entryQuery.lte('fecha', dateTo)
  const { data: entries } = await entryQuery

  let exitQuery = db
    .from('stock_exits')
    .select('supply_id, branch_id, cantidad, fecha, source, supplies(name, unit, category)')
  if (branchId) exitQuery = exitQuery.eq('branch_id', branchId)
  if (dateFrom) exitQuery = exitQuery.gte('fecha', dateFrom)
  if (dateTo)   exitQuery = exitQuery.lte('fecha', dateTo)
  const { data: exits } = await exitQuery

  return {
    stock: stock ?? [],
    entries: entries ?? [],
    exits: exits ?? [],
  }
}
```

**Step 2: Create page with filter form + summary table + totals**

```tsx
// src/app/(dashboard)/reportes/existencias/page.tsx
export const dynamic = 'force-dynamic'
import { getExistenciasReport } from '@/features/inventory/actions/report-actions'
import { getUser } from '@/shared/lib/user'
import { redirect } from 'next/navigation'
import { ExistenciasReport } from '@/features/inventory/components/existencias-report'

interface Props {
  searchParams: Promise<{ from?: string; to?: string; branch?: string; category?: string }>
}

export default async function ExistenciasPage({ searchParams }: Props) {
  const session = await getUser()
  if (!session) redirect('/login')

  const params = await searchParams
  const branchId = session.profile.role === 'sucursal'
    ? session.profile.branch_id ?? undefined
    : params.branch

  const report = await getExistenciasReport({
    branchId,
    dateFrom: params.from,
    dateTo: params.to,
    category: params.category,
  }).catch(() => ({ stock: [], entries: [], exits: [] }))

  return <ExistenciasReport report={report} role={session.profile.role} />
}
```

**Step 3: Commit**

```bash
git add src/features/inventory/actions/report-actions.ts \
        src/features/inventory/components/existencias-report.tsx \
        src/app/(dashboard)/reportes/existencias/
git commit -m "feat: add existencias report (stock in/out summary)"
```

---

## Task 14: Fix Pedidos empty-state message

**Files:**
- Modify: `src/app/(dashboard)/pedidos/page.tsx`

**Step 1: Update empty state JSX**

Find:
```tsx
<p className="text-slate-400 text-sm">No hay pedidos para esta semana.</p>
<Link href="/extractor" className="text-brand-600 text-sm hover:underline mt-2 inline-block">
  Extraer datos →
</Link>
```

Replace with:
```tsx
<div className="flex flex-col items-center gap-3">
  <p className="text-slate-400 text-sm font-medium">No hay pedidos para esta semana.</p>
  <p className="text-slate-400 text-xs max-w-sm text-center">
    Los pedidos aparecerán aquí después de ejecutar el extractor de Foodbot.
    El extractor descarga los pedidos semanales automáticamente.
  </p>
  <Link
    href="/extractor"
    className="mt-2 bg-brand-600 hover:bg-brand-700 text-white text-sm
               font-medium px-4 py-2 rounded-lg transition-colors"
  >
    Ir al Extractor →
  </Link>
</div>
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/pedidos/page.tsx
git commit -m "fix: improve pedidos empty state with clear call-to-action"
```

---

## Task 15: Apply migration + deploy

**Step 1: Apply migration 003 to VPS**

```bash
python3 scripts/apply_migration.py 003_inventory_auth.sql
```

Expected: Tables created, grants applied, no errors.

**Step 2: Create initial dirección user in Supabase Auth**

```bash
# Via Supabase Studio (http://5.252.53.169:8800 → project → SQL Editor)
# OR via curl to Supabase Auth Admin API:
curl -X POST \
  -H "apikey: SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gongcha.mx","password":"GonCha2026!","email_confirm":true}' \
  "http://5.252.53.169:8000/auth/v1/admin/users"
```

Then insert user_profile:
```sql
-- In Supabase Studio SQL Editor
INSERT INTO gongcha.user_profiles (user_id, full_name, role, branch_id)
VALUES (
  '<UUID from previous step>',
  'Administrador',
  'direccion',
  (SELECT id FROM gongcha.branches WHERE code = 'PTO-ESC')
);
```

**Step 3: Push all commits and build new Docker image**

```bash
git push origin master
# Then on VPS:
# git -C /tmp/gongcha-build pull origin master
# docker build -t vcdnk6xkka5qk3btoaqdxv9e:$(git rev-parse --short HEAD) /tmp/gongcha-build
# Update docker-compose.yaml image tag
# docker compose up -d --force-recreate
# Update Traefik config with new container IP
```

**Step 4: Smoke test**

1. `https://gongcha.rodosoft.digital/login` → shows login form
2. Login with `admin@gongcha.mx` / `GonCha2026!` → redirects to `/dashboard`
3. Sidebar shows all admin items
4. `/usuarios` → can create new user
5. `/entradas` → form opens, can register entry
6. `/salidas` → form opens, can register exit
7. `/compras` → access denied for sucursal, accessible for admin
8. `/kardex` → shows saldo actual tab (empty until entries/exits added)
9. `/pedidos` → shows improved empty-state message with button
10. Logout → redirects to `/login`
