# Estado del Frontend — Panel Carrera Arango

**Fecha:** 2026-09-08

Frontend completo hasta donde es posible sin el proyecto Supabase real. Todo el trabajo de esta etapa vive en la rama `frontend`.

## Completado

- Sprint 1 — Autenticación (login, sesión, rutas protegidas)
- Sprint 2 — Layout, Sidebar, Header, RoleGuard
- Sprint 3 — Dashboard (KPIs, gráfico, últimos movimientos)
- Sprint 4 — Inventario
- Sprint 5 — Movimientos, Entradas manuales
- Sprint 6 — Ajustes (solicitar/aprobar), Importar CSV
- Sprint 7 — Usuarios (cambiar rol, activar/desactivar, crear usuario)
- Extras: Calendario personal en el Dashboard, rediseño de login, notificaciones clickeables

Cada feature fue verificada con `tsc --noEmit`, `npm run build` y `curl` antes de cada commit. Toda la lógica de datos sigue el mismo patrón: Server Action con rama de bypass dev (datos de ejemplo) + rama real contra Supabase.

## Bloqueado en el equipo de backend

No hay proyecto Supabase real todavía — nada de esto se probó contra una base de datos real, solo contra el bypass dev (`DEV_SKIP_AUTH=true`). Para que el frontend funcione de verdad, el backend necesita:

1. **Edge Function `aprobar-ajuste`** — contrato documentado en `docs/superpowers/specs/2026-08-30-panel-carrera-arango-sprint6-ajustes-design.md`.
2. **Edge Function `crear-usuario`** — contrato documentado en `docs/superpowers/specs/2026-09-08-panel-carrera-arango-crear-usuarios-design.md`.
3. **Tabla `eventos_calendario`** (con su RLS) — SQL sugerido en `docs/superpowers/specs/2026-09-07-panel-carrera-arango-calendario-dashboard-design.md`.

## Pendiente, no bloqueado por backend

- Sprint 8 (deploy/VPS) — sin empezar, falta info de dominio/servidor/proveedor.
- Suite de tests automatizados — toda la verificación hasta ahora fue manual (tsc/build/curl).
- `RoleGuard` sigue siendo opt-in por página, no fail-closed por default (deferido desde Sprint 2).
