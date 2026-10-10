# Panel Carrera Arango — Sprint 3 (Dashboard KPIs + Realtime) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dashboard placeholder with 4 KPI cards, an Entradas-vs-Salidas 7-day bar chart, a last-10-movements table, and a Realtime refresher — fully visible now via example data (dev bypass), with real Supabase query code written correctly against the now-known schema for when a real backend exists.

**Architecture:** A Server Component (`getDashboardData()`) either returns deterministic example data (dev bypass active) or runs 4 parallel Supabase queries against `vista_inventario_actual`, `movimientos_inventario`, and `vista_movimientos_recientes`. A small Client Component (`RealtimeRefresher`) subscribes to `postgres_changes` on `movimientos_inventario` and calls `router.refresh()` on any event, re-running the server fetch — no client-side data duplication.

**Tech Stack:** Next.js 14+ App Router, TypeScript, Tailwind, shadcn/ui (adds `chart`, `table`), Recharts (via shadcn chart), `@supabase/ssr`.

## Global Constraints

- TypeScript `strict: true`, no `any` anywhere.
- Every Supabase call's `{ error }` is checked and logged via `console.error` on failure — never thrown, never silently ignored. Failed queries fall back to `0`/`[]` so the page still renders.
- npm only.
- Dev bypass gating (existing, from Sprint 2): `isDevBypassActive()` from `@/lib/dev/preview-bypass` — reuse it, don't reimplement.
- Example/fake data must be deterministic — no `Math.random()` — so curl/grep verification is reproducible.
- Real schema (from `origin/master`, `supabase/migrations/002_create_movimientos_inventario.sql` and `004_create_views.sql` — copy these exactly, do not alter):
  - `movimientos_inventario`: columns include `id`, `vin`, `tipo_movimiento` (`'entrada'|'salida_vin'|'ajuste'|'reverso'`), `cantidad`, `estado` (`'pendiente'|'aplicado'|'rechazado'`), `created_at`.
  - `vista_inventario_actual`: `vin, marca, categoria, ubicacion, saldo, valor_unitario, valor_total, ultimo_movimiento` — one row per VIN, already filtered to `estado='aplicado'`.
  - `vista_movimientos_recientes`: all `movimientos_inventario` columns plus `actor_nombre`, `actor_rol` — already ordered `created_at desc`, limited to 100.
- Stock-bajo threshold: `saldo <= 2` (exact value from the source document).
- "Movimientos del Día" counts only `estado = 'aplicado'` rows created today (confirmed product decision — not pending/rechazado).
- All commands run with `frontend/` as the working directory.

---

### Task 1: Dashboard types and number formatters

**Files:**
- Create: `frontend/lib/types/dashboard.ts`
- Create: `frontend/lib/format.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `DashboardData`, `MovimientoReciente`, `EntradaSalidaDia` types from `@/lib/types/dashboard`; `formatCOP(value: number): string` and `formatNumber(value: number): string` from `@/lib/format`. Tasks 2, 3, 5, 6, 7, 9 all import from these two files.

- [ ] **Step 1: Create the dashboard types**

Create `frontend/lib/types/dashboard.ts`:

```ts
export interface MovimientoReciente {
  id: number
  vin: string
  tipo_movimiento: 'entrada' | 'salida_vin' | 'ajuste' | 'reverso'
  cantidad: number
  actor_nombre: string | null
  created_at: string
}

export interface EntradaSalidaDia {
  fecha: string
  entradas: number
  salidas: number
}

export interface DashboardData {
  totalUnidades: number
  valorTotal: number
  movimientosHoy: number
  stockBajo: number
  entradasVsSalidas: EntradaSalidaDia[]
  ultimosMovimientos: MovimientoReciente[]
}
```

- [ ] **Step 2: Create the number formatters**

Create `frontend/lib/format.ts`:

```ts
export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CO').format(value)
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add lib/types/dashboard.ts lib/format.ts
git commit -m "feat: agregar tipos de dashboard y formateadores de numero"
```

---

### Task 2: Dev preview dashboard data

**Files:**
- Create: `frontend/lib/dev/preview-dashboard-data.ts`

**Interfaces:**
- Consumes: `DashboardData`, `MovimientoReciente` from `@/lib/types/dashboard` (Task 1).
- Produces: `getDevPreviewDashboardData(): DashboardData` from `@/lib/dev/preview-dashboard-data`. Task 3 imports this by exact name.

- [ ] **Step 1: Create the file**

Create `frontend/lib/dev/preview-dashboard-data.ts`:

```ts
import type { DashboardData, MovimientoReciente } from '@/lib/types/dashboard'

const TIPOS: MovimientoReciente['tipo_movimiento'][] = [
  'entrada',
  'salida_vin',
  'ajuste',
  'entrada',
  'salida_vin',
]

const ACTORES = ['Juan Pérez', 'María Gómez', 'Carlos Ruiz']

export function getDevPreviewDashboardData(): DashboardData {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const entradasVsSalidas = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return {
      fecha: d.toISOString().slice(0, 10),
      entradas: 15 + ((i * 7) % 20),
      salidas: 10 + ((i * 5) % 15),
    }
  })

  const ultimosMovimientos: MovimientoReciente[] = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    vin: `VIN-${(1000 + i).toString()}`,
    tipo_movimiento: TIPOS[i % TIPOS.length],
    cantidad: 5 + i,
    actor_nombre: ACTORES[i % ACTORES.length],
    created_at: new Date(today.getTime() - i * 3 * 60 * 60 * 1000).toISOString(),
  }))

  return {
    totalUnidades: 12455,
    valorTotal: 3246780000,
    movimientosHoy: 42,
    stockBajo: 7,
    entradasVsSalidas,
    ultimosMovimientos,
  }
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add lib/dev/preview-dashboard-data.ts
git commit -m "feat: agregar datos de ejemplo del dashboard para bypass dev"
```

---

### Task 3: Real dashboard data fetcher

**Files:**
- Create: `frontend/lib/supabase/get-dashboard-data.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (Sprint 1); `isDevBypassActive` from `@/lib/dev/preview-bypass` (Sprint 2); `getDevPreviewDashboardData` from `@/lib/dev/preview-dashboard-data` (Task 2); `DashboardData`, `EntradaSalidaDia`, `MovimientoReciente` from `@/lib/types/dashboard` (Task 1).
- Produces: `getDashboardData(): Promise<DashboardData>` from `@/lib/supabase/get-dashboard-data`. Task 9 imports this by exact name.

- [ ] **Step 1: Create the file**

Create `frontend/lib/supabase/get-dashboard-data.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewDashboardData } from '@/lib/dev/preview-dashboard-data'
import type { DashboardData, EntradaSalidaDia, MovimientoReciente } from '@/lib/types/dashboard'

const STOCK_BAJO_THRESHOLD = 2

export async function getDashboardData(): Promise<DashboardData> {
  if (isDevBypassActive()) {
    return getDevPreviewDashboardData()
  }

  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [inventarioResult, movimientosHoyResult, entradasSalidasResult, ultimosResult] =
    await Promise.all([
      supabase.from('vista_inventario_actual').select('saldo, valor_total'),
      supabase
        .from('movimientos_inventario')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'aplicado')
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('movimientos_inventario')
        .select('tipo_movimiento, created_at')
        .eq('estado', 'aplicado')
        .in('tipo_movimiento', ['entrada', 'salida_vin'])
        .gte('created_at', sevenDaysAgo.toISOString()),
      supabase
        .from('vista_movimientos_recientes')
        .select('id, vin, tipo_movimiento, cantidad, actor_nombre, created_at')
        .limit(10),
    ])

  if (inventarioResult.error) {
    console.error('Failed to load vista_inventario_actual:', inventarioResult.error)
  }
  if (movimientosHoyResult.error) {
    console.error('Failed to count movimientos del día:', movimientosHoyResult.error)
  }
  if (entradasSalidasResult.error) {
    console.error('Failed to load entradas vs salidas:', entradasSalidasResult.error)
  }
  if (ultimosResult.error) {
    console.error('Failed to load vista_movimientos_recientes:', ultimosResult.error)
  }

  const inventarioRows = inventarioResult.data ?? []
  const totalUnidades = inventarioRows.reduce((sum, row) => sum + (row.saldo ?? 0), 0)
  const valorTotal = inventarioRows.reduce((sum, row) => sum + (row.valor_total ?? 0), 0)
  const stockBajo = inventarioRows.filter(
    (row) => (row.saldo ?? 0) <= STOCK_BAJO_THRESHOLD
  ).length

  const movimientosHoy = movimientosHoyResult.count ?? 0

  const entradasVsSalidas = buildEntradasVsSalidasSeries(
    entradasSalidasResult.data ?? [],
    sevenDaysAgo
  )

  const ultimosMovimientos = (ultimosResult.data ?? []) as MovimientoReciente[]

  return {
    totalUnidades,
    valorTotal,
    movimientosHoy,
    stockBajo,
    entradasVsSalidas,
    ultimosMovimientos,
  }
}

function buildEntradasVsSalidasSeries(
  rows: { tipo_movimiento: string; created_at: string }[],
  startDate: Date
): EntradaSalidaDia[] {
  const days: EntradaSalidaDia[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    days.push({ fecha: d.toISOString().slice(0, 10), entradas: 0, salidas: 0 })
  }

  for (const row of rows) {
    const fecha = row.created_at.slice(0, 10)
    const day = days.find((d) => d.fecha === fecha)
    if (!day) continue
    if (row.tipo_movimiento === 'entrada') day.entradas += 1
    if (row.tipo_movimiento === 'salida_vin') day.salidas += 1
  }

  return days
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. (This validates the real-query branch's TypeScript against Supabase's generic client types even though it can't run against a real database yet.)

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/get-dashboard-data.ts
git commit -m "feat: agregar consulta real de datos del dashboard"
```

---

### Task 4: Install shadcn chart and table components

**Files:**
- Create: `frontend/components/ui/chart.tsx`
- Create: `frontend/components/ui/table.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `type ChartConfig` from `@/components/ui/chart`; `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `@/components/ui/table`. Task 6 imports the chart exports; Task 7 imports the table exports.

- [ ] **Step 1: Install the components**

Run:

```bash
npx shadcn@latest add chart table -y
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. Confirm `components/ui/chart.tsx` and `components/ui/table.tsx` now exist and export the names listed above (open the files and check their `export` statements — shadcn's chart component may pull in `recharts` as a new dependency; confirm `package.json` picked it up).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: instalar componentes chart y table de shadcn"
```

---

### Task 5: KpiCard component

**Files:**
- Create: `frontend/components/dashboard/KpiCard.tsx`

**Interfaces:**
- Consumes: `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card` (Sprint 1); `type LucideIcon` from `lucide-react`.
- Produces: `KpiCard` component, props `{ label: string; value: string; icon: LucideIcon }`, from `@/components/dashboard/KpiCard`. Task 9 imports this by exact name and prop shape.

- [ ] **Step 1: Create the component**

Create `frontend/components/dashboard/KpiCard.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: LucideIcon
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/KpiCard.tsx
git commit -m "feat: agregar componente KpiCard"
```

---

### Task 6: EntradasSalidasChart component

**Files:**
- Create: `frontend/components/dashboard/EntradasSalidasChart.tsx`

**Interfaces:**
- Consumes: `EntradaSalidaDia` from `@/lib/types/dashboard` (Task 1); `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `type ChartConfig` from `@/components/ui/chart` (Task 4); `Bar`, `BarChart`, `CartesianGrid`, `XAxis` from `recharts` (installed by Task 4's shadcn command).
- Produces: `EntradasSalidasChart` component, props `{ data: EntradaSalidaDia[] }`, from `@/components/dashboard/EntradasSalidasChart`. Task 9 imports this by exact name and prop shape.

- [ ] **Step 1: Create the component**

Create `frontend/components/dashboard/EntradasSalidasChart.tsx`:

```tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { EntradaSalidaDia } from '@/lib/types/dashboard'

const chartConfig = {
  entradas: { label: 'Entradas', color: 'var(--primary)' },
  salidas: { label: 'Salidas', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

export function EntradasSalidasChart({ data }: { data: EntradaSalidaDia[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="fecha"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) => value.slice(5)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="entradas" fill="var(--color-entradas)" radius={4} />
        <Bar dataKey="salidas" fill="var(--color-salidas)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

If `npx tsc --noEmit` reports a type mismatch on `ChartConfig`'s `color` field or on `ChartContainer`'s props, open `frontend/components/ui/chart.tsx` (installed in Task 4) and adjust this file's usage to match its actual exported types — the shadcn chart component's exact shape can vary slightly by version; the behavior to preserve is: a `ChartConfig` mapping `entradas`/`salidas` to a label and a color, passed to `ChartContainer`, with `Bar` elements using the resulting `var(--color-<key>)` CSS variables.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/EntradasSalidasChart.tsx
git commit -m "feat: agregar grafico de Entradas vs Salidas"
```

---

### Task 7: UltimosMovimientosTable component

**Files:**
- Create: `frontend/components/dashboard/UltimosMovimientosTable.tsx`

**Interfaces:**
- Consumes: `MovimientoReciente` from `@/lib/types/dashboard` (Task 1); `formatNumber` from `@/lib/format` (Task 1); `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `@/components/ui/table` (Task 4).
- Produces: `UltimosMovimientosTable` component, props `{ movimientos: MovimientoReciente[] }`, from `@/components/dashboard/UltimosMovimientosTable`. Task 9 imports this by exact name and prop shape.

- [ ] **Step 1: Create the component**

Create `frontend/components/dashboard/UltimosMovimientosTable.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNumber } from '@/lib/format'
import type { MovimientoReciente } from '@/lib/types/dashboard'

const TIPO_LABELS: Record<MovimientoReciente['tipo_movimiento'], string> = {
  entrada: 'Entrada',
  salida_vin: 'Salida',
  ajuste: 'Ajuste',
  reverso: 'Reverso',
}

export function UltimosMovimientosTable({
  movimientos,
}: {
  movimientos: MovimientoReciente[]
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>VIN</TableHead>
          <TableHead className="text-right">Cantidad</TableHead>
          <TableHead>Usuario</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movimientos.map((mov) => (
          <TableRow key={mov.id}>
            <TableCell>{new Date(mov.created_at).toLocaleString('es-CO')}</TableCell>
            <TableCell>{TIPO_LABELS[mov.tipo_movimiento]}</TableCell>
            <TableCell>{mov.vin}</TableCell>
            <TableCell className="text-right">{formatNumber(mov.cantidad)}</TableCell>
            <TableCell>{mov.actor_nombre ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/UltimosMovimientosTable.tsx
git commit -m "feat: agregar tabla de ultimos movimientos"
```

---

### Task 8: RealtimeRefresher component

**Files:**
- Create: `frontend/components/dashboard/RealtimeRefresher.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client` (Sprint 1).
- Produces: `RealtimeRefresher` component (no props) from `@/components/dashboard/RealtimeRefresher`. Task 9 imports this by exact name.

- [ ] **Step 1: Create the component**

Create `frontend/components/dashboard/RealtimeRefresher.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RealtimeRefresher() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('movimientos-inventario-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movimientos_inventario' },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
```

This subscribes on mount and unsubscribes on unmount. Against the placeholder Supabase URL (no real backend yet), the subscription attempt will fail to connect — this is expected and harmless; the Supabase Realtime client logs a connection error to the browser console and does not crash the page. It stays dormant until a real Supabase project exists.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/RealtimeRefresher.tsx
git commit -m "feat: agregar RealtimeRefresher para actualizar el dashboard"
```

---

### Task 9: Wire the dashboard page together

**Files:**
- Modify: `frontend/app/(panel)/page.tsx`

**Interfaces:**
- Consumes: `RoleGuard` from `@/components/shared/RoleGuard` (Sprint 2); `ROUTE_PERMISSIONS` from `@/lib/permissions/roles` (Sprint 2); `getCurrentProfile` from `@/lib/supabase/get-current-profile` (Sprint 2, corrected in the schema-fix plan — `Profile` fields are `nombre`/`rol`); `getDashboardData` from `@/lib/supabase/get-dashboard-data` (Task 3); `formatCOP`, `formatNumber` from `@/lib/format` (Task 1); `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card` (Sprint 1); `KpiCard` from `@/components/dashboard/KpiCard` (Task 5); `EntradasSalidasChart` from `@/components/dashboard/EntradasSalidasChart` (Task 6); `UltimosMovimientosTable` from `@/components/dashboard/UltimosMovimientosTable` (Task 7); `RealtimeRefresher` from `@/components/dashboard/RealtimeRefresher` (Task 8); `Package`, `DollarSign`, `ArrowLeftRight`, `AlertTriangle` icons from `lucide-react`.
- Produces: nothing new — this is the plan's final integration point.

- [ ] **Step 1: Replace the page's content**

Replace the full contents of `frontend/app/(panel)/page.tsx` with:

```tsx
import { AlertTriangle, ArrowLeftRight, DollarSign, Package } from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { getDashboardData } from '@/lib/supabase/get-dashboard-data'
import { formatCOP, formatNumber } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { UltimosMovimientosTable } from '@/components/dashboard/UltimosMovimientosTable'
import { RealtimeRefresher } from '@/components/dashboard/RealtimeRefresher'

export default function DashboardPlaceholderPage() {
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

  return (
    <div className="space-y-6">
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

- [ ] **Step 2: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: exit code 0, no errors.

- [ ] **Step 3: Verify the dashboard renders with example data**

Confirm `frontend/.env.local` has `DEV_SKIP_AUTH=true` and `DEV_SKIP_AUTH_ROLE=supervisor` (restore if missing). Run `npm run build` first if you haven't already in this step (regenerates `.next/types`), then `npm run dev` (background). Run:

```bash
curl -s http://localhost:3000/ | grep -o "Total Unidades en Stock\|Valor Total del Inventario\|Movimientos del Día\|VINs con Stock Bajo\|12.455\|42\|VIN-1000\|Entradas vs Salidas"
```

Expected: all of these present in the output (the 4 KPI labels, the example `totalUnidades` formatted as `12.455` per `es-CO` locale grouping, the `movimientosHoy` value `42`, the first example movement's VIN `VIN-1000`, and the chart's title text). If the exact currency/number formatting differs from what's listed here (locale formatting can vary slightly), note the actual rendered string in your report instead of failing the check — the important thing is that real numbers appear, not placeholder/error text.

Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add "app/(panel)/page.tsx"
git commit -m "feat: conectar dashboard con KPIs, grafico y tabla de movimientos"
```

---

## After This Plan

Sprint 3 is done once Task 9 is committed and its review is clean. Remaining before this is fully live:

1. Real Supabase project still doesn't exist — `getDashboardData()`'s real-query branch is written and type-checks, but its actual behavior (including whatever RLS policies the backend team adds) is unverified until a real project exists.
2. Once real credentials land: remove `DEV_SKIP_AUTH` from `.env.local`, confirm the Dashboard renders real numbers, and specifically verify the Realtime subscription in `RealtimeRefresher` actually fires within 5 seconds of a new `movimientos_inventario` row (the source document's Sprint 3 acceptance criterion) — this cannot be tested until then.
3. Sprint 4 (Tabla de Inventario) is a separate spec/plan.
