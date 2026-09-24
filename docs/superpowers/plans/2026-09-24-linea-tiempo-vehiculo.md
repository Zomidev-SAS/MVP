# Línea de tiempo del vehículo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al Dashboard, debajo del calendario, una tarjeta que permita buscar un vehículo por chasis/placa y ver la línea de tiempo de sus formularios (Entrada, Parqueadero, Salida) en orden cronológico.

**Architecture:** Dos Server Actions nuevas leen la tabla `formularios` (misma query base que `fetchFormularios`) y filtran en memoria por chasis, porque el chasis vive en JSON heterogéneo sin columna fija confiable. Un helper puro transforma filas `FormularioListado` en eventos de línea de tiempo. Un client component (`VehiculoTimelineCard`) hace búsqueda con debounce y pinta la línea de tiempo con Tailwind puro (sin librería de timeline).

**Tech Stack:** Next.js App Router (Server Components + Server Actions), TypeScript, Supabase JS client, Tailwind, `lucide-react` (ya es dependencia, íconos `ArrowDownToLine`, `ParkingSquare`, `ArrowUpFromLine` confirmados en `node_modules/lucide-react@1.34.0`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-24-linea-tiempo-vehiculo-design.md` — léela antes de empezar.
- Sin cambios en Supabase/DB/RLS. Solo lectura de `formularios`, permiso `ROUTE_PERMISSIONS.formularios` (ya existe, ya coincide con `dashboard`).
- Sin librerías nuevas. Reusar patrones de `lib/supabase/formularios-actions.ts`, `lib/formularios/normalize.ts`, `lib/formularios/fechas.ts`.
- **No hay framework de tests en este repo** (no jest/vitest/playwright, `package.json` solo tiene `dev/build/start/lint`). La verificación de cada task es: `npx tsc --noEmit` (type-check) + `npm run lint`. La verificación funcional final es manual, en el navegador con `npm run dev` (regla del proyecto: cambios de UI se prueban en el navegador antes de darlos por completos).
- Todo el código nuevo en español (nombres de función, comentarios si aplican, textos de UI), igual que el resto del proyecto.
- Commits en español, sin `Co-Authored-By` (estilo del proyecto).

---

### Task 1: Helper de línea de tiempo (`lib/formularios/linea-tiempo.ts`)

**Files:**
- Create: `frontend/lib/formularios/linea-tiempo.ts`

**Interfaces:**
- Consumes: `FormularioListado` y `vistaFormulario` de `@/lib/types/formularios`; `datosGeneralesDe`, `valorDbColumna` de `@/lib/formularios/db-columns`; `normalizarTextoBusqueda` de `@/lib/formularios/busqueda`.
- Produces (usados por Task 2 y Task 3):
  - `type EventoLineaTiempo = { id: string; tipoLabel: string; fecha: string | null; chasis: string; marca: string | null; ciudad: string | null }`
  - `type VehiculoSugerencia = { chasis: string; marca: string | null; ciudad: string | null }`
  - `function construirEventosLineaTiempo(filas: FormularioListado[]): EventoLineaTiempo[]`
  - `function extraerSugerenciasVehiculo(filas: FormularioListado[], termino: string, limite?: number): VehiculoSugerencia[]`

- [ ] **Step 1: Escribir el archivo**

```ts
import { datosGeneralesDe, valorDbColumna } from '@/lib/formularios/db-columns'
import { normalizarTextoBusqueda } from '@/lib/formularios/busqueda'
import { vistaFormulario, type FormularioListado } from '@/lib/types/formularios'

export interface EventoLineaTiempo {
  id: string
  tipoLabel: string
  fecha: string | null
  chasis: string
  marca: string | null
  ciudad: string | null
}

export interface VehiculoSugerencia {
  chasis: string
  marca: string | null
  ciudad: string | null
}

function ciudadDe(fila: FormularioListado): string | null {
  const dg = datosGeneralesDe(fila.rawData)
  return (
    valorDbColumna(fila.dbColumns, 'dg_ciudad') ??
    (typeof dg?.ciudad === 'string' && dg.ciudad.trim() ? dg.ciudad.trim() : null)
  )
}

function fechaEvento(vista: ReturnType<typeof vistaFormulario>): string | null {
  return vista.fechaIngreso ?? vista.fechaSalida
}

/** Eventos de un vehículo (ya filtrado por chasis), ordenados cronológicamente ascendente. */
export function construirEventosLineaTiempo(filas: FormularioListado[]): EventoLineaTiempo[] {
  return filas
    .map((fila) => {
      const vista = vistaFormulario(fila)
      return {
        id: fila.id,
        tipoLabel: vista.tipoLabel,
        fecha: fechaEvento(vista),
        chasis: vista.chasis,
        marca: vista.marca,
        ciudad: ciudadDe(fila),
      }
    })
    .sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0
      if (!a.fecha) return -1
      if (!b.fecha) return 1
      return a.fecha.localeCompare(b.fecha)
    })
}

/** Sugerencias de vehículos (chasis únicos) que hacen match con el término de búsqueda. */
export function extraerSugerenciasVehiculo(
  filas: FormularioListado[],
  termino: string,
  limite = 8
): VehiculoSugerencia[] {
  const q = normalizarTextoBusqueda(termino)
  if (!q) return []

  const vistas = new Map<string, VehiculoSugerencia>()

  for (const fila of filas) {
    const vista = vistaFormulario(fila)
    if (vista.chasis === '—') continue
    if (!normalizarTextoBusqueda(vista.chasis).includes(q)) continue
    if (vistas.has(vista.chasis)) continue

    vistas.set(vista.chasis, {
      chasis: vista.chasis,
      marca: vista.marca,
      ciudad: ciudadDe(fila),
    })

    if (vistas.size >= limite) break
  }

  return Array.from(vistas.values())
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `linea-tiempo.ts` (el proyecto puede tener warnings preexistentes ajenos a este archivo — solo confirmar que no aparecen errores en este archivo nuevo).

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/formularios/linea-tiempo.ts
git commit -m "feat: agregar helper de linea de tiempo por vehiculo"
```

---

### Task 2: Server Actions (`lib/supabase/vehiculo-timeline-actions.ts`)

**Files:**
- Create: `frontend/lib/supabase/vehiculo-timeline-actions.ts`

**Interfaces:**
- Consumes: `EventoLineaTiempo`, `VehiculoSugerencia`, `construirEventosLineaTiempo`, `extraerSugerenciasVehiculo` de Task 1 (`@/lib/formularios/linea-tiempo`); `requireRole` de `@/lib/auth/require-role`; `createClient` de `@/lib/supabase/server`; `isDevBypassActive` de `@/lib/dev/preview-bypass`; `ROUTE_PERMISSIONS` de `@/lib/permissions/roles`; `getDevPreviewFormulariosData` de `@/lib/dev/preview-formularios-data`; `normalizarFormularios` de `@/lib/formularios/normalize`.
- Produces (usados por Task 3):
  - `async function buscarVehiculosFormulario(termino: string): Promise<VehiculoSugerencia[]>`
  - `async function fetchLineaTiempoVehiculo(chasis: string): Promise<EventoLineaTiempo[]>`

- [ ] **Step 1: Escribir el archivo**

```ts
'use server'

import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getDevPreviewFormulariosData } from '@/lib/dev/preview-formularios-data'
import { normalizarFormularios } from '@/lib/formularios/normalize'
import { normalizarTextoBusqueda } from '@/lib/formularios/busqueda'
import { vistaFormulario, type FormularioListado } from '@/lib/types/formularios'
import {
  construirEventosLineaTiempo,
  extraerSugerenciasVehiculo,
  type EventoLineaTiempo,
  type VehiculoSugerencia,
} from '@/lib/formularios/linea-tiempo'

const MAX_FORMULARIOS_CARGA = 2000

async function cargarFormularios(): Promise<FormularioListado[]> {
  if (isDevBypassActive()) {
    return getDevPreviewFormulariosData()
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.formularios)
  if (!auth.ok) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formularios')
    .select('*')
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(MAX_FORMULARIOS_CARGA)

  if (error) {
    console.error('Failed to load formularios for vehicle timeline:', error)
    return []
  }

  return normalizarFormularios(data)
}

export async function buscarVehiculosFormulario(termino: string): Promise<VehiculoSugerencia[]> {
  const filas = await cargarFormularios()
  return extraerSugerenciasVehiculo(filas, termino)
}

export async function fetchLineaTiempoVehiculo(chasis: string): Promise<EventoLineaTiempo[]> {
  const chasisNorm = normalizarTextoBusqueda(chasis)
  if (!chasisNorm) return []

  const filas = await cargarFormularios()
  const filasDelVehiculo = filas.filter(
    (fila) => normalizarTextoBusqueda(vistaFormulario(fila).chasis) === chasisNorm
  )

  return construirEventosLineaTiempo(filasDelVehiculo)
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores en `vehiculo-timeline-actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/supabase/vehiculo-timeline-actions.ts
git commit -m "feat: agregar server actions de linea de tiempo por vehiculo"
```

---

### Task 3: Componente `VehiculoTimelineCard`

**Files:**
- Create: `frontend/components/dashboard/VehiculoTimelineCard.tsx`

**Interfaces:**
- Consumes: `buscarVehiculosFormulario`, `fetchLineaTiempoVehiculo` de Task 2 (`@/lib/supabase/vehiculo-timeline-actions`); `EventoLineaTiempo`, `VehiculoSugerencia` de Task 1 (`@/lib/formularios/linea-tiempo`); `formatearFechaFormulario` de `@/lib/types/formularios`; `Card/CardHeader/CardTitle/CardContent` de `@/components/ui/card`; `Input` de `@/components/ui/input`; íconos `ArrowDownToLine`, `ArrowUpFromLine`, `ParkingSquare`, `Loader2`, `Search` de `lucide-react`.
- Produces (usado por Task 4): `export function VehiculoTimelineCard()` — sin props, self-contained.

- [ ] **Step 1: Escribir el archivo**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Loader2, ParkingSquare, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatearFechaFormulario } from '@/lib/types/formularios'
import {
  buscarVehiculosFormulario,
  fetchLineaTiempoVehiculo,
} from '@/lib/supabase/vehiculo-timeline-actions'
import type { EventoLineaTiempo, VehiculoSugerencia } from '@/lib/formularios/linea-tiempo'

function iconoPorTipo(tipoLabel: string) {
  const t = tipoLabel.toLowerCase()
  if (t === 'entrada') return ArrowDownToLine
  if (t === 'salida') return ArrowUpFromLine
  return ParkingSquare
}

export function VehiculoTimelineCard() {
  const [termino, setTermino] = useState('')
  const [sugerencias, setSugerencias] = useState<VehiculoSugerencia[]>([])
  const [buscando, setBuscando] = useState(false)
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoSugerencia | null>(
    null
  )
  const [eventos, setEventos] = useState<EventoLineaTiempo[]>([])
  const [cargandoEventos, setCargandoEventos] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (vehiculoSeleccionado) return
    const q = termino.trim()
    if (q.length < 2) {
      setSugerencias([])
      return
    }

    setBuscando(true)
    const timeout = setTimeout(() => {
      buscarVehiculosFormulario(q)
        .then(setSugerencias)
        .catch((error) => {
          console.error('Failed to search vehiculos:', error)
          setSugerencias([])
        })
        .finally(() => setBuscando(false))
    }, 400)

    return () => clearTimeout(timeout)
  }, [termino, vehiculoSeleccionado])

  function seleccionarVehiculo(sugerencia: VehiculoSugerencia) {
    setVehiculoSeleccionado(sugerencia)
    setTermino(sugerencia.chasis)
    setSugerencias([])
    setCargandoEventos(true)
    fetchLineaTiempoVehiculo(sugerencia.chasis)
      .then(setEventos)
      .catch((error) => {
        console.error('Failed to load vehicle timeline:', error)
        setEventos([])
      })
      .finally(() => setCargandoEventos(false))
  }

  function limpiarSeleccion() {
    setVehiculoSeleccionado(null)
    setEventos([])
    setTermino('')
    inputRef.current?.focus()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Línea de tiempo del vehículo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={termino}
            onChange={(e) => {
              setTermino(e.target.value)
              if (vehiculoSeleccionado) setVehiculoSeleccionado(null)
            }}
            placeholder="Buscar por chasis o placa..."
            className="pl-9"
          />

          {!vehiculoSeleccionado && termino.trim().length >= 2 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
              {buscando ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
              ) : sugerencias.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias.</p>
              ) : (
                sugerencias.map((s) => (
                  <button
                    key={s.chasis}
                    type="button"
                    onClick={() => seleccionarVehiculo(s)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="font-mono font-medium">{s.chasis}</span>
                    <span className="text-xs text-muted-foreground">
                      {[s.marca, s.ciudad].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {!vehiculoSeleccionado && (
          <p className="text-sm text-muted-foreground">
            Busca un vehículo por chasis o placa para ver su historial.
          </p>
        )}

        {vehiculoSeleccionado && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Chasis <span className="font-mono font-medium">{vehiculoSeleccionado.chasis}</span>
              </p>
              <button
                type="button"
                onClick={limpiarSeleccion}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Buscar otro
              </button>
            </div>

            {cargandoEventos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando historial...
              </div>
            ) : eventos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este vehículo no tiene formularios registrados.
              </p>
            ) : (
              <ol className="space-y-4 border-l border-border pl-4">
                {eventos.map((evento) => {
                  const Icono = iconoPorTipo(evento.tipoLabel)
                  return (
                    <li key={evento.id} className="relative">
                      <span className="absolute -left-[21px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background">
                        <Icono className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-sm font-medium">{evento.tipoLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatearFechaFormulario(evento.fecha) || 'Sin fecha'}
                        {evento.ciudad ? ` · ${evento.ciudad}` : ''}
                      </p>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores en `VehiculoTimelineCard.tsx`. Si `Input` no acepta `ref` vía forwardRef, el error lo dirá explícitamente — en ese caso quitar el `ref`/`inputRef` (no es esencial, solo foco de conveniencia tras "Buscar otro").

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores nuevos en el archivo.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/dashboard/VehiculoTimelineCard.tsx
git commit -m "feat: agregar card de linea de tiempo del vehiculo"
```

---

### Task 4: Insertar en el Dashboard y verificación manual

**Files:**
- Modify: `frontend/app/(panel)/page.tsx`

**Interfaces:**
- Consumes: `VehiculoTimelineCard` de Task 3 (`@/components/dashboard/VehiculoTimelineCard`).

- [ ] **Step 1: Editar `app/(panel)/page.tsx`**

Agregar el import junto a los demás de `components/dashboard`:

```ts
import { VehiculoTimelineCard } from '@/components/dashboard/VehiculoTimelineCard'
```

Reemplazar:

```tsx
      {variante !== 'bitacora' && variante !== 'basico' && <CalendarWidget />}
```

por:

```tsx
      {variante !== 'bitacora' && variante !== 'basico' && <CalendarWidget />}

      <VehiculoTimelineCard />
```

(Sin condición de variante — visible para todos los roles con acceso al dashboard, según lo aprobado.)

- [ ] **Step 2: Type-check y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Verificación manual en navegador**

Run: `npm run dev` (usar `DEV_SKIP_AUTH=true` o `NEXT_PUBLIC_DEV_SKIP_AUTH=true` si el login local lo requiere, igual que el resto del dashboard en dev).

En el navegador, en `/`:
1. Confirmar que la card "Línea de tiempo del vehículo" aparece debajo del calendario (o al inicio, si la variante no tiene calendario).
2. Escribir 2+ caracteres de un chasis existente (con datos preview, chasis tipo `CH100000`, `CH100001`, ...) y confirmar que aparecen sugerencias.
3. Seleccionar una sugerencia y confirmar que se pinta la línea de tiempo con eventos ordenados cronológicamente.
4. Escribir un chasis inexistente y confirmar el estado "Sin coincidencias."
5. Click en "Buscar otro" y confirmar que vuelve al estado inicial de búsqueda.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(panel)/page.tsx"
git commit -m "feat: mostrar linea de tiempo del vehiculo en el dashboard"
```

---

## Self-Review Notes

- Cobertura del spec: búsqueda con debounce (Task 3), sugerencias limitadas (Task 1/2), timeline ordenada ascendente (Task 1), sin cruce con `movimientos` (Task 2 solo consulta `formularios`), permiso reusado `ROUTE_PERMISSIONS.formularios` (Task 2), visible en todas las variantes (Task 4) — todo cubierto.
- Sin placeholders: cada task tiene código completo, no hay "TBD" ni "similar a Task N".
- Tipos consistentes: `EventoLineaTiempo` y `VehiculoSugerencia` se definen una sola vez en Task 1 y se importan igual en Task 2 y 3; `construirEventosLineaTiempo`/`extraerSugerenciasVehiculo` mismo nombre y firma en las tres tasks.
