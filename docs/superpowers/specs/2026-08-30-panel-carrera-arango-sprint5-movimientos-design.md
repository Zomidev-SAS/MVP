# Diseño: Panel Carrera Arango — Sprint 5 parte 1 (Historial de Movimientos)

**Fecha:** 2026-08-30
**Fuente:** `Documento_Iniciacion_Frontend_Carrera_Arango.md` (Sprint 5, mitad de la pestaña Movimientos)
**Alcance:** Tabla paginada de movimientos con filtros y detalle en Dialog. Reemplaza el placeholder de `app/(panel)/movimientos/page.tsx`. Sigue exactamente el mismo patrón arquitectónico que Sprint 4 (Inventario) — Server Action con bypass dev, paginación, filtros.

## Decisiones de diseño

- **Detalle por movimiento:** Dialog (shadcn), no ruta separada — se abre al hacer click en una fila, sin cambiar de URL.
- **Filtros:** rango de fechas sobre `created_at`, `tipo_movimiento` (dropdown: Entrada/Salida/Ajuste/Reverso), VIN (coincidencia exacta, mismo criterio que Inventario).
- **Columnas de la tabla:** Fecha, Tipo, VIN, Cantidad, Ubicación, Usuario (`actor_nombre`), Estado — `estado` es una columna real acá (a diferencia del "Estado" derivado que se inventó para Inventario), así que se muestra tal cual (`pendiente`/`aplicado`/`rechazado`).
- **Contenido del Dialog de detalle:** todo lo de la fila más `motivo`, `valor_unitario`, `formulario_id`, `aprobado_por` (nombre de quien aprobó si existe, o "—").
- **Página:** 20 filas, igual que Inventario.
- **Datos de ejemplo:** 60 filas fijas y deterministas (sin `Math.random`), variando tipo/estado/fechas para que los filtros tengan algo que filtrar.

## Arquitectura

Idéntica a Inventario (Sprint 4): Server Action `fetchMovimientos(filtros, pagina)` en `lib/supabase/movimientos-actions.ts` (archivo separado de cualquier constante, con `'use server'` a nivel de archivo — lección aprendida en Sprint 4: el directive por-función no aísla el módulo del bundle de cliente si un Client Component importa la acción directamente). Rama bypass dev filtra en JS un array fijo; rama real consulta `vista_movimientos_recientes` con `.range()` y los filtros correspondientes.

Client Component `MovementsTable` mantiene filtros+página en estado, debounce 500ms, llama la Server Action, renderiza tabla + paginación. Al hacer click en una fila, guarda el movimiento seleccionado en estado local y abre un `Dialog` (shadcn, se instala en este sprint) con el detalle.

## Tipos y componentes nuevos

- `lib/types/movimientos.ts` — `MovimientoDetalle` (todas las columnas reales + `actor_nombre`), `MovimientosFiltros` (`vin, tipo, desde, hasta`), `MovimientosPagina` (`{filas, total}`).
- `lib/dev/preview-movimientos-data.ts` — 60 filas fijas.
- `lib/supabase/movimientos-page-size.ts` (constante) + `lib/supabase/movimientos-actions.ts` (`'use server'` a nivel de archivo, exporta solo `fetchMovimientos`).
- `components/movimientos/MovementsFilters.tsx`, `components/movimientos/MovementDetailDialog.tsx`, `components/movimientos/MovementsTable.tsx`.
- `app/(panel)/movimientos/page.tsx` se reescribe para usar `MovementsTable`.

## Criterio de aceptación

- Con bypass dev, la tabla muestra 60 filas paginadas (3 páginas), filtros funcionan, click en fila abre el Dialog con el detalle completo.
- `npx tsc --noEmit` y `npm run build` sin errores (el build es obligatorio, no solo tsc — por la lección de Sprint 4 sobre Server Actions).

## Fuera de alcance

- Aprobar/rechazar movimientos desde acá (eso es Ajustes, Sprint 6).
- Exportar CSV (no lo pide el documento para esta vista, a diferencia de Inventario).
