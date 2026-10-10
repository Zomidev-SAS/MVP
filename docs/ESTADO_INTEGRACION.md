# Estado de integración — main (frontend + backend + vehiculosapp)

**Fecha:** 2026-09-19

## Completado en `main`

- Frontend adaptado al schema real (`productos` + `bodegas`, 8 roles).
- Backend Supabase: migraciones `000`–`020`, 5 Edge Functions, RPC `resolver_ajuste`.
- Panel: dashboard, inventario (con filtro por bodega), movimientos, entradas, ajustes, importar CSV, usuarios, configuración, formularios, calendario.
- Umbral de stock bajo leído desde `config_app.umbral_stock_bajo`.
- Seed local: usuarios de prueba + ~800 productos + saldos de apertura + formularios de ejemplo.

## Integración con vehiculosapp (app móvil de registro)

La app móvil **no está en este repo**. Se integra vía Supabase:

| Pieza | Qué hace |
|-------|----------|
| Tabla `formularios` | La app escribe JSON con `data.datosGenerales.chasis` (código de producto) |
| Trigger `on_formulario_ingreso` | Al insertar `tipo = 'ingreso'`, llama `sync-inventario-vin` |
| Edge `sync-inventario-vin` | Crea movimiento `salida_vin` en `movimientos_inventario` |
| Edge `consultar-saldo-vin` | Consulta saldo desde la app móvil |
| Panel `/formularios` | Solo lectura de lo que registró la app |

**Pendiente en cloud:** configurar el trigger con la `service_role_key` real y URL del proyecto (no `host.docker.internal`).

## Cómo probar localmente (sin bypass)

```bash
# Terminal 1 — base de datos + datos reales
supabase start
supabase db reset

# Terminal 2 — Edge Functions
supabase functions serve

# Frontend: quitar DEV_SKIP_AUTH de .env.local y usar keys de `supabase status`
cd frontend && npm run dev
```

Login: `supervisor@test.local` / `test1234`

## Cómo probar contra Supabase Cloud

Tu `.env.local` ya apunta a `https://zkaeptnijqntuefggfru.supabase.co`. Para que todo se muestre:

1. `supabase link --project-ref zkaeptnijqntuefggfru`
2. `supabase db push` (aplica migraciones 018–020 si faltan)
3. Cargar catálogo y movimientos (`tests/01_productos_reales.sql`, `02_apertura...`) en el SQL Editor
4. `supabase functions deploy` + secrets (`MI_SERVICE_ROLE_KEY`, `MI_ANON_KEY`, `SYSTEM_ACTOR_ID`)
5. Desactivar `DEV_SKIP_AUTH` en `.env.local`
6. Crear usuarios reales o usar invitación vía panel

## Pendiente / por verificar

| Área | Notas |
|------|-------|
| Cloud data | Sin productos/movimientos cargados, inventario y dashboard quedan vacíos |
| Trigger sync | Placeholder de service role en migración 015 — actualizar en cloud |
| vehiculosapp | Confirmar que sigue enviando `chasis` como `codigo_producto` |
| Auth producción | Signups, Site URL, sesión 8h (B10 del PDF backend) |
| Deploy VPS | Sin empezar |

## Carpeta local `ArchivosAle/`

PDFs de referencia (cronograma, faltantes frontend/backend). Está en `.gitignore` — no se sube a GitHub.
