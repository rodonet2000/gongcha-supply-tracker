# Diseño: Auth + Control de Usuarios + Módulos de Inventario
**Fecha:** 2026-06-04  
**Estado:** Aprobado

## Contexto

Portal Gon-Cha Supply Tracker — agregar autenticación, roles de acceso y módulos completos de inventario (entradas, salidas, compras, proveedores, kardex, reportes).

---

## Decisiones de diseño

| Decisión | Elección |
|---|---|
| Autenticación | Supabase Auth (email + password) con `@supabase/ssr` |
| Roles | `sucursal`, `administrador`, `direccion` |
| Multi-sucursal | Modelado desde el inicio (`branch_id` en todas las tablas), una sucursal activa hoy |
| Entradas/Salidas | Manual + automático (salidas teóricas calculadas desde pedidos × recetas) |
| Compras | Simple: proveedor + insumo + cantidad + precio → genera entrada automáticamente |

---

## Base de datos (migración 003)

```sql
gongcha.branches         -- sucursales (id, name, code, active)
gongcha.user_profiles    -- user_id FK auth.users, role, branch_id, full_name
gongcha.suppliers        -- proveedores (name, rfc, contact, active)
gongcha.purchases        -- compras (supplier_id, branch_id, date, total)
gongcha.purchase_items   -- líneas de compra (supply_id, qty, unit_cost)
gongcha.stock_entries    -- entradas (supply_id, branch_id, qty, source: manual|purchase|adjustment)
gongcha.stock_exits      -- salidas (supply_id, branch_id, qty, source: manual|auto|waste)

VIEW gongcha.stock_kardex
  -- saldo acumulado por insumo + sucursal con historial de movimientos
```

---

## Autenticación

- **Paquete:** `@supabase/ssr` (reemplaza `createClient` actual en server.ts)
- **Middleware:** `middleware.ts` — verifica sesión en todas las rutas excepto `/login`
- **Post-login redirect:** `/dashboard`
- **Post-logout redirect:** `/login`
- **Perfil de usuario:** cargado desde `gongcha.user_profiles` via `user_id = auth.uid()`

---

## Control de acceso por ruta

| Ruta | sucursal | administrador | direccion |
|---|---|---|---|
| `/dashboard` | ✅ solo su branch | ✅ todas | ✅ global |
| `/pedidos` | ✅ ver | ✅ ver | ✅ ver |
| `/insumos` | ✅ ver | ✅ editar | ✅ editar |
| `/entradas` `/salidas` | ✅ registrar | ✅ registrar | ✅ ver |
| `/compras` `/proveedores` | ❌ | ✅ gestionar | ✅ gestionar |
| `/kardex` | ✅ consulta | ✅ consulta | ✅ exportar |
| `/reportes/existencias` | ✅ su branch | ✅ todas | ✅ todas |
| `/usuarios` | ❌ | ✅ crear sucursales | ✅ todos |
| `/extractor` `/recetas` | ❌ | ✅ | ✅ |

---

## Páginas nuevas

```
/login
/usuarios
/entradas
/salidas
/compras
/proveedores
/kardex
/reportes/existencias
```

## Componentes clave

- `LoginForm` — email + password, error handling, redirect
- `UserMenu` — nombre, rol, sucursal, cerrar sesión (sidebar footer)
- `RoleGuard` — wrapper server-side que bloquea por rol
- `StockEntryForm` — insumo + cantidad + fecha + motivo
- `KardexTable` — saldo acumulado, exportable a CSV
- `ExistenciasReport` — filtros fecha/insumo/branch + gráfica

---

## Sidebar actualizado

```
Sucursal:      Dashboard | Pedidos | Insumos | Entradas | Salidas | Kardex | Reportes
Administrador: + Compras | Proveedores | Usuarios | Extractor | Recetas
Dirección:     todo anterior (vista global)
```

---

## Orden de implementación

1. Schema DB (migración 003)
2. Instalar `@supabase/ssr`, actualizar clientes Supabase
3. Página `/login` + middleware de autenticación
4. `user_profiles` + gestión de usuarios + sidebar dinámico por rol
5. Módulos Entradas y Salidas (manuales)
6. Módulos Proveedores y Compras (genera entrada automática)
7. Vista Kardex (SQL VIEW + página)
8. Salidas automáticas desde extractor
9. Reporte de existencias
10. Fix visual pedidos (mensaje claro estado vacío)
