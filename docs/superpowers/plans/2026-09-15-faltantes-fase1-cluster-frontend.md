# Faltantes Frontend Fase 1 — Cluster frontend-only (F1, F3, F5, F6, F10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar 5 de las 12 tareas de `tareas_faltantes_frontend_fase_1.md` que son 100% resolubles sin tocar `supabase/` (migraciones/Edge Functions): F10 (RoleGuard fail-closed), F1+F6 (ocultar costos por rol), F5 (notificaciones reales en el Header), F3 (separar Inventario en dos menús: Productos y Vehículos).

**Architecture:** Todo vive en `frontend/`. F10 mueve la verificación de rol+activo al `middleware.ts` (Edge, corre antes de cualquier página) y refuerza `RoleGuard`/`getCurrentProfile` como segunda capa. F1/F6 agregan un flag `puedeVerCostos` calculado server-side (`CAN_VIEW_COSTS` en `roles.ts`) y pasado como prop a los componentes cliente que hoy muestran `valor_unitario`/`valor_total`. F5 agrega una función de conteo (`fetchStockBajoCount`) y convierte el `Header` en un componente con props reales. F3 reutiliza `InventoryTable` (ya soporta ambos formatos de datos vía el flag `fuente`) parametrizando qué función de carga usa, y agrega una ruta nueva `/vehiculos` que reutiliza `fetchInventarioVehiculos` (ya existe, hoy sin usar).

**Tech Stack:** Next.js middleware (Edge runtime), Supabase SSR client (ya usado). Sin dependencias nuevas.

## Global Constraints

- TypeScript `strict: true`, sin `any`.
- No se toca nada bajo `supabase/` en este plan — F4, F7, F8, F9, F12 quedan explícitamente fuera (dependen de trabajo de backend no hecho todavía).
- Roles que SÍ ven costos (`valor_unitario`/`valor_total`): `supervisor`, `compras`, `auditoria`. Todos los demás (`comercial`, `ingenieria`, `produccion`, `lectura`, `metalmecanica`, `instalacion`) no deben verlos en ningún lado: tabla de Inventario/Vehículos, CSV exportado, detalle de movimiento, KPI del Dashboard.
- Esto es ocultamiento a nivel de UI únicamente — los datos siguen viajando en la respuesta de Supabase (RLS actual no los enmascara). Es una mitigación real pero no es defensa en profundidad completa; eso requeriría una vista/columna enmascarada en Supabase (fuera de alcance de este plan, ver `docs` sobre F1 dependiendo de "B3").
- `RoleGuard` sigue existiendo y usándose en cada página (no se elimina) — el middleware es una capa ADICIONAL fail-closed, no un reemplazo.
- El bypass de desarrollo (`isDevBypassActive()`) se mantiene sin cambios de comportamiento — todas las funciones nuevas o modificadas respetan la rama de bypass existente.

---

### Task 1: Helpers compartidos en `roles.ts` y `activo` en `Profile`

**Files:**
- Modify: `frontend/lib/permissions/roles.ts`
- Modify: `frontend/lib/types/database.ts`
- Modify: `frontend/lib/dev/preview-bypass.ts`

**Interfaces:**
- Produces: `CAN_VIEW_COSTS: readonly Role[]`, `getRouteKeyForPath(pathname: string): RouteKey | null`, nueva entrada `RouteKey` `'vehiculos'` con su `ROUTE_PERMISSIONS`/`NAV_ITEMS`, desde `@/lib/permissions/roles`; `Profile.activo: boolean` desde `@/lib/types/database`. Tasks 2, 3 y 5 importan estos nombres exactos.

- [ ] **Step 1: Reescribir `lib/permissions/roles.ts`**

Contenido actual completo (para referencia — va a cambiar en varios puntos):

```ts
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  FilePlus,
  SlidersHorizontal,
  Upload,
  Users,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import { ALL_ROLES, type Role } from '@/lib/types/database'

export type RouteKey =
  | 'dashboard'
  | 'inventario'
  | 'movimientos'
  | 'formularios'
  | 'entradas'
  | 'ajustes'
  | 'importar'
  | 'usuarios'

export const ROUTE_PERMISSIONS: Record<RouteKey, readonly Role[]> = {
  dashboard: ALL_ROLES,
  inventario: ALL_ROLES,
  movimientos: ['supervisor', 'ingenieria', 'auditoria'] as const,
  formularios: ALL_ROLES,
  entradas: ['supervisor', 'produccion', 'compras'] as const,
  ajustes: ['supervisor', 'produccion', 'compras'] as const,
  importar: ['supervisor', 'compras'] as const,
  usuarios: ['supervisor'] as const,
}

export const NAV_ITEMS: {
  key: RouteKey
  label: string
  href: string
  icon: LucideIcon
}[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'inventario', label: 'Inventario', href: '/inventario', icon: Package },
  { key: 'movimientos', label: 'Movimientos', href: '/movimientos', icon: ArrowLeftRight },
  { key: 'formularios', label: 'Formularios', href: '/formularios', icon: ClipboardList },
  { key: 'entradas', label: 'Entradas', href: '/entradas', icon: FilePlus },
  { key: 'ajustes', label: 'Ajustes', href: '/ajustes', icon: SlidersHorizontal },
  { key: 'importar', label: 'Importar CSV', href: '/importar', icon: Upload },
  { key: 'usuarios', label: 'Usuarios', href: '/usuarios', icon: Users },
]
```

Reemplázalo por:

```ts
import {
  LayoutDashboard,
  Package,
  Car,
  ArrowLeftRight,
  FilePlus,
  SlidersHorizontal,
  Upload,
  Users,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import { ALL_ROLES, type Role } from '@/lib/types/database'

export type RouteKey =
  | 'dashboard'
  | 'inventario'
  | 'vehiculos'
  | 'movimientos'
  | 'formularios'
  | 'entradas'
  | 'ajustes'
  | 'importar'
  | 'usuarios'

export const ROUTE_PERMISSIONS: Record<RouteKey, readonly Role[]> = {
  dashboard: ALL_ROLES,
  inventario: ALL_ROLES,
  vehiculos: ALL_ROLES,
  movimientos: ['supervisor', 'ingenieria', 'auditoria'] as const,
  formularios: ALL_ROLES,
  entradas: ['supervisor', 'produccion', 'compras'] as const,
  ajustes: ['supervisor', 'produccion', 'compras'] as const,
  importar: ['supervisor', 'compras'] as const,
  usuarios: ['supervisor'] as const,
}

/** Roles que pueden ver valor_unitario/valor_total en cualquier pantalla. */
export const CAN_VIEW_COSTS: readonly Role[] = ['supervisor', 'compras', 'auditoria']

export const NAV_ITEMS: {
  key: RouteKey
  label: string
  href: string
  icon: LucideIcon
}[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'inventario', label: 'Inventario', href: '/inventario', icon: Package },
  { key: 'vehiculos', label: 'Vehículos (VIN)', href: '/vehiculos', icon: Car },
  { key: 'movimientos', label: 'Movimientos', href: '/movimientos', icon: ArrowLeftRight },
  { key: 'formularios', label: 'Formularios', href: '/formularios', icon: ClipboardList },
  { key: 'entradas', label: 'Entradas', href: '/entradas', icon: FilePlus },
  { key: 'ajustes', label: 'Ajustes', href: '/ajustes', icon: SlidersHorizontal },
  { key: 'importar', label: 'Importar CSV', href: '/importar', icon: Upload },
  { key: 'usuarios', label: 'Usuarios', href: '/usuarios', icon: Users },
]

/** Resuelve un pathname exacto a su RouteKey, o null si no es una ruta controlada por ROUTE_PERMISSIONS (ej. /login, /acceso-denegado). */
export function getRouteKeyForPath(pathname: string): RouteKey | null {
  const item = NAV_ITEMS.find((i) => i.href === pathname)
  return item ? item.key : null
}
```

- [ ] **Step 2: Agregar `activo` al tipo `Profile`**

En `frontend/lib/types/database.ts`, el archivo completo actual es:

```ts
export type Role =
  | 'supervisor'
  | 'comercial'
  | 'ingenieria'
  | 'produccion'
  | 'compras'
  | 'auditoria'
  | 'lectura'
  | 'metalmecanica'
  | 'instalacion'

const ROLE_SET: Record<Role, true> = {
  supervisor: true,
  comercial: true,
  ingenieria: true,
  produccion: true,
  compras: true,
  auditoria: true,
  lectura: true,
  metalmecanica: true,
  instalacion: true,
}

export const ROLE_LABELS: Record<Role, string> = {
  supervisor: 'Supervisor',
  comercial: 'Comercial',
  ingenieria: 'Ingeniería',
  produccion: 'Producción',
  compras: 'Compras',
  auditoria: 'Auditoría',
  lectura: 'Solo lectura',
  metalmecanica: 'Metalmecánica',
  instalacion: 'Instalación',
}

export const ALL_ROLES: readonly Role[] = Object.keys(ROLE_SET) as Role[]

export interface Profile {
  id: string
  nombre: string | null
  rol: Role
}
```

Cambia solo la interfaz `Profile` al final, de:

```ts
export interface Profile {
  id: string
  nombre: string | null
  rol: Role
}
```

a:

```ts
export interface Profile {
  id: string
  nombre: string | null
  rol: Role
  activo: boolean
}
```

- [ ] **Step 3: Completar `activo` en el perfil de bypass dev**

En `frontend/lib/dev/preview-bypass.ts`, cambia la última línea de `getDevPreviewProfile`:

```ts
  return { id: 'dev-preview-user', nombre: 'Vista Previa Dev', rol }
```

por:

```ts
  return { id: 'dev-preview-user', nombre: 'Vista Previa Dev', rol, activo: true }
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: **fallará** en este punto — `get-current-profile.ts` todavía selecciona `'id, nombre, rol'` sin `activo`, lo que no satisface el nuevo campo requerido del tipo `Profile`. Eso se corrige en el Task 2. Confirma que el único error reportado es sobre `activo` faltante en `get-current-profile.ts` (archivo que toca el Task 2) — si hay cualquier otro error, detente y repórtalo antes de continuar.

- [ ] **Step 5: Commit**

```bash
git add lib/permissions/roles.ts lib/types/database.ts lib/dev/preview-bypass.ts
git commit -m "feat: agregar helpers de permisos compartidos (costos, ruta vehiculos, activo)"
```

---

### Task 2 (F10): RoleGuard fail-closed + verificación en middleware

**Files:**
- Modify: `frontend/middleware.ts`
- Modify: `frontend/lib/supabase/get-current-profile.ts`
- Modify: `frontend/components/shared/RoleGuard.tsx`

**Interfaces:**
- Consumes: `getRouteKeyForPath`, `ROUTE_PERMISSIONS` desde `@/lib/permissions/roles` (Task 1); `Role` desde `@/lib/types/database` (Task 1).
- Produces: nada nuevo — refuerza el flujo de auth ya existente.

- [ ] **Step 1: Reescribir `middleware.ts`**

Contenido actual completo:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'

export async function middleware(request: NextRequest) {
  if (isDevBypassActive()) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
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

  let user = null
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser()
    user = fetchedUser
  } catch {
    user = null
  }

  const isLoginPage = request.nextUrl.pathname === '/login'

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

Reemplázalo por:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getRouteKeyForPath, ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import type { Role } from '@/lib/types/database'

export async function middleware(request: NextRequest) {
  if (isDevBypassActive()) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
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

  let user = null
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser()
    user = fetchedUser
  } catch {
    user = null
  }

  const isLoginPage = request.nextUrl.pathname === '/login'

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (user) {
    const routeKey = getRouteKeyForPath(request.nextUrl.pathname)

    if (routeKey) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('rol, activo')
        .eq('id', user.id)
        .single<{ rol: Role; activo: boolean }>()

      const permitido =
        !error && !!profile && profile.activo && ROUTE_PERMISSIONS[routeKey].includes(profile.rol)

      if (!permitido) {
        const url = request.nextUrl.clone()
        url.pathname = '/acceso-denegado'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Agregar `activo` al select de `getCurrentProfile`**

En `frontend/lib/supabase/get-current-profile.ts`, cambia:

```ts
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, nombre, rol')
    .eq('id', user.id)
    .single<Profile>()
```

por:

```ts
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, nombre, rol, activo')
    .eq('id', user.id)
    .single<Profile>()
```

- [ ] **Step 3: Reforzar `RoleGuard` con el chequeo de `activo`**

En `frontend/components/shared/RoleGuard.tsx`, cambia:

```tsx
  if (result.status === 'no-profile' || !allowed.includes(result.profile.rol)) {
    redirect('/acceso-denegado')
  }
```

por:

```tsx
  if (
    result.status === 'no-profile' ||
    !result.profile.activo ||
    !allowed.includes(result.profile.rol)
  ) {
    redirect('/acceso-denegado')
  }
```

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit` — esperado exit 0 (esto también resuelve el error pendiente del Task 1).
Run: `npm run build` — esperado exit 0.

- [ ] **Step 5: Verificar con curl (bypass dev, sin cambios de comportamiento esperados)**

Confirma `frontend/.env.local` con `DEV_SKIP_AUTH=true` y `DEV_SKIP_AUTH_ROLE=supervisor` (el middleware se salta por completo en bypass — este chequeo solo confirma que nada se rompió). Corre `npm run dev` (background — mata cualquier servidor previo en el puerto 3000 primero), luego:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/inventario
```

Expected: ambos `200`. Detén el servidor de dev después.

- [ ] **Step 6: Commit**

```bash
git add middleware.ts lib/supabase/get-current-profile.ts components/shared/RoleGuard.tsx
git commit -m "feat: hacer RoleGuard fail-closed via middleware y validar activo"
```

---

### Task 3 (F1 + F6): Ocultar costos por rol

**Files:**
- Modify: `frontend/components/inventario/InventoryTable.tsx`
- Modify: `frontend/app/(panel)/inventario/page.tsx`
- Modify: `frontend/components/movimientos/MovementDetailDialog.tsx`
- Modify: `frontend/components/movimientos/MovementsTable.tsx`
- Modify: `frontend/app/(panel)/movimientos/page.tsx`
- Modify: `frontend/app/(panel)/page.tsx`

**Interfaces:**
- Consumes: `CAN_VIEW_COSTS` desde `@/lib/permissions/roles` (Task 1); `getCurrentProfile` (ya existente).
- Produces: `InventoryTable` gana la prop `puedeVerCostos: boolean` (requerida); `MovementsTable` y `MovementDetailDialog` ganan la misma prop.

- [ ] **Step 1: `InventoryTable` — agregar la prop y ocultar columnas/CSV**

En `frontend/components/inventario/InventoryTable.tsx`:

Cambia la firma del componente de:

```tsx
export function InventoryTable() {
```

a:

```tsx
export function InventoryTable({ puedeVerCostos }: { puedeVerCostos: boolean }) {
```

Cambia `handleExportarCsv` — de:

```tsx
  function handleExportarCsv() {
    const esExcel = fuente === 'excel'
    const encabezados = esExcel
      ? ['Código', 'Nombre', 'Categoría', 'Ubicación', 'Unidad', 'Saldo', 'Valor Unitario', 'Valor Total']
      : ['VIN', 'Marca', 'Categoría', 'Ubicación', 'Saldo', 'Valor Unitario', 'Valor Total', 'Último Movimiento']

    const filasCsv = filas.map((item) => {
      const base = esExcel
        ? [
            item.codigo,
            item.nombre ?? '',
            item.categoria ?? '',
            item.ubicacion ?? '',
            item.unidad ?? '',
            item.saldo,
            item.valor_unitario ?? '',
            item.valor_total,
          ]
        : [
            item.vin ?? item.codigo,
            item.marca ?? '',
            item.categoria ?? '',
            item.ubicacion ?? '',
            item.saldo,
            item.valor_unitario ?? '',
            item.valor_total,
            item.ultimo_movimiento ?? '',
          ]
      return base.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(',')
    })

    const csv = [encabezados.join(','), ...filasCsv].join('\n')
```

a:

```tsx
  function handleExportarCsv() {
    const esExcel = fuente === 'excel'
    const encabezadosCosto = puedeVerCostos ? ['Valor Unitario', 'Valor Total'] : []
    const encabezados = esExcel
      ? ['Código', 'Nombre', 'Categoría', 'Ubicación', 'Unidad', 'Saldo', ...encabezadosCosto]
      : ['VIN', 'Marca', 'Categoría', 'Ubicación', 'Saldo', ...encabezadosCosto, 'Último Movimiento']

    const filasCsv = filas.map((item) => {
      const valoresCosto = puedeVerCostos ? [item.valor_unitario ?? '', item.valor_total] : []
      const base = esExcel
        ? [
            item.codigo,
            item.nombre ?? '',
            item.categoria ?? '',
            item.ubicacion ?? '',
            item.unidad ?? '',
            item.saldo,
            ...valoresCosto,
          ]
        : [
            item.vin ?? item.codigo,
            item.marca ?? '',
            item.categoria ?? '',
            item.ubicacion ?? '',
            item.saldo,
            ...valoresCosto,
            item.ultimo_movimiento ?? '',
          ]
      return base.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(',')
    })

    const csv = [encabezados.join(','), ...filasCsv].join('\n')
```

Cambia la tabla — de:

```tsx
              <TableHead className="whitespace-nowrap text-right">Saldo</TableHead>
              <TableHead className="whitespace-nowrap text-right">Valor unit.</TableHead>
              <TableHead className="whitespace-nowrap text-right">Valor total</TableHead>
              {!esExcel && <TableHead className="whitespace-nowrap">Último mov.</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={esExcel ? 8 : 8} className="text-center text-muted-foreground">
```

a:

```tsx
              <TableHead className="whitespace-nowrap text-right">Saldo</TableHead>
              {puedeVerCostos && (
                <>
                  <TableHead className="whitespace-nowrap text-right">Valor unit.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Valor total</TableHead>
                </>
              )}
              {!esExcel && <TableHead className="whitespace-nowrap">Último mov.</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={puedeVerCostos ? 8 : 6}
                  className="text-center text-muted-foreground"
                >
```

Y cambia las celdas de valor — de:

```tsx
                  <TableCell className="text-right">
                    {item.valor_unitario != null ? formatCOP(item.valor_unitario) : '—'}
                  </TableCell>
                  <TableCell className="text-right">{formatCOP(item.valor_total)}</TableCell>
                  {!esExcel && (
```

a:

```tsx
                  {puedeVerCostos && (
                    <>
                      <TableCell className="text-right">
                        {item.valor_unitario != null ? formatCOP(item.valor_unitario) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{formatCOP(item.valor_total)}</TableCell>
                    </>
                  )}
                  {!esExcel && (
```

- [ ] **Step 2: `inventario/page.tsx` — calcular y pasar `puedeVerCostos`**

Contenido actual completo:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { InventoryTable } from '@/components/inventario/InventoryTable'

export default function InventarioPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.inventario}>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <InventoryTable />
      </div>
    </RoleGuard>
  )
}
```

Reemplázalo por:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS, CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { InventoryTable } from '@/components/inventario/InventoryTable'

export default function InventarioPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.inventario}>
      <InventarioContent />
    </RoleGuard>
  )
}

async function InventarioContent() {
  const result = await getCurrentProfile()
  const puedeVerCostos =
    result.status === 'authenticated' && CAN_VIEW_COSTS.includes(result.profile.rol)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inventario</h1>
      <InventoryTable puedeVerCostos={puedeVerCostos} />
    </div>
  )
}
```

- [ ] **Step 3: `MovementDetailDialog` — agregar la prop y ocultar Valor Unitario**

En `frontend/components/movimientos/MovementDetailDialog.tsx`, cambia la firma de:

```tsx
export function MovementDetailDialog({
  movimiento,
  open,
  onOpenChange,
}: {
  movimiento: MovimientoDetalle | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
```

a:

```tsx
export function MovementDetailDialog({
  movimiento,
  open,
  onOpenChange,
  puedeVerCostos,
}: {
  movimiento: MovimientoDetalle | null
  open: boolean
  onOpenChange: (open: boolean) => void
  puedeVerCostos: boolean
}) {
```

Y cambia:

```tsx
            <dt className="text-muted-foreground">Valor Unitario</dt>
            <dd>{movimiento.valor_unitario ? formatCOP(movimiento.valor_unitario) : '—'}</dd>
```

a:

```tsx
            {puedeVerCostos && (
              <>
                <dt className="text-muted-foreground">Valor Unitario</dt>
                <dd>{movimiento.valor_unitario ? formatCOP(movimiento.valor_unitario) : '—'}</dd>
              </>
            )}
```

- [ ] **Step 4: `MovementsTable` — recibir y reenviar la prop**

En `frontend/components/movimientos/MovementsTable.tsx`, cambia la firma de:

```tsx
export function MovementsTable() {
```

a:

```tsx
export function MovementsTable({ puedeVerCostos }: { puedeVerCostos: boolean }) {
```

Y cambia el uso del diálogo al final del archivo, de:

```tsx
      <MovementDetailDialog
        movimiento={seleccionado}
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
      />
```

a:

```tsx
      <MovementDetailDialog
        movimiento={seleccionado}
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        puedeVerCostos={puedeVerCostos}
      />
```

- [ ] **Step 5: `movimientos/page.tsx` — calcular y pasar `puedeVerCostos`**

Contenido actual completo:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { MovementsTable } from '@/components/movimientos/MovementsTable'

export default function MovimientosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.movimientos}>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Movimientos</h1>
        <MovementsTable />
      </div>
    </RoleGuard>
  )
}
```

Reemplázalo por:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS, CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { MovementsTable } from '@/components/movimientos/MovementsTable'

export default function MovimientosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.movimientos}>
      <MovimientosContent />
    </RoleGuard>
  )
}

async function MovimientosContent() {
  const result = await getCurrentProfile()
  const puedeVerCostos =
    result.status === 'authenticated' && CAN_VIEW_COSTS.includes(result.profile.rol)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Movimientos</h1>
      <MovementsTable puedeVerCostos={puedeVerCostos} />
    </div>
  )
}
```

- [ ] **Step 6: Dashboard — ocultar el KPI "Valor Total del Inventario"**

En `frontend/app/(panel)/page.tsx`, agrega el import:

```ts
import { CAN_VIEW_COSTS } from '@/lib/permissions/roles'
```

Dentro de `DashboardContent`, después de la línea `const data = await getDashboardData()`, agrega:

```ts
  const puedeVerCostos = CAN_VIEW_COSTS.includes(result.profile.rol)
```

Y cambia el bloque de KPIs, de:

```tsx
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Total Unidades en Stock"
          value={formatNumber(data.totalUnidades)}
          icon={Package}
        />
        <KpiCard
          label="Valor Total del Inventario"
          value={formatCOP(data.valorTotal)}
          icon={DollarSign}
        />
        <KpiCard
          label="Movimientos del Día"
          value={formatNumber(data.movimientosHoy)}
          icon={ArrowLeftRight}
        />
        <KpiCard
          label="VINs con Stock Bajo"
          value={formatNumber(data.stockBajo)}
          icon={AlertTriangle}
        />
      </div>
```

a:

```tsx
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Total Unidades en Stock"
          value={formatNumber(data.totalUnidades)}
          icon={Package}
        />
        {puedeVerCostos && (
          <KpiCard
            label="Valor Total del Inventario"
            value={formatCOP(data.valorTotal)}
            icon={DollarSign}
          />
        )}
        <KpiCard
          label="Movimientos del Día"
          value={formatNumber(data.movimientosHoy)}
          icon={ArrowLeftRight}
        />
        <KpiCard
          label="VINs con Stock Bajo"
          value={formatNumber(data.stockBajo)}
          icon={AlertTriangle}
        />
      </div>
```

- [ ] **Step 7: Verificar tipos y build**

Run: `npx tsc --noEmit` — esperado exit 0.
Run: `npm run build` — esperado exit 0.

- [ ] **Step 8: Verificar con curl (dos roles)**

Con `frontend/.env.local` en `DEV_SKIP_AUTH_ROLE=supervisor`, corre `npm run dev` (background) y:

```bash
curl -s http://localhost:3000/ | grep -o "Valor Total del Inventario"
```

Expected: presente (supervisor ve costos). Cambia a `DEV_SKIP_AUTH_ROLE=comercial`, reinicia el server, repite:

```bash
curl -s http://localhost:3000/ | grep -o "Valor Total del Inventario"
```

Expected: **ausente** (comercial no ve costos). Restaura `DEV_SKIP_AUTH_ROLE=supervisor` y detén el servidor.

- [ ] **Step 9: Commit**

```bash
git add components/inventario/InventoryTable.tsx "app/(panel)/inventario/page.tsx" components/movimientos/MovementDetailDialog.tsx components/movimientos/MovementsTable.tsx "app/(panel)/movimientos/page.tsx" "app/(panel)/page.tsx"
git commit -m "feat: ocultar valor_unitario y valor_total segun rol (F1, F6)"
```

---

### Task 4 (F5): Notificaciones reales en el Header

**Files:**
- Modify: `frontend/lib/supabase/inventario-saldos-actions.ts`
- Modify: `frontend/components/layout/Header.tsx`
- Modify: `frontend/app/(panel)/layout.tsx`

**Interfaces:**
- Consumes: `isDevBypassActive` (ya existente); `createClient` (ya existente); `fetchAjustesPendientesCount` (ya existente).
- Produces: `fetchStockBajoCount(): Promise<number>` desde `@/lib/supabase/inventario-saldos-actions`; `Header` gana las props `ajustesPendientes?: number` y `stockBajo?: number`.

- [ ] **Step 1: Agregar `fetchStockBajoCount`**

En `frontend/lib/supabase/inventario-saldos-actions.ts`, agrega el import de `isDevBypassActive` a la lista de imports existente al inicio del archivo (junto a los otros imports de `@/lib/...`):

```ts
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
```

Y agrega esta función al final del archivo:

```ts

const STOCK_BAJO_THRESHOLD = 2

export async function fetchStockBajoCount(): Promise<number> {
  if (isDevBypassActive()) {
    return 3
  }

  const supabase = await createClient()

  const { count, error } = await supabase
    .from('inventario_saldos')
    .select('codigo', { count: 'exact', head: true })
    .gt('saldo', 0)
    .lte('saldo', STOCK_BAJO_THRESHOLD)

  if (error) {
    console.error('Failed to count stock bajo:', error)
    return 0
  }

  return count ?? 0
}
```

- [ ] **Step 2: Reescribir `Header.tsx` con contenido real**

Contenido actual completo:

```tsx
import { Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Header() {
  return (
    <header className="flex items-center justify-end gap-4 border-b border-border bg-card px-6 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="text-muted-foreground hover:text-foreground"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
            Notificaciones
          </p>
          <DropdownMenuSeparator />
          <p className="px-1.5 py-6 text-center text-sm text-muted-foreground">
            No tienes notificaciones.
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

Reemplázalo por:

```tsx
import { Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Header({
  ajustesPendientes,
  stockBajo,
}: {
  ajustesPendientes?: number
  stockBajo?: number
}) {
  const items: string[] = []
  if (ajustesPendientes && ajustesPendientes > 0) {
    items.push(
      `${ajustesPendientes} ajuste${ajustesPendientes === 1 ? '' : 's'} pendiente${
        ajustesPendientes === 1 ? '' : 's'
      } de tu aprobación.`
    )
  }
  if (stockBajo && stockBajo > 0) {
    items.push(`${stockBajo} producto${stockBajo === 1 ? '' : 's'} con stock bajo.`)
  }

  return (
    <header className="flex items-center justify-end gap-4 border-b border-border bg-card px-6 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          {items.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {items.length}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
            Notificaciones
          </p>
          <DropdownMenuSeparator />
          {items.length === 0 ? (
            <p className="px-1.5 py-6 text-center text-sm text-muted-foreground">
              No tienes notificaciones.
            </p>
          ) : (
            <ul className="space-y-1 px-1.5 py-2">
              {items.map((texto, i) => (
                <li key={i} className="rounded-md px-1.5 py-1.5 text-sm">
                  {texto}
                </li>
              ))}
            </ul>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

- [ ] **Step 3: Pasar los conteos desde el layout del panel**

Contenido actual completo de `frontend/app/(panel)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { fetchAjustesPendientesCount } from '@/lib/supabase/ajustes-actions'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export const dynamic = 'force-dynamic'

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const result = await getCurrentProfile()

  if (result.status === 'no-session') {
    redirect('/login')
  }

  if (result.status === 'no-profile') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p>No se pudo cargar tu perfil. Contacta a un administrador.</p>
      </div>
    )
  }

  const ajustesPendientes =
    result.profile.rol === 'supervisor' ? await fetchAjustesPendientesCount() : undefined

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar profile={result.profile} ajustesPendientes={ajustesPendientes} />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

Reemplázalo por:

```tsx
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { fetchAjustesPendientesCount } from '@/lib/supabase/ajustes-actions'
import { fetchStockBajoCount } from '@/lib/supabase/inventario-saldos-actions'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export const dynamic = 'force-dynamic'

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const result = await getCurrentProfile()

  if (result.status === 'no-session') {
    redirect('/login')
  }

  if (result.status === 'no-profile') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p>No se pudo cargar tu perfil. Contacta a un administrador.</p>
      </div>
    )
  }

  const ajustesPendientes =
    result.profile.rol === 'supervisor' ? await fetchAjustesPendientesCount() : undefined
  const stockBajo = await fetchStockBajoCount()

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar profile={result.profile} ajustesPendientes={ajustesPendientes} />
      <div className="flex flex-1 flex-col">
        <Header ajustesPendientes={ajustesPendientes} stockBajo={stockBajo} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit` — esperado exit 0.
Run: `npm run build` — esperado exit 0.

- [ ] **Step 5: Verificar con curl**

Con `DEV_SKIP_AUTH_ROLE=supervisor`, corre `npm run dev` (background) y:

```bash
curl -s http://localhost:3000/ | grep -o "producto.*con stock bajo\|No tienes notificaciones"
```

Expected: alguna coincidencia relacionada a "stock bajo" en el HTML server-renderizado (el contenido del dropdown en sí solo se ve al abrir, pero el conteo llega server-side como prop). Detén el servidor después.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/inventario-saldos-actions.ts components/layout/Header.tsx "app/(panel)/layout.tsx"
git commit -m "feat: mostrar notificaciones reales en el Header (ajustes y stock bajo)"
```

---

### Task 5 (F3): Separar Inventario en dos menús (Productos y Vehículos)

**Files:**
- Modify: `frontend/components/inventario/InventoryTable.tsx`
- Create: `frontend/app/(panel)/vehiculos/page.tsx`
- Modify: `frontend/lib/supabase/inventario-actions.ts`

**Interfaces:**
- Consumes: `fetchInventarioVehiculos` desde `@/lib/supabase/inventario-actions` (ya existe); `fetchInventario`, `INVENTARIO_PAGE_SIZE` desde `@/lib/supabase/get-inventario` (ya existe); `ROUTE_PERMISSIONS.vehiculos`, `CAN_VIEW_COSTS` desde `@/lib/permissions/roles` (Task 1).
- Produces: `InventoryTable` gana una prop opcional `fetchFn`; nueva ruta `/vehiculos`.

Nota: este Task se ejecuta DESPUÉS del Task 3 (que ya modificó `InventoryTable.tsx` y `inventario/page.tsx`) — parte del archivo ya tiene la prop `puedeVerCostos` agregada por el Task 3. Los cambios de este Task se suman a esos, no los reemplazan.

- [ ] **Step 1: Quitar el comentario "legacy" — la función ya se va a usar**

En `frontend/lib/supabase/inventario-actions.ts`, cambia:

```ts
/** Inventario de vehículos (VIN) — vista legacy, no usada en /inventario por defecto */
export async function fetchInventarioVehiculos(
```

a:

```ts
/** Inventario de vehículos (VIN), usado por la ruta /vehiculos. */
export async function fetchInventarioVehiculos(
```

- [ ] **Step 2: `InventoryTable` — agregar la prop opcional `fetchFn`**

En `frontend/components/inventario/InventoryTable.tsx`, cambia el import de:

```tsx
import { fetchInventario, INVENTARIO_PAGE_SIZE } from '@/lib/supabase/get-inventario'
```

a:

```tsx
import { fetchInventario, INVENTARIO_PAGE_SIZE } from '@/lib/supabase/get-inventario'
import type { InventarioPagina } from '@/lib/types/inventario'
```

(si `InventarioPagina` ya está importado en la línea del `import type { InventarioFiltros, InventarioItem } from '@/lib/types/inventario'` existente, en vez de agregar una línea nueva simplemente agrega `InventarioPagina` a esa lista de tipos importados).

Cambia la firma del componente (ya modificada por el Task 3) de:

```tsx
export function InventoryTable({ puedeVerCostos }: { puedeVerCostos: boolean }) {
```

a:

```tsx
export function InventoryTable({
  puedeVerCostos,
  fetchFn = fetchInventario,
}: {
  puedeVerCostos: boolean
  fetchFn?: (filtros: InventarioFiltros, pagina: number) => Promise<InventarioPagina>
}) {
```

Y dentro del `useEffect`, cambia la llamada `fetchInventario(filtros, pagina)` por `fetchFn(filtros, pagina)`:

```tsx
      fetchInventario(filtros, pagina)
```

a:

```tsx
      fetchFn(filtros, pagina)
```

- [ ] **Step 3: Crear la página `/vehiculos`**

Create `frontend/app/(panel)/vehiculos/page.tsx`:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS, CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { fetchInventarioVehiculos } from '@/lib/supabase/inventario-actions'
import { InventoryTable } from '@/components/inventario/InventoryTable'

export default function VehiculosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.vehiculos}>
      <VehiculosContent />
    </RoleGuard>
  )
}

async function VehiculosContent() {
  const result = await getCurrentProfile()
  const puedeVerCostos =
    result.status === 'authenticated' && CAN_VIEW_COSTS.includes(result.profile.rol)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Vehículos (VIN)</h1>
      <InventoryTable puedeVerCostos={puedeVerCostos} fetchFn={fetchInventarioVehiculos} />
    </div>
  )
}
```

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit` — esperado exit 0.
Run: `npm run build` — esperado exit 0 (debe listar `/vehiculos` como ruta nueva).

- [ ] **Step 5: Verificar con curl**

Con `DEV_SKIP_AUTH_ROLE=supervisor`, corre `npm run dev` (background) y:

```bash
curl -s http://localhost:3000/vehiculos | grep -o "Vehículos (VIN)\|VIN"
curl -s http://localhost:3000/inventario | grep -o "Inventario"
```

Expected: la primera muestra contenido de la página de vehículos, la segunda sigue mostrando Inventario normalmente (sin romper nada). Detén el servidor después.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/inventario-actions.ts components/inventario/InventoryTable.tsx "app/(panel)/vehiculos/page.tsx"
git commit -m "feat: separar Inventario y Vehiculos (VIN) en menus distintos (F3)"
```

---

## After This Plan

1. Verificación manual en navegador real: probar el flujo de fail-closed (un rol sin permiso a una ruta debe caer en `/acceso-denegado`, un usuario `activo=false` debe caer también) — necesita un usuario real desactivado en Supabase, no solo curl.
2. Quedan bloqueadas F4, F7, F8, F9, F12 (dependen de trabajo en `supabase/` no hecho, o de infraestructura de deploy) y F11 (QA manual, no es una tarea de código).
3. F2 (Dashboard distinto por rol) queda para un plan separado — es una decisión de diseño más grande (qué ve cada rol), no encaja en este cluster mecánico.
4. La ocultación de costos (F1/F6) es solo de UI — para defensa en profundidad real se necesitaría enmascarar `valor_unitario`/`valor_total` también en Supabase (columna/vista con RLS), que es justamente la tarea "B3" que el documento marca como dependencia externa.
