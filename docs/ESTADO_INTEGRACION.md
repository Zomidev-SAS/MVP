# Estado de integración — main (frontend + backend)

**Fecha:** 2026-09-10

## Completado en `main`

- Rama `main` creada uniendo `frontend` + `master` (historias no relacionadas).
- Migraciones Supabase del backend (000–004) más:
  - `005_create_eventos_calendario.sql` — tabla y RLS del calendario personal
  - `006_enable_rls.sql` — RLS en `profiles`, `movimientos_inventario`, `ajustes_pendientes` + grants en vistas
- `supabase/seed.sql` — usuarios y movimientos de prueba para desarrollo local
- Edge Functions:
  - `aprobar-ajuste` — inserta movimiento y marca ajuste como aprobado
  - `crear-usuario` — Auth admin + upsert en `profiles`
- README raíz con pasos para `supabase start` + conectar frontend

## Cómo probar localmente

1. `supabase start` (o `supabase db reset` para migraciones + seed)
2. `supabase functions serve` (en otra terminal)
3. Configurar `frontend/.env.local` con URL y anon key locales
4. Desactivar `DEV_SKIP_AUTH`
5. `cd frontend && npm run dev`
6. Login: `supervisor@test.local` / `test1234`

## Pendiente / por verificar

| Área | Notas |
|------|-------|
| Supabase Cloud | Crear proyecto remoto, `supabase link`, `db push`, deploy de functions |
| Realtime | `RealtimeRefresher` en dashboard — confirmar suscripción a cambios |
| Importar CSV | Probar insert masivo con RLS activo |
| Ajustes | Flujo completo solicitar → aprobar con Edge Function en local |
| Usuarios | Crear usuario desde panel con function `crear-usuario` |
| Calendario | CRUD contra `eventos_calendario` sin bypass |
| Tests automatizados | Solo hay SQL de prueba en `supabase/tests/` |
| Deploy VPS (Sprint 8) | Sin empezar |

## Bloqueos resueltos respecto a `ESTADO_FRONTEND.md`

Lo que antes estaba bloqueado en backend y ahora existe en `main`:

1. Tabla `eventos_calendario` + RLS
2. Edge Function `aprobar-ajuste`
3. Edge Function `crear-usuario`

Falta **validar en runtime** cada flujo con Supabase local/cloud (no solo tener el código).

## Próximos pasos sugeridos

1. Correr `supabase db reset` y confirmar que migraciones + seed pasan sin error
2. Conectar frontend sin bypass y recorrer cada módulo del panel
3. Anotar errores de RLS o permisos y ajustar `006_enable_rls.sql` si hace falta
4. Cuando exista proyecto cloud: documentar URL/keys de staging en `.env.example` (sin commitear secretos)
