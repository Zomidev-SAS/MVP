# Contrato de datos — Sección 2: Automatización Backend

Vistas, RPC, tablas en vivo (Realtime) y estados que el frontend necesita para
construir con datos de prueba sin tener que preguntar la forma de los datos
(punto 3.11 del documento). Todo lo de acá ya respeta RLS y enmascarado de
costos: un rol sin permiso para ver costos siempre recibe `null` en esos
campos, tanto por API como por correo.

Roles existentes: `supervisor`, `comercial`, `metalmecanica`, `produccion`,
`instalacion`, `compras`, `auditoria`, `lectura`.
Roles que SÍ ven costos: `supervisor`, `compras`, `auditoria`.

---

## 1. RPC `rpc_kpis_dashboard()`

Un solo llamado para los stat-tiles de arriba del dashboard.

**Parámetros:** ninguno (usa el usuario autenticado).

**Ejemplo de respuesta** (rol `supervisor`):
```json
{
  "fecha": "2026-10-11",
  "rol": "supervisor",
  "stock_unidades": 48213,
  "stock_valor": 1747372373.01,
  "alertas_stock_bajo_abiertas": 6,
  "ajustes_pendientes": 2,
  "oc_abiertas": 9,
  "oc_vencidas": 1,
  "oc_pendientes_siigo": 3,
  "notificaciones_no_leidas": 4,
  "sync_pendientes_abiertos": 0
}
```
Mismo JSON para un rol sin costos (`comercial`, `metalmecanica`, etc.), pero
`"stock_valor": null`.

---

## 2. Vistas para gráficas (B6)

Todas son `select` directo (RLS/propietario ya resuelve permisos); filtrar y
paginar desde el cliente con `.eq()`, `.gte()`, `.order()`, `.limit()` de
`supabase-js` como con cualquier vista.

### `vista_movimientos_por_dia`
| columna | tipo | nota |
|---|---|---|
| fecha | date | |
| tipo_movimiento | text | entrada / salida_vin / ajuste / reverso |
| cantidad_movimientos | int | |
| unidades | numeric | |
| valor | numeric \| null | enmascarado |

### `vista_stock_por_bodega`
`bodega, productos_distintos, unidades, valor_total (nullable)`

### `vista_stock_por_categoria`
`categoria, productos_distintos, unidades, valor_total (nullable)`

### `vista_top_productos`
Top 20. `codigo_producto, nombre_producto, categoria, saldo, valor_total (nullable), posicion`

### `vista_vehiculos_por_etapa`
`etapa (vehiculo_procesos.proceso_estado), vehiculos (int)` — etapa **actual**
de cada chasis (la última fila de `vehiculo_procesos` por chasis).

### `vista_ajustes_por_estado`
`estado (pendiente|aprobado|rechazado), cantidad`

### `vista_oc_por_estado`
`estado (en_curso|listo|cancelada), siigo_estado (pendiente|enviando|sincronizada|error), cantidad`

### `vista_tendencia_valorizacion`
Últimos 90 días de `kpi_diario`. `fecha, unidades_entrada, unidades_salida, valor_entrada (nullable), valor_salida (nullable)`

---

## 3. Eventos del sistema (B1) — `eventos_sistema`

Solo lectura para `supervisor` y `auditoria`. Columnas: `id, tipo, entidad,
entidad_id, payload (jsonb), actor, bodega, fecha, procesado`.
Mapeo completo `tipo → tópico Kafka` en `docs/EVENTOS_SISTEMA_KAFKA.md`.

---

## 4. Notificaciones (B3/B4) — `notificaciones`

Cada fila es personal (`usuario_destino = auth.uid()`), así el contador de no
leídas es exacto.

```json
{
  "id": 981,
  "usuario_destino": "a1b2...",
  "tipo": "ajuste_creado",
  "titulo": "Nuevo ajuste pendiente",
  "mensaje": "Hay un ajuste de inventario esperando tu revisión (#44).",
  "enlace": "/ajustes/44",
  "leida": false,
  "leida_at": null,
  "created_at": "2026-10-11T08:03:12Z"
}
```

**Tipos usados hoy:** `ajuste_creado`, `ajuste_resuelto`, `ajuste_recordatorio`,
`formulario_recibido`, `stock_bajo`, `sync_vin_fallida`, `siigo_error`,
`oc_vencida`, `correo_fallido`, `mensaje_panel_info` / `_aviso` / `_urgente`.

**RPC:**
- `marcar_notificacion_leida(p_id bigint)` — marca una propia.
- `marcar_todas_leidas()` — marca todas las propias.

**Realtime:** suscribirse a `notificaciones` filtrando
`usuario_destino=eq.<auth.uid()>` para el contador de la campana en vivo.

---

## 5. Alertas de stock bajo (B4) — `alertas_stock_bajo`

Visible para `supervisor`, `compras`, `auditoria`. Una sola fila **abierta**
por `(codigo_producto, bodega)` — se cierra sola (`abierta=false,
cerrado_at`) cuando el saldo vuelve a superar `config_app.umbral_stock_bajo`.

```json
{
  "id": 12,
  "codigo_producto": "402015",
  "bodega": "ALMACEN NIVEL 1",
  "saldo_en_alerta": 1,
  "umbral": 2,
  "abierta": true,
  "creado_at": "2026-10-10T14:22:01Z",
  "cerrado_at": null
}
```

---

## 6. Cola de reintentos (B7) — `sync_pendientes`

Visible para `supervisor`, `compras`, `auditoria`. Útil para la pantalla de
Automatizaciones (B8) y para mostrar "sincronización en curso".

`id, tipo (sync_vin|siigo_oc|siigo_catalogo), referencia_id, payload, motivo,
intentos, max_intentos (5), proximo_intento, estado (pendiente|reintentando|resuelto|fallido), created_at, resuelto_at`

---

## 7. Registro de automatizaciones (B8) — `log_automatizaciones` / `vista_log_automatizaciones_ultimo_estado`

Visible para `supervisor`, `auditoria`. La vista de último estado es la que
alimenta la pantalla de Automatizaciones: una fila por regla con su última
ejecución.

```json
{
  "regla": "cierre_diario_kpi",
  "id": 204,
  "inicio": "2026-10-10T23:55:00Z",
  "fin": "2026-10-10T23:55:01Z",
  "resultado": "ok",
  "filas_afectadas": 1,
  "error": null,
  "duracion_segundos": 1.2
}
```

**Reglas que registran ejecución:** `cierre_diario_kpi`,
`recordatorio_ajustes_pendientes`, `aviso_oc_vencidas`,
`reintentar_sync_pendientes`, `limpiar_notificaciones_leidas`,
`siigo_sync_oc`, `siigo_sync_catalogo`, `enviar_correos`, `reporte_semanal`,
más cualquier `fn_llamar_edge_function:<funcion>` que haya fallado a nivel de
red.

---

## 8. Cola de correos (B13) — `cola_correos`

Visible solo para `supervisor` y `auditoria` (contiene direcciones de
correo). Estados: `pendiente → enviando → enviado` o `error`; una fila puede
quedar `agrupado` si otra fila con mismo `(destinatario, tipo)` llegó dentro
de los mismos 10 minutos y se envió junto con otra como un solo correo
(antispam, 3.13).

```json
{
  "id": 5510,
  "destinatario": "supervisor@carrera-arango.com",
  "tipo": "ajuste_creado",
  "asunto": "Nuevo ajuste pendiente",
  "estado": "enviado",
  "intentos": 1,
  "enviado_at": "2026-10-11T08:04:50Z"
}
```

---

## 9. Órdenes de compra + Siigo (B12) — `ordenes_compra`

Columnas nuevas de esta sección: `siigo_id (text), siigo_referencia (text),
siigo_estado (pendiente|enviando|sincronizada|error)`.

**Cómo el frontend dispara el envío a Siigo:** el esquema real no tiene un
estado "aprobada" (solo `en_curso | listo | cancelada`, que son operativos).
Para no adivinar en qué transición disparar el envío, se expone una acción
explícita:

```sql
select rpc_aprobar_oc_siigo(p_orden_id := 123);
```
Requiere rol `supervisor` o `compras`. Devuelve
`{"ok": true, "ya_sincronizada": false}` de inmediato (el envío real es
asíncrono, vía Edge Function `siigo-sync-oc`); el frontend debe refrescar la
fila (o suscribirse a Realtime) y mirar `siigo_estado`/`siigo_id` para saber
cuándo terminó. Si falla, queda `siigo_estado = 'error'`, se encola un
reintento (hasta 5, cada 5 min) y se notifica + envía correo al rol `compras`.

**Catálogo (B12):** diferencias entre el panel y Siigo quedan en
`siigo_catalogo_diferencias` (`tipo, codigo, campo, valor_panel, valor_siigo,
revisado`), visible para `supervisor`, `compras`, `auditoria`. Nunca se borra
nada solo.

---

## 10. Realtime (B2)

Publicadas en `supabase_realtime` (respetan RLS, igual que un SELECT normal):
`movimientos_inventario`, `ajustes_pendientes`, `ordenes_compra`,
`formularios`, `eventos_sistema`, `notificaciones`, `alertas_stock_bajo`,
`kpi_diario`.

---

## 11. `kpi_diario` (cierre diario, B5)

Una fila por día, generada a las 11:55 p.m. Útil para series de tiempo y
para el reporte semanal.

`fecha (PK), unidades_entrada, valor_entrada, unidades_salida, valor_salida,
alertas_stock_bajo, ajustes_creados, ajustes_resueltos, oc_creadas,
oc_abiertas, oc_vencidas, oc_sincronizadas_siigo, vehiculos_por_etapa (jsonb: {etapa: count}), generado_at`

No tiene enmascarado de costos a nivel de vista (es una tabla), así que si el
frontend la consulta directo para un rol sin permiso de costos, debe ocultar
`valor_entrada`/`valor_salida` él mismo, o preferir `vista_tendencia_valorizacion`
(que sí enmascara).

---

## 12. Tareas programadas (B5) — horarios

| Tarea | Horario | Función |
|---|---|---|
| Cierre diario KPI | 11:55 p.m. | `fn_cierre_diario_kpi()` |
| Recordatorio ajustes >24h | 8:00 a.m. | `fn_recordatorio_ajustes_pendientes()` |
| Aviso OC vencidas | 8:05 a.m. | `fn_aviso_oc_vencidas()` |
| Reintentos VIN/Siigo | cada 5 min | `fn_reintentar_sync_pendientes()` |
| Envío cola de correos | cada minuto | Edge Function `enviar-correos` |
| Catálogo Siigo | 2:30 a.m. | Edge Function `siigo-sync-catalogo` |
| Limpieza notificaciones leídas >90 días | lunes 3:00 a.m. | `fn_limpiar_notificaciones_leidas()` |
| Reporte semanal | lunes 7:00 a.m. | Edge Function `reporte-semanal` |

---

## 13. Edge Functions nuevas de esta sección

| Función | Quién la llama | Auth |
|---|---|---|
| `siigo-sync-oc` | `rpc_aprobar_oc_siigo` / reintento cron | service_role (interno) |
| `siigo-sync-catalogo` | cron nocturno, o bajo demanda desde el panel | service_role, o JWT de `supervisor`/`compras` |
| `enviar-correos` | cron cada minuto | service_role (interno) |
| `reporte-semanal` | cron lunes 7 a.m. | service_role (interno) |

---

## 14. Pendiente de confirmación (no bloquea el resto del contrato)

- **Tipo de documento de Siigo** (`SIIGO_DOCUMENT_TYPE_ID`): sin confirmar
  con contabilidad al momento de escribir esto. Hasta que se confirme y se
  cargue como secret, `rpc_aprobar_oc_siigo` deja la orden en
  `siigo_estado = 'error'` con un mensaje explícito — **no se inventa un id**
  para no crear un documento incorrecto en la cuenta real de Siigo.
- **Project ref de Supabase cloud**: las migraciones y Edge Functions de esta
  sección están listas para aplicar; falta confirmar si ya existe un
  proyecto cloud (lo tendría quien mantiene la rama `main`) para desplegar
  ahí mismo, o si hay que crear uno nuevo.
- **Secrets nuevos a configurar** (ninguno se escribe en una migración, solo
  `supabase secrets set ...`): `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
  `PANEL_BASE_URL`, `SIIGO_DOCUMENT_TYPE_ID` (cuando se confirme). Los de
  Siigo de consulta (`SIIGO_PARTNER_ID`, `SIIGO_USERNAME`, `SIIGO_ACCESS_KEY`)
  ya existían del Avance 1 y se reutilizan tal cual.
