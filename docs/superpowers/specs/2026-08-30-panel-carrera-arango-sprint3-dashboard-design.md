# Diseño: Panel Carrera Arango — Sprint 3 (Dashboard KPIs + Realtime)

**Fecha:** 2026-08-30
**Fuente:** `Documento_Iniciacion_Frontend_Carrera_Arango.md` (Sprint 3) — alcance estricto del documento, sin los widgets extra del mockup (dona por categoría, panel de Alertas, KPIs distintos) que se descartaron explícitamente.
**Alcance:** 4 tarjetas KPI, gráfico Entradas vs Salidas (7 días), tabla de últimos 10 movimientos, suscripción Realtime. Prioridad: que se vea y funcione visualmente completo YA con datos de ejemplo (bypass dev), ya que no hay conexión de datos activa todavía. El código de consulta real a Supabase se escribe completo y correcto (ahora que se conoce el schema real vía `origin/master`), pero es secundario — no se puede verificar contra datos reales hasta que exista el proyecto Supabase.

## Contexto

Sprint 1-2 dejaron auth, layout y RoleGuard funcionando. La corrección de schema (commit `788d291`) alineó `Profile` con las columnas reales (`nombre`, `rol`). Ahora se conoce también el schema real de `movimientos_inventario` y sus vistas (`vista_inventario_actual`, `vista_valorizacion_basica`, `vista_movimientos_recientes`), vía las migraciones ya pusheadas por el equipo de backend a `origin/master`.

## Schema real relevante (de `supabase/migrations/002_create_movimientos_inventario.sql` y `004_create_views.sql`)

```sql
movimientos_inventario: id, vin, tipo_movimiento ('entrada'|'salida_vin'|'ajuste'|'reverso'),
  cantidad, valor_unitario, marca, categoria, ubicacion, formulario_id, motivo,
  evidencia, actor_id, aprobado_por, estado ('pendiente'|'aplicado'|'rechazado'),
  idempotency_key, created_at

vista_inventario_actual: vin, marca, categoria, ubicacion, saldo, valor_unitario,
  valor_total, ultimo_movimiento   -- una fila por VIN, ya agregada (solo estado='aplicado')

vista_movimientos_recientes: movimientos_inventario.* + actor_nombre, actor_rol
  -- ya ordenada por created_at desc, limit 100
```

## Datos de los 4 KPIs (decisiones tomadas)

- **Total Unidades en Stock:** `sum(saldo)` de `vista_inventario_actual`.
- **Valor Total del Inventario:** `sum(valor_total)` de `vista_inventario_actual`.
- **Movimientos del Día:** `count(*)` de `movimientos_inventario` donde `estado = 'aplicado'` y `created_at` es de hoy (confirmado con el usuario: solo aplicados, no pendientes/rechazados).
- **VINs con Stock Bajo:** `count(*)` de `vista_inventario_actual` donde `saldo <= 2` (umbral del documento).

Los tres primeros KPIs de stock/valor/stock-bajo se derivan de UNA sola consulta a `vista_inventario_actual` (traer `saldo, valor_total` de todas las filas y agregar en JS) — evita tres round-trips.

## Gráfico Entradas vs Salidas (7 días)

Cuenta de movimientos por día (no suma de `cantidad`) con `estado='aplicado'` y `tipo_movimiento in ('entrada','salida_vin')` — `ajuste`/`reverso` quedan fuera de este gráfico específico. Barras agrupadas, Entradas en rojo de marca, Salidas en gris (Recharts vía `npx shadcn add chart`).

## Tabla de últimos movimientos

`vista_movimientos_recientes` (ya ordenada desc) con `.limit(10)`, columnas: fecha, tipo (etiqueta en español: Entrada/Salida/Ajuste/Reverso), VIN, cantidad, usuario (`actor_nombre`). Requiere instalar `npx shadcn add table` (no instalado todavía).

## Realtime

Client Component sin render (`RealtimeRefresher`) suscrito a `postgres_changes` sobre `movimientos_inventario`, que llama `router.refresh()` en cualquier evento — reejecuta el Server Component que trae los datos, sin recargar la página. Reutiliza el patrón de fetch server-side ya existente en vez de duplicar lógica de consulta en el cliente. Con Supabase de mentira (bypass dev), la suscripción intenta conectar y falla silenciosamente (no rompe la app) — dormida hasta que exista backend real, mismo patrón que el resto del proyecto.

## Datos falsos para bypass dev

`lib/dev/preview-dashboard-data.ts` (nuevo, mismo patrón que `preview-bypass.ts`): números fijos y deterministas (sin `Math.random`, para que las verificaciones con curl/grep sean reproducibles) — Total Unidades 12,455 · Valor Total $3,246,780,000 · Movimientos Hoy 42 · Stock Bajo 7 VINs, más series de 7 días y 10 movimientos de ejemplo con nombres/VINs/fechas realistas.

## Componentes nuevos

- `lib/types/dashboard.ts` — `DashboardData`, `MovimientoReciente`.
- `lib/format.ts` — `formatCOP(n)`, `formatNumber(n)` (Intl.NumberFormat es-CO).
- `lib/dev/preview-dashboard-data.ts` — datos falsos.
- `lib/supabase/get-dashboard-data.ts` — `getDashboardData()`: bypass dev o las 4 consultas reales en paralelo, con `{error}` chequeado en cada una (fallback a 0/[] y `console.error` si falla, no crashea la página).
- `components/dashboard/KpiCard.tsx` — tarjeta reutilizable (ícono + label + valor).
- `components/dashboard/EntradasSalidasChart.tsx` — Client Component, gráfico de barras.
- `components/dashboard/UltimosMovimientosTable.tsx` — tabla shadcn.
- `components/dashboard/RealtimeRefresher.tsx` — Client Component, suscripción Realtime.

`app/(panel)/page.tsx` se reescribe: mantiene el saludo actual, agrega grid de 4 KPIs, card con el gráfico, card con la tabla, y `<RealtimeRefresher />` al final.

## Criterio de aceptación

- Con el bypass dev activo, el Dashboard muestra las 4 KPI cards, el gráfico de 7 días y la tabla de 10 movimientos con los datos de ejemplo — visualmente completo.
- `npx tsc --noEmit` y `npm run build` sin errores.
- El código de `getDashboardData()` (rama sin bypass) compila correcto contra el schema real, aunque no se pueda probar en vivo todavía.

## Fuera de alcance

- Dona por categoría, panel de Alertas, KPIs "Entradas Hoy"/"Ajustes Pendientes" del mockup visual — no están en el texto del documento, se descartan (decisión ya tomada).
- Verificación end-to-end de Realtime contra una base de datos real — imposible sin Supabase real, se prueba manualmente cuando exista.
- RLS de las vistas/tabla — no se ha visto ninguna migración de políticas RLS todavía; si existen y son restrictivas, las consultas reales podrían fallar por permisos incluso con credenciales válidas, se ajusta cuando se conecte.
