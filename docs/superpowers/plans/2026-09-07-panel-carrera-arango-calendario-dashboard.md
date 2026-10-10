# Calendario personal en el Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un widget de calendario personal (mini-grid de mes + próximos eventos + agregar/borrar) en la parte superior del Dashboard, visible para cualquier rol, con eventos privados por usuario.

**Architecture:** Un Server Action file (`lib/supabase/calendario-actions.ts`, `'use server'` a nivel de archivo) expone `fetchEventos`, `crearEvento`, `eliminarEvento`, todas filtrando por el usuario autenticado. Un Client Component nuevo (`components/dashboard/CalendarWidget.tsx`) hace su propio fetch al montar (mismo patrón que `AdjustmentApproval`), renderiza un mini-grid de mes construido a mano (sin dependencias nuevas) + lista de próximos eventos + un `Dialog` con formulario RHF+Zod para agregar. Se inserta como primer elemento del Dashboard existente.

**Tech Stack:** React Hook Form + Zod + `@hookform/resolvers` (ya instalados), `sonner` (ya instalado), shadcn `Dialog`/`Form`/`Input`/`Textarea`/`Button`/`Card` (ya instalados).

## Global Constraints

- TypeScript `strict: true`, sin `any`.
- Server Action file con `'use server'` como PRIMERA línea del archivo (lección ya establecida en Sprints 4-6 — la forma por función rompe `npm run build` cuando un Client Component importa la acción directamente).
- Cada llamada a Supabase revisa `{ error }`, lo loguea, y cae a un fallback seguro (`{ok:false,error}` en mutaciones, `[]` en lecturas) — nunca lanza excepción.
- Los eventos son privados por usuario: la rama real de cada Server Action filtra siempre por `usuario_id = <usuario autenticado>` (vía `getSessionUser()`), aparte de la política RLS que se documenta para el equipo de backend (no se ejecuta desde el frontend).
- `fecha` se maneja siempre como string plano `'YYYY-MM-DD'` (sin objetos `Date` con zona horaria) tanto en el schema Zod como en el estado del componente — el mini-grid es un widget personal renderizado en el navegador del usuario, por lo que usa el reloj local del navegador directamente (no el ajuste fijo `BOGOTA_OFFSET_MS` que sí usa el Dashboard para KPIs/reportes — ese ajuste es innecesario aquí porque no hay agregación de datos entre husos horarios, solo la fecha que el propio usuario ve en su pantalla).
- Tabla real `eventos_calendario` no existe todavía — se documenta el SQL sugerido (ya en el spec) pero el código real queda sin probar hasta que el equipo de backend la cree, igual que el resto del proyecto.

---

### Task 1: Tipos, datos de ejemplo y Server Actions de calendario

**Files:**
- Create: `frontend/lib/types/calendario.ts`
- Create: `frontend/lib/dev/preview-calendario-data.ts`
- Create: `frontend/lib/supabase/calendario-actions.ts`

**Interfaces:**
- Consumes: `createClient` (Sprint 1), `getSessionUser` (Sprint 1), `isDevBypassActive` (Sprint 2).
- Produces: `crearEventoSchema`, `CrearEventoInput`, `CalendarEvento`, `EventoResultado` desde `@/lib/types/calendario`; `getDevPreviewCalendarioData(): CalendarEvento[]` desde `@/lib/dev/preview-calendario-data`; `fetchEventos`, `crearEvento`, `eliminarEvento` desde `@/lib/supabase/calendario-actions`. Task 2 importa estos nombres exactos.

- [ ] **Step 1: Crear los tipos**

Create `frontend/lib/types/calendario.ts`:

```ts
import { z } from 'zod'

export const crearEventoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  titulo: z.string().trim().min(1, 'El título es requerido'),
  nota: z.string().trim().optional(),
})

export type CrearEventoInput = z.infer<typeof crearEventoSchema>

export interface CalendarEvento {
  id: number
  fecha: string
  titulo: string
  nota: string | null
}

export type EventoResultado = { ok: true } | { ok: false; error: string }
```

- [ ] **Step 2: Crear los datos de ejemplo**

Create `frontend/lib/dev/preview-calendario-data.ts`:

```ts
import type { CalendarEvento } from '@/lib/types/calendario'

const DAY_MS = 24 * 60 * 60 * 1000

function toFechaKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function getDevPreviewCalendarioData(): CalendarEvento[] {
  const hoy = new Date()
  const offsets = [1, 3, -2, 7]
  const titulos = [
    'Reunión con proveedor',
    'Corte de inventario mensual',
    'Entrega de repuestos',
    'Auditoría interna',
  ]
  const notas: (string | null)[] = [
    'Confirmar cantidades antes de la reunión',
    null,
    'Recoger en bodega principal',
    null,
  ]

  return offsets.map((offset, i) => ({
    id: i + 1,
    fecha: toFechaKey(new Date(hoy.getTime() + offset * DAY_MS)),
    titulo: titulos[i],
    nota: notas[i],
  }))
}
```

- [ ] **Step 3: Crear las Server Actions**

Create `frontend/lib/supabase/calendario-actions.ts` — `'use server'` debe ser la PRIMERA línea del archivo:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewCalendarioData } from '@/lib/dev/preview-calendario-data'
import {
  crearEventoSchema,
  type CalendarEvento,
  type CrearEventoInput,
  type EventoResultado,
} from '@/lib/types/calendario'

export async function fetchEventos(): Promise<CalendarEvento[]> {
  if (isDevBypassActive()) {
    return getDevPreviewCalendarioData()
  }

  const user = await getSessionUser()
  if (!user) {
    return []
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('eventos_calendario')
    .select('id, fecha, titulo, nota')
    .eq('usuario_id', user.id)
    .order('fecha', { ascending: true })

  if (error) {
    console.error('Failed to load eventos_calendario:', error)
    return []
  }

  return data ?? []
}

export async function crearEvento(datos: CrearEventoInput): Promise<EventoResultado> {
  const parsed = crearEventoSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('eventos_calendario').insert({
    usuario_id: user.id,
    fecha: parsed.data.fecha,
    titulo: parsed.data.titulo,
    nota: parsed.data.nota ?? null,
  })

  if (error) {
    console.error('Failed to insert evento_calendario:', error)
    return { ok: false, error: 'No se pudo guardar el evento. Intenta de nuevo.' }
  }

  return { ok: true }
}

export async function eliminarEvento(id: number): Promise<EventoResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('eventos_calendario')
    .delete()
    .eq('id', id)
    .eq('usuario_id', user.id)

  if (error) {
    console.error('Failed to delete evento_calendario:', error)
    return { ok: false, error: 'No se pudo borrar el evento. Intenta de nuevo.' }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add lib/types/calendario.ts lib/dev/preview-calendario-data.ts lib/supabase/calendario-actions.ts
git commit -m "feat: agregar tipos, datos de ejemplo y Server Actions de calendario"
```

---

### Task 2: CalendarWidget y wiring en el Dashboard

**Files:**
- Create: `frontend/components/dashboard/CalendarWidget.tsx`
- Modify: `frontend/app/(panel)/page.tsx`

**Interfaces:**
- Consumes: `crearEventoSchema`/`CrearEventoInput`/`CalendarEvento` desde `@/lib/types/calendario` (Task 1); `fetchEventos`/`crearEvento`/`eliminarEvento` desde `@/lib/supabase/calendario-actions` (Task 1); shadcn `Card`/`Button`/`Input`/`Textarea`/`Dialog`/`Form` family (ya instalados, ver Sprints 5-6).
- Produces: `CalendarWidget` (sin props). Última tarea de este plan.

- [ ] **Step 1: Crear CalendarWidget**

Create `frontend/components/dashboard/CalendarWidget.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { crearEventoSchema, type CrearEventoInput, type CalendarEvento } from '@/lib/types/calendario'
import { fetchEventos, crearEvento, eliminarEvento } from '@/lib/supabase/calendario-actions'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function fechaKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlanks = (firstDay.getDay() + 6) % 7
  const cells: (number | null)[] = Array(leadingBlanks).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

export function CalendarWidget() {
  const hoy = new Date()
  const [viewYear, setViewYear] = useState(hoy.getFullYear())
  const [viewMonth, setViewMonth] = useState(hoy.getMonth())
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(
    fechaKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  )
  const [eventos, setEventos] = useState<CalendarEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogoAbierto, setDialogoAbierto] = useState(false)

  const form = useForm<CrearEventoInput>({
    resolver: zodResolver(crearEventoSchema),
    defaultValues: { fecha: diaSeleccionado, titulo: '', nota: '' },
  })

  useEffect(() => {
    fetchEventos()
      .then(setEventos)
      .catch((error) => {
        console.error('Failed to fetch eventos:', error)
        setEventos([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (dialogoAbierto) {
      form.reset({ fecha: diaSeleccionado, titulo: '', nota: '' })
    }
  }, [dialogoAbierto, diaSeleccionado, form])

  const hoyKey = fechaKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])
  const fechasConEvento = useMemo(() => new Set(eventos.map((e) => e.fecha)), [eventos])
  const proximosEventos = useMemo(
    () => eventos.filter((e) => e.fecha >= hoyKey).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [eventos, hoyKey]
  )

  function irMesAnterior() {
    const nuevo = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(nuevo.getFullYear())
    setViewMonth(nuevo.getMonth())
  }

  function irMesSiguiente() {
    const nuevo = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(nuevo.getFullYear())
    setViewMonth(nuevo.getMonth())
  }

  async function onSubmit(datos: CrearEventoInput) {
    const resultado = await crearEvento(datos)
    if (resultado.ok) {
      toast.success('Evento agregado.')
      setDialogoAbierto(false)
      const actualizados = await fetchEventos()
      setEventos(actualizados)
    } else {
      toast.error(resultado.error)
    }
  }

  async function handleBorrar(id: number) {
    const resultado = await eliminarEvento(id)
    if (resultado.ok) {
      toast.success('Evento borrado.')
      setEventos((prev) => prev.filter((e) => e.id !== id))
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Calendario</CardTitle>
        <Button type="button" size="sm" onClick={() => setDialogoAbierto(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Agregar evento
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={irMesAnterior}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {MESES[viewMonth]} {viewYear}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={irMesSiguiente}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {DIAS_SEMANA.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((dia, i) => {
              if (dia === null) return <div key={`blank-${i}`} />
              const key = fechaKey(viewYear, viewMonth, dia)
              const tieneEvento = fechasConEvento.has(key)
              const esSeleccionado = key === diaSeleccionado
              const esHoy = key === hoyKey
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDiaSeleccionado(key)}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors ${
                    esSeleccionado
                      ? 'bg-primary text-primary-foreground'
                      : esHoy
                        ? 'bg-accent'
                        : 'hover:bg-accent'
                  }`}
                >
                  {dia}
                  {tieneEvento && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Próximos eventos</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : proximosEventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos próximos.</p>
          ) : (
            <ul className="space-y-2">
              {proximosEventos.map((evento) => (
                <li
                  key={evento.id}
                  className="flex items-start justify-between gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{evento.titulo}</p>
                    <p className="text-xs text-muted-foreground">{evento.fecha}</p>
                    {evento.nota && (
                      <p className="text-xs text-muted-foreground">{evento.nota}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBorrar(evento.id)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Borrar evento"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar evento</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nota"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota (opcional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
```

Si `Button`'s `size="sm"` o `variant="outline"` no compilan contra la versión instalada de `components/ui/button.tsx`, abre ese archivo y usa el nombre de variante más cercano que exista — ya se confirmó en el plan de Ajustes (Sprint 6) que `sm` existe, así que no debería ser un problema, pero verifícalo si `tsc` se queja.

- [ ] **Step 2: Insertar el widget en el Dashboard**

En `frontend/app/(panel)/page.tsx`, agrega el import:

```ts
import { CalendarWidget } from '@/components/dashboard/CalendarWidget'
```

Luego, dentro de `DashboardContent`, en el `return`, agrega `<CalendarWidget />` como el PRIMER hijo de `<div className="space-y-6">`, antes del `<div>` que contiene el saludo (`Bienvenido, ...`). El resultado debe quedar así (mostrando el inicio del bloque, el resto de `DashboardContent` no cambia):

```tsx
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
```

(el resto del archivo — KPIs, gráfico, tabla, `RealtimeRefresher` — permanece exactamente igual)

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit` — esperado exit 0.
Run: `npm run build` — esperado exit 0 (chequeo crítico: `CalendarWidget` es Client Component que importa las Server Actions de Task 1 directamente).

- [ ] **Step 4: Verificar visualmente con curl**

Confirma que `frontend/.env.local` tiene `DEV_SKIP_AUTH=true` (cualquier rol sirve, ya que `dashboard: ALL_ROLES`). Corre `npm run dev` (background), luego:

```bash
curl -s http://localhost:3000/ | grep -o "Calendario\|Agregar evento\|Próximos eventos"
```

Expected: los tres presentes. Detén el servidor de dev después.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/CalendarWidget.tsx "app/(panel)/page.tsx"
git commit -m "feat: agregar calendario personal al Dashboard"
```

---

## After This Plan

1. Verificación manual en navegador real de: click en días del mini-grid, navegación de mes con las flechas, agregar un evento y verlo aparecer en la lista sin recargar, borrar un evento — curl no puede ejercitar interacción de clicks ni el Dialog.
2. La tabla real `eventos_calendario` y su RLS (SQL documentado en el spec) no existen todavía — la rama real de las Server Actions queda escrita correctamente pero sin probar hasta que el equipo de backend la cree.
3. El usuario pidió ver el resultado visual antes de decidir si iterar el diseño ("depende como se vea miramos el diseño para una segunda version") — no se debe iterar el look por cuenta propia, esperar feedback después de esta implementación.
