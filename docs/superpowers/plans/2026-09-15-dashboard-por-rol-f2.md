# Dashboard por rol (F2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el Dashboard muestre una variante distinta de widgets según el rol del usuario, en vez del mismo home para los 9 roles.

**Architecture:** Un mapeo estático `Role → DashboardVariante` (7 variantes). `getDashboardData` gana un parámetro opcional para pedir más o menos movimientos recientes (10 por defecto, 25 para la variante `bitacora`). Dos componentes nuevos y genéricos (`QuickLinksCard`, `LowStockList`) se reutilizan entre variantes. `app/(panel)/page.tsx` calcula la variante server-side y renderiza condicionalmente cada bloque — todo sigue siendo un único árbol de Server Component, sin rutas nuevas.

**Tech Stack:** Igual que el resto del Dashboard (Server Components + Client Components ya existentes). Sin dependencias nuevas.

## Global Constraints

- TypeScript `strict: true`, sin `any`.
- Ningún widget debe mostrar `valor_unitario`/`valor_total` a un rol fuera de `CAN_VIEW_COSTS` (ya establecido en F1) — todas las variantes respetan `puedeVerCostos`, ninguna lo pasa por alto.
- La variante `instalacion` NO implementa tracking de fase del vehículo (eso sigue bloqueado, es un subsistema grande aparte) — su tabla es literalmente `UltimosMovimientosTable` reetiquetada, no una feature nueva.
- No se crean rutas nuevas ni se modifica `RoleGuard`/`middleware` — este plan es exclusivamente sobre qué widgets renderiza `/` (el Dashboard) según el rol.

---

### Task 1: Mapeo de variantes y datos nuevos

**Files:**
- Create: `frontend/lib/permissions/dashboard-variante.ts`
- Modify: `frontend/lib/supabase/get-dashboard-data.ts`
- Modify: `frontend/lib/dev/preview-dashboard-data.ts`
- Modify: `frontend/lib/supabase/inventario-saldos-actions.ts`

**Interfaces:**
- Consumes: `Role` desde `@/lib/types/database`; `isDevBypassActive`, `createClient` (ya existentes).
- Produces: `DashboardVariante`, `VARIANTE_POR_ROL` desde `@/lib/permissions/dashboard-variante`; `getDashboardData(limiteMovimientos?: number)` con nueva firma; `fetchProductosBajoStock(limite: number): Promise<{codigo, nombre, saldo}[]>` desde `@/lib/supabase/inventario-saldos-actions`. Task 3 importa estos nombres exactos.

- [ ] **Step 1: Crear el mapeo de variantes**

Create `frontend/lib/permissions/dashboard-variante.ts`:

```ts
import type { Role } from '@/lib/types/database'

export type DashboardVariante =
  | 'completo'
  | 'comercial'
  | 'compras'
  | 'taller'
  | 'instalacion'
  | 'bitacora'
  | 'basico'

export const VARIANTE_POR_ROL: Record<Role, DashboardVariante> = {
  supervisor: 'completo',
  comercial: 'comercial',
  compras: 'compras',
  produccion: 'taller',
  metalmecanica: 'taller',
  instalacion: 'instalacion',
  auditoria: 'bitacora',
  ingenieria: 'bitacora',
  lectura: 'basico',
}
```

- [ ] **Step 2: Parametrizar el límite de movimientos en `getDashboardData`**

En `frontend/lib/supabase/get-dashboard-data.ts`, cambia:

```ts
export async function getDashboardData(): Promise<DashboardData> {
  if (isDevBypassActive()) {
    return getDevPreviewDashboardData()
  }
```

a:

```ts
export async function getDashboardData(limiteMovimientos: number = 10): Promise<DashboardData> {
  if (isDevBypassActive()) {
    return getDevPreviewDashboardData(limiteMovimientos)
  }
```

Y más abajo, dentro del `Promise.all`, cambia:

```ts
      supabase
        .from('vista_movimientos_recientes')
        .select('id, vin, tipo_movimiento, cantidad, actor_nombre, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
```

a:

```ts
      supabase
        .from('vista_movimientos_recientes')
        .select('id, vin, tipo_movimiento, cantidad, actor_nombre, created_at')
        .order('created_at', { ascending: false })
        .limit(limiteMovimientos),
```

- [ ] **Step 3: Parametrizar el generador de datos de ejemplo**

En `frontend/lib/dev/preview-dashboard-data.ts`, cambia:

```ts
export function getDevPreviewDashboardData(): DashboardData {
```

a:

```ts
export function getDevPreviewDashboardData(limiteMovimientos: number = 10): DashboardData {
```

Y cambia:

```ts
  const ultimosMovimientos: MovimientoReciente[] = Array.from({ length: 10 }, (_, i) => ({
```

a:

```ts
  const ultimosMovimientos: MovimientoReciente[] = Array.from({ length: limiteMovimientos }, (_, i) => ({
```

- [ ] **Step 4: Agregar `fetchProductosBajoStock`**

En `frontend/lib/supabase/inventario-saldos-actions.ts`, agrega esta función al final del archivo (después de `fetchStockBajoCount`, reutiliza la constante `STOCK_BAJO_THRESHOLD` ya definida ahí):

```ts

export async function fetchProductosBajoStock(
  limite: number
): Promise<{ codigo: string; nombre: string | null; saldo: number }[]> {
  if (isDevBypassActive()) {
    return Array.from({ length: Math.min(limite, 5) }, (_, i) => ({
      codigo: `PRD-${1000 + i}`,
      nombre: `Producto de ejemplo ${i + 1}`,
      saldo: i + 1,
    }))
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inventario_saldos')
    .select('codigo, nombre, saldo')
    .gt('saldo', 0)
    .lte('saldo', STOCK_BAJO_THRESHOLD)
    .order('saldo', { ascending: true })
    .limit(limite)

  if (error) {
    console.error('Failed to load productos bajo stock:', error)
    return []
  }

  return data ?? []
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/permissions/dashboard-variante.ts lib/supabase/get-dashboard-data.ts lib/dev/preview-dashboard-data.ts lib/supabase/inventario-saldos-actions.ts
git commit -m "feat: agregar mapeo de variantes de dashboard y datos de stock bajo por producto"
```

---

### Task 2: Componentes compartidos `QuickLinksCard` y `LowStockList`

**Files:**
- Create: `frontend/components/dashboard/QuickLinksCard.tsx`
- Create: `frontend/components/dashboard/LowStockList.tsx`

**Interfaces:**
- Consumes: `Card`/`CardContent`/`CardHeader`/`CardTitle`, `Table` family (ya instalados); `formatNumber` (ya existente).
- Produces: `QuickLinksCard({titulo?, enlaces})`, `LowStockList({productos})`, `ProductoBajoStock` (tipo) desde `@/components/dashboard/LowStockList`. Task 3 importa estos nombres exactos.

- [ ] **Step 1: Crear QuickLinksCard**

Create `frontend/components/dashboard/QuickLinksCard.tsx`:

```tsx
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function QuickLinksCard({
  titulo = 'Accesos rápidos',
  enlaces,
}: {
  titulo?: string
  enlaces: { label: string; href: string; icon: LucideIcon }[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {enlaces.map((enlace) => {
          const Icon = enlace.icon
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className="flex flex-col items-center gap-2 rounded-md border p-4 text-center text-sm transition-colors hover:bg-accent"
            >
              <Icon className="h-5 w-5 text-primary" />
              {enlace.label}
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Crear LowStockList**

Create `frontend/components/dashboard/LowStockList.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/format'

export interface ProductoBajoStock {
  codigo: string
  nombre: string | null
  saldo: number
}

export function LowStockList({ productos }: { productos: ProductoBajoStock[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos con stock bajo</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Sin productos en stock bajo.
                </TableCell>
              </TableRow>
            ) : (
              productos.map((p) => (
                <TableRow key={p.codigo}>
                  <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                  <TableCell>{p.nombre ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.saldo)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/QuickLinksCard.tsx components/dashboard/LowStockList.tsx
git commit -m "feat: agregar componentes QuickLinksCard y LowStockList"
```

---

### Task 3: Reescribir el Dashboard con branching por variante

**Files:**
- Modify: `frontend/app/(panel)/page.tsx`

**Interfaces:**
- Consumes: `VARIANTE_POR_ROL` desde `@/lib/permissions/dashboard-variante` (Task 1); `getDashboardData(limiteMovimientos?)`, `fetchProductosBajoStock` (Task 1); `QuickLinksCard`, `LowStockList` (Task 2); `CAN_VIEW_COSTS` (ya existente).
- Produces: nada nuevo — última tarea de este plan.

- [ ] **Step 1: Reescribir `app/(panel)/page.tsx`**

Contenido actual completo:

```tsx
import { AlertTriangle, ArrowLeftRight, DollarSign, Package } from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { getDashboardData } from '@/lib/supabase/get-dashboard-data'
import { formatCOP, formatNumber } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { CalendarWidget } from '@/components/dashboard/CalendarWidget'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { UltimosMovimientosTable } from '@/components/dashboard/UltimosMovimientosTable'
import { RealtimeRefresher } from '@/components/dashboard/RealtimeRefresher'

export default function DashboardPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.dashboard}>
      <DashboardContent />
    </RoleGuard>
  )
}

async function DashboardContent() {
  const result = await getCurrentProfile()

  if (result.status !== 'authenticated') {
    // Unreachable in practice — RoleGuard already redirected before this
    // renders if there's no session or no profile.
    return null
  }

  const data = await getDashboardData()
  const puedeVerCostos = CAN_VIEW_COSTS.includes(result.profile.rol)

  return (
    <div className="space-y-6">
      <CalendarWidget />

      <div>
        <h1 className="text-2xl font-semibold">
          Bienvenido, {result.profile.nombre ?? result.user.email}
        </h1>
        <p className="text-muted-foreground">Rol: {result.profile.rol}</p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Entradas vs Salidas (últimos 7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <EntradasSalidasChart data={data.entradasVsSalidas} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <UltimosMovimientosTable movimientos={data.ultimosMovimientos} />
        </CardContent>
      </Card>

      <RealtimeRefresher />
    </div>
  )
}
```

Reemplázalo por:

```tsx
import {
  AlertTriangle,
  ArrowLeftRight,
  Car,
  ClipboardList,
  DollarSign,
  FilePlus,
  Package,
  SlidersHorizontal,
  Upload,
} from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS, CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import { VARIANTE_POR_ROL } from '@/lib/permissions/dashboard-variante'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { getDashboardData } from '@/lib/supabase/get-dashboard-data'
import { fetchProductosBajoStock } from '@/lib/supabase/inventario-saldos-actions'
import { formatCOP, formatNumber } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { CalendarWidget } from '@/components/dashboard/CalendarWidget'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { UltimosMovimientosTable } from '@/components/dashboard/UltimosMovimientosTable'
import { RealtimeRefresher } from '@/components/dashboard/RealtimeRefresher'
import { QuickLinksCard } from '@/components/dashboard/QuickLinksCard'
import { LowStockList } from '@/components/dashboard/LowStockList'

export default function DashboardPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.dashboard}>
      <DashboardContent />
    </RoleGuard>
  )
}

async function DashboardContent() {
  const result = await getCurrentProfile()

  if (result.status !== 'authenticated') {
    // Unreachable in practice — RoleGuard already redirected before this
    // renders if there's no session or no profile.
    return null
  }

  const variante = VARIANTE_POR_ROL[result.profile.rol]
  const puedeVerCostos = CAN_VIEW_COSTS.includes(result.profile.rol)
  const data = await getDashboardData(variante === 'bitacora' ? 25 : 10)
  const productosBajoStock = variante === 'compras' ? await fetchProductosBajoStock(5) : []

  return (
    <div className="space-y-6">
      {variante !== 'bitacora' && variante !== 'basico' && <CalendarWidget />}

      <div>
        <h1 className="text-2xl font-semibold">
          Bienvenido, {result.profile.nombre ?? result.user.email}
        </h1>
        <p className="text-muted-foreground">Rol: {result.profile.rol}</p>
      </div>

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
        {variante !== 'basico' && (
          <KpiCard
            label="Movimientos del Día"
            value={formatNumber(data.movimientosHoy)}
            icon={ArrowLeftRight}
          />
        )}
        <KpiCard
          label="VINs con Stock Bajo"
          value={formatNumber(data.stockBajo)}
          icon={AlertTriangle}
        />
      </div>

      {(variante === 'completo' || variante === 'comercial' || variante === 'compras') && (
        <Card>
          <CardHeader>
            <CardTitle>Entradas vs Salidas (últimos 7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <EntradasSalidasChart data={data.entradasVsSalidas} />
          </CardContent>
        </Card>
      )}

      {variante === 'compras' && <LowStockList productos={productosBajoStock} />}

      {variante === 'comercial' && (
        <QuickLinksCard
          enlaces={[
            { label: 'Vehículos (VIN)', href: '/vehiculos', icon: Car },
            { label: 'Inventario', href: '/inventario', icon: Package },
          ]}
        />
      )}

      {variante === 'compras' && (
        <QuickLinksCard
          enlaces={[
            { label: 'Importar CSV', href: '/importar', icon: Upload },
            { label: 'Entradas', href: '/entradas', icon: FilePlus },
          ]}
        />
      )}

      {variante === 'taller' && (
        <QuickLinksCard
          enlaces={[
            { label: 'Vehículos (VIN)', href: '/vehiculos', icon: Car },
            { label: 'Formularios', href: '/formularios', icon: ClipboardList },
            { label: 'Ajustes', href: '/ajustes', icon: SlidersHorizontal },
          ]}
        />
      )}

      {variante === 'instalacion' && (
        <QuickLinksCard enlaces={[{ label: 'Vehículos (VIN)', href: '/vehiculos', icon: Car }]} />
      )}

      {variante !== 'basico' && (
        <Card>
          <CardHeader>
            <CardTitle>
              {variante === 'bitacora'
                ? 'Bitácora de actividad'
                : variante === 'instalacion'
                  ? 'Vehículos con movimiento reciente'
                  : 'Últimos movimientos'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UltimosMovimientosTable movimientos={data.ultimosMovimientos} />
          </CardContent>
        </Card>
      )}

      <RealtimeRefresher />
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos y build**

Run: `npx tsc --noEmit` — esperado exit 0.
Run: `npm run build` — esperado exit 0.

- [ ] **Step 3: Verificar con curl (varios roles)**

Con `DEV_SKIP_AUTH_ROLE=supervisor`, corre `npm run dev` (background, matando cualquier servidor previo en 3000) y:

```bash
curl -s http://localhost:3000/ | grep -o "Entradas vs Salidas\|Últimos movimientos"
```

Expected: ambos presentes (variante `completo`). Cambia a `DEV_SKIP_AUTH_ROLE=compras`, reinicia el server:

```bash
curl -s http://localhost:3000/ | grep -o "Productos con stock bajo\|Accesos rápidos"
```

Expected: ambos presentes. Cambia a `DEV_SKIP_AUTH_ROLE=lectura`, reinicia el server:

```bash
curl -s http://localhost:3000/ | grep -o "Movimientos del Día\|Últimos movimientos\|Accesos rápidos"
```

Expected: **ninguno presente** (variante `basico` no muestra esas piezas). Cambia a `DEV_SKIP_AUTH_ROLE=instalacion`, reinicia el server:

```bash
curl -s http://localhost:3000/ | grep -o "Vehículos con movimiento reciente"
```

Expected: presente. Restaura `DEV_SKIP_AUTH_ROLE=supervisor` y detén el servidor.

- [ ] **Step 4: Commit**

```bash
git add "app/(panel)/page.tsx"
git commit -m "feat: renderizar Dashboard distinto segun la variante del rol (F2)"
```

---

## After This Plan

1. Verificación manual en navegador real de las 7 variantes — curl solo confirma presencia/ausencia de texto, no el layout real.
2. Con esto se cierran 6 de las 12 tareas de `tareas_faltantes_frontend_fase_1.md` (F1, F2, F3, F5, F6, F10). Quedan F4, F7, F8, F9, F12 bloqueadas (backend/infra) y F11 (QA manual).
