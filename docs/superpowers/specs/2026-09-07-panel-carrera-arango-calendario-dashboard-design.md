# Diseño: Panel Carrera Arango — Calendario personal en el Dashboard

**Fecha:** 2026-09-07
**Fuente:** Petición directa del usuario (feature fuera del plan original de 8 sprints).
**Alcance:** Widget de calendario en la parte superior del Dashboard (`app/(panel)/page.tsx`). Cualquier rol autenticado puede crear y borrar sus propios eventos (fecha + título + nota opcional), visibles solo para quien los creó.

## Decisiones de diseño

- **Alcance visual:** widget compacto, no un calendario de mes gigante. Mini-grid de mes (una columna) + lista de próximos eventos (otra columna), dentro de un `Card` arriba de los KPIs existentes.
- **Sin dependencia nueva:** el `Calendar` estándar de shadcn depende de `react-day-picker` (no instalado) y probablemente choca con el setup base-ui del proyecto (mismo problema ya visto con `form.tsx` en Sprint 5). Se construye un mini-grid de mes propio con aritmética de fechas pura (mismo patrón ya usado para el bucketing de fechas del Dashboard en Sprint 3 — `BOGOTA_OFFSET_MS`, sin depender de métodos `Date` locales del host).
- **Privacidad:** los eventos son por usuario. Cada fila en `eventos_calendario` tiene `usuario_id`; la rama real de cada Server Action filtra siempre por el usuario autenticado (`getSessionUser()`), y se documenta la política RLS esperada para cuando el equipo de backend cree la tabla — igual doble-check en el código, no solo en RLS.
- **Campos del evento:** `fecha` (date), `titulo` (texto corto, requerido), `nota` (texto libre, opcional). Sin hora específica, sin recurrencia, sin categorías/colores.
- **Edición:** solo crear y borrar. No hay edición de un evento existente (si el usuario se equivoca, borra y crea de nuevo).
- **Datos de ejemplo (bypass dev):** ~4 eventos generados con offsets fijos en días relativos a "hoy" (ej. hoy+1, hoy+3, hoy-2, hoy+7) — determinista (sin `Math.random()`) pero siempre visible en el mes actual sin importar qué día se pruebe, seedeado con `new Date()` real del entorno de dev (no una fecha fija de 2026 como en sprints anteriores, porque este widget necesita mostrar algo relevante al mes que el mini-grid está renderizando).
- **Sin tabla real todavía:** igual que el resto del proyecto, el schema `eventos_calendario` no existe — se documenta aquí con el SQL sugerido para el equipo de backend, y la rama "real" de las Server Actions se escribe correcta pero queda sin probar hasta que la tabla exista.

## Schema propuesto (para el equipo de backend, no se ejecuta desde frontend)

```sql
create table eventos_calendario (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references auth.users(id),
  fecha date not null,
  titulo text not null check (length(trim(titulo)) >= 1),
  nota text,
  created_at timestamptz not null default now()
);

alter table eventos_calendario enable row level security;

create policy "usuarios ven solo sus propios eventos"
  on eventos_calendario for select
  using (usuario_id = auth.uid());

create policy "usuarios insertan solo sus propios eventos"
  on eventos_calendario for insert
  with check (usuario_id = auth.uid());

create policy "usuarios borran solo sus propios eventos"
  on eventos_calendario for delete
  using (usuario_id = auth.uid());
```

## Arquitectura

- `lib/types/calendario.ts` — `CalendarEvento` (`{id, fecha: string (YYYY-MM-DD), titulo, nota: string | null}`), `crearEventoSchema` (Zod: `fecha` requerido formato `YYYY-MM-DD`, `titulo` mínimo 1 carácter, `nota` opcional), `CrearEventoInput`, `EventoResultado` (`{ok:true} | {ok:false, error:string}`).
- `lib/dev/preview-calendario-data.ts` — `getDevPreviewCalendarioData(): CalendarEvento[]`, genera las ~4 filas relativas a `new Date()` con offsets fijos en milisegundos (mismo patrón `bogotaDateKey`/millisecond arithmetic ya usado en Sprint 3, evitando desfases de zona horaria).
- `lib/supabase/calendario-actions.ts` (`'use server'` a nivel de archivo — lección ya establecida):
  - `fetchEventos(): Promise<CalendarEvento[]>` — bypass dev: datos de ejemplo. Real: `select` en `eventos_calendario` donde `usuario_id = <usuario actual>`, orden por `fecha asc`.
  - `crearEvento(datos: CrearEventoInput): Promise<EventoResultado>` — valida con Zod: bypass dev simula éxito (delay falso). Real: `insert` con `usuario_id` del usuario autenticado vía `getSessionUser()`.
  - `eliminarEvento(id: number): Promise<EventoResultado>` — bypass dev simula éxito. Real: `delete` donde `id = id AND usuario_id = <usuario actual>` (doble-check en código, además de RLS).
- `components/dashboard/CalendarWidget.tsx` (Client Component): estado local `mes` (mes visible en el mini-grid), `diaSeleccionado`, `eventos` (cargado con `fetchEventos()` en un `useEffect`, igual que `AdjustmentApproval`). Renderiza:
  - Mini-grid del mes: cabecera con nombre del mes + flechas prev/siguiente, 7 columnas (Lun-Dom), celdas de días del mes con un punto si `eventos` tiene alguna fecha ese día; click en un día lo selecciona (`diaSeleccionado`).
  - Lista "Próximos eventos": eventos con `fecha >= hoy`, ordenados ascendente, cada fila muestra fecha corta + título + nota (si existe) + botón de borrar (llama `eliminarEvento`, quita del estado local al confirmar, toast).
  - Botón "+ Agregar evento" abre un `Dialog` (ya instalado) con un formulario RHF+Zod (mismo patrón que `EntryForm`/`AdjustmentForm`): campo fecha (prellenado con `diaSeleccionado` si hay uno, si no con hoy), título, nota. Al enviar llama `crearEvento`, cierra el diálogo, agrega el evento al estado local, toast de éxito o error.
- `app/(panel)/page.tsx` se modifica: se agrega `<CalendarWidget />` como primer elemento dentro del `<div className="space-y-6">`, antes del bloque de KPIs.

## Criterio de aceptación

- Con bypass dev, el widget muestra el mes actual con puntos en los días que tienen eventos de ejemplo, y la lista de próximos eventos con esos mismos datos.
- Crear un evento nuevo (fecha futura + título) lo agrega a la lista sin recargar la página y muestra un toast de éxito.
- Borrar un evento lo quita de la lista y muestra un toast de éxito.
- Enviar el formulario sin título muestra el error de validación de Zod sin llamar a la Server Action.
- El widget es visible para cualquier rol (no depende de `ROUTE_PERMISSIONS`, ya que `dashboard: ALL_ROLES`).
- `npx tsc --noEmit` y `npm run build` sin errores (build obligatorio: `CalendarWidget` es Client Component que importa las Server Actions directamente).

## Fuera de alcance

- Crear la tabla `eventos_calendario` de verdad (responsabilidad del equipo de backend — este spec solo documenta el SQL sugerido).
- Edición de eventos existentes.
- Hora específica, recurrencia, categorías/colores, recordatorios/notificaciones.
- Vista de mes completo tipo Google Calendar (decisión ya tomada: widget compacto).
- Una "segunda versión" del diseño visual — el usuario pidió ver el resultado antes de decidir si iterar el look, eso queda para después de esta implementación.
