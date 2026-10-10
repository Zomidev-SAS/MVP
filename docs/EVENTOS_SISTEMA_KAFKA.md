# eventos_sistema → Kafka (mapeo de paso)

`eventos_sistema` es el libro de eventos del backend. Hoy los consumidores leen esta
tabla directo en Postgres (o vía Realtime); el día que se conecte Kafka, cada fila
nueva se publica en el tópico correspondiente **sin cambiar el esquema ni el
código que genera los eventos** — solo se agrega un conector de salida
(Debezium / un worker que hace `SELECT ... WHERE procesado = false` y publica).

## Convención de nombres de tópico

```
carrera-arango.<entidad>.<accion>
```

## Mapa tipo → tópico

| `eventos_sistema.tipo` | `entidad` (tabla origen) | Tópico Kafka propuesto | Payload (`payload`) |
|---|---|---|---|
| `movimiento_entrada` | movimientos_inventario | `carrera-arango.inventario.entrada` | fila completa del movimiento (`to_jsonb`) |
| `movimiento_salida_vin` | movimientos_inventario | `carrera-arango.inventario.salida` | ídem |
| `movimiento_ajuste` | movimientos_inventario | `carrera-arango.inventario.ajuste-aplicado` | ídem |
| `movimiento_reverso` | movimientos_inventario | `carrera-arango.inventario.reverso` | ídem |
| `ajuste_creado` | ajustes_pendientes | `carrera-arango.ajustes.creado` | fila completa del ajuste pendiente |
| `ajuste_resuelto` | ajustes_pendientes | `carrera-arango.ajustes.resuelto` | fila con `estado` final (aprobado/rechazado) |
| `oc_creada` | ordenes_compra | `carrera-arango.compras.oc-creada` | fila completa de la OC |
| `oc_actualizada` | ordenes_compra | `carrera-arango.compras.oc-actualizada` | fila con el nuevo `estado` |
| `formulario_recibido` | formularios | `carrera-arango.formularios.recibido` | fila del formulario tal como llega de la app |
| `perfil_creado` | profiles | `carrera-arango.usuarios.creado` | fila del perfil (sin contraseña ni tokens) |
| `perfil_actualizado` | profiles | `carrera-arango.usuarios.actualizado` | fila con el nuevo `rol`/`activo` |

## Reglas

- `entidad_id` siempre es el `id` de la fila origen, como texto (sirve de "key" de
  partición en Kafka: eventos del mismo producto/ajuste/OC caen en la misma
  partición, así el orden se respeta por entidad).
- `actor` es el `auth.users.id` responsable del evento cuando aplica (puede ser
  `null`, p. ej. en formularios recibidos desde fuera del panel).
- `procesado` lo marca en `true` el worker/consumidor que ya publicó el evento;
  mientras tanto sirve también para los reintentos (B7/B8) y para que las tareas
  programadas (B5) sepan qué eventos nuevos atender.
- El paso a Kafka real no requiere tocar esta tabla ni sus triggers: solo se
  agrega el conector de salida leyendo `eventos_sistema` ordenado por `fecha`.
