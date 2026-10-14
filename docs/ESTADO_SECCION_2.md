# Estado de la Sección 2 — Vista Gráfica, Siigo y Correos por Rol

**Fecha:** 2026-10-10 (actualizado 2026-10-11 tras reconciliar contra el backend real; actualizado 2026-10-13 con fixes de frontend puro)
**Rama:** fusionada en `main` (commit `5381209`, pusheado a `origin/main`)
**Plan original:** `docs/superpowers/plans/2026-10-09-seccion-2-vista-grafica.md`

**Actualización 2026-10-13:** sesión de arreglos de frontend puro, sin tocar
backend/migraciones. Resumen (detalle completo en el mensaje de commit):
- El selector de bodega/categoría del dashboard ahora trae opciones reales
  (tablas `bodegas`/`categorias_inventario`) en vez de arrays vacíos/hardcodeados,
  y el mismo bug (lista de opciones copy-pasteada y fija) se encontró y
  arregló en 4 lugares más: `InventoryFilters`, `MovementsFilters`,
  `AdjustmentForm`, `EntryForm`.
- Los filtros de bodega/categoría del dashboard ahora sí llegan al servidor
  (`parseFiltrosDesdeSearchParams` los ignoraba) y las tarjetas KPI
  (unidades, valor, stock bajo) ya respetan esos filtros — antes solo las
  gráficas los usaban, no los KPIs.
- Gráficas del dashboard: ejes con etiquetas cortadas (nombres de bodega,
  categoría, producto) arreglado; se cambió el layout de grid 2 columnas a
  un selector tipo dropdown que muestra una gráfica a la vez (pedido
  explícito del cliente para que no se vean cortadas).
- Exportar gráfica: bug real en PNG (fallo silencioso si `canvas.toBlob`
  devolvía `null`, sin aviso); se agregó opción de exportar como SVG además
  de PNG/CSV, y errores ahora muestran toast en vez de fallar mudo.
- `EnvioCorreoPreview` ya no se queda colgado en silencio si falla el
  cálculo de destinatarios — muestra error visible.

No se probó contra navegador real en esta sesión (sin herramienta de browser
disponible al momento de los cambios) — pendiente de verificación visual.

**Actualización 2026-10-11:** el equipo de backend entregó B1-B13 (migraciones
031-046) con nombres distintos a los que el frontend asumía — documentado en
`docs/CONTRATO_DATOS_SECCION2.md`. Se reconciliaron los 7 archivos que
llamaban RPCs/vistas placeholder (`dashboard-graficas-actions.ts`,
`automatizaciones-actions.ts`, `actividad-actions.ts`, `correos-actions.ts`,
`ordenes-compra-actions.ts`, `planta-actions.ts`, más el tipo
`automatizaciones.ts`) contra los nombres reales del contrato. `tsc --noEmit`
y `eslint` pasan limpio sobre esos archivos. Sigue sin probarse contra datos
100% reales (falta confirmar project ref de Supabase cloud + secrets). Los
huecos que NO se cerraron, porque no son de nombres sino de funcionalidad
faltante en backend:
- Vista/RPC anon-safe para `/planta` (kiosco): no existe nada que llamar
  todavía — `fetchDatosPlanta` se degrada directo a listas vacías.
- Reenvío manual de un correo individual: no hay RPC/Edge Function para
  esto (solo reintento automático por cron) — `reenviarCorreo` falla
  explícito con un mensaje claro en vez de llamar algo inexistente.
- El centro de notificaciones (`/notificaciones`, campana) sigue sin
  persistir "leída" entre recargas: el backend no construyó
  `notificaciones_leidas` como se asumía, sino un sistema distinto (tabla
  `notificaciones` por instancia/usuario) que no mapea 1:1 contra las
  alertas sintéticas por categoría de esta pantalla — decisión de producto
  pendiente, no un nombre por confirmar (ver nota en
  `notificaciones-actions.ts`).

Frontend completo para F1-F12 del documento del cliente. Se construyó con Subagent-Driven Development: 21 tareas, cada una implementada y revisada por separado (algunas con rondas de corrección), más una revisión final de rama completa que encontró y corrigió 1 hallazgo crítico y 6 importantes antes de fusionar.

## Completado

- **F1-F2** Dashboard gráfico por rol (6 gráficas nuevas + KPIs) y filtro de rango de fecha conectado a la URL.
- **F3** Actualización en vivo: un solo proveedor de realtime escuchando 4 tablas a la vez, indicador "En vivo", aviso toast al llegar algo nuevo.
- **F4** Centro de notificaciones: campana con marcar leída/marcar todas + historial en `/notificaciones`.
- **F5** `/automatizaciones` (solo supervisor).
- **F6** `/actividad` (supervisor + auditoría).
- **F7** Pulido visual (parcial — ver Pendiente).
- **F8** Exportar gráficas a PNG/CSV, respetando qué costos puede ver cada rol.
- **F9** Rendimiento: KPIs rápidos se separaron de las gráficas pesadas con Suspense.
- **F10** Estado de sincronización Siigo en `/compras` — **solo la parte que no depende del backend** (ver Pendiente).
- **F11** Correos automáticos por rol: selector + vista previa al redactar, pantalla `/correos`, avisos de correo faltante en usuarios/cuenta.
- **F12** `/planta/[token]` — modo pantalla para TV del taller, sin login, protegido por token firmado.

Cada feature sigue el mismo patrón que ya usaba el resto del proyecto: Server Action con rama de bypass dev (datos de ejemplo) + rama real contra Supabase, que falla explícito (no silencioso) cuando la función/vista del backend todavía no existe.

## Bloqueado en el equipo de backend

Nada de esto se probó contra datos 100% reales porque faltan estas piezas en Supabase:

1. **Función/RPC `dashboard_graficas`** — alimenta las 6 gráficas nuevas + KPIs del dashboard. Sin esto, esa sección muestra "Gráficas no disponibles" (ya no tumba la página entera, se corrigió en la revisión final).
2. **Vista `vista_automatizaciones_estado`** — alimenta `/automatizaciones`.
3. **Vista `vista_actividad_auditoria`** — alimenta `/actividad`.
4. **Vista `vista_correos_enviados`** + función `reenviar-correo` (Edge Function) — alimenta `/correos` y el botón Reenviar.
5. **Tabla `notificaciones_leidas`** — para que "marcar leída" persista entre recargas (hoy solo vive en el navegador). Importante: los IDs de alerta hoy son por categoría (`'stock-bajo'`, no por instancia) — si se crea esta tabla tal cual, marcar una alerta de stock bajo como leída ocultaría TODAS las futuras alertas de stock bajo para siempre. Hay que diseñar la clave como instancia + fecha, o con expiración. Nota dejada en `notificaciones-actions.ts`.
6. **Función Edge `siigo-enviar-orden`** — el botón "Enviar a Siigo"/"Reintentar" en `/compras` existe y es clicable, pero fallará hasta que esta función exista. El badge de estado Siigo SÍ funciona ya con datos reales (usa columnas que ya existían: `descargada_siigo_at`, `finalizada_at`, `siigo_referencia`).
7. **Vista anon-safe para el kiosco** (`/planta`) — el kiosco usa el cliente anónimo (sin sesión). La nota en `planta-actions.ts` es explícita: **nunca** dar acceso `anon` a `dashboard_graficas` ni a ninguna vista con costos; se necesita una vista/RPC dedicada, solo con `vehiculosPorEtapa`/`entradasSalidas`, sin dinero.

## Pendiente, no bloqueado por backend

- **Siigo — catálogo de productos/proveedores**: fecha de última sincronización y lista de diferencias. No se construyó nada (fuera del alcance de la tarea que sí se hizo).
- **F7 pulido visual**: solo se hizo una pasada a nivel de código (sin navegador/tablet disponible en el entorno de desarrollo). Falta la revisión visual real en escritorio y tablet de 10 pulgadas que pide el documento del cliente.
- **QA completo por rol (8 roles × todas las pantallas)** — no se hizo, requiere datos reales y navegador.
- **Deploy a staging (`carrera.zomidev.com`) y grabaciones para el cliente** — no se hizo.

## Cómo seguir

1. Backend entrega las vistas/funciones de la sección "Bloqueado" de arriba.
2. Se reconcilian los nombres reales contra lo que el frontend ya asume (cada archivo tiene un comentario `// NOTA:` señalando exactamente qué falta).
3. QA por rol con datos reales + pulido visual en dispositivo real.
4. Deploy.

Si se retoma Siigo (catálogo) o cualquier otro punto pendiente, seguir el mismo patrón: Server Action con bypass dev + rama real explícita, nunca inventar que algo funciona cuando no se puede verificar.
