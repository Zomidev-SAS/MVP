# Diseño: Sección Proveedores (desempeño, reevaluación anual y evaluación de selección)

**Fecha:** 2026-11-19
**Fuentes:** reunión de compras/auditoría (audio + diagrama a mano), Excel de referencia "PROCESO DE COMPRAS Y ALMACÉN – CUADRO CONTROL DESEMPEÑO DE LOS PROVEEDORES" (junio 2025, versión 1) y respuestas del usuario del 2026-11-19. El Excel es solo guía de qué capturar; no hay que copiarlo tal cual.

## Objetivo

Cerrar la parte de auditoría de compras que exige la norma: llevar un historial por proveedor, medir su desempeño en cada orden de compra (OC), reevaluarlo una vez al año con un porcentaje y evaluar proveedores nuevos contra los actuales. Todo con constancia descargable en CSV y PDF.

## Decisiones tomadas (confirmadas por el usuario)

- **Sección nueva "Proveedores"** en el menú. Roles con acceso: `supervisor`, `comercial`, `compras`, `auditoria`. El rol `auditoria` ya existe en el sistema; no se crea ningún rol nuevo. Ingeniería ya no existe.
- **Todos los roles con acceso ven y modifican** (no hay roles de solo lectura dentro de la sección). Borrar queda solo para `supervisor`.
- **"Excel" = CSV compatible con Excel** (UTF-8 con BOM, separador `;`). No se agrega librería `.xlsx`.
- **Calidad = desplegable** Bien / Regular / Mal, que se convierte en un índice (100 / 50 / 0), más un comentario.
- **Porcentaje = promedio ponderado de las 4 divisiones** con pesos iguales por defecto (25 % cada una) y umbral de aprobación 85 % por defecto. Pesos, umbral y penalizaciones son **configurables** (porque "podría variar").
- **No hay marca de "proveedor único"**: Alfibras era un ejemplo. Lo que se necesita es poder **filtrar por proveedor y ver su información**.
- **"Poder ver el análisis"** (palabra del diagrama): la reevaluación y el desempeño muestran en pantalla el mismo análisis que contienen el CSV y el PDF.
- La reunión pidió que el resultado salga también **por correo de forma automática**; eso es trabajo de backend (ver "Fuera de alcance"). El frontend entrega primero la descarga manual.

## Qué ya existe y se reutiliza

- Las OC (`ordenes_compra` + `orden_compra_items`) ya guardan por línea NIT, nombre y correo del proveedor, cantidades pedidas y recibidas, `fecha_vencimiento` (entrega prometida), `fecha_cierre`, la factura del proveedor (`factura_proveedor_prefijo/numero`) y las entregas parciales con fecha (`orden_compra_recepciones`).
- Una OC puede tener líneas de **varios proveedores**; el desempeño se mide por **(OC, proveedor)**.
- `jspdf` + `jspdf-autotable`, `papaparse` y `recharts` ya están instalados. No se agrega ninguna dependencia.
- Patrones: Server Actions con `requireRole`, preview con `DEV_SKIP_AUTH`, formularios `react-hook-form` + `zod`, trigger de "quién y cuándo" (migración 027), `config_app` para parámetros que edita el supervisor.

## Modelo de datos (propuesta; backend aplica las migraciones)

Migraciones desde la 080 (la última existente es la 079). Todas con RLS usando `get_user_rol()`; select/insert/update para `supervisor, comercial, compras, auditoria`; delete solo `supervisor`; sin acceso para `anon`.

| Tabla | Para qué | Campos clave |
|---|---|---|
| `proveedores` (080) | Catálogo de proveedores | `id`, `nit`, `nit_normalizado` (solo dígitos, único), `nombre`, `email`, `telefono`, `contacto`, `notas`, `activo`, `origen` (`manual`/`oc`/`importado`). Se siembra con los proveedores ya presentes en las OC y se mantiene sola con un trigger al crear líneas de OC. |
| `proveedor_desempeno` (081) | Una fila por (OC, proveedor) o por OC histórica importada | `proveedor_id`, `orden_id` (nulo si es histórica), `numero_oc`, `fecha_oc`, `fecha_entrega_prometida`, `fecha_entrega_real`, `factura_remision`, `cantidad_pedida`, `cantidad_recibida` (todas como sobrescritura; si son nulas se derivan de la OC), `calidad`, `calidad_comentario`, `devoluciones`, `devoluciones_detalle`, `cantidad_observaciones`, `pagos_acordados`, `tiempo_observaciones`, `observaciones`, `actualizado_por`, `actualizado_por_nombre`. Un trigger la crea al crearse la línea de OC ("se genera la OC y se abre su desempeño"). |
| `config_app` (081, columnas nuevas) | Parámetros de evaluación | `proveedor_umbral_aprobacion` (85), `proveedor_peso_calidad/devoluciones/cantidad/tiempo` (25 c/u), `proveedor_penalizacion_dia` (5), `proveedor_penalizacion_devolucion` (25). Solo el supervisor los edita. |
| `proveedor_reevaluaciones` (082) | Reevaluación anual, una por proveedor y año | `proveedor_id`, `anio`, `porcentaje`, `umbral` (copia del vigente), `resultado` (`continuar`/`no_continuar`), `motivo`, `detalle jsonb` (copia de promedios por división, pesos y cantidad de OC, para que la constancia no cambie si luego cambia la configuración), `creado_por`, `creado_por_nombre`. `unique (proveedor_id, anio)`. |
| `proveedor_selecciones` + `proveedor_seleccion_candidatos` (083) | Evaluación de selección (cuadro comparativo) | Selección: `titulo`, `necesidad`, `estado` (`borrador`/`decidida`), `proveedor_elegido_id`, `conclusion`, quién y cuándo. Candidato: `proveedor_id` (existente) o `nombre_nuevo`, `precio`, `tiempo_entrega_dias`, `calidad`, `observaciones`. |

## Reglas de cálculo (valores por defecto; viven en una sola librería pura `lib/proveedores/desempeno.ts`)

Solo se puntúan las OC **finalizadas** (`estado = 'listo'`) o históricas importadas. Una OC en curso aparece como "En curso" sin puntaje. Cada división da 0–100 o "N/A" (no se promedia):

- **Calidad:** Bien = 100, Regular = 50, Mal = 0; sin evaluar = N/A.
- **Devoluciones:** `max(0, 100 − penalizacion_devolucion × devoluciones)`.
- **Cantidad:** `min(100, recibida / pedida × 100)` con las cantidades de las líneas de ese proveedor; sin cantidades = N/A.
- **Tiempo:** `diferencia = fecha_real − fecha_prometida` (días; negativo = llegó antes, igual que el Excel). `max(0, 100 − penalizacion_dia × max(0, diferencia))`; sin ambas fechas = N/A.
- **Porcentaje de la OC:** promedio ponderado de las divisiones disponibles (los pesos se renormalizan sobre las disponibles).
- **Fecha real de entrega:** sobrescritura manual, si no, la fecha de la entrega que completó el pedido, si no, `fecha_cierre`.
- **Reevaluación anual:** promedio del porcentaje de las OC puntuables del año calendario; se compara contra el umbral. La decisión (continuar / no continuar) y el motivo los escribe una persona; el motivo es obligatorio si no se continúa o si queda por debajo del umbral.
- **Evaluación de selección:** por criterio se marca el mejor (menor precio, menor tiempo, mayor calidad); puntaje global = promedio de `min_precio/precio×100`, `min_tiempo/tiempo×100` y el índice de calidad. Para un proveedor existente, tiempo y calidad se precargan del historial; el precio se escribe. La recomendación es el mayor puntaje, pero la persona elige y escribe la conclusión.

## Pantallas y rutas

- `/proveedores` — pestañas **Proveedores** y **Evaluación de selección**.
  - Proveedores: lista con búsqueda por nombre/NIT, filas desplegables con resumen (OC, % cumplimiento, última reevaluación), botón "Abrir historial", "Nuevo proveedor" e "Importar CSV".
  - Evaluación de selección: lista de evaluaciones y botón para crear una.
- `/proveedores/[id]` — ficha del proveedor con pestañas:
  - **Historial:** tabla con las columnas del Excel (OC, fecha de OC, proveedor, fecha de entrega, fecha real, diferencia en días, devoluciones, observaciones, factura/remisión) más calidad, cantidad y porcentaje. Cada fila abre el desempeño de esa OC con sus 4 divisiones. Botones de exportar CSV/PDF e "Importar historial".
  - **Reevaluación anual:** análisis del año elegido, porcentaje, decisión, constancia en CSV/PDF.
- `/proveedores/seleccion/[id]` — editor del cuadro comparativo.
- En el detalle de una OC (Compras) se agrega un acceso al desempeño de esa OC.
- En **Configuración** (supervisor) se agrega una tarjeta con umbral, pesos y penalizaciones.

## Importaciones

- **Proveedores:** CSV con NIT, nombre y correo (opcionales: teléfono, contacto). Se previsualiza, se valida y se hace upsert por NIT normalizado.
- **Historial de desempeño:** se importa dentro de la ficha de un proveedor (así no hay que emparejar nombres) con las columnas del Excel de referencia. Formato de fecha detectado, con selector dd/mm/aaaa o mm/dd/aaaa y vista previa antes de guardar.

## Exportaciones

- CSV (`;`, UTF-8 con BOM, `escapeFormulae`): cuadro de desempeño por proveedor (columnas del Excel + calidad, cantidades y puntajes), constancia de reevaluación, cuadro comparativo de selección y resultado de una OC.
- PDF (`jspdf` + `autotable`): encabezado Carrera Arango, resumen, tabla, barras por división dibujadas con primitivas de `jspdf` y texto de análisis/conclusión.

## Fuera de alcance (a cargo de backend / más adelante)

- Aplicar las migraciones 080–083 (frontend las deja escritas en el repo; no se corre `supabase db push` desde aquí).
- Envío automático por correo del resultado de la OC y recordatorio anual de reevaluación (Edge Function / `cola_correos` con adjuntos / `pg_cron`; lo coordina el usuario con Juan Pablo).
- Archivos `.xlsx` reales.
- Vincular el desempeño con la factura de Siigo.

## Supuestos a confirmar durante la implementación

- Interpretamos el "desplegable" del diagrama como el menú Proveedores más filas desplegables en la lista; si se quería un submenú en el sidebar, se ajusta (el sidebar hoy no tiene submenús).
- Los valores por defecto de las fórmulas (50 para Regular, 5 puntos por día de retraso, 25 por devolución) son propuestos y quedan editables salvo la escala de calidad.
- El NIT se normaliza a solo dígitos; un mismo proveedor escrito con y sin dígito de verificación se vería como dos. Si pasa, se unifica a mano o con la importación.
