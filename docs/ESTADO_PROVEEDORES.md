# Estado — Sección Proveedores

**Fecha:** 2026-11-19
**Spec:** `docs/superpowers/specs/2026-11-19-proveedores-design.md` · **Plan:** `docs/superpowers/plans/2026-11-19-proveedores.md`

## Hecho en el frontend

- **Menú y permisos:** "Proveedores" en el menú lateral para supervisor, comercial, compras y auditoría. Todos ven y modifican; borrar proveedores o evaluaciones, solo supervisor. La configuración de la evaluación está en Configuración (solo supervisor).
- **Catálogo** (`/proveedores`): desplegable "Elegir proveedor" con búsqueda por nombre o NIT, lista con filas desplegables, alta, edición, eliminación e importación por CSV (con plantilla).
- **Ficha** (`/proveedores/[id]`), pestaña *Historial y desempeño*: cuadro de control con las columnas del Excel de compras, resumen (cumplimiento promedio, órdenes calificadas, retrasos, devoluciones), desempeño por OC (calidad, devoluciones, cantidad, tiempo) con porcentaje en vivo, descarga CSV/PDF del cuadro y del resultado de cada OC, e importación del historial desde el Excel de control (ignora filas de título, detecta día/mes o mes/día).
- **Ficha**, pestaña *Reevaluación anual*: análisis del año, decisión (continuar / no continuar) con motivo obligatorio cuando corresponde, historial de reevaluaciones y constancia CSV/PDF con espacios de firma.
- **Evaluación de selección** (`/proveedores?vista=seleccion`, `/proveedores/seleccion/[id]`): cuadro comparativo de precio, tiempo y calidad entre proveedores del catálogo y nuevos, mejor valor por criterio, recomendación, elección, conclusión y constancia CSV/PDF. Al elegir un proveedor del catálogo se precargan su tiempo y calidad del historial.
- **Desde Compras:** el detalle de cada orden tiene el enlace "Ver desempeño" (`/proveedores/nit/[nit]?orden=`).

Todo probado en el navegador con `DEV_SKIP_AUTH` (datos de ejemplo) en escritorio y celular, y con los roles supervisor, comercial y producción.

## Pendiente de backend (sin esto la sección muestra el aviso de migración)

1. Aplicar en Supabase, en este orden: `080_proveedores.sql`, `081_proveedor_desempeno.sql`, `082_proveedor_reevaluaciones.sql`, `083_proveedor_selecciones.sql`.
2. Cargar todos los proveedores de Siigo en el catálogo: extender la Edge Function `siigo-sync-catalogo` para hacer `upsert` en `proveedores` (por `nit_normalizado`, `origen = 'siigo'`, filtrando solo proveedores del endpoint de terceros) y correrla una vez completa (`{ completo: true }`).
3. Envío automático por correo del resultado de la OC y recordatorio anual de reevaluación (cola de correos con adjuntos + `pg_cron`). Mientras tanto, todo se descarga a mano.

## A confirmar con compras

- Cómo se escribe el NIT de un mismo proveedor (con o sin dígito de verificación): el panel los compara solo por dígitos.
- Los valores por defecto de la evaluación (85 % para aprobar, pesos iguales, 5 puntos por día de retraso, 25 por devolución, Regular = 50) se pueden cambiar en Configuración.
