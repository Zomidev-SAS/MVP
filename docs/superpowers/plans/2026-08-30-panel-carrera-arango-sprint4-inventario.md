# Panel Carrera Arango — Sprint 4 (Tabla de Inventario) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Inventario placeholder with a paginated, filterable table backed by a Server Action, browser CSV export, and example data visible now via the existing dev bypass.

**Architecture:** A Server Action (`fetchInventario`, in a file WITHOUT a file-level `'use server'` directive — only the action function itself gets the inline directive, so the file can also export a plain constant) either filters an in-memory 120-row example dataset (dev bypass active) or queries `vista_inventario_actual` with `.range()` + filter clauses (real branch). A Client Component (`InventoryTable`) owns filter/page state, debounces re-fetching by 500ms, and calls the Server Action like a normal async function — this is how Next.js Server Actions work from client code.

**Tech Stack:** Next.js 14+ App Router (Server Actions), TypeScript, Tailwind, shadcn/ui (`Table`, already installed in Sprint 3), `@supabase/ssr`.

## Global Constraints

- TypeScript `strict: true`, no `any` anywhere.
- Every Supabase call's `{ error }` checked and `console.error`'d — never thrown, falls back to `{ filas: [], total: 0 }`.
- Example data must be deterministic (no `Math.random()`).
- Dev bypass gating reuses the existing `isDevBypassActive()` from `@/lib/dev/preview-bypass` (Sprint 2) — do not reimplement.
- Real schema (`vista_inventario_actual`, from `origin/master`): `vin, marca, categoria, ubicacion, saldo, valor_unitario, valor_total, ultimo_movimiento`.
- Filter semantics (already decided, copy exactly):
  - VIN: **exact** match (`.eq`), not partial.
  - Marca / Categoría: partial match (`.ilike`), free text.
  - Estado: derived, not a real column — `activo` means `saldo > 0`, `agotado` means `saldo <= 0`.
  - Date range: applies to `ultimo_movimiento`.
- Page size: 20 rows.
- CSV export: only the current page's visible rows, built client-side with `Blob`/`URL.createObjectURL` — never re-fetches all filtered results from the server.
- All commands run with `frontend/` as the working directory.

---

### Task 1: Inventario types

**Files:**
- Create: `frontend/lib/types/inventario.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `InventarioItem`, `InventarioFiltros`, `InventarioPagina` types from `@/lib/types/inventario`. Tasks 2, 3, 4, 5 all import from this file.

- [ ] **Step 1: Create the file**

Create `frontend/lib/types/inventario.ts`:

```ts
export interface InventarioItem {
  vin: string
  marca: string | null
  categoria: string | null
  ubicacion: string | null
  saldo: number
  valor_unitario: number | null
  valor_total: number
  ultimo_movimiento: string
}

export interface InventarioFiltros {
  vin: string
  marca: string
  categoria: string
  estado: 'todos' | 'activo' | 'agotado'
  desde: string
  hasta: string
}

export interface InventarioPagina {
  filas: InventarioItem[]
  total: number
}
```

All `InventarioFiltros` fields are strings (empty string = filter not applied) so they bind directly to controlled `<input>` elements without extra conversion.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add lib/types/inventario.ts
git commit -m "feat: agregar tipos de inventario"
```

---

### Task 2: Dev preview inventario data

**Files:**
- Create: `frontend/lib/dev/preview-inventario-data.ts`

**Interfaces:**
- Consumes: `InventarioItem` from `@/lib/types/inventario` (Task 1).
- Produces: `getDevPreviewInventarioData(): InventarioItem[]` from `@/lib/dev/preview-inventario-data`, returning exactly 120 rows. Task 3 imports this by exact name.

- [ ] **Step 1: Create the file**

Create `frontend/lib/dev/preview-inventario-data.ts`:

```ts
import type { InventarioItem } from '@/lib/types/inventario'

const MARCAS = ['Toyota', 'Chevrolet', 'Renault', 'Mazda']
const CATEGORIAS = ['Transformaciones', 'Componentes', 'Accesorios', 'Otros']
const UBICACIONES = ['Bodega Principal', 'Bodega Norte', 'Patio Exhibicion']

export function getDevPreviewInventarioData(): InventarioItem[] {
  const baseDate = new Date('2026-08-01T00:00:00Z')

  return Array.from({ length: 120 }, (_, i) => {
    const marca = MARCAS[i % MARCAS.length]
    const categoria = CATEGORIAS[i % CATEGORIAS.length]
    const ubicacion = UBICACIONES[i % UBICACIONES.length]
    const saldo = i % 15
    const valorUnitario = 5_000_000 + (i % 10) * 250_000
    const ultimoMovimiento = new Date(baseDate.getTime() + i * 6 * 60 * 60 * 1000).toISOString()

    return {
      vin: `VIN-${(2000 + i).toString()}`,
      marca,
      categoria,
      ubicacion,
      saldo,
      valor_unitario: valorUnitario,
      valor_total: saldo * valorUnitario,
      ultimo_movimiento: ultimoMovimiento,
    }
  })
}
```

`saldo = i % 15` produces values 0-14 across the 120 rows, including 8 rows with `saldo = 0` (agotado) and several with `saldo` between 1-2 (stock bajo alert-worthy) — enough variety to exercise the Estado filter and the low-stock visual indicator.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add lib/dev/preview-inventario-data.ts
git commit -m "feat: agregar datos de ejemplo de inventario para bypass dev"
```

---

### Task 3: fetchInventario Server Action

**Files:**
- Create: `frontend/lib/supabase/get-inventario.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (Sprint 1); `isDevBypassActive` from `@/lib/dev/preview-bypass` (Sprint 2); `getDevPreviewInventarioData` from `@/lib/dev/preview-inventario-data` (Task 2); `InventarioFiltros`, `InventarioItem`, `InventarioPagina` from `@/lib/types/inventario` (Task 1).
- Produces: `fetchInventario(filtros: InventarioFiltros, pagina: number): Promise<InventarioPagina>` and `INVENTARIO_PAGE_SIZE: number`, both from `@/lib/supabase/get-inventario`. Task 5 imports both by exact name.

**Important:** do NOT put `'use server'` at the top of this file — that would force every export to be an async function, and this file also exports the plain `INVENTARIO_PAGE_SIZE` constant. Put `'use server'` as the FIRST line INSIDE `fetchInventario`'s function body instead (the per-function form of the directive) — this marks only that function as a Server Action while the constant export stays a normal export.

- [ ] **Step 1: Create the file**

Create `frontend/lib/supabase/get-inventario.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewInventarioData } from '@/lib/dev/preview-inventario-data'
import type { InventarioFiltros, InventarioItem, InventarioPagina } from '@/lib/types/inventario'

export const INVENTARIO_PAGE_SIZE = 20

export async function fetchInventario(
  filtros: InventarioFiltros,
  pagina: number
): Promise<InventarioPagina> {
  'use server'

  if (isDevBypassActive()) {
    return fetchInventarioPreview(filtros, pagina)
  }

  const supabase = await createClient()

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE - 1

  let query = supabase
    .from('vista_inventario_actual')
    .select(
      'vin, marca, categoria, ubicacion, saldo, valor_unitario, valor_total, ultimo_movimiento',
      { count: 'exact' }
    )

  if (filtros.vin) {
    query = query.eq('vin', filtros.vin)
  }
  if (filtros.marca) {
    query = query.ilike('marca', `%${filtros.marca}%`)
  }
  if (filtros.categoria) {
    query = query.ilike('categoria', `%${filtros.categoria}%`)
  }
  if (filtros.estado === 'activo') {
    query = query.gt('saldo', 0)
  } else if (filtros.estado === 'agotado') {
    query = query.lte('saldo', 0)
  }
  if (filtros.desde) {
    query = query.gte('ultimo_movimiento', filtros.desde)
  }
  if (filtros.hasta) {
    query = query.lte('ultimo_movimiento', filtros.hasta)
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Failed to load vista_inventario_actual:', error)
    return { filas: [], total: 0 }
  }

  return { filas: (data ?? []) as InventarioItem[], total: count ?? 0 }
}

function fetchInventarioPreview(filtros: InventarioFiltros, pagina: number): InventarioPagina {
  const todas = getDevPreviewInventarioData()

  const filtradas = todas.filter((item) => {
    if (filtros.vin && item.vin !== filtros.vin) return false
    if (filtros.marca && !(item.marca ?? '').toLowerCase().includes(filtros.marca.toLowerCase())) {
      return false
    }
    if (
      filtros.categoria &&
      !(item.categoria ?? '').toLowerCase().includes(filtros.categoria.toLowerCase())
    ) {
      return false
    }
    if (filtros.estado === 'activo' && item.saldo <= 0) return false
    if (filtros.estado === 'agotado' && item.saldo > 0) return false
    if (filtros.desde && item.ultimo_movimiento < filtros.desde) return false
    if (filtros.hasta && item.ultimo_movimiento > filtros.hasta) return false
    return true
  })

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE

  return { filas: filtradas.slice(from, to), total: filtradas.length }
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. If Next.js's Server Actions plugin reports an error about the file needing a directive, re-read this task's note above — the fix is the inline `'use server'` inside `fetchInventario`'s body, not a file-level directive.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/get-inventario.ts
git commit -m "feat: agregar Server Action fetchInventario con filtros y paginacion"
```

---

### Task 4: InventoryFilters component

**Files:**
- Create: `frontend/components/inventario/InventoryFilters.tsx`

**Interfaces:**
- Consumes: `Input` from `@/components/ui/input` (Sprint 1); `Label` from `@/components/ui/label` (Sprint 1); `InventarioFiltros` from `@/lib/types/inventario` (Task 1).
- Produces: `InventoryFilters` component, props `{ filtros: InventarioFiltros; onChange: (filtros: InventarioFiltros) => void }`, from `@/components/inventario/InventoryFilters`. Task 5 imports this by exact name and prop shape.

- [ ] **Step 1: Create the component**

Create `frontend/components/inventario/InventoryFilters.tsx`:

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { InventarioFiltros } from '@/lib/types/inventario'

export function InventoryFilters({
  filtros,
  onChange,
}: {
  filtros: InventarioFiltros
  onChange: (filtros: InventarioFiltros) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      <div className="space-y-1">
        <Label htmlFor="filtro-vin">VIN</Label>
        <Input
          id="filtro-vin"
          value={filtros.vin}
          onChange={(e) => onChange({ ...filtros, vin: e.target.value })}
          placeholder="Exacto"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-marca">Marca</Label>
        <Input
          id="filtro-marca"
          value={filtros.marca}
          onChange={(e) => onChange({ ...filtros, marca: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-categoria">Categoría</Label>
        <Input
          id="filtro-categoria"
          value={filtros.categoria}
          onChange={(e) => onChange({ ...filtros, categoria: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-estado">Estado</Label>
        <select
          id="filtro-estado"
          value={filtros.estado}
          onChange={(e) =>
            onChange({ ...filtros, estado: e.target.value as InventarioFiltros['estado'] })
          }
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="todos">Todos</option>
          <option value="activo">Activo</option>
          <option value="agotado">Agotado</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-desde">Desde</Label>
        <Input
          id="filtro-desde"
          type="date"
          value={filtros.desde}
          onChange={(e) => onChange({ ...filtros, desde: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-hasta">Hasta</Label>
        <Input
          id="filtro-hasta"
          type="date"
          value={filtros.hasta}
          onChange={(e) => onChange({ ...filtros, hasta: e.target.value })}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add components/inventario/InventoryFilters.tsx
git commit -m "feat: agregar componente de filtros de inventario"
```

---

### Task 5: InventoryTable component

**Files:**
- Create: `frontend/components/inventario/InventoryTable.tsx`

**Interfaces:**
- Consumes: `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` from `@/components/ui/table` (Sprint 3); `Button` from `@/components/ui/button` (Sprint 1); `InventoryFilters` from `@/components/inventario/InventoryFilters` (Task 4); `fetchInventario`, `INVENTARIO_PAGE_SIZE` from `@/lib/supabase/get-inventario` (Task 3); `formatCOP`, `formatNumber` from `@/lib/format` (Sprint 3); `InventarioFiltros`, `InventarioItem` from `@/lib/types/inventario` (Task 1).
- Produces: `InventoryTable` component (no props) from `@/components/inventario/InventoryTable`. Task 6 imports this by exact name.

- [ ] **Step 1: Create the component**

Create `frontend/components/inventario/InventoryTable.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { InventoryFilters } from '@/components/inventario/InventoryFilters'
import { fetchInventario, INVENTARIO_PAGE_SIZE } from '@/lib/supabase/get-inventario'
import { formatCOP, formatNumber } from '@/lib/format'
import type { InventarioFiltros, InventarioItem } from '@/lib/types/inventario'

const STOCK_BAJO_THRESHOLD = 2

const FILTROS_INICIALES: InventarioFiltros = {
  vin: '',
  marca: '',
  categoria: '',
  estado: 'todos',
  desde: '',
  hasta: '',
}

export function InventoryTable() {
  const [filtros, setFiltros] = useState<InventarioFiltros>(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [filas, setFilas] = useState<InventarioItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      fetchInventario(filtros, pagina)
        .then((resultado) => {
          setFilas(resultado.filas)
          setTotal(resultado.total)
        })
        .catch((error) => {
          console.error('Failed to fetch inventario:', error)
          setFilas([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    }, 500)

    return () => clearTimeout(timeout)
  }, [filtros, pagina])

  function handleFiltrosChange(nuevosFiltros: InventarioFiltros) {
    setFiltros(nuevosFiltros)
    setPagina(1)
  }

  function handleExportarCsv() {
    const encabezados = [
      'VIN',
      'Marca',
      'Categoría',
      'Ubicación',
      'Saldo',
      'Valor Unitario',
      'Valor Total',
      'Último Movimiento',
    ]
    const filasCsv = filas.map((item) =>
      [
        item.vin,
        item.marca ?? '',
        item.categoria ?? '',
        item.ubicacion ?? '',
        item.saldo,
        item.valor_unitario ?? '',
        item.valor_total,
        item.ultimo_movimiento,
      ]
        .map((valor) => `"${String(valor).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = [encabezados.join(','), ...filasCsv].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = 'inventario.csv'
    enlace.click()
    URL.revokeObjectURL(url)
  }

  const totalPaginas = Math.max(1, Math.ceil(total / INVENTARIO_PAGE_SIZE))

  return (
    <div className="space-y-4">
      <InventoryFilters filtros={filtros} onChange={handleFiltrosChange} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Cargando...' : `Mostrando ${filas.length} de ${total} resultados`}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={handleExportarCsv}
          disabled={filas.length === 0}
        >
          Exportar CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>VIN</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead className="text-right">Valor Total</TableHead>
            <TableHead>Último Movimiento</TableHead>
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
              <TableRow key={item.vin}>
                <TableCell className="font-medium">{item.vin}</TableCell>
                <TableCell>{item.marca ?? '—'}</TableCell>
                <TableCell>{item.categoria ?? '—'}</TableCell>
                <TableCell>{item.ubicacion ?? '—'}</TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1">
                    {item.saldo <= STOCK_BAJO_THRESHOLD && (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    {formatNumber(item.saldo)}
                  </span>
                </TableCell>
                <TableCell className="text-right">{formatCOP(item.valor_total)}</TableCell>
                <TableCell>
                  {new Date(item.ultimo_movimiento).toLocaleDateString('es-CO')}
                </TableCell>
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
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. If `Button`'s `variant="outline"` prop isn't recognized, open `frontend/components/ui/button.tsx` to confirm the actual prop name/values it supports (it's a shadcn `Button` installed in Sprint 1, built on `@base-ui/react`'s `buttonVariants` — it should already support a `variant` prop; if the exact variant name differs, use whichever existing variant reads as a secondary/subtle button style, and note the substitution in your report).

- [ ] **Step 3: Commit**

```bash
git add components/inventario/InventoryTable.tsx
git commit -m "feat: agregar tabla de inventario con paginacion, filtros y export CSV"
```

---

### Task 6: Wire the Inventario page

**Files:**
- Modify: `frontend/app/(panel)/inventario/page.tsx`

**Interfaces:**
- Consumes: `RoleGuard` from `@/components/shared/RoleGuard` (Sprint 2); `ROUTE_PERMISSIONS` from `@/lib/permissions/roles` (Sprint 2); `InventoryTable` from `@/components/inventario/InventoryTable` (Task 5).
- Produces: nothing new — final integration point for this plan.

- [ ] **Step 1: Replace the page's content**

Replace the full contents of `frontend/app/(panel)/inventario/page.tsx` with:

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

- [ ] **Step 2: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: exit code 0, no errors.

- [ ] **Step 3: Verify the page shell renders (curl-visible parts only)**

Confirm `frontend/.env.local` has `DEV_SKIP_AUTH=true` and `DEV_SKIP_AUTH_ROLE=supervisor` (restore if missing). Run `npm run dev` (background), then:

```bash
curl -s http://localhost:3000/inventario | grep -o "Inventario\|Exportar CSV\|VIN\|Categoría\|Estado"
```

Expected: all of these strings present — this confirms the SERVER-RENDERED shell (page title, filter labels, export button, table headers) is correct. **Important limitation to note in your report:** the actual data rows are fetched client-side (via the Server Action, after the page hydrates in the browser) — curl cannot see them, since curl doesn't execute JavaScript. This is expected and matches the architecture (Client Component + Server Action), not a bug. A full check of pagination/filtering/data actually appearing requires a real browser — note this as unverified-by-construction in your report, the same way prior sprints' reports have flagged curl's limits.

Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add "app/(panel)/inventario/page.tsx"
git commit -m "feat: conectar tabla de inventario en la pagina"
```

---

## After This Plan

Sprint 4 is done once Task 6 is committed and its review is clean. Remaining:

1. A real browser check (not just curl) is worth doing once the app is running, to confirm the client-side fetch → render → paginate → filter loop actually works end-to-end with the example data, and that CSV export downloads a well-formed file.
2. Real Supabase project still doesn't exist — `fetchInventario`'s real-query branch is written and type-checks but is unverified against a live database, same caveat as Sprints 1-3.
3. Sprint 5 (Movimientos + Entradas) is a separate spec/plan.
