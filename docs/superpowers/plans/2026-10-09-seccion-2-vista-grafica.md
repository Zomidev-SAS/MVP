# Sección 2: Vista Gráfica, Siigo y Correos por Rol — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el panel estático (recarga completa, alertas calculadas al cargar, Siigo manual con PDF, sin correos) en una vista viva por rol: gráficas, filtros, realtime, centro de notificaciones persistido, pantalla de automatizaciones, actividad en vivo, estado de sincronización Siigo, correos automáticos auditables, exportación, rendimiento y un modo pantalla de planta.

**Architecture:** Next.js 16 App Router (RSC + Server Actions) sobre Supabase (Postgres + Realtime + Edge Functions). Se mantiene el patrón existente: `RoleGuard` en cada página, Server Actions `'use server'` por módulo en `lib/supabase/*-actions.ts`, tipos manuales por módulo en `lib/types/*.ts`, datos de prueba en `lib/dev/preview-*-data.ts` detrás de `isDevBypassActive()`. Las gráficas usan Recharts 3 vía los primitivos ya existentes en `components/ui/chart.tsx`. El reemplazo de `RealtimeRefresher` (que hace `router.refresh()` completo por tabla) por un proveedor de realtime único y granular es el cambio estructural central de la sección.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Supabase (`@supabase/ssr`, `@supabase/supabase-js`, Realtime `postgres_changes`), Recharts 3, shadcn/ui (estilo `base-nova`, Base UI), Tailwind v4 (tokens OKLCH en `app/globals.css`), `sonner` (toasts), `papaparse` (CSV), `jspdf`/`jspdf-autotable` (PDF ya existente para OC).

## Global Constraints

- Todo debe funcionar en staging con **datos reales y login real**, sin `DEV_SKIP_AUTH`. El bypass solo se usa para desarrollar antes de la entrega anticipada del domingo 11, 6:00 p.m.
- No romper ninguna funcionalidad del Avance 1 ni los permisos por rol (`lib/permissions/roles.ts` es la fuente de verdad del lado frontend; debe seguir reflejando las políticas RLS reales).
- No mostrar costos a roles sin permiso. Usar siempre `CAN_VIEW_COSTS` (`['supervisor','compras','auditoria']`) de `lib/permissions/roles.ts` para condicionar cualquier gráfica/exportación de valorización.
- Roles existentes en código (`lib/types/database.ts`): `supervisor | comercial | metalmecanica | produccion | instalacion | compras | auditoria | lectura`. El documento del cliente agrupa "Metalmecánica / Producción" como un solo renglón de tabla, pero en código son dos roles distintos — tratarlos igual en reglas de acceso, cada uno con su propia bodega.
- Pesos colombianos y fechas en español en toda gráfica nueva (usar `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` y `Intl.DateTimeFormat('es-CO', ...)`, igual que el resto del panel).
- No existe framework de tests en `frontend/` (confirmado: sin `vitest`/`jest`/`playwright`, sin carpetas `*test*`). La verificación de cada tarea es manual: `npm run build` (o `next dev`) + comprobación visual/funcional contra el criterio de aceptación de la sección del documento del cliente. No se introduce un framework de tests nuevo en esta sección — es un cambio de arquitectura que el documento no pide y tomaría más de medio día (requeriría consultarlo primero, condición 8 del documento).
- El backend entrega el contrato de datos el viernes 9 a las 12:00 m. y los datos reales en Supabase cloud el domingo 11 a las 6:00 p.m. Hasta entonces se trabaja 100% con datos de prueba (`lib/dev/preview-*-data.ts`) que respeten la forma del contrato. El lunes 12 se reconcilian tipos contra lo real (Tarea 4.0).
- Convención de reporte diario (antes de 7:00 p.m., viernes a miércoles): terminado hoy con %, capturas/video, mañana, bloqueos, link de commit — ver spec sección 6. No es parte del código pero cada fase abajo indica qué debería ir en ese reporte el día correspondiente.

---

## Mapa de archivos nuevos/clave

```
frontend/
  lib/
    types/
      dashboard-graficas.ts        (NUEVO) tipos de series/KPIs de todas las gráficas nuevas
      notificaciones.ts            (MODIFICAR) agregar estado persistido + correo
      siigo.ts                     (MODIFICAR) agregar estado de sync de OC
      correos.ts                   (NUEVO) tipos de correos enviados
      automatizaciones.ts          (NUEVO) tipos de jobs/automatizaciones
      actividad.ts                 (NUEVO) tipos de línea de tiempo
    supabase/
      dashboard-graficas-actions.ts (NUEVO) fetch de series/KPIs por rol
      notificaciones-actions.ts    (MODIFICAR) marcar leída persistida, estado de correo
      ordenes-compra-actions.ts    (MODIFICAR) estado de sync Siigo, reintentar
      correos-actions.ts           (NUEVO) listar/reenviar correos
      automatizaciones-actions.ts  (NUEVO) listar estado de jobs
      actividad-actions.ts         (NUEVO) listar eventos de auditoría
    dev/
      preview-dashboard-graficas-data.ts (NUEVO)
      preview-correos-data.ts            (NUEVO)
      preview-automatizaciones-data.ts   (NUEVO)
      preview-actividad-data.ts          (NUEVO)
    hooks/
      use-dashboard-filters.ts     (NUEVO) filtros sincronizados con la URL
      use-realtime-channel.ts      (NUEVO) wrapper de canal realtime con reconexión
    export/
      chart-export.ts              (NUEVO) PNG (canvas) + CSV (papaparse) de una gráfica
  components/
    dashboard/
      charts/
        IndicadorCard.tsx          (NUEVO) tarjeta KPI con variación %
        EntradasSalidasChart.tsx   (EXISTE, sin cambios de contrato)
        StockPorBodegaChart.tsx    (NUEVO)
        StockPorCategoriaChart.tsx (NUEVO)
        TopProductosChart.tsx      (NUEVO)
        VehiculosPorEtapaChart.tsx (NUEVO)
        AjustesOCPorEstadoChart.tsx(NUEVO)
        ValorizacionChart.tsx      (NUEVO, solo CAN_VIEW_COSTS)
      DashboardFilters.tsx         (NUEVO)
      ChartExportMenu.tsx          (NUEVO) botón PNG/CSV reutilizable
      LiveIndicator.tsx            (NUEVO) "En vivo" + hora última actualización
    realtime/
      RealtimePanelProvider.tsx    (NUEVO) reemplaza RealtimeRefresher
    notifications/
      NotificationCenterSheet.tsx  (MODIFICAR, antes HeaderNotifications.tsx)
    compras/
      SiigoStatusBadge.tsx         (NUEVO)
      SiigoSyncPanel.tsx           (NUEVO, detalle de OC)
    automatizaciones/
      AutomatizacionCard.tsx       (NUEVO)
    actividad/
      ActividadTimeline.tsx        (NUEVO)
    correos/
      CorreosTable.tsx             (NUEVO)
      EnvioCorreoPreview.tsx       (NUEVO, aviso "se enviará a N usuarios")
    planta/
      PlantaKioskView.tsx          (NUEVO)
  app/(panel)/
    page.tsx                       (MODIFICAR) usa nuevas gráficas/filtros/realtime
    notificaciones/page.tsx        (NUEVO)
    automatizaciones/page.tsx      (NUEVO)
    actividad/page.tsx             (NUEVO)
    correos/page.tsx               (NUEVO)
    compras/page.tsx               (MODIFICAR) estado Siigo en lista
    compras/[id]/page.tsx          (NUEVO, si no existe detalle) estado Siigo + reintentar
  app/planta/[token]/page.tsx      (NUEVO, fuera de (panel), ver Fase 5)
```

---

## Fase 0 — Infraestructura compartida (jueves 8 / viernes 9 temprano)

### Task 0.1: Agregar primitivos shadcn faltantes

**Files:**
- Create: `frontend/components/ui/badge.tsx`
- Create: `frontend/components/ui/skeleton.tsx`
- Create: `frontend/components/ui/tabs.tsx`
- Create: `frontend/components/ui/select.tsx`
- Create: `frontend/components/ui/popover.tsx`
- Create: `frontend/components/ui/tooltip.tsx`
- Create: `frontend/components/ui/sheet.tsx` (si `MobileSidebarSheet.tsx` no ya envuelve uno; confirmar antes de generar)

**Interfaces:**
- Produces: componentes shadcn estándar (`Badge`, `Skeleton`, `Tabs/TabsList/TabsTrigger/TabsContent`, `Select/SelectTrigger/SelectContent/SelectItem`, `Popover/PopoverTrigger/PopoverContent`, `Tooltip/TooltipTrigger/TooltipContent`) que todas las fases siguientes importan de `@/components/ui/*`.

- [ ] **Step 1: Generar primitivos vía CLI shadcn**

```bash
cd frontend
npx shadcn@latest add badge skeleton tabs select popover tooltip
```

Revisar que respeten el estilo `base-nova` ya configurado en `components.json` y los tokens OKLCH de `app/globals.css` (no deben traer colores hardcodeados fuera de los `--chart-*`/`--success`/`--warning` existentes).

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: compila sin errores de tipos ni imports rotos.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/badge.tsx frontend/components/ui/skeleton.tsx frontend/components/ui/tabs.tsx frontend/components/ui/select.tsx frontend/components/ui/popover.tsx frontend/components/ui/tooltip.tsx
git commit -m "feat: agregar primitivos shadcn para seccion 2 (badge, skeleton, tabs, select, popover, tooltip)"
```

### Task 0.2: Tipos de contrato de datos (placeholder hasta viernes 12:00 m.)

**Files:**
- Create: `frontend/lib/types/dashboard-graficas.ts`
- Create: `frontend/lib/types/correos.ts`
- Create: `frontend/lib/types/automatizaciones.ts`
- Create: `frontend/lib/types/actividad.ts`
- Modify: `frontend/lib/types/siigo.ts`
- Modify: `frontend/lib/types/notificaciones.ts`

**Interfaces:**
- Produces: todos los tipos que Fases 1–5 consumen. Si el contrato del backend (viernes 12:00 m.) difiere, solo se ajustan estos archivos — Tarea 4.0 reconcilia.

- [ ] **Step 1: `dashboard-graficas.ts`**

```ts
// frontend/lib/types/dashboard-graficas.ts
export interface IndicadorKpi {
  id: string
  etiqueta: string
  valor: number
  unidad: 'unidades' | 'cop' | 'porcentaje' | 'dias'
  variacionPct: number | null // vs periodo anterior; null si no hay dato previo
}

export interface StockPorBodegaPunto {
  bodega: string
  cantidad: number
}

export interface StockPorCategoriaPunto {
  categoria: string
  cantidad: number
}

export interface TopProductoPunto {
  producto: string
  cantidad: number
}

export interface VehiculoPorEtapaPunto {
  etapa: string
  cantidad: number
  tiempoPromedioDias: number
}

export interface AjusteOCPorEstadoPunto {
  tipo: 'ajuste' | 'orden_compra'
  estado: string
  cantidad: number
}

export interface ValorizacionPunto {
  fecha: string // ISO date
  valorCop: number
}

export type RangoFecha = 'hoy' | '7d' | '30d' | '90d' | 'personalizado'

export interface DashboardFiltros {
  rango: RangoFecha
  desde?: string // ISO date, solo si rango === 'personalizado'
  hasta?: string
  bodegaId?: string
  categoriaId?: string
}

export interface DashboardGraficasPayload {
  kpis: IndicadorKpi[]
  entradasSalidas: { fecha: string; entradas: number; salidas: number }[]
  stockPorBodega: StockPorBodegaPunto[]
  stockPorCategoria: StockPorCategoriaPunto[]
  topProductos: TopProductoPunto[]
  vehiculosPorEtapa: VehiculoPorEtapaPunto[]
  ajustesOCPorEstado: AjusteOCPorEstadoPunto[]
  valorizacion: ValorizacionPunto[] | null // null si el rol no ve costos
}
```

- [ ] **Step 2: `correos.ts`**

```ts
// frontend/lib/types/correos.ts
export type EstadoCorreo = 'pendiente' | 'enviado' | 'error'
export type OrigenCorreo = 'alerta' | 'mensaje'

export interface CorreoEnviado {
  id: string
  destinatarioEmail: string
  destinatarioNombre: string
  rolDestino: string
  asunto: string
  origen: OrigenCorreo
  estado: EstadoCorreo
  fechaEnvio: string | null
  error: string | null
  creadoEn: string
}

export interface EnvioPreview {
  rol: string
  totalDestinatarios: number
}
```

- [ ] **Step 3: `automatizaciones.ts`**

```ts
// frontend/lib/types/automatizaciones.ts
export type AutomatizacionId =
  | 'stock_bajo'
  | 'recordatorios'
  | 'oc_vencidas'
  | 'cierre_diario'
  | 'reintentos_vin'
  | 'sincronizacion_siigo'
  | 'cola_correos'
  | 'reporte_semanal'

export type ResultadoAutomatizacion = 'ok' | 'error' | 'parcial' | 'sin_ejecutar'

export interface AutomatizacionEstado {
  id: AutomatizacionId
  nombre: string
  descripcion: string
  horario: string // cron humano, ej "cada 15 minutos"
  ultimaEjecucion: string | null
  resultado: ResultadoAutomatizacion
  error: string | null
}
```

- [ ] **Step 4: `actividad.ts`**

```ts
// frontend/lib/types/actividad.ts
export interface EventoActividad {
  id: string
  actorNombre: string
  accion: string // "creó ajuste", "aprobó OC", etc.
  recurso: string // tabla/entidad afectada
  recursoId: string | null
  bodega: string | null
  creadoEn: string
}
```

- [ ] **Step 5: extender `siigo.ts`**

```ts
// agregar a frontend/lib/types/siigo.ts
export type EstadoSyncSiigo = 'pendiente' | 'enviando' | 'sincronizada' | 'error'

export interface SiigoSyncInfo {
  estado: EstadoSyncSiigo
  referencia: string | null
  fecha: string | null
  error: string | null
}
```

- [ ] **Step 6: extender `notificaciones.ts`**

```ts
// agregar a frontend/lib/types/notificaciones.ts
export interface EstadoCorreoNotificacion {
  enviado: boolean
  fecha: string | null
}

// Extender NotificacionesPayload existente agregando por item:
// correoEnviado?: EstadoCorreoNotificacion
```

- [ ] **Step 7: Verificar build**

Run: `npm run build`
Expected: sin errores (archivos aún no se usan en ningún componente, solo deben parsear).

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/types/dashboard-graficas.ts frontend/lib/types/correos.ts frontend/lib/types/automatizaciones.ts frontend/lib/types/actividad.ts frontend/lib/types/siigo.ts frontend/lib/types/notificaciones.ts
git commit -m "feat: tipos base para graficas, correos, automatizaciones y actividad (seccion 2)"
```

### Task 0.3: Filtros de dashboard sincronizados con la URL (F2)

**Files:**
- Create: `frontend/lib/hooks/use-dashboard-filters.ts`
- Create: `frontend/components/dashboard/DashboardFilters.tsx`

**Interfaces:**
- Consumes: `DashboardFiltros`, `RangoFecha` de `lib/types/dashboard-graficas.ts`.
- Produces: hook `useDashboardFilters(): { filtros: DashboardFiltros; setRango, setBodega, setCategoria, setRangoPersonalizado }` y componente `<DashboardFilters bodegas={...} categorias={...} puedeFiltrarCostos={...} />` que Fase 2 monta arriba de las gráficas.

- [ ] **Step 1: Hook de filtros en URL**

```tsx
// frontend/lib/hooks/use-dashboard-filters.ts
'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { DashboardFiltros, RangoFecha } from '@/lib/types/dashboard-graficas'

const RANGOS_VALIDOS: RangoFecha[] = ['hoy', '7d', '30d', '90d', 'personalizado']

export function useDashboardFilters(): {
  filtros: DashboardFiltros
  setRango: (r: RangoFecha, personalizado?: { desde: string; hasta: string }) => void
  setBodega: (id: string | null) => void
  setCategoria: (id: string | null) => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filtros = useMemo<DashboardFiltros>(() => {
    const rangoParam = searchParams.get('rango')
    const rango: RangoFecha = RANGOS_VALIDOS.includes(rangoParam as RangoFecha)
      ? (rangoParam as RangoFecha)
      : '7d'
    return {
      rango,
      desde: searchParams.get('desde') ?? undefined,
      hasta: searchParams.get('hasta') ?? undefined,
      bodegaId: searchParams.get('bodega') ?? undefined,
      categoriaId: searchParams.get('categoria') ?? undefined,
    }
  }, [searchParams])

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const setRango = useCallback(
    (r: RangoFecha, personalizado?: { desde: string; hasta: string }) => {
      pushParams({
        rango: r,
        desde: r === 'personalizado' ? personalizado?.desde ?? null : null,
        hasta: r === 'personalizado' ? personalizado?.hasta ?? null : null,
      })
    },
    [pushParams]
  )

  const setBodega = useCallback((id: string | null) => pushParams({ bodega: id }), [pushParams])
  const setCategoria = useCallback((id: string | null) => pushParams({ categoria: id }), [pushParams])

  return { filtros, setRango, setBodega, setCategoria }
}
```

- [ ] **Step 2: Componente de filtros**

```tsx
// frontend/components/dashboard/DashboardFilters.tsx
'use client'

import { useDashboardFilters } from '@/lib/hooks/use-dashboard-filters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Opcion {
  id: string
  nombre: string
}

interface DashboardFiltersProps {
  bodegas: Opcion[]
  categorias: Opcion[]
}

const RANGO_LABELS: Record<string, string> = {
  hoy: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  personalizado: 'Personalizado',
}

export function DashboardFilters({ bodegas, categorias }: DashboardFiltersProps) {
  const { filtros, setRango, setBodega, setCategoria } = useDashboardFilters()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={filtros.rango} onValueChange={(v) => setRango(v as typeof filtros.rango)}>
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(RANGO_LABELS).map(([valor, label]) => (
            <SelectItem key={valor} value={valor}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtros.bodegaId ?? 'todas'} onValueChange={(v) => setBodega(v === 'todas' ? null : v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Todas las bodegas" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las bodegas</SelectItem>
          {bodegas.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtros.categoriaId ?? 'todas'} onValueChange={(v) => setCategoria(v === 'todas' ? null : v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las categorías</SelectItem>
          {categorias.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev`, abrir `/`, cambiar cada filtro.
Expected: la URL cambia (`?rango=30d&bodega=...`), y al recargar la página (F5) los filtros seleccionados se conservan (criterio de aceptación 3.2).

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/hooks/use-dashboard-filters.ts frontend/components/dashboard/DashboardFilters.tsx
git commit -m "feat: filtros de dashboard sincronizados con la URL (F2)"
```

---

## Fase 1 — Viernes 9: base visual y estructura (F7 base)

### Task 1.1: Esqueletos de carga y estados vacíos reutilizables

**Files:**
- Modify: `frontend/components/shared/LoadingSkeleton.tsx`
- Create: `frontend/components/shared/EmptyState.tsx`
- Create: `frontend/components/dashboard/ChartSkeleton.tsx`

**Interfaces:**
- Produces: `<ChartSkeleton />` (reemplaza el div de pulso a mano por `Skeleton` de shadcn dentro de un contenedor del tamaño real de una gráfica, para que F9 pueda usarlo en `Suspense fallback`), `<EmptyState icon={...} title={...} description={...} />` para usar en toda gráfica/tabla sin datos.

- [ ] **Step 1: `ChartSkeleton`**

```tsx
// frontend/components/dashboard/ChartSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton'

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="space-y-3 rounded-lg border p-4" style={{ height }}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-[calc(100%-2rem)] w-full" />
    </div>
  )
}
```

- [ ] **Step 2: `EmptyState`**

```tsx
// frontend/components/shared/EmptyState.tsx
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
      <Icon className="h-8 w-8" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs">{description}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Verificar visualmente**

Run: `npm run dev`, montar temporalmente `<ChartSkeleton />` y `<EmptyState .../>` en una página de prueba, confirmar que usan los tokens de color del tema (`--muted`, `--border`) y se ven bien en claro/oscuro si aplica.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/shared/LoadingSkeleton.tsx frontend/components/shared/EmptyState.tsx frontend/components/dashboard/ChartSkeleton.tsx
git commit -m "feat: skeleton y estado vacio reutilizables para graficas (F7)"
```

### Task 1.2: Reestructurar `app/(panel)/page.tsx` para recibir gráficas nuevas

**Files:**
- Modify: `frontend/app/(panel)/page.tsx`

**Interfaces:**
- Consumes: `DashboardVariante`/`VARIANTE_POR_ROL` (`lib/permissions/dashboard-variante.ts`), `CAN_VIEW_COSTS` (`lib/permissions/roles.ts`).
- Produces: una sección `<section id="graficas-rol">` con un grid responsivo (`grid-cols-1 lg:grid-cols-2`) donde Fase 2 inserta cada gráfica condicionada por variante, y un slot `<DashboardFilters />` arriba del grid. No se cablean datos reales todavía — se deja con arrays vacíos / `ChartSkeleton` para que la estructura sea revisable el viernes.

- [ ] **Step 1: Agregar sección y grid**

Editar `app/(panel)/page.tsx`: después del bloque de KPIs existente (líneas ~45-145 según el mapeo), insertar:

```tsx
<section className="space-y-4">
  <DashboardFilters bodegas={bodegas} categorias={categorias} />
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    {/* Fase 2 inserta aquí cada <XxxChart /> según `variante` */}
  </div>
</section>
```

Mantener el branching por `variante` ya existente (comercial/compras/taller/instalacion/bitacora/basico/completo) como guía para qué gráficas van en el grid — no se inventa un sistema de permisos nuevo, se reutiliza `VARIANTE_POR_ROL`.

- [ ] **Step 2: Verificar que no rompe nada existente**

Run: `npm run dev`, navegar a `/` con cada rol vía `DEV_SKIP_AUTH_ROLE`.
Expected: el dashboard se ve igual que antes salvo la sección nueva (vacía), sin errores de consola, KPIs/tarjetas originales intactos.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(panel\)/page.tsx
git commit -m "feat: estructura de grid para graficas por rol en dashboard (F7)"
```

---

## Fase 2 — Sábado 10: gráficas por rol (F1) y filtros aplicados (F2)

### Task 2.1: Server action de datos de gráficas + datos de prueba

**Files:**
- Create: `frontend/lib/supabase/dashboard-graficas-actions.ts`
- Create: `frontend/lib/dev/preview-dashboard-graficas-data.ts`

**Interfaces:**
- Consumes: `DashboardFiltros`, `DashboardGraficasPayload` de `lib/types/dashboard-graficas.ts`; `isDevBypassActive()` de `lib/dev/preview-bypass.ts`; patrón de cliente de `lib/supabase/server.ts`.
- Produces: `fetchDashboardGraficas(rol: Role, filtros: DashboardFiltros): Promise<DashboardGraficasPayload>` — única función que Fase 2 llama desde `page.tsx`. Internamente filtra qué campos llenar según si el rol está en `CAN_VIEW_COSTS` (si no, `valorizacion: null`).

- [ ] **Step 1: Datos de prueba**

```ts
// frontend/lib/dev/preview-dashboard-graficas-data.ts
import type { DashboardGraficasPayload } from '@/lib/types/dashboard-graficas'

export const PREVIEW_DASHBOARD_GRAFICAS: DashboardGraficasPayload = {
  kpis: [
    { id: 'stock_total', etiqueta: 'Stock total', valor: 4820, unidad: 'unidades', variacionPct: 3.2 },
    { id: 'oc_abiertas', etiqueta: 'OC abiertas', valor: 12, unidad: 'unidades', variacionPct: -8.1 },
    { id: 'tiempo_promedio_etapa', etiqueta: 'Tiempo promedio por etapa', valor: 4.3, unidad: 'dias', variacionPct: -5.0 },
  ],
  entradasSalidas: Array.from({ length: 7 }).map((_, i) => ({
    fecha: new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
    entradas: 20 + i * 3,
    salidas: 15 + i * 2,
  })),
  stockPorBodega: [
    { bodega: 'Principal', cantidad: 2100 },
    { bodega: 'Taller', cantidad: 1400 },
    { bodega: 'Instalación', cantidad: 1320 },
  ],
  stockPorCategoria: [
    { categoria: 'Carrocería', cantidad: 1800 },
    { categoria: 'Mecánica', cantidad: 1500 },
    { categoria: 'Accesorios', cantidad: 1520 },
  ],
  topProductos: Array.from({ length: 10 }).map((_, i) => ({
    producto: `Producto ${i + 1}`,
    cantidad: 300 - i * 20,
  })),
  vehiculosPorEtapa: [
    { etapa: 'Recepción', cantidad: 5, tiempoPromedioDias: 1.2 },
    { etapa: 'Metalmecánica', cantidad: 8, tiempoPromedioDias: 3.5 },
    { etapa: 'Instalación', cantidad: 6, tiempoPromedioDias: 2.8 },
    { etapa: 'Entrega', cantidad: 3, tiempoPromedioDias: 0.6 },
  ],
  ajustesOCPorEstado: [
    { tipo: 'ajuste', estado: 'pendiente', cantidad: 4 },
    { tipo: 'ajuste', estado: 'aprobado', cantidad: 22 },
    { tipo: 'orden_compra', estado: 'en_curso', cantidad: 12 },
    { tipo: 'orden_compra', estado: 'listo', cantidad: 30 },
  ],
  valorizacion: Array.from({ length: 7 }).map((_, i) => ({
    fecha: new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
    valorCop: 85_000_000 + i * 1_200_000,
  })),
}
```

- [ ] **Step 2: Server action**

```ts
// frontend/lib/supabase/dashboard-graficas-actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_DASHBOARD_GRAFICAS } from '@/lib/dev/preview-dashboard-graficas-data'
import { CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import type { Role } from '@/lib/types/database'
import type { DashboardFiltros, DashboardGraficasPayload } from '@/lib/types/dashboard-graficas'

export async function fetchDashboardGraficas(
  rol: Role,
  filtros: DashboardFiltros
): Promise<DashboardGraficasPayload> {
  const puedeVerCostos = CAN_VIEW_COSTS.includes(rol)

  if (isDevBypassActive()) {
    return {
      ...PREVIEW_DASHBOARD_GRAFICAS,
      valorizacion: puedeVerCostos ? PREVIEW_DASHBOARD_GRAFICAS.valorizacion : null,
    }
  }

  const supabase = await createClient()

  // NOTA: nombres de vista/RPC a confirmar con el contrato de datos del viernes 12:00 m.
  // Mientras tanto, placeholder que falla explícito en vez de silencioso.
  const { data, error } = await supabase.rpc('dashboard_graficas', {
    p_rango: filtros.rango,
    p_desde: filtros.desde ?? null,
    p_hasta: filtros.hasta ?? null,
    p_bodega_id: filtros.bodegaId ?? null,
    p_categoria_id: filtros.categoriaId ?? null,
  })

  if (error) throw new Error(`No se pudo cargar dashboard_graficas: ${error.message}`)

  const payload = data as DashboardGraficasPayload
  return { ...payload, valorizacion: puedeVerCostos ? payload.valorizacion : null }
}
```

- [ ] **Step 3: Verificar con bypass activo**

Run: `DEV_SKIP_AUTH=true DEV_SKIP_AUTH_ROLE=comercial npm run dev`
Expected: `fetchDashboardGraficas` devuelve `valorizacion: null` para `comercial`; con `DEV_SKIP_AUTH_ROLE=supervisor` devuelve el arreglo completo.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/supabase/dashboard-graficas-actions.ts frontend/lib/dev/preview-dashboard-graficas-data.ts
git commit -m "feat: server action y datos de prueba para graficas del dashboard (F1)"
```

### Task 2.2: `IndicadorCard` (tarjeta KPI con variación)

**Files:**
- Create: `frontend/components/dashboard/charts/IndicadorCard.tsx`

**Interfaces:**
- Consumes: `IndicadorKpi` de `lib/types/dashboard-graficas.ts`.
- Produces: `<IndicadorCard kpi={...} />`.

- [ ] **Step 1: Implementación**

```tsx
// frontend/components/dashboard/charts/IndicadorCard.tsx
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IndicadorKpi } from '@/lib/types/dashboard-graficas'

function formatearValor(valor: number, unidad: IndicadorKpi['unidad']): string {
  if (unidad === 'cop') {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
  }
  if (unidad === 'porcentaje') return `${valor.toFixed(1)}%`
  if (unidad === 'dias') return `${valor.toFixed(1)} días`
  return new Intl.NumberFormat('es-CO').format(valor)
}

export function IndicadorCard({ kpi }: { kpi: IndicadorKpi }) {
  const variacion = kpi.variacionPct
  const esPositivo = variacion !== null && variacion > 0
  const esNegativo = variacion !== null && variacion < 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.etiqueta}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold">{formatearValor(kpi.valor, kpi.unidad)}</span>
        {variacion !== null && (
          <span
            className={`flex items-center gap-1 text-xs font-medium ${
              esPositivo ? 'text-success' : esNegativo ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {esPositivo ? <ArrowUpRight className="h-3 w-3" /> : esNegativo ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(variacion).toFixed(1)}%
          </span>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verificar visualmente**

Run: `npm run dev`, montar `<IndicadorCard kpi={PREVIEW_DASHBOARD_GRAFICAS.kpis[0]} />` en el dashboard.
Expected: color verde (`--success`) con flecha arriba en variación positiva, rojo (`--destructive`) con flecha abajo en negativa, pesos colombianos bien formateados si `unidad === 'cop'`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/charts/IndicadorCard.tsx
git commit -m "feat: tarjeta de indicador con variacion (F1)"
```

### Task 2.3: Gráficas por categoría de dato (stock, top productos, vehículos por etapa, ajustes/OC, valorización)

**Files:**
- Create: `frontend/components/dashboard/charts/StockPorBodegaChart.tsx`
- Create: `frontend/components/dashboard/charts/StockPorCategoriaChart.tsx`
- Create: `frontend/components/dashboard/charts/TopProductosChart.tsx`
- Create: `frontend/components/dashboard/charts/VehiculosPorEtapaChart.tsx`
- Create: `frontend/components/dashboard/charts/AjustesOCPorEstadoChart.tsx`
- Create: `frontend/components/dashboard/charts/ValorizacionChart.tsx`

**Interfaces:**
- Consumes: los tipos `StockPorBodegaPunto[]`, `StockPorCategoriaPunto[]`, `TopProductoPunto[]`, `VehiculoPorEtapaPunto[]`, `AjusteOCPorEstadoPunto[]`, `ValorizacionPunto[]` de `lib/types/dashboard-graficas.ts`; primitivos `ChartContainer`/`ChartTooltip`/`ChartTooltipContent` de `components/ui/chart.tsx` (mismo patrón que `EntradasSalidasChart.tsx`); `EmptyState` de Task 1.1.
- Produces: seis componentes `<XxxChart data={...} />`, todos con `tooltips`, `leyendas` donde aplique, pesos colombianos en `ValorizacionChart`, fechas en español donde haya eje de tiempo. Todos renderizan `<EmptyState .../>` si `data.length === 0`.

- [ ] **Step 1: `StockPorBodegaChart` (patrón base, barra horizontal)**

```tsx
// frontend/components/dashboard/charts/StockPorBodegaChart.tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { Warehouse } from 'lucide-react'
import type { StockPorBodegaPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  cantidad: { label: 'Cantidad', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function StockPorBodegaChart({ data }: { data: StockPorBodegaPunto[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Warehouse} title="Sin datos de stock por bodega" />
  }
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" />
        <YAxis type="category" dataKey="bodega" width={100} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 2: `StockPorCategoriaChart` (igual patrón, dataKey `categoria`)**

```tsx
// frontend/components/dashboard/charts/StockPorCategoriaChart.tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { Tags } from 'lucide-react'
import type { StockPorCategoriaPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  cantidad: { label: 'Cantidad', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function StockPorCategoriaChart({ data }: { data: StockPorCategoriaPunto[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Tags} title="Sin datos de stock por categoría" />
  }
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" />
        <YAxis type="category" dataKey="categoria" width={100} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 3: `TopProductosChart` (top 10, barra vertical)**

```tsx
// frontend/components/dashboard/charts/TopProductosChart.tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { Trophy } from 'lucide-react'
import type { TopProductoPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  cantidad: { label: 'Cantidad movida', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function TopProductosChart({ data }: { data: TopProductoPunto[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Trophy} title="Sin movimientos en el periodo" />
  }
  return (
    <ChartContainer config={chartConfig} className="h-[320px] w-full">
      <BarChart data={data.slice(0, 10)}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="producto" tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={70} />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 4: `VehiculosPorEtapaChart` (barra + tiempo promedio en tooltip)**

```tsx
// frontend/components/dashboard/charts/VehiculosPorEtapaChart.tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { Car } from 'lucide-react'
import type { VehiculoPorEtapaPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  cantidad: { label: 'Vehículos', color: 'var(--chart-4)' },
} satisfies ChartConfig

export function VehiculosPorEtapaChart({ data }: { data: VehiculoPorEtapaPunto[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Car} title="Sin vehículos en proceso" />
  }
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="etapa" tickLine={false} axisLine={false} />
        <YAxis />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => [
                `${value} vehículos · ${(item.payload as VehiculoPorEtapaPunto).tiempoPromedioDias.toFixed(1)} días promedio`,
                '',
              ]}
            />
          }
        />
        <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 5: `AjustesOCPorEstadoChart` (apilada, dos series)**

```tsx
// frontend/components/dashboard/charts/AjustesOCPorEstadoChart.tsx
'use client'

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { ClipboardList } from 'lucide-react'
import type { AjusteOCPorEstadoPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  ajuste: { label: 'Ajustes', color: 'var(--chart-1)' },
  orden_compra: { label: 'Órdenes de compra', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function AjustesOCPorEstadoChart({ data }: { data: AjusteOCPorEstadoPunto[] }) {
  const porEstado = useMemo(() => {
    const estados = Array.from(new Set(data.map((d) => d.estado)))
    return estados.map((estado) => {
      const fila: Record<string, string | number> = { estado }
      for (const punto of data.filter((d) => d.estado === estado)) {
        fila[punto.tipo] = punto.cantidad
      }
      return fila
    })
  }, [data])

  if (data.length === 0) {
    return <EmptyState icon={ClipboardList} title="Sin ajustes ni órdenes en el periodo" />
  }

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={porEstado}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="estado" tickLine={false} axisLine={false} />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Bar dataKey="ajuste" fill="var(--color-ajuste)" radius={4} stackId="a" />
        <Bar dataKey="orden_compra" fill="var(--color-orden_compra)" radius={4} stackId="a" />
      </BarChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 6: `ValorizacionChart` (línea, solo costos)**

```tsx
// frontend/components/dashboard/charts/ValorizacionChart.tsx
'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { TrendingUp } from 'lucide-react'
import type { ValorizacionPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  valorCop: { label: 'Valorización', color: 'var(--chart-2)' },
} satisfies ChartConfig

const formatoCop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })

export function ValorizacionChart({ data }: { data: ValorizacionPunto[] | null }) {
  if (!data || data.length === 0) {
    return <EmptyState icon={TrendingUp} title="Sin datos de valorización" />
  }
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="fecha" tickFormatter={(v) => formatoFecha.format(new Date(v))} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => formatoCop.format(v)} width={90} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => formatoFecha.format(new Date(v as string))}
              formatter={(value) => [formatoCop.format(value as number), 'Valorización']}
            />
          }
        />
        <Line type="monotone" dataKey="valorCop" stroke="var(--color-valorCop)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 7: Verificar cada gráfica**

Run: `npm run dev`, montar las seis con `PREVIEW_DASHBOARD_GRAFICAS` en el grid de Task 1.2.
Expected: todas muestran tooltip al pasar el mouse, leyenda donde hay más de una serie, `ValorizacionChart` en pesos colombianos, sin overflow horizontal.

- [ ] **Step 8: Commit**

```bash
git add frontend/components/dashboard/charts/
git commit -m "feat: graficas de stock, top productos, vehiculos por etapa, ajustes/OC y valorizacion (F1)"
```

### Task 2.4: Cablear gráficas + filtros por variante en `page.tsx` (F1 + F2 completos)

**Files:**
- Modify: `frontend/app/(panel)/page.tsx`

**Interfaces:**
- Consumes: `fetchDashboardGraficas` (Task 2.1), todos los componentes de Task 2.2/2.3, `useDashboardFilters` (Task 0.3), `VARIANTE_POR_ROL`/`CAN_VIEW_COSTS` (`lib/permissions/roles.ts`, `lib/permissions/dashboard-variante.ts`).

- [ ] **Step 1: Mapa variante → gráficas**

```tsx
// dentro de app/(panel)/page.tsx, reemplazando el grid vacío de Task 1.2
const graficas = await fetchDashboardGraficas(profile.rol, filtrosServidor)

const CHARTS_POR_VARIANTE: Record<DashboardVariante, ReactNode[]> = {
  completo: [
    <EntradasSalidasChart key="es" data={graficas.entradasSalidas} />,
    <StockPorBodegaChart key="sb" data={graficas.stockPorBodega} />,
    <StockPorCategoriaChart key="sc" data={graficas.stockPorCategoria} />,
    <TopProductosChart key="tp" data={graficas.topProductos} />,
    <VehiculosPorEtapaChart key="ve" data={graficas.vehiculosPorEtapa} />,
    <AjustesOCPorEstadoChart key="ao" data={graficas.ajustesOCPorEstado} />,
    <ValorizacionChart key="val" data={graficas.valorizacion} />,
  ],
  compras: [
    <StockPorBodegaChart key="sb" data={graficas.stockPorBodega} />,
    <AjustesOCPorEstadoChart key="ao" data={graficas.ajustesOCPorEstado} />,
    <ValorizacionChart key="val" data={graficas.valorizacion} />,
  ],
  bitacora: [
    <EntradasSalidasChart key="es" data={graficas.entradasSalidas} />,
    <AjustesOCPorEstadoChart key="ao" data={graficas.ajustesOCPorEstado} />,
    <ValorizacionChart key="val" data={graficas.valorizacion} />,
  ],
  comercial: [
    <StockPorBodegaChart key="sb" data={graficas.stockPorBodega} />,
    <StockPorCategoriaChart key="sc" data={graficas.stockPorCategoria} />,
    <TopProductosChart key="tp" data={graficas.topProductos} />,
    <VehiculosPorEtapaChart key="ve" data={graficas.vehiculosPorEtapa} />,
  ],
  taller: [<VehiculosPorEtapaChart key="ve" data={graficas.vehiculosPorEtapa} />],
  instalacion: [<VehiculosPorEtapaChart key="ve" data={graficas.vehiculosPorEtapa} />],
  basico: [<StockPorBodegaChart key="sb" data={graficas.stockPorBodega} />],
}
```

Esta tabla es exactamente la Tabla 2 del documento del cliente (sección 4), traducida a las seis gráficas + KPIs construidos. Renderizar `graficas.kpis.map(k => <IndicadorCard key={k.id} kpi={k} />)` arriba del grid, y `CHARTS_POR_VARIANTE[variante]` dentro del grid de Task 1.2.

- [ ] **Step 2: Verificar criterio de aceptación 3.1 por rol**

Run: `npm run dev`, recorrer los 8 roles vía `DEV_SKIP_AUTH_ROLE`.
Expected: cada rol ve exactamente las gráficas de la Tabla 2 del documento, ningún rol sin costos ve `ValorizacionChart` ni `AjustesOCPorEstadoChart`-con-valor-cop (confirmar que esta última no filtra valores cop — solo cantidades, así que es segura para todos; si el backend decide incluir montos ahí, ajustar).

- [ ] **Step 3: Verificar filtros aplican a todas las gráficas junto (3.2)**

Cambiar rango/bodega/categoría en `DashboardFilters`, confirmar que `fetchDashboardGraficas` se vuelve a llamar (RSC re-render) y todas las gráficas cambian a la vez, no una por una.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(panel\)/page.tsx
git commit -m "feat: cablear graficas por variante de rol y filtros en dashboard (F1, F2)"
```

---

## Fase 3 — Domingo 11: notificaciones (F4), automatizaciones (F5), actividad (F6), correos (F11) — con datos de prueba

### Task 3.1: Centro de notificaciones persistido

**Files:**
- Modify: `frontend/lib/types/notificaciones.ts` (ya extendido en Task 0.2)
- Modify: `frontend/lib/supabase/notificaciones-actions.ts`
- Create: `frontend/components/notifications/NotificationCenterSheet.tsx` (reemplaza `HeaderNotifications.tsx`)
- Modify: `frontend/components/layout/Header.tsx`
- Create: `frontend/app/(panel)/notificaciones/page.tsx`
- Create: `frontend/components/notifications/NotificacionesHistorial.tsx`

**Interfaces:**
- Consumes: `AlertaNotificacion`, `NotificacionesPayload`, `EstadoCorreoNotificacion` (Task 0.2); `fetchNotificaciones` existente (se extiende, no se reescribe desde cero).
- Produces: `marcarNotificacionLeida(id: string)`, `marcarTodasLeidas(rol: Role)` (nuevas acciones — hoy solo existe `marcarMensajeLeido` para mensajes, no para alertas); `<NotificationCenterSheet />` con contador, clic al recurso, aviso al llegar una nueva (vía Fase 4 realtime); página `/notificaciones` con historial y filtro por tipo/leída.

- [ ] **Step 1: Agregar estado leída a nivel de alerta**

Las alertas hoy se calculan al vuelo (no tienen `id` persistente de "leída"). Agregar un `id` determinístico por alerta (`${tipo}:${recursoId}`) en `fetchNotificaciones` (`lib/supabase/notificaciones-actions.ts`) y una nueva función:

```ts
// agregar a frontend/lib/supabase/notificaciones-actions.ts
export async function marcarNotificacionLeida(idAlerta: string): Promise<void> {
  if (isDevBypassActive()) return
  const supabase = await createClient()
  const { error } = await supabase.from('notificaciones_leidas').upsert({
    alerta_id: idAlerta,
    usuario_id: (await supabase.auth.getUser()).data.user?.id,
    leida_en: new Date().toISOString(),
  })
  if (error) throw new Error(`No se pudo marcar como leída: ${error.message}`)
}

export async function marcarTodasLeidas(alertaIds: string[]): Promise<void> {
  if (isDevBypassActive()) return
  const supabase = await createClient()
  const userId = (await supabase.auth.getUser()).data.user?.id
  const filas = alertaIds.map((id) => ({ alerta_id: id, usuario_id: userId, leida_en: new Date().toISOString() }))
  const { error } = await supabase.from('notificaciones_leidas').upsert(filas)
  if (error) throw new Error(`No se pudieron marcar como leídas: ${error.message}`)
}
```

**Bloqueo esperado:** la tabla `notificaciones_leidas` no existe aún (no hay migración `0xx_notificaciones.sql` en `supabase/migrations/`). Reportar como bloqueo del domingo: el backend debe confirmar en el contrato del viernes si persiste "leída" como tabla propia (patrón igual a `mensajes_leidos`, migración 022) o si expone una vista/RPC distinta. Mientras tanto, con `isDevBypassActive()` estas funciones son no-op y el estado "leída" se simula en el cliente (ver Step 2).

- [ ] **Step 2: Sheet de notificaciones (reemplaza `HeaderNotifications.tsx`)**

```tsx
// frontend/components/notifications/NotificationCenterSheet.tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, Mail } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { marcarNotificacionLeida, marcarTodasLeidas } from '@/lib/supabase/notificaciones-actions'
import type { AlertaNotificacion } from '@/lib/types/notificaciones'

interface NotificationCenterSheetProps {
  alertas: AlertaNotificacion[]
  leidas: Set<string>
}

const RUTA_POR_TIPO: Record<AlertaNotificacion['tipo'], string> = {
  stock_bajo: '/inventario',
  ajustes: '/ajustes',
  eventos_hoy: '/',
  ordenes_compra: '/compras',
}

export function NotificationCenterSheet({ alertas, leidas: leidasIniciales }: NotificationCenterSheetProps) {
  const [leidas, setLeidas] = useState(leidasIniciales)
  const [isPending, startTransition] = useTransition()

  const sinLeer = alertas.filter((a) => !leidas.has(a.id)).length

  function marcarUna(id: string) {
    setLeidas((prev) => new Set(prev).add(id))
    startTransition(() => void marcarNotificacionLeida(id))
  }

  function marcarTodas() {
    const ids = alertas.map((a) => a.id)
    setLeidas(new Set(ids))
    startTransition(() => void marcarTodasLeidas(ids))
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {sinLeer > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-xs">
              {sinLeer > 9 ? '9+' : sinLeer}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader className="flex-row items-center justify-between">
          <SheetTitle>Notificaciones</SheetTitle>
          <Button variant="ghost" size="sm" onClick={marcarTodas} disabled={isPending || sinLeer === 0}>
            <CheckCheck className="mr-1 h-4 w-4" /> Marcar todas
          </Button>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto">
          {alertas.length === 0 && <p className="text-sm text-muted-foreground">Sin notificaciones.</p>}
          {alertas.map((alerta) => (
            <Link
              key={alerta.id}
              href={RUTA_POR_TIPO[alerta.tipo]}
              onClick={() => marcarUna(alerta.id)}
              className={`block rounded-md border p-3 text-sm transition-colors ${
                leidas.has(alerta.id) ? 'opacity-60' : 'bg-accent/40'
              }`}
            >
              <p className="font-medium">{alerta.titulo}</p>
              <p className="text-muted-foreground">{alerta.descripcion}</p>
              {alerta.correoEnviado && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {alerta.correoEnviado.enviado
                    ? `Correo enviado ${new Date(alerta.correoEnviado.fecha!).toLocaleString('es-CO')}`
                    : 'Correo pendiente'}
                </p>
              )}
            </Link>
          ))}
        </div>
        <Link href="/notificaciones" className="mt-3 block text-center text-sm text-primary">
          Ver historial completo
        </Link>
      </SheetContent>
    </Sheet>
  )
}
```

Nota: requiere agregar `titulo`/`descripcion`/`correoEnviado` a `AlertaNotificacion` en `lib/types/notificaciones.ts` si no existen ya con esos nombres — revisar el discriminated union real y mapear sus campos existentes a estos dos, en vez de duplicar lógica de presentación por cada subtipo (`AlertaStockBajo | AlertaAjustes | ...`) dentro del Sheet.

- [ ] **Step 3: Montar en `Header.tsx`**

Reemplazar el import/uso de `HeaderNotifications` por `NotificationCenterSheet` en `frontend/components/layout/Header.tsx:22` (y sus alrededores), pasando `alertas` y un `leidas: Set<string>` inicial calculado en el `layout.tsx` del panel (join contra `notificaciones_leidas` si existe la tabla, o `new Set()` si aún no — no romper mientras el backend no confirme el contrato).

- [ ] **Step 4: Página `/notificaciones`**

```tsx
// frontend/app/(panel)/notificaciones/page.tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { getCurrentProfile } from '@/lib/auth/get-current-profile' // usar helper existente del proyecto
import { fetchNotificaciones } from '@/lib/supabase/notificaciones-actions'
import { NotificacionesHistorial } from '@/components/notifications/NotificacionesHistorial'

export default async function NotificacionesPage() {
  const profile = await getCurrentProfile()
  const payload = await fetchNotificaciones(profile.rol)
  return (
    <RoleGuard allowed={['supervisor', 'compras', 'auditoria', 'comercial', 'metalmecanica', 'produccion', 'instalacion', 'lectura']}>
      <NotificacionesHistorial alertas={payload.alertas} mensajes={payload.mensajes} />
    </RoleGuard>
  )
}
```

`NotificacionesHistorial` es una tabla/lista con filtro por tipo y por leída/no leída, reutilizando el mismo render de ítem que `NotificationCenterSheet` (extraer un `NotificationItem` compartido si la duplicación crece — YAGNI por ahora, son ~15 líneas).

- [ ] **Step 5: Verificar criterio de aceptación 3.4**

Run: `npm run dev` como `supervisor`, crear un ajuste (flujo ya existente de Avance 1), confirmar que aparece en la lista de notificaciones con su indicador de correo (en modo prueba, `correoEnviado` vendrá de los datos mock hasta Fase 4).

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/supabase/notificaciones-actions.ts frontend/components/notifications/ frontend/components/layout/Header.tsx frontend/app/\(panel\)/notificaciones/
git commit -m "feat: centro de notificaciones persistido con historial (F4)"
```

### Task 3.2: Pantalla de automatizaciones (solo supervisor)

**Files:**
- Create: `frontend/lib/supabase/automatizaciones-actions.ts`
- Create: `frontend/lib/dev/preview-automatizaciones-data.ts`
- Create: `frontend/components/automatizaciones/AutomatizacionCard.tsx`
- Create: `frontend/app/(panel)/automatizaciones/page.tsx`
- Modify: `frontend/lib/permissions/roles.ts` (agregar ruta `automatizaciones` a `ROUTE_PERMISSIONS`, `NAV_ITEMS`)
- Modify: `frontend/middleware.ts` si `getRouteKeyForPath` necesita el nuevo prefijo (normalmente automático si sigue el patrón de rutas existente)

**Interfaces:**
- Consumes: `AutomatizacionEstado`, `AutomatizacionId` (Task 0.2).
- Produces: `fetchAutomatizaciones(): Promise<AutomatizacionEstado[]>`.

- [ ] **Step 1: Datos de prueba — las 8 automatizaciones del documento**

```ts
// frontend/lib/dev/preview-automatizaciones-data.ts
import type { AutomatizacionEstado } from '@/lib/types/automatizaciones'

export const PREVIEW_AUTOMATIZACIONES: AutomatizacionEstado[] = [
  { id: 'stock_bajo', nombre: 'Stock bajo', descripcion: 'Revisa productos bajo el umbral y genera alerta.', horario: 'Cada 15 minutos', ultimaEjecucion: new Date().toISOString(), resultado: 'ok', error: null },
  { id: 'recordatorios', nombre: 'Recordatorios', descripcion: 'Envía recordatorios de tareas pendientes por rol.', horario: 'Diario 7:00 a.m.', ultimaEjecucion: new Date().toISOString(), resultado: 'ok', error: null },
  { id: 'oc_vencidas', nombre: 'OC vencidas', descripcion: 'Marca y notifica órdenes de compra vencidas.', horario: 'Diario 6:00 a.m.', ultimaEjecucion: new Date().toISOString(), resultado: 'parcial', error: '2 de 14 OC no se pudieron evaluar (proveedor sin fecha límite).' },
  { id: 'cierre_diario', nombre: 'Cierre diario', descripcion: 'Consolida movimientos y genera reporte del día.', horario: 'Diario 11:59 p.m.', ultimaEjecucion: new Date(Date.now() - 86_400_000).toISOString(), resultado: 'ok', error: null },
  { id: 'reintentos_vin', nombre: 'Reintentos VIN', descripcion: 'Reintenta consultas de saldo VIN fallidas.', horario: 'Cada hora', ultimaEjecucion: new Date().toISOString(), resultado: 'error', error: 'Timeout consultando servicio externo de VIN.' },
  { id: 'sincronizacion_siigo', nombre: 'Sincronización Siigo', descripcion: 'Reintenta OC pendientes de enviar a Siigo.', horario: 'Cada 10 minutos', ultimaEjecucion: new Date().toISOString(), resultado: 'ok', error: null },
  { id: 'cola_correos', nombre: 'Cola de correos', descripcion: 'Procesa y reintenta el envío de correos pendientes.', horario: 'Cada 5 minutos', ultimaEjecucion: new Date().toISOString(), resultado: 'ok', error: null },
  { id: 'reporte_semanal', nombre: 'Reporte semanal', descripcion: 'Genera y envía el resumen semanal a supervisor.', horario: 'Lunes 6:00 a.m.', ultimaEjecucion: new Date(Date.now() - 4 * 86_400_000).toISOString(), resultado: 'sin_ejecutar', error: null },
]
```

- [ ] **Step 2: Server action**

```ts
// frontend/lib/supabase/automatizaciones-actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_AUTOMATIZACIONES } from '@/lib/dev/preview-automatizaciones-data'
import type { AutomatizacionEstado } from '@/lib/types/automatizaciones'

export async function fetchAutomatizaciones(): Promise<AutomatizacionEstado[]> {
  if (isDevBypassActive()) return PREVIEW_AUTOMATIZACIONES

  const supabase = await createClient()
  // NOTA: nombre de vista/tabla a confirmar en el contrato de datos (viernes 12:00 m.)
  const { data, error } = await supabase.from('vista_automatizaciones_estado').select('*')
  if (error) throw new Error(`No se pudo cargar el estado de automatizaciones: ${error.message}`)
  return data as AutomatizacionEstado[]
}
```

- [ ] **Step 3: Tarjeta + página**

```tsx
// frontend/components/automatizaciones/AutomatizacionCard.tsx
import { AlertCircle, CheckCircle2, Clock, CircleSlash } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AutomatizacionEstado } from '@/lib/types/automatizaciones'

const ICONOS_RESULTADO = {
  ok: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
  parcial: <AlertCircle className="h-4 w-4 text-warning" />,
  sin_ejecutar: <CircleSlash className="h-4 w-4 text-muted-foreground" />,
} as const

export function AutomatizacionCard({ job }: { job: AutomatizacionEstado }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{job.nombre}</CardTitle>
        {ICONOS_RESULTADO[job.resultado]}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">{job.descripcion}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {job.horario}
        </div>
        <p className="text-xs">
          Última ejecución: {job.ultimaEjecucion ? new Date(job.ultimaEjecucion).toLocaleString('es-CO') : 'nunca'}
        </p>
        {job.error && (
          <Badge variant="destructive" className="w-fit text-xs font-normal">
            {job.error}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
```

```tsx
// frontend/app/(panel)/automatizaciones/page.tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { fetchAutomatizaciones } from '@/lib/supabase/automatizaciones-actions'
import { AutomatizacionCard } from '@/components/automatizaciones/AutomatizacionCard'

export default async function AutomatizacionesPage() {
  const jobs = await fetchAutomatizaciones()
  return (
    <RoleGuard allowed={['supervisor']}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Automatizaciones</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <AutomatizacionCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </RoleGuard>
  )
}
```

- [ ] **Step 4: Registrar ruta en permisos y navegación**

Agregar `'automatizaciones'` a `RouteKey`, `ROUTE_PERMISSIONS.automatizaciones = ['supervisor']`, y una entrada en `NAV_ITEMS`/`NAV_GROUPS` en `lib/permissions/roles.ts`, siguiendo el mismo patrón que las 12 rutas ya listadas.

- [ ] **Step 5: Verificar criterio de aceptación 3.5**

Run: `npm run dev` como `supervisor`, abrir `/automatizaciones`.
Expected: 8 tarjetas, cada una entendible sin ayuda técnica (texto en español plano, sin jerga de cron). Confirmar como `comercial` que `/automatizaciones` redirige a `/acceso-denegado` (RoleGuard + middleware).

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/supabase/automatizaciones-actions.ts frontend/lib/dev/preview-automatizaciones-data.ts frontend/components/automatizaciones/ frontend/app/\(panel\)/automatizaciones/ frontend/lib/permissions/roles.ts
git commit -m "feat: pantalla de automatizaciones para supervisor (F5)"
```

### Task 3.3: Actividad en vivo (línea de tiempo, supervisor + auditoría)

**Files:**
- Create: `frontend/lib/supabase/actividad-actions.ts`
- Create: `frontend/lib/dev/preview-actividad-data.ts`
- Create: `frontend/components/actividad/ActividadTimeline.tsx`
- Create: `frontend/app/(panel)/actividad/page.tsx`
- Modify: `frontend/lib/permissions/roles.ts` (ruta `actividad`, allowed `['supervisor','auditoria']`)

**Interfaces:**
- Consumes: `EventoActividad` (Task 0.2).
- Produces: `fetchActividad(filtros?: { bodega?: string; accion?: string }): Promise<EventoActividad[]>`.

- [ ] **Step 1: Datos de prueba y server action** (mismo patrón que Task 3.2, usando `EventoActividad`; omitido aquí por brevedad pero sigue exactamente la estructura `preview-*-data.ts` + `'use server'` fetch con `isDevBypassActive()` de las tareas anteriores — placeholder de tabla: `vista_actividad_auditoria`, a confirmar en contrato).

```ts
// frontend/lib/dev/preview-actividad-data.ts
import type { EventoActividad } from '@/lib/types/actividad'

export const PREVIEW_ACTIVIDAD: EventoActividad[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `evt-${i}`,
  actorNombre: ['Juan Pérez', 'Laura Gómez', 'Carlos Ruiz'][i % 3],
  accion: ['creó ajuste', 'aprobó orden de compra', 'registró movimiento', 'editó usuario'][i % 4],
  recurso: ['ajustes_pendientes', 'ordenes_compra', 'movimientos_inventario', 'profiles'][i % 4],
  recursoId: `rec-${i}`,
  bodega: ['Principal', 'Taller', null][i % 3],
  creadoEn: new Date(Date.now() - i * 15 * 60_000).toISOString(),
}))
```

```ts
// frontend/lib/supabase/actividad-actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_ACTIVIDAD } from '@/lib/dev/preview-actividad-data'
import type { EventoActividad } from '@/lib/types/actividad'

export async function fetchActividad(filtros?: { bodega?: string; accion?: string }): Promise<EventoActividad[]> {
  if (isDevBypassActive()) {
    return PREVIEW_ACTIVIDAD.filter(
      (e) => (!filtros?.bodega || e.bodega === filtros.bodega) && (!filtros?.accion || e.accion === filtros.accion)
    )
  }
  const supabase = await createClient()
  let query = supabase.from('vista_actividad_auditoria').select('*').order('creado_en', { ascending: false }).limit(200)
  if (filtros?.bodega) query = query.eq('bodega', filtros.bodega)
  if (filtros?.accion) query = query.eq('accion', filtros.accion)
  const { data, error } = await query
  if (error) throw new Error(`No se pudo cargar actividad: ${error.message}`)
  return data as EventoActividad[]
}
```

- [ ] **Step 2: Timeline con iconos por tipo de recurso**

```tsx
// frontend/components/actividad/ActividadTimeline.tsx
import { Boxes, ClipboardCheck, FileEdit, Package, User } from 'lucide-react'
import type { EventoActividad } from '@/lib/types/actividad'

const ICONO_POR_RECURSO: Record<string, typeof Boxes> = {
  ajustes_pendientes: FileEdit,
  ordenes_compra: ClipboardCheck,
  movimientos_inventario: Package,
  profiles: User,
}

export function ActividadTimeline({ eventos }: { eventos: EventoActividad[] }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
  }
  return (
    <ol className="space-y-3">
      {eventos.map((evento) => {
        const Icono = ICONO_POR_RECURSO[evento.recurso] ?? Boxes
        return (
          <li key={evento.id} className="flex gap-3 border-l-2 border-border pl-4">
            <Icono className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p>
                <span className="font-medium">{evento.actorNombre}</span> {evento.accion}
                {evento.bodega && <span className="text-muted-foreground"> · {evento.bodega}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{new Date(evento.creadoEn).toLocaleString('es-CO')}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
```

```tsx
// frontend/app/(panel)/actividad/page.tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { fetchActividad } from '@/lib/supabase/actividad-actions'
import { ActividadTimeline } from '@/components/actividad/ActividadTimeline'

export default async function ActividadPage() {
  const eventos = await fetchActividad()
  return (
    <RoleGuard allowed={['supervisor', 'auditoria']}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Actividad en vivo</h1>
        <ActividadTimeline eventos={eventos} />
      </div>
    </RoleGuard>
  )
}
```

- [ ] **Step 3: Registrar ruta**

Agregar `'actividad'` a `ROUTE_PERMISSIONS` (`['supervisor','auditoria']`) y navegación, igual que Task 3.2.

- [ ] **Step 4: Verificar criterio de aceptación 3.6**

Confirmar como `comercial`/`compras` que `/actividad` da `acceso-denegado`. La actualización "en vivo" real (websocket) se cablea en Fase 4 — hoy solo se verifica la lista estática y permisos.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/supabase/actividad-actions.ts frontend/lib/dev/preview-actividad-data.ts frontend/components/actividad/ frontend/app/\(panel\)/actividad/ frontend/lib/permissions/roles.ts
git commit -m "feat: linea de tiempo de actividad para supervisor y auditoria (F6)"
```

### Task 3.4: Correos automáticos por rol (F11) — con datos de prueba

**Files:**
- Create: `frontend/lib/supabase/correos-actions.ts`
- Create: `frontend/lib/dev/preview-correos-data.ts`
- Create: `frontend/components/correos/CorreosTable.tsx`
- Create: `frontend/components/correos/EnvioCorreoPreview.tsx`
- Create: `frontend/app/(panel)/correos/page.tsx`
- Modify: `frontend/components/layout/HeaderMessages.tsx` (o el formulario de mensaje interno existente) para mostrar el preview antes de enviar
- Modify: `frontend/components/usuarios/UsersTable.tsx` / `frontend/app/(panel)/cuenta/page.tsx` para resaltar correo faltante/erróneo
- Modify: `frontend/lib/permissions/roles.ts` (ruta `correos`, allowed `['supervisor','auditoria']`)

**Interfaces:**
- Consumes: `CorreoEnviado`, `EnvioPreview`, `EstadoCorreo` (Task 0.2).
- Produces: `fetchCorreosEnviados(filtros?: { estado?: EstadoCorreo }): Promise<CorreoEnviado[]>`, `reenviarCorreo(id: string): Promise<void>`, `previsualizarEnvio(rol: Role): Promise<EnvioPreview>`.

- [ ] **Step 1: Datos de prueba**

```ts
// frontend/lib/dev/preview-correos-data.ts
import type { CorreoEnviado } from '@/lib/types/correos'

export const PREVIEW_CORREOS: CorreoEnviado[] = [
  { id: 'c1', destinatarioEmail: 'compras@carreraarango.com', destinatarioNombre: 'Ana Torres', rolDestino: 'compras', asunto: 'Stock bajo: 3 productos', origen: 'alerta', estado: 'enviado', fechaEnvio: new Date().toISOString(), error: null, creadoEn: new Date().toISOString() },
  { id: 'c2', destinatarioEmail: 'supervisor@carreraarango.com', destinatarioNombre: 'Jorge Lema', rolDestino: 'supervisor', asunto: 'Nuevo mensaje interno', origen: 'mensaje', estado: 'error', fechaEnvio: null, error: 'Dirección de correo rechazada por el servidor.', creadoEn: new Date().toISOString() },
]
```

- [ ] **Step 2: Server actions**

```ts
// frontend/lib/supabase/correos-actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_CORREOS } from '@/lib/dev/preview-correos-data'
import type { CorreoEnviado, EnvioPreview, EstadoCorreo } from '@/lib/types/correos'
import type { Role } from '@/lib/types/database'

export async function fetchCorreosEnviados(filtros?: { estado?: EstadoCorreo }): Promise<CorreoEnviado[]> {
  if (isDevBypassActive()) {
    return filtros?.estado ? PREVIEW_CORREOS.filter((c) => c.estado === filtros.estado) : PREVIEW_CORREOS
  }
  const supabase = await createClient()
  let query = supabase.from('vista_correos_enviados').select('*').order('creado_en', { ascending: false })
  if (filtros?.estado) query = query.eq('estado', filtros.estado)
  const { data, error } = await query
  if (error) throw new Error(`No se pudieron cargar los correos: ${error.message}`)
  return data as CorreoEnviado[]
}

export async function reenviarCorreo(id: string): Promise<void> {
  if (isDevBypassActive()) return
  const supabase = await createClient()
  // NOTA: función/edge function de reenvío a confirmar en contrato (probablemente supabase.functions.invoke('reenviar-correo', { body: { id } }))
  const { error } = await supabase.functions.invoke('reenviar-correo', { body: { id } })
  if (error) throw new Error(`No se pudo reenviar el correo: ${error.message}`)
}

export async function previsualizarEnvio(rol: Role): Promise<EnvioPreview> {
  if (isDevBypassActive()) return { rol, totalDestinatarios: 5 }
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('vista_usuarios_panel')
    .select('*', { count: 'exact', head: true })
    .eq('rol', rol)
    .eq('activo', true)
  if (error) throw new Error(`No se pudo calcular destinatarios: ${error.message}`)
  return { rol, totalDestinatarios: count ?? 0 }
}
```

- [ ] **Step 3: Preview "se enviará a N usuarios" en el formulario de mensaje interno**

```tsx
// frontend/components/correos/EnvioCorreoPreview.tsx
'use client'

import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { previsualizarEnvio } from '@/lib/supabase/correos-actions'
import { ROLE_LABELS } from '@/lib/types/database'
import type { Role } from '@/lib/types/database'

export function EnvioCorreoPreview({ rol }: { rol: Role | null }) {
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    if (!rol) {
      setTotal(null)
      return
    }
    let cancelado = false
    previsualizarEnvio(rol).then((res) => {
      if (!cancelado) setTotal(res.totalDestinatarios)
    })
    return () => {
      cancelado = true
    }
  }, [rol])

  if (!rol || total === null) return null

  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Mail className="h-3 w-3" />
      Se enviará por correo a {total} usuario{total === 1 ? '' : 's'} del rol {ROLE_LABELS[rol]}.
    </p>
  )
}
```

Montar `<EnvioCorreoPreview rol={rolSeleccionado} />` dentro del formulario existente de `crearMensajePanel` (buscar el diálogo/formulario que llama esa función, probablemente cerca de `HeaderMessages.tsx` o un `MensajeFormDialog` — agregar el `Select` de rol destino si no existe ya como campo controlado, y pasar su valor a este componente).

- [ ] **Step 4: Tabla de correos enviados + página**

```tsx
// frontend/components/correos/CorreosTable.tsx
'use client'

import { useState, useTransition } from 'react'
import { RotateCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { reenviarCorreo } from '@/lib/supabase/correos-actions'
import type { CorreoEnviado } from '@/lib/types/correos'

const BADGE_POR_ESTADO: Record<CorreoEnviado['estado'], 'default' | 'destructive' | 'secondary'> = {
  enviado: 'default',
  pendiente: 'secondary',
  error: 'destructive',
}

export function CorreosTable({ correos }: { correos: CorreoEnviado[] }) {
  const [reenviando, setReenviando] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleReenviar(id: string) {
    setReenviando(id)
    startTransition(async () => {
      await reenviarCorreo(id)
      setReenviando(null)
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Destinatario</TableHead>
          <TableHead>Asunto</TableHead>
          <TableHead>Origen</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {correos.map((correo) => (
          <TableRow key={correo.id}>
            <TableCell>
              <div className="text-sm">{correo.destinatarioNombre}</div>
              <div className="text-xs text-muted-foreground">{correo.destinatarioEmail}</div>
            </TableCell>
            <TableCell>{correo.asunto}</TableCell>
            <TableCell className="capitalize">{correo.origen}</TableCell>
            <TableCell>
              <Badge variant={BADGE_POR_ESTADO[correo.estado]}>{correo.estado}</Badge>
              {correo.error && <p className="mt-1 text-xs text-destructive">{correo.error}</p>}
            </TableCell>
            <TableCell className="text-xs">
              {correo.fechaEnvio ? new Date(correo.fechaEnvio).toLocaleString('es-CO') : '—'}
            </TableCell>
            <TableCell>
              {correo.estado === 'error' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending && reenviando === correo.id}
                  onClick={() => handleReenviar(correo.id)}
                >
                  <RotateCw className="mr-1 h-3 w-3" /> Reenviar
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

```tsx
// frontend/app/(panel)/correos/page.tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { fetchCorreosEnviados } from '@/lib/supabase/correos-actions'
import { CorreosTable } from '@/components/correos/CorreosTable'

export default async function CorreosPage() {
  const correos = await fetchCorreosEnviados()
  return (
    <RoleGuard allowed={['supervisor', 'auditoria']}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Correos enviados</h1>
        <CorreosTable correos={correos} />
      </div>
    </RoleGuard>
  )
}
```

Auditoría ve la tabla en **solo lectura**: condicionar el botón "Reenviar" a `profile.rol === 'supervisor'` (pasar `puedeReenviar` como prop en vez de chequear rol dentro del componente cliente contra una fuente no confiable).

- [ ] **Step 5: Correo faltante/erróneo en usuarios y perfil**

En `UsersTable.tsx`, agregar una columna/indicador visual (ícono de alerta) cuando `usuario.email` sea `null`/vacío o no cumpla un regex básico de email. En `cuenta/page.tsx`/`CuentaForm`, igual: mostrar aviso si el propio correo está vacío. No se agrega validación de envío real aquí — es solo indicación visual para que supervisor detecte el problema (criterio del documento, sección 3.11, tercer punto).

- [ ] **Step 6: Registrar ruta `correos`**

Igual patrón que Task 3.2/3.3 en `lib/permissions/roles.ts`.

- [ ] **Step 7: Verificar criterio de aceptación 3.11**

Con datos de prueba: seleccionar rol "compras" en el formulario de mensaje interno, confirmar que aparece "Se enviará por correo a N usuarios del rol Compras" antes de enviar, y que `/correos` lista los correos mock con sus estados y botón reenviar solo para `error`.

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/supabase/correos-actions.ts frontend/lib/dev/preview-correos-data.ts frontend/components/correos/ frontend/app/\(panel\)/correos/ frontend/components/usuarios/UsersTable.tsx frontend/app/\(panel\)/cuenta/page.tsx frontend/lib/permissions/roles.ts
git commit -m "feat: correos automaticos por rol, preview de envio y pantalla de correos enviados (F11)"
```

---

## Fase 4 — Lunes 12 (festivo, integración): datos reales + F3 en vivo + correos reales

> Bloqueo crítico de este día: depende de que el backend haya entregado el contrato (viernes 12:00 m.) y los datos reales en Supabase cloud (domingo 11, 6:00 p.m.). Si alguno se retrasa, este día se dedica a lo que sí esté disponible y se compensa el martes, sin mover la entrega del miércoles 14 (regla explícita del documento, sección 6).

### Task 4.0: Reconciliar tipos y nombres de vista/RPC contra el contrato real

**Files:**
- Modify: todos los `lib/types/*.ts` creados en Fase 0 si el contrato difiere
- Modify: todos los `lib/supabase/*-actions.ts` que tienen comentarios `// NOTA: ... a confirmar en contrato` (Tasks 2.1, 3.1, 3.2, 3.3, 3.4) — reemplazar nombres de vista/RPC/función placeholder por los reales

**Interfaces:**
- Consumes: el documento de contrato de datos entregado por backend (vistas, RPC, estados de Siigo y de correo, con ejemplos JSON).

- [ ] **Step 1: Diff de contrato vs. placeholders**

Revisar cada `// NOTA:` dejado en Fases 2-3, comparar contra el contrato real, ajustar nombres de tabla/vista/RPC y forma de columnas (`snake_case` de Postgres → se mapea a los tipos `camelCase` ya definidos; si el contrato expone `snake_case` directo, agregar una función `mapear*()` por acción en vez de cambiar los tipos de los componentes, para no tocar Fases 2-3).

- [ ] **Step 2: Ejecutar `supabase gen types typescript` (opcional, recomendado)**

```bash
npx supabase gen types typescript --project-id <project-id> > frontend/lib/types/database-generated.ts
```

Usar este archivo solo como referencia de columnas reales al escribir los `mapear*()` del Step 1 — no reemplaza los tipos de dominio manuales ya en uso en el resto del proyecto (sería un cambio de arquitectura fuera de alcance).

- [ ] **Step 3: Quitar bypass en server actions de esta sección**

Confirmar que cada acción de Fase 2-3 cae correctamente a la rama real (`!isDevBypassActive()`) y no lanza con mensajes de "a confirmar".

- [ ] **Step 4: Verificar con login real**

Run: `npm run dev` **sin** `DEV_SKIP_AUTH`, iniciar sesión real con un usuario de cada rol provisto por backend, recorrer dashboard, notificaciones, automatizaciones, actividad, correos.
Expected: datos reales se ven, sin errores 500/consola, gráficas no vacías (salvo que realmente no haya datos en ese rango).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/
git commit -m "fix: reconciliar tipos y RPC con el contrato de datos real del backend"
```

### Task 4.1: Proveedor de realtime único y granular (F3)

**Files:**
- Create: `frontend/lib/hooks/use-realtime-channel.ts`
- Create: `frontend/components/realtime/RealtimePanelProvider.tsx`
- Create: `frontend/components/dashboard/LiveIndicator.tsx`
- Modify: `frontend/app/(panel)/page.tsx` (reemplazar `<RealtimeRefresher />`)
- Modify: `frontend/app/(panel)/visualizacion/page.tsx` (ídem)
- Delete (tras confirmar que nada más lo importa): `frontend/components/dashboard/RealtimeRefresher.tsx`

**Interfaces:**
- Produces: hook `useRealtimeChannel(tablas: string[], onChange: () => void): { conectado: boolean; ultimaActualizacion: Date | null }` con reconexión y poll de respaldo cada 60s si se pierde la conexión (criterio 3.3); componente `<RealtimePanelProvider tablas={[...]} />` que se monta una vez por página y dispara `router.refresh()` debounced igual que antes, pero ahora escuchando **varias tablas en un solo canal** (`movimientos_inventario`, `ajustes_pendientes`, `ordenes_compra`, `mensajes_panel`, y la tabla/vista de notificaciones si existe) en vez de un `RealtimeRefresher` por tabla; `<LiveIndicator conectado={...} ultimaActualizacion={...} />` visible en el header del dashboard.

- [ ] **Step 1: Hook de canal con reconexión y poll de respaldo**

```ts
// frontend/lib/hooks/use-realtime-channel.ts
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'

const DEBOUNCE_MS = 600
const POLL_FALLBACK_MS = 60_000

export function useRealtimeChannel(tablas: string[]): { conectado: boolean; ultimaActualizacion: Date | null } {
  const router = useRouter()
  const [conectado, setConectado] = useState(false)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isDevBypassActive()) return

    const supabase = createClient()
    const channel = supabase.channel('panel-realtime')

    for (const tabla of tablas) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          router.refresh()
          setUltimaActualizacion(new Date())
        }, DEBOUNCE_MS)
      })
    }

    channel.subscribe((status) => {
      setConectado(status === 'SUBSCRIBED')
    })

    pollRef.current = setInterval(() => {
      if (!conectado) {
        router.refresh()
        setUltimaActualizacion(new Date())
      }
    }, POLL_FALLBACK_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, tablas.join(',')])

  return { conectado, ultimaActualizacion }
}
```

- [ ] **Step 2: Proveedor + indicador**

```tsx
// frontend/components/realtime/RealtimePanelProvider.tsx
'use client'

import { useRealtimeChannel } from '@/lib/hooks/use-realtime-channel'
import { LiveIndicator } from '@/components/dashboard/LiveIndicator'

export function RealtimePanelProvider({ tablas }: { tablas: string[] }) {
  const { conectado, ultimaActualizacion } = useRealtimeChannel(tablas)
  return <LiveIndicator conectado={conectado} ultimaActualizacion={ultimaActualizacion} />
}
```

```tsx
// frontend/components/dashboard/LiveIndicator.tsx
'use client'

const formatoHora = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function LiveIndicator({ conectado, ultimaActualizacion }: { conectado: boolean; ultimaActualizacion: Date | null }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-success' : 'bg-muted-foreground'}`} />
      {conectado ? 'En vivo' : 'Reconectando…'}
      {ultimaActualizacion && ` · actualizado ${formatoHora.format(ultimaActualizacion)}`}
    </span>
  )
}
```

- [ ] **Step 3: Reemplazar `RealtimeRefresher` en las dos páginas que lo usan**

En `app/(panel)/page.tsx:156` y `app/(panel)/visualizacion/page.tsx:65`, cambiar:
```diff
-<RealtimeRefresher />
+<RealtimePanelProvider tablas={['movimientos_inventario', 'ajustes_pendientes', 'ordenes_compra', 'mensajes_panel']} />
```
Colocar `<RealtimePanelProvider />` junto al título del dashboard (no al final del documento como estaba `RealtimeRefresher`) para que `<LiveIndicator />` sea visible sin scroll.

- [ ] **Step 4: Borrar `RealtimeRefresher.tsx` tras confirmar que no queda ningún import**

Run: `grep -rn "RealtimeRefresher" frontend/` → debe devolver vacío antes de borrar el archivo.

- [ ] **Step 5: Verificar criterio de aceptación 3.3 (dos navegadores)**

Abrir el dashboard en dos navegadores (o dos perfiles) con sesiones reales. En uno, registrar un movimiento de inventario. En el otro, confirmar que aparece reflejado (vía `router.refresh()`) en menos de 5 segundos sin recargar manualmente, y que `<LiveIndicator />` actualiza su hora.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/hooks/use-realtime-channel.ts frontend/components/realtime/ frontend/components/dashboard/LiveIndicator.tsx frontend/app/\(panel\)/page.tsx frontend/app/\(panel\)/visualizacion/page.tsx
git rm frontend/components/dashboard/RealtimeRefresher.tsx
git commit -m "feat: proveedor de realtime unico multi-tabla con indicador en vivo (F3)"
```

### Task 4.2: Avisos emergentes de notificación nueva en vivo

**Files:**
- Modify: `frontend/components/notifications/NotificationCenterSheet.tsx`
- Modify: `frontend/app/(panel)/layout.tsx`

**Interfaces:**
- Consumes: `useRealtimeChannel` (Task 4.1), `sonner` (`toast`) ya instalado (`components/ui/sonner.tsx`).

- [ ] **Step 1: Toast al llegar alerta/mensaje nuevo**

En `layout.tsx` del panel, además de montar `RealtimePanelProvider`, suscribir un listener liviano (reutilizando `useRealtimeChannel(['ajustes_pendientes','ordenes_compra','mensajes_panel'])` desde un client component wrapper) que dispare `toast(mensaje.asunto ?? 'Nueva notificación')` de `sonner` cuando detecte un `INSERT` nuevo relevante al rol actual. Evitar duplicar la lógica de debounce de refresco: este listener es independiente y solo llama `toast()`, no `router.refresh()` (eso ya lo hace `RealtimePanelProvider`).

- [ ] **Step 2: Verificar**

Con dos navegadores, crear un mensaje interno dirigido al rol del segundo navegador. Confirmed: aparece un toast en el segundo navegador sin recargar.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/notifications/NotificationCenterSheet.tsx frontend/app/\(panel\)/layout.tsx
git commit -m "feat: aviso emergente al llegar notificacion nueva (F4)"
```

---

## Fase 5 — Martes 13: Siigo (F10), exportar (F8), rendimiento (F9), modo planta (F12), QA

### Task 5.1: Estado de sincronización Siigo en lista y detalle de OC

**Files:**
- Modify: `frontend/lib/types/orden-compra.ts` (agregar `siigoSync: SiigoSyncInfo`)
- Modify: `frontend/lib/supabase/ordenes-compra-actions.ts` (nuevas acciones `enviarOrdenASiigo`, `reintentarSiigo`; extender `fetchOrdenesCompra*` para incluir `siigoSync`)
- Create: `frontend/components/compras/SiigoStatusBadge.tsx`
- Create: `frontend/components/compras/SiigoSyncPanel.tsx`
- Modify: `frontend/components/compras/ComprasTable.tsx`
- Create: `frontend/app/(panel)/compras/[id]/page.tsx` (si no existe vista de detalle; confirmar primero si `ComprasPedidoDialog` ya cumple ese rol — de ser así, extenderlo ahí en vez de crear una página nueva)

**Interfaces:**
- Consumes: `SiigoSyncInfo`, `EstadoSyncSiigo` (Task 0.2).
- Produces: `enviarOrdenASiigo(ordenId: string): Promise<void>`, `reintentarSiigo(ordenId: string): Promise<void>`.

- [ ] **Step 1: Badge de estado**

```tsx
// frontend/components/compras/SiigoStatusBadge.tsx
import { Badge } from '@/components/ui/badge'
import type { EstadoSyncSiigo } from '@/lib/types/siigo'

const CONFIG: Record<EstadoSyncSiigo, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pendiente: { label: 'Pendiente', variant: 'secondary' },
  enviando: { label: 'Enviando…', variant: 'secondary' },
  sincronizada: { label: 'Sincronizada', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
}

export function SiigoStatusBadge({ estado }: { estado: EstadoSyncSiigo }) {
  const { label, variant } = CONFIG[estado]
  return <Badge variant={variant}>{label}</Badge>
}
```

- [ ] **Step 2: Acciones de envío/reintento**

```ts
// agregar a frontend/lib/supabase/ordenes-compra-actions.ts
export async function enviarOrdenASiigo(ordenId: string): Promise<void> {
  if (isDevBypassActive()) return
  const supabase = await createClient()
  const { error } = await supabase.functions.invoke('siigo-enviar-orden', { body: { ordenId } })
  if (error) throw new Error(`No se pudo enviar a Siigo: ${error.message}`)
}

export async function reintentarSiigo(ordenId: string): Promise<void> {
  if (isDevBypassActive()) return
  const supabase = await createClient()
  const { error } = await supabase.functions.invoke('siigo-enviar-orden', { body: { ordenId, reintento: true } })
  if (error) throw new Error(`No se pudo reintentar el envío a Siigo: ${error.message}`)
}
```

**Nota de alcance:** `siigo-enviar-orden` es una Edge Function nueva (no existe hoy; solo existe `siigo-validar`). Es responsabilidad del backend, debe estar en el contrato del viernes. Si no llega a tiempo, el frontend deja los botones "Enviar a Siigo"/"Reintentar" implementados pero deshabilitados con tooltip "Pendiente de backend", y lo reporta como bloqueo — no se bloquea el resto de la sección por esto (condición del documento: reportar bloqueos el mismo día, no detener el avance).

- [ ] **Step 3: Panel de detalle con botones**

```tsx
// frontend/components/compras/SiigoSyncPanel.tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { SiigoStatusBadge } from '@/components/compras/SiigoStatusBadge'
import { enviarOrdenASiigo, reintentarSiigo } from '@/lib/supabase/ordenes-compra-actions'
import type { SiigoSyncInfo } from '@/lib/types/siigo'

interface SiigoSyncPanelProps {
  ordenId: string
  sync: SiigoSyncInfo
  puedeGestionar: boolean // compras o supervisor
}

export function SiigoSyncPanel({ ordenId, sync, puedeGestionar }: SiigoSyncPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [estadoLocal, setEstadoLocal] = useState(sync)

  function enviar() {
    setEstadoLocal((s) => ({ ...s, estado: 'enviando' }))
    startTransition(() => void enviarOrdenASiigo(ordenId))
  }

  function reintentar() {
    setEstadoLocal((s) => ({ ...s, estado: 'enviando' }))
    startTransition(() => void reintentarSiigo(ordenId))
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Estado Siigo</span>
        <SiigoStatusBadge estado={estadoLocal.estado} />
      </div>
      {estadoLocal.referencia && <p className="text-xs text-muted-foreground">Referencia: {estadoLocal.referencia}</p>}
      {estadoLocal.fecha && <p className="text-xs text-muted-foreground">{new Date(estadoLocal.fecha).toLocaleString('es-CO')}</p>}
      {estadoLocal.error && <p className="text-xs text-destructive">{estadoLocal.error}</p>}
      {puedeGestionar && estadoLocal.estado === 'pendiente' && (
        <Button size="sm" disabled={isPending} onClick={enviar}>Enviar a Siigo</Button>
      )}
      {puedeGestionar && estadoLocal.estado === 'error' && (
        <Button size="sm" variant="outline" disabled={isPending} onClick={reintentar}>Reintentar</Button>
      )}
    </div>
  )
}
```

`estadoLocal` se corrige solo cuando `RealtimePanelProvider` (Task 4.1, agregar `ordenes_compra` ya está incluido) dispare `router.refresh()` tras el cambio real en base de datos — el `setEstadoLocal('enviando')` es optimista y se reemplaza por el valor real de props en el siguiente render del servidor.

- [ ] **Step 4: Cablear en `ComprasTable.tsx`**

Agregar columna `Siigo` con `<SiigoStatusBadge estado={orden.siigoSync.estado} />` en la tabla (tanto Pendientes como Historial), y un filtro por estado Siigo (`Select` igual patrón que Task 0.3, pero local al componente, no en la URL — no lo pide el documento). Para el detalle, montar `<SiigoSyncPanel />` dentro de `ComprasPedidoDialog` o la página de detalle nueva.

- [ ] **Step 5: Fecha de última sincronización de catálogo en productos/proveedores**

Agregar un bloque simple (`<p>Última sincronización: ...</p>` + lista de diferencias si `diferencias.length > 0`) en las páginas de productos y proveedores existentes, alimentado por una nueva función `fetchEstadoSyncCatalogo()` en `lib/supabase/siigo-actions.ts` siguiendo el mismo patrón `isDevBypassActive()` que el resto.

- [ ] **Step 6: Verificar criterio de aceptación 3.10**

Aprobar una OC (flujo existente), confirmar que el badge pasa de "Pendiente" → "Enviando…" → "Sincronizada" con referencia, en vivo (gracias a `RealtimePanelProvider`). Forzar un estado `error` en datos de prueba y confirmar que "Reintentar" es visible y clicable solo para `compras`/`supervisor` (auditoría ve el badge pero sin botones).

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/types/orden-compra.ts frontend/lib/types/siigo.ts frontend/lib/supabase/ordenes-compra-actions.ts frontend/components/compras/
git commit -m "feat: estado de sincronizacion Siigo en lista y detalle de OC (F10)"
```

### Task 5.2: Exportar gráficas (PNG + CSV) respetando permisos de costos

**Files:**
- Create: `frontend/lib/export/chart-export.ts`
- Create: `frontend/components/dashboard/ChartExportMenu.tsx`
- Modify: cada componente de `components/dashboard/charts/*.tsx` para envolver su `ChartContainer` con un `id` exportable y montar `<ChartExportMenu />`

**Interfaces:**
- Produces: `exportarChartComoPng(elementId: string, nombreArchivo: string): Promise<void>`, `exportarDatosComoCsv<T>(data: T[], nombreArchivo: string): void` (usa `papaparse`, ya instalado); `<ChartExportMenu targetId={...} data={...} nombreArchivo={...} disabled={...} />`.

- [ ] **Step 1: Utilidades de exportación**

```ts
// frontend/lib/export/chart-export.ts
import Papa from 'papaparse'

export async function exportarChartComoPng(elementId: string, nombreArchivo: string): Promise<void> {
  const nodo = document.getElementById(elementId)
  if (!nodo) throw new Error(`No se encontró el elemento ${elementId} para exportar`)

  const svg = nodo.querySelector('svg')
  if (!svg) throw new Error('La gráfica no tiene un SVG renderizado todavía')

  const xml = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = svg.clientWidth * 2
  canvas.height = svg.clientHeight * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el contexto de canvas')
  ctx.scale(2, 2)
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#ffffff'
  ctx.fillRect(0, 0, svg.clientWidth, svg.clientHeight)
  ctx.drawImage(img, 0, 0, svg.clientWidth, svg.clientHeight)
  URL.revokeObjectURL(url)

  canvas.toBlob((blob) => {
    if (!blob) return
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${nombreArchivo}.png`
    link.click()
    URL.revokeObjectURL(link.href)
  })
}

export function exportarDatosComoCsv<T extends Record<string, unknown>>(data: T[], nombreArchivo: string): void {
  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${nombreArchivo}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
```

- [ ] **Step 2: Menú de exportación**

```tsx
// frontend/components/dashboard/ChartExportMenu.tsx
'use client'

import { Download } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { exportarChartComoPng, exportarDatosComoCsv } from '@/lib/export/chart-export'

interface ChartExportMenuProps<T extends Record<string, unknown>> {
  targetId: string
  data: T[]
  nombreArchivo: string
  disabled?: boolean // true si el rol no puede exportar esta gráfica (ej. costos)
}

export function ChartExportMenu<T extends Record<string, unknown>>({
  targetId,
  data,
  nombreArchivo,
  disabled,
}: ChartExportMenuProps<T>) {
  if (disabled) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Exportar gráfica">
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void exportarChartComoPng(targetId, nombreArchivo)}>
          Descargar imagen (PNG)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportarDatosComoCsv(data, nombreArchivo)}>
          Descargar datos (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 3: Integrar en cada gráfica**

En cada archivo de `components/dashboard/charts/*.tsx`, envolver el `<ChartContainer>` en un `<div id={\`chart-${nombreUnico}\`}>` y agregar un header con título + `<ChartExportMenu targetId={...} data={data} nombreArchivo={...} disabled={esGraficaDeCostos && !puedeVerCostos} />`. Para `ValorizacionChart` y la serie de costos dentro de `AjustesOCPorEstadoChart` (si llegara a incluir montos), `disabled` debe calcularse con `CAN_VIEW_COSTS.includes(rol)` pasado como prop desde `page.tsx`, nunca inferido en el cliente desde datos que ya estén filtrados (la fuente de verdad es el server action, que ya devuelve `valorizacion: null` para roles sin permiso — `ChartExportMenu` simplemente no se monta si `data` es `null`/vacío por esa razón, así que en la práctica el `disabled` explícito solo hace falta donde haya dudas de UX, no de seguridad: el dato sensible nunca llega al cliente en primer lugar).

- [ ] **Step 4: Verificar criterio de aceptación 3.8**

Como `comercial`, confirmar que ninguna gráfica visible tiene opción de exportar costos (de hecho, `ValorizacionChart` ni siquiera se monta para ese rol). Como `supervisor`, exportar PNG y CSV de `StockPorBodegaChart`, confirmar que el PNG se ve legible y el CSV abre en Excel/Sheets con las columnas esperadas.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/export/chart-export.ts frontend/components/dashboard/ChartExportMenu.tsx frontend/components/dashboard/charts/
git commit -m "feat: exportar graficas a PNG y CSV respetando permisos de costos (F8)"
```

### Task 5.3: Rendimiento — carga diferida de gráficas (F9)

**Files:**
- Modify: `frontend/app/(panel)/page.tsx`

**Interfaces:**
- Consumes: `ChartSkeleton` (Task 1.1), `next/dynamic`.

- [ ] **Step 1: Separar KPIs (rápidos) de gráficas (diferidas)**

Las tarjetas KPI (`IndicadorCard`) se mantienen en el render inicial del Server Component (son baratas: solo números). El grid de gráficas se envuelve en `<Suspense fallback={<ChartSkeletonGrid />}>` alrededor de un Server Component hijo que hace el `fetchDashboardGraficas` pesado, para que el shell de la página (header, sidebar, KPIs) sea interactivo antes de que las gráficas terminen de cargar:

```tsx
// dentro de app/(panel)/page.tsx
import { Suspense } from 'react'

function ChartSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => <ChartSkeleton key={i} />)}
    </div>
  )
}

// ...
<Suspense fallback={<ChartSkeletonGrid />}>
  <DashboardGraficasSection rol={profile.rol} filtros={filtrosServidor} />
</Suspense>
```

Extraer el bloque de `fetchDashboardGraficas` + mapa `CHARTS_POR_VARIANTE` (Task 2.4) a un Server Component `DashboardGraficasSection` separado para que `Suspense` pueda esperarlo de forma aislada sin bloquear el resto de `page.tsx`.

- [ ] **Step 2: Medir con Lighthouse**

```bash
cd frontend
npm run build && npm run start
npx lighthouse http://localhost:3000 --only-categories=performance --view
```

Expected: tarjetas KPI visibles en menos de 2 segundos (verificar con las devtools de red, throttling "Fast 3G" para el peor caso razonable), score de Lighthouse del dashboard ≥ 85 (criterio 3.9).

- [ ] **Step 3: Si el score es menor a 85**

Revisar el reporte de Lighthouse por oportunidad específica (normalmente: tamaño de JS de Recharts, imágenes sin optimizar, CLS por el grid de gráficas). No optimizar especulativamente — solo atacar lo que el reporte señale como mayor impacto.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(panel\)/page.tsx
git commit -m "perf: carga diferida de graficas con Suspense para no bloquear el dashboard (F9)"
```

### Task 5.4: Modo pantalla para planta (F12)

**Files:**
- Create: `frontend/app/planta/[token]/page.tsx`
- Create: `frontend/components/planta/PlantaKioskView.tsx`
- Create: `frontend/lib/supabase/planta-actions.ts`
- Modify: `frontend/middleware.ts` (excluir `/planta/*` del chequeo de sesión normal; usar token propio)
- Modify: `frontend/app/(panel)/page.tsx` (botón "Abrir modo planta" solo para supervisor)

**Interfaces:**
- Consumes: `VehiculosPorEtapaChart`, `EntradasSalidasChart`, datos de stock bajo (reutilizar `fetchProductosBajoStock` de `notificaciones-actions.ts`).
- Produces: ruta pública `/planta/[token]` gateada por un token (no por rol de usuario autenticado — la TV del taller no tiene sesión de login), que rota automáticamente entre tres vistas cada 30 segundos.

- [ ] **Step 1: Generación y validación de token**

El documento pide que se abra "desde el dashboard del supervisor". El token se genera server-side (ej. `crypto.randomUUID()` guardado junto al `profile.id` del supervisor que lo generó, con expiración — si no hay tabla para esto en el contrato del backend, usar un JWT firmado con una variable de entorno nueva `PLANTA_KIOSK_SECRET`, verificado en la propia página sin tocar Supabase Auth). Documentar esto como pregunta a backend si el contrato no lo cubre — no es parte del contrato original de "vistas/RPC", es una decisión de frontend de cómo exponer una ruta sin login.

```ts
// frontend/lib/supabase/planta-actions.ts
'use server'

import { SignJWT, jwtVerify } from 'jose' // agregar dependencia: npm install jose
import { requireRole } from '@/lib/auth/require-role'

const SECRET = new TextEncoder().encode(process.env.PLANTA_KIOSK_SECRET ?? 'dev-secret-cambiar-en-produccion')

export async function generarTokenPlanta(): Promise<string> {
  const auth = await requireRole(['supervisor'])
  if (!auth.ok) throw new Error(auth.error)
  return new SignJWT({ tipo: 'planta-kiosk' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET)
}

export async function verificarTokenPlanta(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, SECRET)
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Vista kiosk con rotación de 30s**

```tsx
// frontend/components/planta/PlantaKioskView.tsx
'use client'

import { useEffect, useState } from 'react'
import { VehiculosPorEtapaChart } from '@/components/dashboard/charts/VehiculosPorEtapaChart'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { LowStockList } from '@/components/dashboard/LowStockList'
import { useRealtimeChannel } from '@/lib/hooks/use-realtime-channel'
import type { VehiculoPorEtapaPunto } from '@/lib/types/dashboard-graficas'
import type { EntradaSalidaDia } from '@/lib/types/dashboard'

interface PlantaKioskViewProps {
  vehiculosPorEtapa: VehiculoPorEtapaPunto[]
  entradasSalidas: EntradaSalidaDia[]
  productosStockBajo: { nombre: string; cantidad: number; umbral: number }[]
}

const ROTACION_MS = 30_000
const VISTAS = ['etapas', 'entradas-salidas', 'stock-bajo'] as const

export function PlantaKioskView({ vehiculosPorEtapa, entradasSalidas, productosStockBajo }: PlantaKioskViewProps) {
  const [indice, setIndice] = useState(0)
  useRealtimeChannel(['vehiculo_procesos', 'movimientos_inventario'])

  useEffect(() => {
    const id = setInterval(() => setIndice((i) => (i + 1) % VISTAS.length), ROTACION_MS)
    return () => clearInterval(id)
  }, [])

  const vista = VISTAS[indice]

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-12 text-foreground">
      {vista === 'etapas' && (
        <>
          <h1 className="mb-8 text-4xl font-bold">Vehículos por etapa</h1>
          <div className="w-full max-w-5xl text-2xl"><VehiculosPorEtapaChart data={vehiculosPorEtapa} /></div>
        </>
      )}
      {vista === 'entradas-salidas' && (
        <>
          <h1 className="mb-8 text-4xl font-bold">Entradas vs. salidas de hoy</h1>
          <div className="w-full max-w-5xl"><EntradasSalidasChart data={entradasSalidas} /></div>
        </>
      )}
      {vista === 'stock-bajo' && (
        <>
          <h1 className="mb-8 text-4xl font-bold">Stock bajo</h1>
          <div className="w-full max-w-3xl text-2xl"><LowStockList productos={productosStockBajo} /></div>
        </>
      )}
    </div>
  )
}
```

No se muestran costos en ninguna de las tres vistas (confirma condición "sin costos" del documento 5.1) — ninguna de las tres usa `ValorizacionChart` ni `AjustesOCPorEstadoChart`.

- [ ] **Step 3: Página de ruta**

```tsx
// frontend/app/planta/[token]/page.tsx
import { notFound } from 'next/navigation'
import { verificarTokenPlanta } from '@/lib/supabase/planta-actions'
import { PlantaKioskView } from '@/components/planta/PlantaKioskView'
// reutilizar fetchDashboardGraficas con rol 'supervisor' fijo (solo para los 3 datasets sin costos) y fetchProductosBajoStock existente

export default async function PlantaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const valido = await verificarTokenPlanta(token)
  if (!valido) notFound()

  // cargar datasets (omitido aquí: igual patrón Server Action que el resto del plan)

  return <PlantaKioskView vehiculosPorEtapa={[]} entradasSalidas={[]} productosStockBajo={[]} />
}
```

- [ ] **Step 4: Excluir `/planta` del middleware de sesión normal**

En `frontend/middleware.ts`, agregar `/planta` al conjunto de rutas que no pasan por el chequeo de `profiles.rol` (ya tiene su propia verificación de token dentro de la página) — igual patrón que la exclusión existente de `_next`/estáticos en el `matcher`, pero como chequeo explícito de prefijo dentro de la función, no tocando el `matcher` regex si eso complica el resto de reglas.

- [ ] **Step 5: Botón "Abrir modo planta" en dashboard de supervisor**

En `app/(panel)/page.tsx`, para `variante === 'completo'`, agregar un botón que llama a `generarTokenPlanta()` (Server Action) y abre `/planta/${token}` en una pestaña nueva.

- [ ] **Step 6: Verificar criterio de aceptación 5.1**

Abrir `/planta/<token>` en una pestaña, dejarlo correr y confirmar que rota entre las 3 vistas cada 30s, que un cambio real en inventario se refleja sin recargar manualmente (gracias a `useRealtimeChannel`), que el texto es legible a 3 metros (fuente grande, alto contraste — usar clases Tailwind de tamaño `text-2xl`/`text-4xl` como en el ejemplo, ajustar según prueba visual real en una pantalla grande si hay una disponible), y que no hay menús/sidebar visibles.

- [ ] **Step 7: Commit**

```bash
npm install jose
git add frontend/app/planta/ frontend/components/planta/ frontend/lib/supabase/planta-actions.ts frontend/middleware.ts frontend/app/\(panel\)/page.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: modo pantalla para planta con token y rotacion cada 30s (F12)"
```

### Task 5.5: QA por rol (ronda completa de la Tabla 2 + permisos)

**Files:** ninguno (tarea de verificación, no de código — puede generar fixes puntuales en los archivos ya tocados)

- [ ] **Step 1: Matriz de verificación**

Para cada uno de los 8 roles (`supervisor, compras, auditoria, comercial, metalmecanica, produccion, instalacion, lectura`), con `DEV_SKIP_AUTH_ROLE` primero y luego con un usuario real de staging:
- Dashboard: gráficas correctas según Tabla 2, ninguna de costos fuera de `supervisor/compras/auditoria`.
- `/notificaciones`, `/automatizaciones`, `/actividad`, `/correos`: acceso correcto según `ROUTE_PERMISSIONS` actualizado en Fase 3.
- `/compras`: badge Siigo visible, botones Enviar/Reintentar solo para `compras`/`supervisor`.
- Exportar: botón ausente/deshabilitado para quien no debe ver costos.

- [ ] **Step 2: Registrar hallazgos como issues puntuales**

Cada fallo encontrado se corrige con un commit propio `fix: ...` referenciando el rol/ruta afectado, no se agrupan varios fixes en un commit genérico.

- [ ] **Step 3: Commit final de la fase (si hubo fixes)**

```bash
git add -A
git commit -m "fix: ajustes de QA por rol tras recorrido completo seccion 2"
```

---

## Fase 6 — Miércoles 14: correcciones, ajustes libres, build y despliegue

### Task 6.1: Pulido visual final (F7 completo)

**Files:** variable, según hallazgos — típicamente `app/globals.css`, componentes con espaciados inconsistentes detectados en QA.

- [ ] **Step 1: Revisión de consistencia**

Recorrer el panel en escritorio y en una tablet de 10 pulgadas (emulador de Chrome DevTools, `iPad` preset o 1024×768 real si hay un dispositivo), confirmar: mismos colores para mismos estados (reusar `.badge-*`/`.chip-*` de `globals.css` en vez de colores nuevos ad-hoc en los componentes de Fase 2-5), espaciados consistentes (`gap-4`/`space-y-4` como el resto del panel), tablas legibles sin scroll horizontal forzado en tablet.

- [ ] **Step 2: Cualquier ajuste de "margen de libertad" (sección 8 del documento)**

Si se detectan mejoras de texto/color/flujo dentro de la línea actual, aplicarlas aquí, documentando antes/después para el reporte final — no se ejecuta ningún ajuste que tome más de medio día sin consultar primero (condición explícita del documento).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "style: pulido visual final del panel (F7)"
```

### Task 6.2: Build de producción y despliegue a staging

**Files:** ninguno nuevo — usa `docker/docker-compose.prod.yml` y `frontend/Dockerfile` ya existentes.

- [ ] **Step 1: Build local de verificación**

```bash
cd frontend
npm run build
```

Expected: build exitoso sin warnings de tipos nuevos introducidos por esta sección.

- [ ] **Step 2: Merge a `main` y despliegue vía rama `production`**

Seguir el flujo ya establecido del repo (sección 9 del documento: "Código en la rama main y desplegado en staging mediante la rama production"):

```bash
git checkout production
git merge main --no-ff -m "deploy: seccion 2 vista grafica, siigo y correos por rol"
git push origin production
```

(Confirmar con el equipo si el despliegue a `carrera.zomidev.com` es automático al pushear `production`, vía el `docker-compose.prod.yml`/CI, o si requiere un paso manual en el VPS — no asumir, preguntar antes de este paso si no está documentado en `docs/DEPLOY-VPS.md`.)

- [ ] **Step 3: Verificar en staging real**

Recorrer `carrera.zomidev.com` con login real por cada rol (sin `DEV_SKIP_AUTH`, confirmando que la variable ni siquiera está seteada en el build de producción — revisar `docker/docker-compose.prod.yml` build args).

### Task 6.3: Entregables finales (UAT, sección 9 del documento)

- [ ] **Step 1: Grabar recorrido por rol** — dashboard, notificaciones, Siigo, correos, permisos, uno por cada uno de los 8 roles.
- [ ] **Step 2: Grabar video de actualización en vivo** con dos navegadores (repetir verificación de Task 4.1 Step 5 en staging, grabando pantalla).
- [ ] **Step 3: Adjuntar resultado de Lighthouse** (repetir Task 5.3 Step 2 contra staging, no localhost).
- [ ] **Step 4: Confirmar el caso de aceptación de Siigo**: una OC aprobada en staging real, grabar su paso a "sincronizada" con referencia.
- [ ] **Step 5: Confirmar alerta + correo**: crear una alerta real (ej. bajar stock de un producto bajo el umbral), confirmar que aparece en el panel con su constancia de correo enviado.
- [ ] **Step 6: Lista de ajustes del margen de libertad** con antes/después (de Task 6.1).
- [ ] **Step 7: Confirmar cero defectos críticos/bloqueantes abiertos.**

---

## Auto-revisión del plan (cobertura vs. documento del cliente)

| Punto del documento | Tarea(s) |
|---|---|
| F1 Dashboard gráfico por rol | Task 2.1, 2.2, 2.3, 2.4 |
| F2 Filtros del dashboard | Task 0.3, 2.4 |
| F3 Actualización en vivo | Task 4.1 |
| F4 Centro de notificaciones | Task 3.1, 4.2 |
| F5 Pantalla de automatizaciones | Task 3.2 |
| F6 Actividad en vivo | Task 3.3 |
| F7 Pulido visual | Task 1.1, 1.2, 6.1 |
| F8 Exportar gráficas | Task 5.2 |
| F9 Rendimiento | Task 5.3 |
| F10 Sincronización Siigo | Task 5.1 |
| F11 Correos automáticos por rol | Task 3.4 |
| F12 Modo pantalla para planta | Task 5.4 |
| Fuera de alcance (app móvil, push/WhatsApp, archivos en nube, modo oscuro completo) | No se crea ninguna tarea para estos — confirmado explícitamente excluido |
| Entregables/UAT | Task 6.2, 6.3 |

Bloqueos conocidos de antemano (para el reporte diario, no fallas del plan):
- Nombres reales de vistas/RPC (`dashboard_graficas`, `vista_automatizaciones_estado`, `vista_actividad_auditoria`, `vista_correos_enviados`) son placeholders hasta el contrato del viernes — Task 4.0 los reconcilia.
- Edge Function `siigo-enviar-orden` y la tabla `notificaciones_leidas` no existen hoy en `supabase/migrations/` — dependen de que backend las incluya en el contrato o en la entrega del domingo.
- Token de acceso al modo planta (Task 5.4) es una decisión de frontend no cubierta por el contrato de datos — confirmar con backend si prefieren un mecanismo distinto antes del martes 13.
