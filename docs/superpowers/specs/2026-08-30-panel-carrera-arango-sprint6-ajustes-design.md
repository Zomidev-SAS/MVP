# Diseño: Panel Carrera Arango — Sprint 6 parte 1 (Ajustes: Solicitar + Aprobar)

**Fecha:** 2026-08-30
**Fuente:** `Documento_Iniciacion_Frontend_Carrera_Arango.md` (Sprint 6, mitad de Ajustes)
**Alcance:** Página única en `/ajustes` cuyo contenido depende del rol: formulario de solicitud (Producción/Compras/Supervisor) + tabla de aprobación (solo Supervisor). Badge de pendientes en el Sidebar.

## Decisiones de diseño

- **Evidencia:** campo de texto libre (descripción), no subida de archivo real — Supabase Storage no está configurado y el documento no lo pide explícitamente, solo dice "Evidencia" como campo del formulario. Se guarda dentro del `movimiento_borrador` jsonb como `{ descripcion: "..." }`.
- **Solicitar:** INSERT en `ajustes_pendientes` (schema real: `movimiento_borrador jsonb, solicitado_por uuid, estado, motivo_rechazo, resuelto_por, resuelto_at, created_at`). `movimiento_borrador` guarda `{ vin, cantidad, motivo, evidencia: { descripcion } }`. `solicitado_por` = usuario actual, `estado = 'pendiente'`.
- **Aprobar:** invoca la Edge Function `aprobar-ajuste` (tal como especifica el documento) vía `supabase.functions.invoke('aprobar-ajuste', { body: { ajuste_id } })` — la función no existe todavía (backend no está listo), el código queda correcto y listo para cuando exista, igual que el resto del proyecto.
- **Rechazar:** no necesita la Edge Function (no toca `movimientos_inventario`) — es un `UPDATE` directo sobre `ajustes_pendientes` (`estado = 'rechazado'`, `motivo_rechazo`, `resuelto_por`, `resuelto_at`).
- **Contenido por rol:** quien puede solicitar (`supervisor`, `produccion`, `compras`, según la matriz del documento) ve el formulario. Solo `supervisor` ve además la tabla de pendientes con Aprobar/Rechazar. Ambos bloques pueden coexistir en la misma página si el rol es Supervisor.
- **Badge en Sidebar:** solo para Supervisor, muestra el conteo de `ajustes_pendientes` con `estado = 'pendiente'`. En bypass dev, un número fijo de ejemplo.

## Arquitectura

Tres Server Actions en `lib/supabase/ajustes-actions.ts` (`'use server'` a nivel de archivo — lección ya establecida):
- `solicitarAjuste(datos)`: valida con Zod, inserta (real) o simula éxito (bypass dev).
- `fetchAjustesPendientes()`: lista los pendientes (real: consulta `ajustes_pendientes` con `estado='pendiente'`, join liviano no disponible así que se resuelve `solicitado_por` mostrando su UUID crudo, igual que `aprobado_por` en Movimientos; bypass dev: array fijo de ejemplo).
- `aprobarAjuste(id)` / `rechazarAjuste(id, motivo)`: real: `functions.invoke` / `update` respectivamente; bypass dev: simulan éxito.

El conteo para el badge del Sidebar se obtiene en `app/(panel)/layout.tsx` (Server Component, ya existente) solo cuando `profile.rol === 'supervisor'`, y se pasa como prop nueva a `Sidebar`.

`app/(panel)/ajustes/page.tsx` es un Server Component que decide qué renderizar según `profile.rol`: `<AdjustmentForm>` (Client Component, si el rol puede solicitar) y/o `<AdjustmentApproval>` (Client Component, solo supervisor, hace su propio fetch de pendientes vía Server Action + botones que llaman `aprobarAjuste`/`rechazarAjuste`).

## Tipos y componentes nuevos

- `lib/types/ajustes.ts` — `solicitarAjusteSchema` (Zod), `SolicitarAjusteInput`, `AjustePendiente` (`{id, vin, cantidad, motivo, solicitado_por, created_at}`), `AjusteResultado`.
- `lib/supabase/ajustes-actions.ts` — las 4 acciones.
- `lib/dev/preview-ajustes-data.ts` — 5 filas de ejemplo pendientes.
- `components/ajustes/AdjustmentForm.tsx`, `components/ajustes/AdjustmentApproval.tsx`.
- `app/(panel)/ajustes/page.tsx` se reescribe.
- `components/layout/Sidebar.tsx` se modifica: nueva prop opcional `ajustesPendientes?: number`, muestra un badge junto al ítem "Ajustes" si es mayor a 0.
- `app/(panel)/layout.tsx` se modifica: obtiene el conteo (solo si `rol === 'supervisor'`) y lo pasa al Sidebar.

## Criterio de aceptación

- Con bypass dev y rol `supervisor`: se ve el formulario de solicitud Y la tabla de pendientes con badge en el Sidebar mostrando el conteo de ejemplo.
- Con bypass dev y rol `produccion` o `compras`: solo se ve el formulario, sin badge ni tabla de aprobación.
- Con bypass dev y rol `comercial`, `ingenieria`, `auditoria`, `lectura`: `RoleGuard` bloquea el acceso (matriz ya existente, sin cambios).
- `npx tsc --noEmit` y `npm run build` sin errores.

## Fuera de alcance

- Subida real de archivos como evidencia.
- La Edge Function `aprobar-ajuste` en sí (es responsabilidad del equipo de backend).
- Importar CSV (Sprint 6 parte 2, spec separado).
