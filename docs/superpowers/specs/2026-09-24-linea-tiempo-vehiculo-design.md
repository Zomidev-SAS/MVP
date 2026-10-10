# Diseño: Línea de tiempo del vehículo (Dashboard)

**Fecha:** 2026-09-24
**Fuente:** pedido directo del usuario en sesión — buscar un vehículo registrado y visualizar su historial de proceso (ingreso, parqueadero, salida) como línea de tiempo, debajo del calendario en el Dashboard.

## Alcance

Widget nuevo en `app/(panel)/page.tsx`, debajo de `CalendarWidget`, visible para **todas** las variantes de dashboard (incluidas `bitacora` y `basico`, que hoy no muestran calendario).

Fuente de datos: solo tabla `formularios` (ya existente), filtrando por chasis. No se cruza con `movimientos`.

**No es** el sistema de "tracking real de fase" mencionado como bloqueado en `2026-09-15-dashboard-por-rol-f2-design.md` (eso requeriría un subsistema de fases nuevo en base de datos). Este widget solo ordena cronológicamente los formularios que ya existen por chasis — no introduce estados nuevos ni tabla nueva.

## Flujo de usuario

1. Card "Línea de tiempo del vehículo" con un `Input` de búsqueda (chasis o placa).
2. Con 2+ caracteres, debounce 400ms, se piden sugerencias (chasis, marca, ciudad) que hagan match.
3. Al elegir una sugerencia, se cargan todos los formularios de ese chasis, ordenados cronológicamente ascendente (más antiguo arriba, más reciente abajo — cuenta el proceso en orden).
4. Cada evento se pinta como punto en una línea vertical: ícono según tipo (Entrada / Parqueadero / Salida), fecha (`formatearFechaCompacta`), marca/ciudad si el formulario los trae.
5. Sin selección: estado vacío ("Busca un vehículo por chasis o placa").
6. Chasis sin formularios (o error de red): mensaje de "sin resultados" / error, mismo tono que `FormulariosTable`.

## Piezas nuevas

- **`lib/supabase/vehiculo-timeline-actions.ts`** — Server Actions, mismo patrón que `formularios-actions.ts`:
  - `buscarVehiculosFormulario(termino: string): Promise<VehiculoSugerencia[]>` — trae formularios (misma query base que `fetchFormularios`, límite 2000), filtra en memoria por coincidencia de chasis/marca, deduplica por chasis, devuelve máx. 8 sugerencias ordenadas por actividad más reciente.
  - `fetchLineaTiempoVehiculo(chasis: string): Promise<EventoLineaTiempo[]>` — misma query base, filtra en memoria por chasis exacto (normalizado), ordena ascendente por fecha.
  - Ambas con `requireRole(ROUTE_PERMISSIONS.formularios)` y rama `isDevBypassActive()` usando `getDevPreviewFormulariosData()`.

  Se filtra en memoria (no `ilike` en SQL) porque el chasis vive en JSON heterogéneo por fila, igual que ya hace `fetchFormularios` — no hay columna fija confiable para filtrar en la base.

- **`lib/formularios/linea-tiempo.ts`** — helper puro:
  - `type EventoLineaTiempo = { id, tipoLabel, fecha: string | null, chasis, marca: string | null, ciudad: string | null }`
  - `construirEventosLineaTiempo(filas: FormularioListado[]): EventoLineaTiempo[]` — reusa `vistaFormulario` para tipoLabel/fecha/marca/chasis, agrega ciudad leyendo `dg_ciudad`/`datosGenerales.ciudad`.
  - `type VehiculoSugerencia = { chasis, marca: string | null, ciudad: string | null }`
  - `extraerSugerenciasVehiculo(filas: FormularioListado[], termino: string): VehiculoSugerencia[]`

- **`components/dashboard/VehiculoTimelineCard.tsx`** — client component:
  - `Card`/`CardHeader`/`CardTitle`/`CardContent` (mismo look que el resto del dashboard).
  - Input controlado + debounce (mismo patrón que `FormulariosTable`/`FormulariosFilters`), lista de sugerencias en dropdown simple (sin librería de combobox, no hay una en `components/ui`).
  - Al seleccionar, pinta la línea vertical con Tailwind (borde izquierdo + puntos), sin librería de timeline nueva.
  - Ícono por tipo: `ArrowDownToLine` (Entrada), `ParkingSquare` (Parqueadero), `ArrowUpFromLine` (Salida) de `lucide-react` (ya es dependencia del proyecto).

## Edición existente

- `app/(panel)/page.tsx` — importar y renderizar `<VehiculoTimelineCard />` justo después del bloque `{variante !== 'bitacora' && variante !== 'basico' && <CalendarWidget />}`, sin condición de variante.

## Fuera de alcance

- Cruce con tabla `movimientos`.
- Sistema de fases/estados nuevo en base de datos (ver nota de alcance arriba).
- Edición de formularios desde la línea de tiempo (solo lectura).
- Cambios en Supabase/RLS — se reutiliza el permiso `formularios` ya existente, que ya coincide con el permiso de `dashboard` (ambos excluyen solo `lectura`).
