# Panel Carrera Arango — Sprint 5 parte 1 (Historial de Movimientos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Movimientos placeholder with a paginated, filterable history table and a detail Dialog, following the exact same pattern as Sprint 4's Inventario table.

**Architecture:** Server Action `fetchMovimientos` (file-level `'use server'` — the file-level form is mandatory here, not the per-function form; Sprint 4 discovered the per-function form breaks the production build once a Client Component imports the action directly) either filters an in-memory 60-row example dataset or queries `vista_movimientos_recientes`. A Client Component (`MovementsTable`) owns filter/page state, debounces re-fetching by 500ms, and opens a shadcn `Dialog` with the selected row's full detail on click.

**Tech Stack:** Next.js 14+ App Router (Server Actions), TypeScript, Tailwind, shadcn/ui (`Dialog`, new this sprint; `Table`, already installed).

## Global Constraints

- TypeScript `strict: true`, no `any` anywhere.
- Every Supabase call's `{ error }` checked and `console.error`'d — falls back to `{ filas: [], total: 0 }`, never thrown.
- Example data deterministic (no `Math.random()`).
- Dev bypass reuses `isDevBypassActive()` from `@/lib/dev/preview-bypass` (Sprint 2) — do not reimplement.
- **Server Action file must use the file-level `'use server'` directive** (first line of the file, not inside the function body) — any plain constants it needs (like page size) go in a SEPARATE file, imported normally. This is the Sprint 4 lesson: the per-function form does not exempt the rest of the module (including its `next/headers`-importing chain) from being pulled into the client bundle once a Client Component imports the action directly.
- Real schema (`vista_movimientos_recientes`, from `origin/master`): all `movimientos_inventario` columns (`id, vin, tipo_movimiento, cantidad, valor_unitario, marca, categoria, ubicacion, formulario_id, motivo, evidencia, actor_id, aprobado_por, estado, idempotency_key, created_at`) plus `actor_nombre, actor_rol` — already ordered `created_at desc`, limited to 100.
- `estado` is a REAL column here (`'pendiente'|'aplicado'|'rechazado'`) — do not derive it like Inventario's Estado.
- VIN filter: exact match. Tipo filter: exact match against `tipo_movimiento`.
- Page size: 20 rows.
- Verification for every task that touches the Server Action or the page must include `npm run build`, not just `tsc --noEmit` — `tsc` alone does not catch Next.js's client/server module-boundary violations (the exact bug Sprint 4 hit).
- All commands run with `frontend/` as the working directory.

---

### Task 1: Types and dev preview data

**Files:**
- Create: `frontend/lib/types/movimientos.ts`
- Create: `frontend/lib/dev/preview-movimientos-data.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MovimientoDetalle`, `MovimientosFiltros`, `MovimientosPagina` types from `@/lib/types/movimientos`; `getDevPreviewMovimientosData(): MovimientoDetalle[]` (60 rows) from `@/lib/dev/preview-movimientos-data`. Task 2 imports both.

- [ ] **Step 1: Create the types**

Create `frontend/lib/types/movimientos.ts`:

```ts
export interface MovimientoDetalle {
  id: number
  vin: string
  tipo_movimiento: 'entrada' | 'salida_vin' | 'ajuste' | 'reverso'
  cantidad: number
  valor_unitario: number | null
  marca: string | null
  categoria: string | null
  ubicacion: string | null
  formulario_id: string | null
  motivo: string | null
  actor_nombre: string | null
  aprobado_por: string | null
  estado: 'pendiente' | 'aplicado' | 'rechazado'
  created_at: string
}

export interface MovimientosFiltros {
  vin: string
  tipo: 'todos' | 'entrada' | 'salida_vin' | 'ajuste' | 'reverso'
  desde: string
  hasta: string
}

export interface MovimientosPagina {
  filas: MovimientoDetalle[]
  total: number
}
```

- [ ] **Step 2: Create the example data**

Create `frontend/lib/dev/preview-movimientos-data.ts`:

```ts
import type { MovimientoDetalle } from '@/lib/types/movimientos'

const TIPOS: MovimientoDetalle['tipo_movimiento'][] = ['entrada', 'salida_vin', 'ajuste', 'reverso']
const ESTADOS: MovimientoDetalle['estado'][] = ['aplicado', 'aplicado', 'aplicado', 'pendiente', 'rechazado']
const ACTORES = ['Juan Pérez', 'María Gómez', 'Carlos Ruiz']
const UBICACIONES = ['Bodega Principal', 'Bodega Norte', 'Patio Exhibicion']

export function getDevPreviewMovimientosData(): MovimientoDetalle[] {
  const baseDate = new Date('2026-08-01T00:00:00Z')

  return Array.from({ length: 60 }, (_, i) => {
    const tipo = TIPOS[i % TIPOS.length]
    const estado = ESTADOS[i % ESTADOS.length]

    return {
      id: i + 1,
      vin: `VIN-${(2000 + (i % 40)).toString()}`,
      tipo_movimiento: tipo,
      cantidad: 1 + (i % 10),
      valor_unitario: 5_000_000 + (i % 10) * 250_000,
      marca: null,
      categoria: null,
      ubicacion: UBICACIONES[i % UBICACIONES.length],
      formulario_id: i % 3 === 0 ? `FORM-${1000 + i}` : null,
      motivo: estado === 'rechazado' ? 'Discrepancia con conteo físico' : null,
      actor_nombre: ACTORES[i % ACTORES.length],
      aprobado_por: estado === 'aplicado' ? `a0000000-0000-0000-0000-00000000000${i % 3}` : null,
      estado,
      created_at: new Date(baseDate.getTime() + i * 8 * 60 * 60 * 1000).toISOString(),
    }
  })
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add lib/types/movimientos.ts lib/dev/preview-movimientos-data.ts
git commit -m "feat: agregar tipos y datos de ejemplo de movimientos"
```

---

### Task 2: fetchMovimientos Server Action

**Files:**
- Create: `frontend/lib/supabase/movimientos-page-size.ts`
- Create: `frontend/lib/supabase/movimientos-actions.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (Sprint 1); `isDevBypassActive` from `@/lib/dev/preview-bypass` (Sprint 2); `getDevPreviewMovimientosData` from `@/lib/dev/preview-movimientos-data` (Task 1); `MovimientoDetalle`, `MovimientosFiltros`, `MovimientosPagina` from `@/lib/types/movimientos` (Task 1).
- Produces: `MOVIMIENTOS_PAGE_SIZE` from `@/lib/supabase/movimientos-page-size`; `fetchMovimientos(filtros, pagina): Promise<MovimientosPagina>` from `@/lib/supabase/movimientos-actions` (file-level `'use server'`). Task 4 imports both.

- [ ] **Step 1: Create the page-size constant (separate file — see Global Constraints)**

Create `frontend/lib/supabase/movimientos-page-size.ts`:

```ts
export const MOVIMIENTOS_PAGE_SIZE = 20
```

- [ ] **Step 2: Create the Server Action**

Create `frontend/lib/supabase/movimientos-actions.ts` — note `'use server'` is the FIRST LINE OF THE FILE:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewMovimientosData } from '@/lib/dev/preview-movimientos-data'
import { MOVIMIENTOS_PAGE_SIZE } from '@/lib/supabase/movimientos-page-size'
import type {
  MovimientoDetalle,
  MovimientosFiltros,
  MovimientosPagina,
} from '@/lib/types/movimientos'

export async function fetchMovimientos(
  filtros: MovimientosFiltros,
  pagina: number
): Promise<MovimientosPagina> {
  if (isDevBypassActive()) {
    return fetchMovimientosPreview(filtros, pagina)
  }

  const supabase = await createClient()

  const from = (pagina - 1) * MOVIMIENTOS_PAGE_SIZE
  const to = from + MOVIMIENTOS_PAGE_SIZE - 1

  let query = supabase
    .from('vista_movimientos_recientes')
    .select(
      'id, vin, tipo_movimiento, cantidad, valor_unitario, marca, categoria, ubicacion, formulario_id, motivo, actor_nombre, aprobado_por, estado, created_at',
      { count: 'exact' }
    )

  if (filtros.vin) {
    query = query.eq('vin', filtros.vin)
  }
  if (filtros.tipo !== 'todos') {
    query = query.eq('tipo_movimiento', filtros.tipo)
  }
  if (filtros.desde) {
    query = query.gte('created_at', filtros.desde)
  }
  if (filtros.hasta) {
    query = query.lte('created_at', filtros.hasta)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('Failed to load vista_movimientos_recientes:', error)
    return { filas: [], total: 0 }
  }

  return { filas: (data ?? []) as MovimientoDetalle[], total: count ?? 0 }
}

function fetchMovimientosPreview(
  filtros: MovimientosFiltros,
  pagina: number
): MovimientosPagina {
  const todas = getDevPreviewMovimientosData()

  const filtradas = todas.filter((item) => {
    if (filtros.vin && item.vin !== filtros.vin) return false
    if (filtros.tipo !== 'todos' && item.tipo_movimiento !== filtros.tipo) return false
    if (filtros.desde && item.created_at < filtros.desde) return false
    if (filtros.hasta && item.created_at > filtros.hasta) return false
    return true
  })

  const from = (pagina - 1) * MOVIMIENTOS_PAGE_SIZE
  const to = from + MOVIMIENTOS_PAGE_SIZE

  return { filas: filtradas.slice(from, to), total: filtradas.length }
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/movimientos-page-size.ts lib/supabase/movimientos-actions.ts
git commit -m "feat: agregar Server Action fetchMovimientos"
```

---

### Task 3: shadcn Dialog + MovementsFilters + MovementDetailDialog + MovementsTable

**Files:**
- Create: `frontend/components/ui/dialog.tsx` (via shadcn install)
- Create: `frontend/components/movimientos/MovementsFilters.tsx`
- Create: `frontend/components/movimientos/MovementDetailDialog.tsx`
- Create: `frontend/components/movimientos/MovementsTable.tsx`

**Interfaces:**
- Consumes: `Input`/`Label` (Sprint 1); `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` (Sprint 3); `Button` (Sprint 1); `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` (this task, via shadcn); `fetchMovimientos`/`MOVIMIENTOS_PAGE_SIZE` (Task 2); `formatCOP`/`formatNumber` (Sprint 3); `MovimientoDetalle`/`MovimientosFiltros` (Task 1).
- Produces: `MovementsFilters` (props `{filtros: MovimientosFiltros; onChange: (f: MovimientosFiltros) => void}`), `MovementDetailDialog` (props `{movimiento: MovimientoDetalle | null; open: boolean; onOpenChange: (open: boolean) => void}`), `MovementsTable` (no props). Task 4 imports `MovementsTable` by exact name.

- [ ] **Step 1: Install shadcn Dialog**

Run: `npx shadcn@latest add dialog -y`

Check `git status` before any commit in this task — only add the files you intend to (a prior sprint had a mistake with stray `npm run dev` log files getting swept into `git add -A`).

- [ ] **Step 2: Create MovementsFilters**

Create `frontend/components/movimientos/MovementsFilters.tsx`:

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MovimientosFiltros } from '@/lib/types/movimientos'

export function MovementsFilters({
  filtros,
  onChange,
}: {
  filtros: MovimientosFiltros
  onChange: (filtros: MovimientosFiltros) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-vin">VIN</Label>
        <Input
          id="mov-filtro-vin"
          value={filtros.vin}
          onChange={(e) => onChange({ ...filtros, vin: e.target.value })}
          placeholder="Exacto"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-tipo">Tipo</Label>
        <select
          id="mov-filtro-tipo"
          value={filtros.tipo}
          onChange={(e) =>
            onChange({ ...filtros, tipo: e.target.value as MovimientosFiltros['tipo'] })
          }
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="todos">Todos</option>
          <option value="entrada">Entrada</option>
          <option value="salida_vin">Salida</option>
          <option value="ajuste">Ajuste</option>
          <option value="reverso">Reverso</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-desde">Desde</Label>
        <Input
          id="mov-filtro-desde"
          type="date"
          value={filtros.desde}
          onChange={(e) => onChange({ ...filtros, desde: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-hasta">Hasta</Label>
        <Input
          id="mov-filtro-hasta"
          type="date"
          value={filtros.hasta}
          onChange={(e) => onChange({ ...filtros, hasta: e.target.value })}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create MovementDetailDialog**

Create `frontend/components/movimientos/MovementDetailDialog.tsx`:

```tsx
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCOP, formatNumber } from '@/lib/format'
import type { MovimientoDetalle } from '@/lib/types/movimientos'

const TIPO_LABELS: Record<MovimientoDetalle['tipo_movimiento'], string> = {
  entrada: 'Entrada',
  salida_vin: 'Salida',
  ajuste: 'Ajuste',
  reverso: 'Reverso',
}

const ESTADO_LABELS: Record<MovimientoDetalle['estado'], string> = {
  pendiente: 'Pendiente',
  aplicado: 'Aplicado',
  rechazado: 'Rechazado',
}

export function MovementDetailDialog({
  movimiento,
  open,
  onOpenChange,
}: {
  movimiento: MovimientoDetalle | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle del movimiento</DialogTitle>
        </DialogHeader>
        {movimiento && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">VIN</dt>
            <dd>{movimiento.vin}</dd>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>{TIPO_LABELS[movimiento.tipo_movimiento]}</dd>
            <dt className="text-muted-foreground">Estado</dt>
            <dd>{ESTADO_LABELS[movimiento.estado]}</dd>
            <dt className="text-muted-foreground">Cantidad</dt>
            <dd>{formatNumber(movimiento.cantidad)}</dd>
            <dt className="text-muted-foreground">Valor Unitario</dt>
            <dd>{movimiento.valor_unitario ? formatCOP(movimiento.valor_unitario) : '—'}</dd>
            <dt className="text-muted-foreground">Ubicación</dt>
            <dd>{movimiento.ubicacion ?? '—'}</dd>
            <dt className="text-muted-foreground">Usuario</dt>
            <dd>{movimiento.actor_nombre ?? '—'}</dd>
            <dt className="text-muted-foreground">Aprobado por</dt>
            <dd className="truncate">{movimiento.aprobado_por ?? '—'}</dd>
            <dt className="text-muted-foreground">Formulario</dt>
            <dd>{movimiento.formulario_id ?? '—'}</dd>
            <dt className="text-muted-foreground">Motivo</dt>
            <dd className="col-span-2">{movimiento.motivo ?? '—'}</dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd className="col-span-2">
              {new Date(movimiento.created_at).toLocaleString('es-CO')}
            </dd>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

If `tsc` reports that `Dialog`'s props don't match (e.g. a different open/onOpenChange signature), open the actual installed `frontend/components/ui/dialog.tsx` and adjust only the mismatched prop names — note any such adjustment in your report, the same way earlier sprints handled shadcn-version differences.

- [ ] **Step 4: Create MovementsTable**

Create `frontend/components/movimientos/MovementsTable.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MovementsFilters } from '@/components/movimientos/MovementsFilters'
import { MovementDetailDialog } from '@/components/movimientos/MovementDetailDialog'
import { fetchMovimientos } from '@/lib/supabase/movimientos-actions'
import { MOVIMIENTOS_PAGE_SIZE } from '@/lib/supabase/movimientos-page-size'
import { formatNumber } from '@/lib/format'
import type { MovimientoDetalle, MovimientosFiltros } from '@/lib/types/movimientos'

const TIPO_LABELS: Record<MovimientoDetalle['tipo_movimiento'], string> = {
  entrada: 'Entrada',
  salida_vin: 'Salida',
  ajuste: 'Ajuste',
  reverso: 'Reverso',
}

const FILTROS_INICIALES: MovimientosFiltros = {
  vin: '',
  tipo: 'todos',
  desde: '',
  hasta: '',
}

export function MovementsTable() {
  const [filtros, setFiltros] = useState<MovimientosFiltros>(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [filas, setFilas] = useState<MovimientoDetalle[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState<MovimientoDetalle | null>(null)
  const [dialogAbierto, setDialogAbierto] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      fetchMovimientos(filtros, pagina)
        .then((resultado) => {
          setFilas(resultado.filas)
          setTotal(resultado.total)
        })
        .catch((error) => {
          console.error('Failed to fetch movimientos:', error)
          setFilas([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    }, 500)

    return () => clearTimeout(timeout)
  }, [filtros, pagina])

  function handleFiltrosChange(nuevosFiltros: MovimientosFiltros) {
    setFiltros(nuevosFiltros)
    setPagina(1)
  }

  function handleRowClick(movimiento: MovimientoDetalle) {
    setSeleccionado(movimiento)
    setDialogAbierto(true)
  }

  const totalPaginas = Math.max(1, Math.ceil(total / MOVIMIENTOS_PAGE_SIZE))

  return (
    <div className="space-y-4">
      <MovementsFilters filtros={filtros} onChange={handleFiltrosChange} />

      <p className="text-sm text-muted-foreground">
        {loading ? 'Cargando...' : `Mostrando ${filas.length} de ${total} resultados`}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>VIN</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {loading ? 'Cargando...' : 'Sin resultados.'}
              </TableCell>
            </TableRow>
          ) : (
            filas.map((item) => (
              <TableRow
                key={item.id}
                onClick={() => handleRowClick(item)}
                className="cursor-pointer hover:bg-accent"
              >
                <TableCell>{new Date(item.created_at).toLocaleDateString('es-CO')}</TableCell>
                <TableCell>{TIPO_LABELS[item.tipo_movimiento]}</TableCell>
                <TableCell className="font-medium">{item.vin}</TableCell>
                <TableCell className="text-right">{formatNumber(item.cantidad)}</TableCell>
                <TableCell>{item.ubicacion ?? '—'}</TableCell>
                <TableCell>{item.actor_nombre ?? '—'}</TableCell>
                <TableCell>{item.estado}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPagina((p) => Math.max(1, p - 1))}
          disabled={pagina <= 1}
        >
          Anterior
        </Button>
        <p className="text-sm text-muted-foreground">
          Página {pagina} de {totalPaginas}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          disabled={pagina >= totalPaginas}
        >
          Siguiente
        </Button>
      </div>

      <MovementDetailDialog
        movimiento={seleccionado}
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
      />
    </div>
  )
}
```

- [ ] **Step 5: Verify types and build**

Run: `npx tsc --noEmit` — expected exit 0.
Run: `npm run build` — expected exit 0 (this is the check that would have caught Sprint 4's Server Action bug; it must pass here since the Server Action file already uses the correct file-level directive from Task 2).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: agregar filtros, dialog de detalle y tabla de movimientos"
```

(Confirm via `git status` before this commit that only the intended files — the shadcn dialog install plus the three new component files — are staged.)

---

### Task 4: Wire the Movimientos page

**Files:**
- Modify: `frontend/app/(panel)/movimientos/page.tsx`

**Interfaces:**
- Consumes: `RoleGuard` (Sprint 2); `ROUTE_PERMISSIONS` (Sprint 2); `MovementsTable` (Task 3).
- Produces: nothing new — final integration point.

- [ ] **Step 1: Replace the page's content**

Replace the full contents of `frontend/app/(panel)/movimientos/page.tsx` with:

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

- [ ] **Step 2: Verify types and build**

Run: `npx tsc --noEmit` — expected exit 0.
Run: `npm run build` — expected exit 0.

- [ ] **Step 3: Verify the page shell renders**

Confirm `frontend/.env.local` has `DEV_SKIP_AUTH=true` and `DEV_SKIP_AUTH_ROLE=supervisor`. Run `npm run dev` (background), then:

```bash
curl -s http://localhost:3000/movimientos | grep -o "Movimientos\|Tipo\|VIN\|Estado"
```

Expected: all present (server-rendered shell — actual data rows load client-side, unverifiable by curl, same caveat as Inventario). Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add "app/(panel)/movimientos/page.tsx"
git commit -m "feat: conectar tabla de movimientos en la pagina"
```

---

## After This Plan

Sprint 5 parte 1 (Movimientos) done once Task 4 is committed and reviewed clean. Sprint 5 parte 2 (Entradas manual-entry form) is a separate spec/plan. Real Supabase project still doesn't exist — same caveat as every prior sprint.
