# Diseño: Procesos del vehículo (etapa "En proceso")

**Fecha:** 2026-09-24
**Fuente:** pedido del usuario en sesión, sobre `2026-09-24-linea-tiempo-vehiculo-design.md`. Aclaraciones resueltas en conversación (ver resumen abajo).

## Alcance

La etapa "En proceso" del widget `VehiculoTimelineCard` (única etapa clickeable; el resto del stepper sigue sin interacción) abre un modal que muestra el historial de procesos registrados para el chasis seleccionado, y — solo para roles autorizados — un formulario para agregar uno nuevo.

**Decisiones ya tomadas en conversación:**
- "admin" del pedido original = rol `supervisor` (no existe un rol "admin" en el sistema).
- Historial **acumulativo, append-only**: cada "agregar" o "mover" crea una fila nueva con fecha y usuario automáticos. No hay edición ni borrado de filas existentes.
- Campos del formulario: Título, Proceso/estado, Observaciones (opcional), Sección siguiente (opcional) — los cuatro son texto libre, sin lista fija.
- Visibilidad: cualquier rol con acceso al dashboard (todos menos `lectura`) puede **ver** el historial. Solo `supervisor`, `metalmecanica`, `instalacion` pueden **agregar** un proceso nuevo.
- Fecha y autor se guardan automáticamente vía trigger de base de datos (el frontend nunca los envía, no se pueden falsificar).
- **Fuera de alcance por ahora** (decisión explícita del usuario): el problema de un vehículo que reingresa a proceso después de una salida — hoy el historial de procesos y el stepper no distinguen "ciclos" (entradas repetidas del mismo chasis). Se deja para que el equipo de backend lo resuelva más adelante; no se implementa scoping por ciclo en esta tarea.

## Base de datos (propuesta — no se aplica desde este repo de frontend)

Migración nueva `supabase/migrations/027_vehiculo_procesos.sql`:

- Tabla `vehiculo_procesos`: `id uuid`, `chasis text`, `titulo text`, `proceso_estado text`, `observaciones text?`, `seccion_siguiente text?`, `creado_por uuid`, `creado_por_nombre text`, `creado_en timestamptz`.
- Trigger `before insert` que sobrescribe `creado_por`, `creado_por_nombre` y `creado_en` leyendo `auth.uid()` y `profiles.nombre` — el cliente no controla esos tres campos.
- RLS: `SELECT` para `get_user_rol() is not null and get_user_rol() <> 'lectura'` (mismo criterio que `formularios`/dashboard). `INSERT` para `get_user_rol() in ('supervisor','metalmecanica','instalacion')`. Sin políticas `UPDATE`/`DELETE` (deny by default → append-only).
- Índice en `chasis` para la consulta por vehículo.

Este archivo se deja listo en el repo para que el equipo de backend lo revise y aplique — no se corre `supabase db push` desde esta sesión (fuera del alcance de frontend, [[project_carrera_arango]] / [[feedback_backend_scope]]).

## Frontend

- `lib/types/vehiculo-proceso.ts` — `guardarProcesoVehiculoSchema` (zod), `VehiculoProceso`, `ProcesoVehiculoResultado`.
- `lib/permissions/roles.ts` — nueva constante `ROLES_PROCESO_VEHICULO = ['supervisor', 'metalmecanica', 'instalacion']`.
- `lib/dev/preview-procesos-vehiculo-data.ts` — datos estáticos de preview para `DEV_SKIP_AUTH`, mismo patrón que `preview-calendario-data.ts`.
- `lib/supabase/vehiculo-proceso-actions.ts` — `fetchProcesosVehiculo(chasis)`, `crearProcesoVehiculo(input)`; mismo patrón que `calendario-actions.ts` (bypass dev simula sin persistir, valida con zod, usa `requireRole`).
- `components/dashboard/VehiculoProcesoDialog.tsx` — modal con lista (siempre visible) + formulario `react-hook-form`/zod (solo si `rolActual` está en `ROLES_PROCESO_VEHICULO`), mismo patrón visual que `EventoFormDialog.tsx`.
- `components/dashboard/VehiculoTimelineCard.tsx` — recibe prop nueva `rolActual: Role`; la etapa "En proceso" pasa a ser un `<button>` (el resto sigue como `<div>` no interactivo) que abre `VehiculoProcesoDialog`.
- `app/(panel)/page.tsx` — pasa `rolActual={result.profile.rol}` a `VehiculoTimelineCard`.

## Fuera de alcance

- Scoping por ciclo de entrada/salida (ver nota arriba — a cargo de backend).
- Edición o borrado de procesos ya creados.
- Lista fija de opciones para "Proceso/estado" o "Sección siguiente".
- Notificaciones/alertas al cambiar de sección.
