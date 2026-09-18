# Panel Carrera Arango — Monorepo

Proyecto unificado con **frontend** (Next.js) y **backend** (Supabase: migraciones, RLS, Edge Functions).

## Estructura

```
├── frontend/          # Panel Next.js (App Router)
├── supabase/          # Backend: migraciones, seed, Edge Functions
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
└── docs/              # Specs, planes y estado del proyecto
```

## Ramas

| Rama | Contenido |
|------|-----------|
| `main` | Frontend + backend integrados (rama de trabajo principal) |
| `frontend` | Solo panel Next.js |
| `master` | Solo migraciones Supabase originales |

## Requisitos

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- Docker (para Supabase local)

## 1. Levantar Supabase local

Desde la raíz del repo:

```bash
supabase start
```

Copia las credenciales que imprime el comando (URL y `anon key`).

Para aplicar migraciones y datos de prueba desde cero:

```bash
supabase db reset
```

Usuarios de prueba (contraseña `test1234`):

| Email | Rol |
|-------|-----|
| supervisor@test.local | supervisor |
| comercial@test.local | comercial |
| produccion@test.local | produccion |
| compras@test.local | compras |
| auditoria@test.local | auditoria |

## 2. Conectar el frontend

```bash
cd frontend
cp .env.example .env.local
```

Edita `frontend/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key de supabase status>
```

Quita o comenta `DEV_SKIP_AUTH` para usar login real:

```
# DEV_SKIP_AUTH=true
# DEV_SKIP_AUTH_ROLE=supervisor
```

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000/login](http://localhost:3000/login) e iniciá sesión con `supervisor@test.local` / `test1234`.

## 3. Edge Functions (local)

Con Supabase corriendo:

```bash
supabase functions serve
```

Funciones incluidas:

- `sync-inventario-vin` — registra salida automática al crear formulario móvil
- `consultar-saldo-vin` — consulta saldo respetando RLS y enmascarado de costos
- `importar-inventario-csv` — carga masiva de entradas desde CSV
- `crear-usuario` — invita usuario Auth + perfil (solo supervisor)
- `desactivar-usuario` — desactiva perfil y banea sesión (solo supervisor)

También existe el RPC `resolver_ajuste` (PostgREST, no Edge Function).

## Estado de integración

Ver `docs/ESTADO_INTEGRACION.md` para qué está listo y qué falta probar contra Supabase real (cloud).

## Documentación del frontend

Detalle de instalación y variables: `frontend/README.md`.

---

# Backend — Núcleo de inventario (Supabase)

Documentación técnica del backend en Supabase. Cubre el esquema, las 6 Edge
Functions construidas, la matriz de seguridad (RLS), y la guía de despliegue
a staging/producción — según lo exigido en B12 del documento
`FALTANTES_BACKEND_FASE_1.pdf`.

Última actualización: cierre de Sprint 3-6 + B1-B9 del PDF de faltantes.

## 1. Esquema

El negocio real de Carrera Arango es **fabricación de muebles** (no
vehículos con VIN, como asumía el documento de iniciación original). El
esquema fue adaptado con evidencia real (`Saldos_de_inventario_*.xlsx`).

### Tablas

| Tabla | Qué es |
|---|---|
| `profiles` | Extensión de `auth.users`; guarda `rol` y `activo` |
| `productos` | Catálogo maestro: `codigo_producto`, `nombre_producto`, `unidad_medida`, `categoria` |
| `bodegas` | Catálogo de las 9 bodegas reales (`ALMACEN NIVEL 1`, `METALMECANICA`, etc.) |
| `categorias_inventario` | Catálogo de las 17 categorías reales |
| `movimientos_inventario` | **Ledger inmutable** (sin UPDATE/DELETE). `codigo_producto` + `bodega` + `cantidad` (+/-) |
| `ajustes_pendientes` | Cola de aprobación para correcciones manuales |
| `config_app` | Config global: `bloquear_sin_stock`, `umbral_stock_bajo` |
| `formularios` | Origen de los movimientos desde la app móvil |

### Vistas

| Vista | Qué muestra |
|---|---|
| `vista_inventario_actual` | Saldo total por producto (todas las bodegas sumadas) |
| `vista_inventario_por_bodega` | Saldo por producto **y** bodega específica |
| `vista_valorizacion_basica` | Unidades y valor agrupado por categoría |
| `vista_movimientos_recientes` | Últimos 100 movimientos con nombre del actor |

**Nota de seguridad (B3):** `valor_unitario` y `valor_total` se enmascaran
a `null` en las 4 vistas para cualquier rol fuera de `supervisor`, `compras`,
`auditoria`, vía `CASE WHEN get_user_rol() IN (...)`. La columna
`valor_unitario` también está revocada a nivel de tabla base para el rol
`authenticated`, así que no se puede saltar la vista consultando
`movimientos_inventario` directo.

## 2. Roles

```
supervisor · comercial · metalmecanica · produccion · instalacion · compras · auditoria · lectura
```

**Pendiente (B5):** `instalacion` está incluido como borrador. Falta
confirmar con el cliente si reemplaza a `produccion` o coexiste con ella.
Evidencia disponible: `metalmecanica` está confirmado porque aparece
textual como bodega real en los archivos de saldos.

## 3. Edge Functions

Todas requieren `Authorization: Bearer <token>`. Las que dicen
"vía `service_role`" corren con permisos elevados internamente, pero igual
exigen un JWT válido de quien llama (no aceptan llamadas anónimas).

### 3.1 `sync-inventario-vin`

**Qué hace:** registra automáticamente una salida (`salida_vin`) cuando la
app móvil crea un formulario de ingreso. Se dispara sola vía **database
webhook** (trigger `on_formulario_ingreso`, migración `015`) — no requiere
que nadie la llame manualmente.

**Auth:** vía `service_role` (llamada por el trigger, no por el usuario final).

**Endpoint:** `POST /functions/v1/sync-inventario-vin`

**Request:**
```json
{
  "formulario_id": "abc-123",
  "codigo_producto": "10024",
  "bodega": "ALMACEN NIVEL 1"
}
```

**Response 200 (creado):**
```json
{
  "ok": true,
  "duplicado": false,
  "movimiento": { "id": 1574, "codigo_producto": "10024", "tipo_movimiento": "salida_vin", "cantidad": -1, "...": "..." }
}
```

**Response 200 (idempotente, ya existía):**
```json
{ "ok": true, "duplicado": true, "movimiento": { "...": "..." } }
```

**Response 409 (bloqueado por falta de stock, si `config_app.bloquear_sin_stock = true`):**
```json
{
  "error": "Producto sin saldo disponible en esa bodega",
  "detalle": "El producto PM1006 en ALMACEN NIVEL 1 tiene saldo -100, no se puede registrar una salida."
}
```

**Errores:** `400` (falta `formulario_id`/`codigo_producto`/`bodega`),
`401` (sin `Authorization`), `500` (error de base de datos, p.ej. producto
inexistente).

### 3.2 `consultar-saldo-vin`

**Qué hace:** consulta el saldo/costos de un producto, respetando RLS y el
enmascarado de costos según el rol de quien pregunta.

**Auth:** JWT del usuario final (no `service_role` — respeta su rol real).

**Endpoint:** `GET /functions/v1/consultar-saldo-vin?codigo_producto=10024`

**Response 200 (rol con permiso de costos, p.ej. `compras`):**
```json
{
  "codigo_producto": "10024",
  "nombre_producto": "TAPA DE ASIENTO",
  "unidad_medida": "unidad",
  "categoria": "Productos CA",
  "saldo": 1940,
  "valor_unitario": 12480,
  "valor_total": 24211200,
  "ultimo_movimiento": "2026-09-16T05:02:31.74549+00:00"
}
```

**Response 200 (rol sin permiso de costos, p.ej. `comercial`):**
```json
{
  "codigo_producto": "10024",
  "saldo": 1940,
  "valor_unitario": null,
  "valor_total": null,
  "...": "..."
}
```

**Errores:** `400` (falta `codigo_producto`), `401` (sin token), `404`
(producto sin movimientos aplicados).

### 3.3 `importar-inventario-csv`

**Qué hace:** carga masiva de movimientos tipo `entrada` desde un CSV.

**Auth:** JWT del usuario; solo `supervisor` o `compras` (`403` para el resto).

**Endpoint:** `POST /functions/v1/importar-inventario-csv` (multipart/form-data, campo `file`)

**Formato del CSV esperado:**
```
codigo_producto,cantidad,bodega,valor_unitario
10024,5,ALMACEN NIVEL 1,12480
```
(`bodega` y `valor_unitario` son opcionales; `bodega` por defecto es `Sin Asignar`)

**Reglas:**
- Tope de 500 filas — `400` si se excede.
- Si el % de filas con error es mayor a 30%, se aborta el lote completo
  (`exitosas: 0`, nada se inserta).
- Si es igual o menor a 30%, se insertan las válidas y se reportan los
  errores puntuales.

**Response 200 (éxito total):**
```json
{ "exitosas": 480, "errores": [], "abortado": false }
```

**Response 200 (parcial, con errores bajo el umbral):**
```json
{
  "exitosas": 31,
  "errores": [
    { "fila": 2, "motivo": "codigo_producto \"XXX\" no existe en el catálogo" },
    { "fila": 13, "motivo": "cantidad debe ser un número mayor a 0" }
  ],
  "abortado": false
}
```

**Response 422 (abortado por exceso de errores):**
```json
{
  "exitosas": 0,
  "errores": [ "..." ],
  "abortado": true,
  "motivo_abortado": "50.0% de filas con error, supera el umbral de 30%"
}
```

**Errores:** `400` (CSV inválido, sin columnas requeridas, más de 500
filas), `401`, `403` (rol no autorizado).

### 3.4 `crear-usuario`

**Qué hace:** invita un nuevo usuario por correo (sin password en el body)
y le asigna un rol.

**Auth:** JWT del usuario; solo `supervisor` (`403` para el resto).

**Endpoint:** `POST /functions/v1/crear-usuario`

**Request:**
```json
{ "email": "nuevo@carreraarango.com", "nombre": "Pedro Ramírez", "rol": "metalmecanica" }
```

**Response 200:**
```json
{
  "ok": true,
  "usuario": { "id": "fa8496d0-...", "email": "nuevo@carreraarango.com", "nombre": "Pedro Ramírez", "rol": "metalmecanica" }
}
```

El usuario recibe un correo de invitación (en local, visible en Mailpit:
`http://127.0.0.1:54324`) con un link para establecer su propia contraseña.

**Errores:** `400` (campos faltantes o `rol` inválido), `401`, `403`.

### 3.5 `desactivar-usuario`

**Qué hace:** marca `activo = false` en `profiles` y **banea** al usuario
(`ban_duration`) para invalidar cualquier sesión y bloquear futuros logins.

**Auth:** JWT del usuario; solo `supervisor` (`403` para el resto). No se
puede auto-desactivar.

**Endpoint:** `POST /functions/v1/desactivar-usuario`

**Request:**
```json
{ "user_id": "fa8496d0-2409-4491-a9fd-8aa4c43748df" }
```

**Response 200:**
```json
{ "ok": true, "user_id": "fa8496d0-...", "activo": false, "baneado": true }
```

**Errores:** `400` (falta `user_id`, o intenta auto-desactivarse), `401`, `403`.

### 3.6 `resolver_ajuste` (función RPC, no Edge Function)

**Qué hace:** aprueba o rechaza un ajuste pendiente de forma **atómica**
(inserta el movimiento real + actualiza el ajuste, o ninguno de los dos).
Es una función SQL llamada vía PostgREST (`/rest/v1/rpc/...`), no una Edge
Function separada — la transacción atómica solo se garantiza así.

**Auth:** JWT del usuario; solo `supervisor` (verificado dos veces: RLS +
chequeo interno de la función).

**Endpoint:** `POST /rest/v1/rpc/resolver_ajuste`

**Request (rechazo):**
```json
{ "p_ajuste_id": 2, "p_decision": "rechazado", "p_motivo_rechazo": "Sin evidencia suficiente" }
```

**Response:**
```json
[{ "ajuste_id": 2, "estado_final": "rechazado", "movimiento_id": null }]
```

**Request (aprobación):**
```json
{ "p_ajuste_id": 3, "p_decision": "aprobado" }
```

**Response:**
```json
[{ "ajuste_id": 3, "estado_final": "aprobado", "movimiento_id": 1573 }]
```

**Errores (como excepción SQL, HTTP 400):** decisión inválida, ajuste
inexistente, ajuste ya resuelto, o quien llama no es supervisor.

## 4. Variables de entorno requeridas (local)

Archivo `supabase/functions/.env` (nunca se versiona — está en
`.gitignore`):

```
SYSTEM_ACTOR_ID=<uuid de un usuario "sistema" para movimientos automáticos>
MI_SERVICE_ROLE_KEY=<service_role key de supabase status>
MI_ANON_KEY=<anon/publishable key de supabase status>
```

**Nota técnica:** se usan nombres propios (`MI_...`) en vez de
`SUPABASE_SERVICE_ROLE_KEY` porque (1) Supabase Functions local rechaza
variables que empiecen con `SUPABASE_`, y (2) la versión sin fijar de
`@supabase/supabase-js@2` tuvo un bug real autenticando keys con el
formato nuevo `sb_secret_...` — por eso todas las funciones importan una
versión exacta: `@supabase/supabase-js@2.45.4`.

## 5. Guía de despliegue a staging/producción

```bash
# 1. Vincular el proyecto remoto (una sola vez)
supabase login
supabase link --project-ref <project-ref-de-staging>

# 2. Revisar qué migraciones locales faltan aplicar remoto (dry-run)
supabase db push --dry-run

# 3. Aplicar de verdad
supabase db push

# 4. Configurar los secrets de las Edge Functions EN EL PROYECTO REMOTO
#    (nunca se copian los mismos de local — deben ser distintos, sección B10)
supabase secrets set SYSTEM_ACTOR_ID=<uuid real de un usuario sistema en staging>
supabase secrets set MI_SERVICE_ROLE_KEY=<service_role key de staging>
supabase secrets set MI_ANON_KEY=<anon key de staging>

# 5. Desplegar las funciones
supabase functions deploy sync-inventario-vin
supabase functions deploy consultar-saldo-vin
supabase functions deploy importar-inventario-csv
supabase functions deploy crear-usuario
supabase functions deploy desactivar-usuario

# 6. Repetir TODO el proceso (2-5) para producción, apuntando a su project-ref,
#    con secrets DISTINTOS a los de staging.
```

Antes del primer `db push` a producción, revisar y resolver B10
completo (signups desactivados, sesión de 8h, Site URL, backups activos).

## 6. Checklist de seguridad — verificado en esta fase

- [x] `service_role_key` nunca en código fuente versionado (corregido tras
      incidente real de GitHub Push Protection — ver historial de commits)
- [x] RLS habilitado en todas las tablas nuevas
- [x] `movimientos_inventario`: UPDATE/DELETE denegados (RULE + sin policy RLS)
- [x] Cada Edge Function valida el JWT del caller
- [x] Rol verificado dentro de cada función (no se confía solo en el JWT)
- [x] Costos (`valor_unitario`/`valor_total`) ocultos por rol, en 2 capas
      (vista + revoke de columna en tabla base)
- [ ] Auth en producción (B10 — pendiente)
- [ ] Rotación/gestión de secrets vía Vault en vez de literales (B10)
