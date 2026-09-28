\# Carrera Arango — Núcleo de inventario (Backend)



Documentación técnica del backend en Supabase. Cubre el esquema, las 6 Edge

Functions construidas, la matriz de seguridad (RLS), y la guía de despliegue

a staging/producción — según lo exigido en B12 del documento

`FALTANTES\_BACKEND\_FASE\_1.pdf`.



Última actualización: cierre de Sprint 3-6 + B1-B9 del PDF de faltantes.



\---



\## 1. Esquema



El negocio real de Carrera Arango es \*\*fabricación de muebles\*\* (no

vehículos con VIN, como asumía el documento de iniciación original). El

esquema fue adaptado con evidencia real (`Saldos\_de\_inventario\_\*.xlsx`).



\### Tablas



| Tabla | Qué es |

|---|---|

| `profiles` | Extensión de `auth.users`; guarda `rol` y `activo` |

| `productos` | Catálogo maestro: `codigo\_producto`, `nombre\_producto`, `unidad\_medida`, `categoria` |

| `bodegas` | Catálogo de las 9 bodegas reales (`ALMACEN NIVEL 1`, `METALMECANICA`, etc.) |

| `categorias\_inventario` | Catálogo de las 17 categorías reales |

| `movimientos\_inventario` | \*\*Ledger inmutable\*\* (sin UPDATE/DELETE). `codigo\_producto` + `bodega` + `cantidad` (+/-) |

| `ajustes\_pendientes` | Cola de aprobación para correcciones manuales |

| `config\_app` | Config global: `bloquear\_sin\_stock`, `umbral\_stock\_bajo` |

| `formularios` | Origen de los movimientos desde la app móvil |



\### Vistas



| Vista | Qué muestra |

|---|---|

| `vista\_inventario\_actual` | Saldo total por producto (todas las bodegas sumadas) |

| `vista\_inventario\_por\_bodega` | Saldo por producto \*\*y\*\* bodega específica |

| `vista\_valorizacion\_basica` | Unidades y valor agrupado por categoría |

| `vista\_movimientos\_recientes` | Últimos 100 movimientos con nombre del actor |



\*\*Nota de seguridad (B3):\*\* `valor\_unitario` y `valor\_total` se enmascaran

a `null` en las 4 vistas para cualquier rol fuera de `supervisor`, `compras`,

`auditoria`, vía `CASE WHEN get\_user\_rol() IN (...)`. La columna

`valor\_unitario` también está revocada a nivel de tabla base para el rol

`authenticated`, así que no se puede saltar la vista consultando

`movimientos\_inventario` directo.



\---



\## 2. Roles



```

supervisor · comercial · metalmecanica · produccion · instalacion · compras · auditoria · lectura

```



\*\*Pendiente (B5):\*\* `instalacion` está incluido como borrador. Falta

confirmar con el cliente si reemplaza a `produccion` o coexiste con ella.

Evidencia disponible: `metalmecanica` está confirmado porque aparece

textual como bodega real en los archivos de saldos.



\---



\## 3. Edge Functions



Todas requieren `Authorization: Bearer <token>`. Las que dicen

"vía `service\_role`" corren con permisos elevados internamente, pero igual

exigen un JWT válido de quien llama (no aceptan llamadas anónimas).



\### 3.1 `sync-inventario-vin`



\*\*Qué hace:\*\* registra automáticamente una salida (`salida\_vin`) cuando la

app móvil crea un formulario de ingreso. Se dispara sola vía \*\*database

webhook\*\* (trigger `on\_formulario\_ingreso`, migración `015`) — no requiere

que nadie la llame manualmente.



\*\*Auth:\*\* vía `service\_role` (llamada por el trigger, no por el usuario final).



\*\*Endpoint:\*\* `POST /functions/v1/sync-inventario-vin`



\*\*Request:\*\*

```json

{

&#x20; "formulario\_id": "abc-123",

&#x20; "codigo\_producto": "10024",

&#x20; "bodega": "ALMACEN NIVEL 1"

}

```



\*\*Response 200 (creado):\*\*

```json

{

&#x20; "ok": true,

&#x20; "duplicado": false,

&#x20; "movimiento": { "id": 1574, "codigo\_producto": "10024", "tipo\_movimiento": "salida\_vin", "cantidad": -1, "...": "..." }

}

```



\*\*Response 200 (idempotente, ya existía):\*\*

```json

{ "ok": true, "duplicado": true, "movimiento": { "...": "..." } }

```



\*\*Response 409 (bloqueado por falta de stock, si `config\_app.bloquear\_sin\_stock = true`):\*\*

```json

{

&#x20; "error": "Producto sin saldo disponible en esa bodega",

&#x20; "detalle": "El producto PM1006 en ALMACEN NIVEL 1 tiene saldo -100, no se puede registrar una salida."

}

```



\*\*Errores:\*\* `400` (falta `formulario\_id`/`codigo\_producto`/`bodega`),

`401` (sin `Authorization`), `500` (error de base de datos, p.ej. producto

inexistente).



\---



\### 3.2 `consultar-saldo-vin`



\*\*Qué hace:\*\* consulta el saldo/costos de un producto, respetando RLS y el

enmascarado de costos según el rol de quien pregunta.



\*\*Auth:\*\* JWT del usuario final (no `service\_role` — respeta su rol real).



\*\*Endpoint:\*\* `GET /functions/v1/consultar-saldo-vin?codigo\_producto=10024`



\*\*Response 200 (rol con permiso de costos, p.ej. `compras`):\*\*

```json

{

&#x20; "codigo\_producto": "10024",

&#x20; "nombre\_producto": "TAPA DE ASIENTO",

&#x20; "unidad\_medida": "unidad",

&#x20; "categoria": "Productos CA",

&#x20; "saldo": 1940,

&#x20; "valor\_unitario": 12480,

&#x20; "valor\_total": 24211200,

&#x20; "ultimo\_movimiento": "2026-09-16T05:02:31.74549+00:00"

}

```



\*\*Response 200 (rol sin permiso de costos, p.ej. `comercial`):\*\*

```json

{

&#x20; "codigo\_producto": "10024",

&#x20; "saldo": 1940,

&#x20; "valor\_unitario": null,

&#x20; "valor\_total": null,

&#x20; "...": "..."

}

```



\*\*Errores:\*\* `400` (falta `codigo\_producto`), `401` (sin token), `404`

(producto sin movimientos aplicados).



\---



\### 3.3 `importar-inventario-csv`



\*\*Qué hace:\*\* carga masiva de movimientos tipo `entrada` desde un CSV.



\*\*Auth:\*\* JWT del usuario; solo `supervisor` o `compras` (`403` para el resto).



\*\*Endpoint:\*\* `POST /functions/v1/importar-inventario-csv` (multipart/form-data, campo `file`)



\*\*Formato del CSV esperado:\*\*

```

codigo\_producto,cantidad,bodega,valor\_unitario

10024,5,ALMACEN NIVEL 1,12480

```

(`bodega` y `valor\_unitario` son opcionales; `bodega` por defecto es `Sin Asignar`)



\*\*Reglas:\*\*

\- Tope de 500 filas — `400` si se excede.

\- Si el % de filas con error es mayor a 30%, se aborta el lote completo

&#x20; (`exitosas: 0`, nada se inserta).

\- Si es igual o menor a 30%, se insertan las válidas y se reportan los

&#x20; errores puntuales.



\*\*Response 200 (éxito total):\*\*

```json

{ "exitosas": 480, "errores": \[], "abortado": false }

```



\*\*Response 200 (parcial, con errores bajo el umbral):\*\*

```json

{

&#x20; "exitosas": 31,

&#x20; "errores": \[

&#x20;   { "fila": 2, "motivo": "codigo\_producto \\"XXX\\" no existe en el catálogo" },

&#x20;   { "fila": 13, "motivo": "cantidad debe ser un número mayor a 0" }

&#x20; ],

&#x20; "abortado": false

}

```



\*\*Response 422 (abortado por exceso de errores):\*\*

```json

{

&#x20; "exitosas": 0,

&#x20; "errores": \[ "..." ],

&#x20; "abortado": true,

&#x20; "motivo\_abortado": "50.0% de filas con error, supera el umbral de 30%"

}

```



\*\*Errores:\*\* `400` (CSV inválido, sin columnas requeridas, más de 500

filas), `401`, `403` (rol no autorizado).



\---



\### 3.4 `crear-usuario`



\*\*Qué hace:\*\* invita un nuevo usuario por correo (sin password en el body)

y le asigna un rol.



\*\*Auth:\*\* JWT del usuario; solo `supervisor` (`403` para el resto).



\*\*Endpoint:\*\* `POST /functions/v1/crear-usuario`



\*\*Request:\*\*

```json

{ "email": "nuevo@carreraarango.com", "nombre": "Pedro Ramírez", "rol": "metalmecanica" }

```



\*\*Response 200:\*\*

```json

{

&#x20; "ok": true,

&#x20; "usuario": { "id": "fa8496d0-...", "email": "nuevo@carreraarango.com", "nombre": "Pedro Ramírez", "rol": "metalmecanica" }

}

```



El usuario recibe un correo de invitación (en local, visible en Mailpit:

`http://127.0.0.1:54324`) con un link para establecer su propia contraseña.



\*\*Errores:\*\* `400` (campos faltantes o `rol` inválido), `401`, `403`.



\---



\### 3.5 `desactivar-usuario`



\*\*Qué hace:\*\* marca `activo = false` en `profiles` y \*\*banea\*\* al usuario

(`ban\_duration`) para invalidar cualquier sesión y bloquear futuros logins.



\*\*Auth:\*\* JWT del usuario; solo `supervisor` (`403` para el resto). No se

puede auto-desactivar.



\*\*Endpoint:\*\* `POST /functions/v1/desactivar-usuario`



\*\*Request:\*\*

```json

{ "user\_id": "fa8496d0-2409-4491-a9fd-8aa4c43748df" }

```



\*\*Response 200:\*\*

```json

{ "ok": true, "user\_id": "fa8496d0-...", "activo": false, "baneado": true }

```



\*\*Errores:\*\* `400` (falta `user\_id`, o intenta auto-desactivarse), `401`, `403`.



\---



\### 3.6 `resolver\_ajuste` (función RPC, no Edge Function)



\*\*Qué hace:\*\* aprueba o rechaza un ajuste pendiente de forma \*\*atómica\*\*

(inserta el movimiento real + actualiza el ajuste, o ninguno de los dos).

Es una función SQL llamada vía PostgREST (`/rest/v1/rpc/...`), no una Edge

Function separada — la transacción atómica solo se garantiza así.



\*\*Auth:\*\* JWT del usuario; solo `supervisor` (verificado dos veces: RLS +

chequeo interno de la función).



\*\*Endpoint:\*\* `POST /rest/v1/rpc/resolver\_ajuste`



\*\*Request (rechazo):\*\*

```json

{ "p\_ajuste\_id": 2, "p\_decision": "rechazado", "p\_motivo\_rechazo": "Sin evidencia suficiente" }

```



\*\*Response:\*\*

```json

\[{ "ajuste\_id": 2, "estado\_final": "rechazado", "movimiento\_id": null }]

```



\*\*Request (aprobación):\*\*

```json

{ "p\_ajuste\_id": 3, "p\_decision": "aprobado" }

```



\*\*Response:\*\*

```json

\[{ "ajuste\_id": 3, "estado\_final": "aprobado", "movimiento\_id": 1573 }]

```



\*\*Errores (como excepción SQL, HTTP 400):\*\* decisión inválida, ajuste

inexistente, ajuste ya resuelto, o quien llama no es supervisor.



\---



\## 4. Variables de entorno requeridas (local)



Archivo `supabase/functions/.env` (nunca se versiona — está en

`.gitignore`):



```

SYSTEM\_ACTOR\_ID=<uuid de un usuario "sistema" para movimientos automáticos>

MI\_SERVICE\_ROLE\_KEY=<service\_role key de supabase status>

MI\_ANON\_KEY=<anon/publishable key de supabase status>

```



\*\*Nota técnica:\*\* se usan nombres propios (`MI\_...`) en vez de

`SUPABASE\_SERVICE\_ROLE\_KEY` porque (1) Supabase Functions local rechaza

variables que empiecen con `SUPABASE\_`, y (2) la versión sin fijar de

`@supabase/supabase-js@2` tuvo un bug real autenticando keys con el

formato nuevo `sb\_secret\_...` — por eso todas las funciones importan una

versión exacta: `@supabase/supabase-js@2.45.4`.



\---



\## 5. Guía de despliegue a staging/producción



```bash

\# 1. Vincular el proyecto remoto (una sola vez)

supabase login

supabase link --project-ref <project-ref-de-staging>



\# 2. Revisar qué migraciones locales faltan aplicar remoto (dry-run)

supabase db push --dry-run



\# 3. Aplicar de verdad

supabase db push



\# 4. Configurar los secrets de las Edge Functions EN EL PROYECTO REMOTO

\#    (nunca se copian los mismos de local — deben ser distintos, sección B10)

supabase secrets set SYSTEM\_ACTOR\_ID=<uuid real de un usuario sistema en staging>

supabase secrets set MI\_SERVICE\_ROLE\_KEY=<service\_role key de staging>

supabase secrets set MI\_ANON\_KEY=<anon key de staging>



\# 5. Desplegar las funciones

supabase functions deploy sync-inventario-vin

supabase functions deploy consultar-saldo-vin

supabase functions deploy importar-inventario-csv

supabase functions deploy crear-usuario

supabase functions deploy desactivar-usuario



\# 6. Repetir TODO el proceso (2-5) para producción, apuntando a su project-ref,

\#    con secrets DISTINTOS a los de staging.

```



Antes del primer `db push` a producción, revisar y resolver B10

completo (signups desactivados, sesión de 8h, Site URL, backups activos).



\---



\## 6. Checklist de seguridad — verificado en esta fase



\- \[x] `service\_role\_key` nunca en código fuente versionado (corregido tras

&#x20;     incidente real de GitHub Push Protection — ver historial de commits)

\- \[x] RLS habilitado en todas las tablas nuevas

\- \[x] `movimientos\_inventario`: UPDATE/DELETE denegados (RULE + sin policy RLS)

\- \[x] Cada Edge Function valida el JWT del caller

\- \[x] Rol verificado dentro de cada función (no se confía solo en el JWT)

\- \[x] Costos (`valor\_unitario`/`valor\_total`) ocultos por rol, en 2 capas

&#x20;     (vista + revoke de columna en tabla base)

\- \[ ] Auth en producción (B10 — pendiente)

\- \[ ] Rotación/gestión de secrets vía Vault en vez de literales (B10)

