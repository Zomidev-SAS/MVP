# Adaptar el frontend al schema real (productos/bodegas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir todo el frontend que asumía un negocio de "vehículos con VIN" para que funcione contra el schema real de Carrera Arango — fabricación de muebles, con `productos` + `bodegas` + `categorias_inventario`, ya construido y documentado por el equipo de backend en `origin/master` (ahora copiado a `supabase/` en esta rama, ver commit `fead98b`).

**Architecture:** Mismo patrón de siempre (Server Action con rama bypass-dev + rama real), pero apuntando a las tablas/vistas/Edge Functions/RPC reales en vez de las inventadas. `lib/types/database.ts` y `lib/permissions/roles.ts` YA fueron reescritos (8 roles reales, sin `ingenieria`; ruta `/vehiculos` eliminada — Inventario y Vehículos eran el mismo concepto, ahora es un solo módulo "Inventario" sobre `productos`+`bodegas`). Este plan cubre el resto: Inventario, Movimientos, Entradas, Ajustes, Importar CSV, Usuarios, Configuración, Dashboard.

**Tech Stack:** Sin cambios de stack — Next.js Server Actions, Supabase JS client, Zod, RHF. La única pieza nueva es una llamada `multipart/form-data` a una Edge Function (Importar CSV) en vez de un `insert` directo.

## Referencia completa del schema real (usar exactamente estos nombres — NO inventar columnas)

### Tablas

- **`productos`**: `codigo_producto` (text, PK), `nombre_producto` (text), `unidad_medida` (text), `categoria` (text, FK a `categorias_inventario.nombre`).
- **`bodegas`**: `nombre` (text, PK). 9 filas reales: `Sin Asignar`, `ALMACEN NIVEL 1`, `ALMACEN NIVEL 2`, `ALMACEN NIVEL 3`, `METALMECANICA`, `PRODUCTO TERMINADO`, `MADERAS`, `DESCANSABRAZOS`, `AUDIO Y VIDEO`.
- **`categorias_inventario`**: `nombre` (text, PK). 17 categorías reales (ver `supabase/migrations/006_adaptar_esquema_datos_reales.sql` para la lista completa si hace falta un `<select>`).
- **`movimientos_inventario`**: `id` (bigint), `codigo_producto` (text, FK productos), `tipo_movimiento` (`'entrada'|'salida_vin'|'ajuste'|'reverso'`), `cantidad` (numeric), `valor_unitario` (numeric, **columna revocada para `authenticated` — nunca seleccionarla directo de esta tabla, solo desde las vistas**), `bodega` (text, FK bodegas), `formulario_id`, `motivo`, `evidencia` (jsonb), `actor_id`, `aprobado_por`, `estado` (`'pendiente'|'aplicado'|'rechazado'`), `idempotency_key`, `created_at`. Las columnas `marca`/`categoria`/`ubicacion` siguen existiendo en la tabla por compatibilidad histórica pero YA NO se usan — usar `bodega` y `productos.categoria` en su lugar. UPDATE/DELETE están bloqueados a nivel de RULE (es un ledger inmutable) — nunca intentar editar una fila existente.
- **`ajustes_pendientes`**: sin cambios de forma (`id`, `movimiento_borrador` jsonb, `solicitado_por`, `estado`, `motivo_rechazo`, `resuelto_por`, `created_at`, `resuelto_at`), pero el contenido de `movimiento_borrador` ahora debe tener `{codigo_producto, cantidad, bodega, valor_unitario, motivo}` en vez de `{vin, cantidad, motivo}`.
- **`config_app`** (NO `configuracion` — ese nombre ya no existe): `id` (siempre 1), `bloquear_sin_stock` (boolean), `umbral_stock_bajo` (integer).
- **`profiles`**: sin cambios de forma (`id`, `nombre`, `rol`, `activo`).

### Vistas (siempre leer costos desde acá, nunca desde `movimientos_inventario` directo)

- **`vista_inventario_actual`**: `codigo_producto, nombre_producto, unidad_medida, categoria, saldo, valor_unitario, valor_total, ultimo_movimiento` — saldo total del producto sumando TODAS las bodegas. `valor_unitario`/`valor_total` ya vienen `null` desde la vista si el rol no tiene permiso de costos (no hace falta ocultarlos de nuevo en el frontend, aunque no está de más seguir gateando la UI con `CAN_VIEW_COSTS` como defensa en profundidad).
- **`vista_inventario_por_bodega`**: `codigo_producto, bodega, saldo, valor_unitario, valor_total, ultimo_movimiento` — saldo por producto Y bodega específica. Útil para un futuro desglose por bodega; no es necesario usarla en este plan salvo que un Task lo pida explícitamente.
- **`vista_valorizacion_basica`**: `categoria, unidades, valor_total` (agrupado por categoría).
- **`vista_movimientos_recientes`**: `id, codigo_producto, tipo_movimiento, cantidad, valor_unitario, bodega, formulario_id, motivo, evidencia, actor_id, aprobado_por, estado, idempotency_key, created_at, actor_nombre, actor_rol, producto_nombre` — últimos 100 movimientos con el nombre del producto y del actor ya resueltos.

### RPC (para Ajustes)

- **`resolver_ajuste(p_ajuste_id bigint, p_decision text, p_motivo_rechazo text default null)`** — llamado vía `supabase.rpc('resolver_ajuste', {...})`. `p_decision` es `'aprobado'` o `'rechazado'`. Reemplaza tanto `aprobarAjuste` (que antes invocaba la Edge Function `aprobar-ajuste`, que ya no existe) como `rechazarAjuste` (que antes hacía un `update` directo). Devuelve un array con una fila `{ajuste_id, estado_final, movimiento_id}`.

### Edge Functions reales (todas en `supabase/functions/`, ya escritas — el frontend solo las invoca)

- **`crear-usuario`**: `POST`, body `{email, nombre, rol}` (SIN `password`). Response 200: `{ok: true, usuario: {id, email, nombre, rol}}`. El usuario recibe un correo de invitación (Supabase gestiona el `redirectTo` internamente vía la config de Auth del proyecto — a diferencia de la versión que se había escrito antes en esta rama, esta NO recibe/usa un `redirectTo` custom en el body).
- **`desactivar-usuario`**: `POST`, body `{user_id}`. Response 200: `{ok: true, user_id, activo: false, baneado: true}`. Ya marca `activo=false` en `profiles` Y banea la cuenta (invalida sesión) — el frontend NO debe seguir haciendo un `update` directo de `profiles.activo`, debe invocar esta función.
- **`importar-inventario-csv`**: `POST multipart/form-data`, campo `file` (el CSV). Columnas esperadas: `codigo_producto,cantidad,bodega,valor_unitario` (`bodega` y `valor_unitario` opcionales, `bodega` por defecto `Sin Asignar`). Tope 500 filas. Response 200: `{exitosas, errores: [{fila, motivo}], abortado}`. Response 422 si el % de error supera 30%: `{exitosas:0, errores, abortado:true, motivo_abortado}`.
- `sync-inventario-vin` y `consultar-saldo-vin` son para la app móvil / webhooks — el panel web NO las llama, ignorarlas en este plan.

## Global Constraints

- TypeScript `strict: true`, sin `any`.
- Server Action files mantienen `'use server'` como PRIMERA línea (lección ya establecida en toda la sesión).
- Cada Server Action sigue el patrón `isDevBypassActive()` → datos de ejemplo determinísticos con la NUEVA forma (`codigo_producto`/`bodega`, nunca `vin`) vs. rama real contra el schema de arriba.
- Antes de editar cualquier archivo de este plan, LEÉLO PRIMERO — este plan no reproduce el contenido actual línea por línea (es demasiado código para transcribir), así que confía en lo que encuentres en disco como punto de partida, no en una versión "anterior" que el plan no te muestra.
- Nunca selecciones `valor_unitario`/`valor_total` directo de `movimientos_inventario` — siempre desde una vista (`vista_inventario_actual`, `vista_movimientos_recientes`, etc.). La tabla base tiene esa columna revocada para `authenticated`, la query fallaría.
- `RoleGuard`/`CAN_VIEW_COSTS`/`ROUTE_PERMISSIONS` ya están actualizados (`lib/permissions/roles.ts`, `lib/types/database.ts`) — no los toques salvo que un Task lo pida explícitamente.
- La ruta `/vehiculos` ya fue eliminada — Inventario es ahora un solo módulo.

---

### Task 1: Inventario (fusionar Productos+Vehículos en un solo módulo real)

**Files:**
- Rewrite: `frontend/lib/types/inventario.ts`
- Rewrite: `frontend/lib/supabase/inventario-actions.ts` (borrar `inventario-saldos-actions.ts` y fusionar todo acá — un solo archivo, un solo concepto de inventario ahora)
- Delete: `frontend/lib/supabase/inventario-saldos-actions.ts`, `frontend/lib/supabase/get-inventario.ts` (barrel ya no hace falta, importar `inventario-actions.ts` directo)
- Rewrite: `frontend/lib/dev/preview-inventario-data.ts` (borrar `preview-inventario-data.ts` viejo con VIN, generar datos de ejemplo con `codigo_producto`/`bodega`)
- Rewrite: `frontend/components/inventario/InventoryFilters.tsx`
- Rewrite: `frontend/components/inventario/InventoryTable.tsx`
- Rewrite: `frontend/app/(panel)/inventario/page.tsx`
- Delete: `frontend/lib/inventario/` (carpeta con `filtros-local.ts`, `parse-excel.ts`, `cache-local.ts` si existen — el flujo de "excel local cacheado en disco" ya no aplica, el catálogo de productos vive en Supabase)

**Interfaces:**
- Consumes: `CAN_VIEW_COSTS` desde `@/lib/permissions/roles`; `getCurrentProfile`.
- Produces: `InventarioItem` (`{codigo_producto, nombre_producto, unidad_medida, categoria, saldo, valor_unitario, valor_total, ultimo_movimiento}`), `InventarioFiltros` (`{busqueda, categoria, bodega, estado: 'todos'|'activo'|'agotado', desde, hasta}` — SIN `vin`, SIN `marca`), `InventarioPagina` (`{filas, total}` — SIN el concepto `fuente`/`origen`/`archivoLocal`, ya no hay dos orígenes), `fetchInventario(filtros, pagina): Promise<InventarioPagina>` desde `@/lib/supabase/inventario-actions`.

- [ ] **Step 1: Reescribir el tipo**

`frontend/lib/types/inventario.ts`:

```ts
export interface InventarioItem {
  codigo_producto: string
  nombre_producto: string | null
  unidad_medida: string | null
  categoria: string | null
  saldo: number
  valor_unitario: number | null
  valor_total: number | null
  ultimo_movimiento: string | null
}

export interface InventarioFiltros {
  busqueda: string
  categoria: string
  bodega: string
  estado: 'todos' | 'activo' | 'agotado'
  desde: string
  hasta: string
}

export interface InventarioPagina {
  filas: InventarioItem[]
  total: number
}
```

- [ ] **Step 2: Reescribir la Server Action**

Create `frontend/lib/supabase/inventario-actions.ts` (borra `inventario-saldos-actions.ts` y `get-inventario.ts` después de esto — ya no hace falta el barrel ni el archivo separado):

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewInventarioData } from '@/lib/dev/preview-inventario-data'
import { INVENTARIO_PAGE_SIZE } from '@/lib/supabase/inventario-page-size'
import type { InventarioFiltros, InventarioItem, InventarioPagina } from '@/lib/types/inventario'

export async function fetchInventario(
  filtros: InventarioFiltros,
  pagina: number
): Promise<InventarioPagina> {
  if (isDevBypassActive()) {
    return fetchInventarioPreview(filtros, pagina)
  }

  const supabase = await createClient()

  let query = supabase
    .from('vista_inventario_actual')
    .select(
      'codigo_producto, nombre_producto, unidad_medida, categoria, saldo, valor_unitario, valor_total, ultimo_movimiento',
      { count: 'exact' }
    )

  if (filtros.categoria) query = query.ilike('categoria', `%${filtros.categoria}%`)
  if (filtros.estado === 'activo') query = query.gt('saldo', 0)
  else if (filtros.estado === 'agotado') query = query.lte('saldo', 0)
  if (filtros.desde) query = query.gte('ultimo_movimiento', filtros.desde)
  if (filtros.hasta) query = query.lte('ultimo_movimiento', filtros.hasta)
  if (filtros.busqueda) {
    query = query.or(
      `codigo_producto.ilike.%${filtros.busqueda}%,nombre_producto.ilike.%${filtros.busqueda}%`
    )
  }

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE - 1

  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Failed to load vista_inventario_actual:', error)
    return { filas: [], total: 0 }
  }

  return { filas: (data ?? []) as InventarioItem[], total: count ?? 0 }
}

function fetchInventarioPreview(filtros: InventarioFiltros, pagina: number): InventarioPagina {
  const todas = getDevPreviewInventarioData()
  const filtradas = todas.filter((item) => {
    if (filtros.categoria && item.categoria !== filtros.categoria) return false
    if (filtros.estado === 'activo' && item.saldo <= 0) return false
    if (filtros.estado === 'agotado' && item.saldo > 0) return false
    if (filtros.busqueda) {
      const b = filtros.busqueda.toLowerCase()
      const matches =
        item.codigo_producto.toLowerCase().includes(b) ||
        (item.nombre_producto ?? '').toLowerCase().includes(b)
      if (!matches) return false
    }
    return true
  })

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE

  return { filas: filtradas.slice(from, to), total: filtradas.length }
}
```

Nota: el filtro `bodega` de `InventarioFiltros` no se usa en esta consulta porque `vista_inventario_actual` está agregada por producto (todas las bodegas sumadas) — no tiene columna `bodega`. Déjalo en el tipo/UI para cuando se quiera un desglose por bodega usando `vista_inventario_por_bodega` (fuera de alcance de este plan), pero no lo apliques como filtro real todavía; si el campo `filtros.bodega` no se usa en esta función, está bien, no falla nada por dejarlo sin conectar.

- [ ] **Step 3: Datos de ejemplo (bypass dev)**

Reescribe `frontend/lib/dev/preview-inventario-data.ts` con ~20 filas usando `codigo_producto` (ej. `'10024'`, `'10025'`...), `nombre_producto` (nombres de muebles/partes creíbles, ej. "TAPA DE ASIENTO", "BASE METALICA SILLA"), `categoria` tomada de la lista real (`'TORNILLERIA'`, `'MECANIZADOS'`, `'PRODUCTO TERMINADO'`, etc.), `unidad_medida` (`'unidad'`, `'kg'`, `'metro'`), `saldo`/`valor_unitario`/`valor_total` numéricos deterministas, `ultimo_movimiento` con fechas ISO.

- [ ] **Step 4: Reescribir los filtros de UI**

`InventoryFilters.tsx`: quita los campos `vin`/`marca`/el branching `esExcel`/`!esExcel` — ya no existen dos formatos. Deja: Buscar (código/nombre), Categoría (idealmente un `<select>` con las 17 categorías reales, o un `Input` de texto libre si prefieres no hardcodear la lista — tu criterio, ambas son razonables), Estado (Todos/Con stock/Sin stock, sin cambios), Desde/Hasta.

- [ ] **Step 5: Reescribir la tabla**

`InventoryTable.tsx`: una sola forma de tabla (sin branching `esExcel`). Columnas: Código, Nombre, Categoría, Saldo (con el ícono de alerta si `saldo <= umbral` — de momento deja el umbral hardcodeado en `2` iaual que antes, la Task 8 de este plan lo conecta a `config_app`), Valor unit. (gateado por `puedeVerCostos`, prop igual que ya existía), Valor total (gateado igual), Último movimiento. El botón "Exportar CSV" se mantiene, mismo patrón (`puedeVerCostos` decide si incluye las columnas de valor), pero con los nuevos nombres de columna.

- [ ] **Step 6: Reescribir la página**

`app/(panel)/inventario/page.tsx`: mismo patrón que ya tenía (`RoleGuard` + `getCurrentProfile` + `puedeVerCostos` vía `CAN_VIEW_COSTS` + `<InventoryTable puedeVerCostos={...} />`), solo sin la prop `fetchFn` (ya no hace falta, hay un solo `fetchInventario`).

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit` desde `frontend/` — puede que siga fallando por otros módulos que este plan todavía no tocó (Movimientos, Ajustes, etc. en Tasks 2-4) — está bien, solo confirma que los errores restantes NO mencionan `inventario` ni el propio Task 1.

- [ ] **Step 8: Commit**

```bash
git add lib/types/inventario.ts lib/supabase/inventario-actions.ts lib/dev/preview-inventario-data.ts components/inventario/InventoryFilters.tsx components/inventario/InventoryTable.tsx "app/(panel)/inventario/page.tsx"
git rm lib/supabase/inventario-saldos-actions.ts lib/supabase/get-inventario.ts 2>/dev/null || true
git rm -r lib/inventario 2>/dev/null || true
git commit -m "feat: adaptar Inventario al schema real de productos y bodegas"
```

---

### Task 2: Movimientos (codigo_producto + bodega en vez de VIN)

**Files:**
- Rewrite: `frontend/lib/types/movimientos.ts`
- Rewrite: `frontend/lib/supabase/movimientos-actions.ts`
- Rewrite: `frontend/lib/dev/preview-movimientos-data.ts`
- Rewrite: `frontend/components/movimientos/MovementsFilters.tsx`
- Rewrite: `frontend/components/movimientos/MovementsTable.tsx`
- Rewrite: `frontend/components/movimientos/MovementDetailDialog.tsx`

**Interfaces:**
- Consumes: `CAN_VIEW_COSTS`; nada de otros Tasks.
- Produces: `MovimientoDetalle` (nueva forma, ver abajo), `MovimientosFiltros`, `MovimientosPagina`, `fetchMovimientos(filtros, pagina)` desde `@/lib/supabase/movimientos-actions`. Consumido por Task 4 (Ajustes) NO — Ajustes tiene su propio tipo, no reutiliza este.

- [ ] **Step 1: Reescribir el tipo**

```ts
export interface MovimientoDetalle {
  id: number
  codigo_producto: string
  producto_nombre: string | null
  tipo_movimiento: 'entrada' | 'salida_vin' | 'ajuste' | 'reverso'
  cantidad: number
  valor_unitario: number | null
  bodega: string | null
  formulario_id: string | null
  motivo: string | null
  actor_id: string
  actor_nombre: string | null
  aprobado_por: string | null
  estado: 'pendiente' | 'aplicado' | 'rechazado'
  created_at: string
}

export interface MovimientosFiltros {
  codigoProducto: string
  bodega: string
  tipo: 'todos' | 'entrada' | 'salida_vin' | 'ajuste' | 'reverso'
  desde: string
  hasta: string
}

export interface MovimientosPagina {
  filas: MovimientoDetalle[]
  total: number
}
```

- [ ] **Step 2: Reescribir la Server Action**

Consulta `vista_movimientos_recientes` (ya trae `actor_nombre`/`producto_nombre` resueltos y `valor_unitario` ya enmascarado por rol) en vez de `movimientos_inventario` directo. Filtra por `codigo_producto` (`.eq`), `bodega` (`.eq`), `tipo_movimiento` (`.eq`), rango de fechas sobre `created_at`. Mismo patrón de paginación que ya existía (`MOVIMIENTOS_PAGE_SIZE`, mantenlo en `movimientos-page-size.ts` sin cambios). Dev bypass devuelve `getDevPreviewMovimientosData()` filtrada en memoria con la misma lógica de filtros.

Nota importante: `vista_movimientos_recientes` trae como mucho los últimos 100 movimientos (`limit 100` en la vista misma) — la paginación de la UI opera sobre ese máximo de 100 filas, no sobre la tabla completa. Está bien así por ahora (es el comportamiento real de la vista tal como la construyó backend); no intentes paginar más allá consultando `movimientos_inventario` directo (perderías el enmascarado de costos de la vista).

- [ ] **Step 3: Datos de ejemplo**

Reescribe `preview-movimientos-data.ts` con 60 filas usando `codigo_producto`/`bodega`/`producto_nombre` en vez de `vin`/`marca`.

- [ ] **Step 4: Filtros, tabla y detalle**

`MovementsFilters.tsx`: campo "Código producto" en vez de "VIN exacto", agrega un `<select>` o `Input` de Bodega, quita "Marca". `MovementsTable.tsx`: columna "Producto" (código + nombre) en vez de "VIN", agrega columna "Bodega". `MovementDetailDialog.tsx`: mismos campos que antes pero con los nuevos nombres (`codigo_producto`/`producto_nombre` en vez de `vin`, `bodega` en vez de `ubicacion`), sigue recibiendo la prop `puedeVerCostos` (ya existía, no la quites) para gatear "Valor Unitario" en la UI — aunque la vista ya lo manda `null` si no corresponde, mantener el gate en frontend es la defensa en profundidad de siempre.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit` — mismo criterio que Task 1 (pueden quedar errores de Tasks futuros, no de este).

- [ ] **Step 6: Commit**

```bash
git add lib/types/movimientos.ts lib/supabase/movimientos-actions.ts lib/dev/preview-movimientos-data.ts components/movimientos/
git commit -m "feat: adaptar Movimientos al schema real de productos y bodegas"
```

---

### Task 3: Entradas (formulario manual, codigo_producto + bodega)

**Files:**
- Rewrite: `frontend/lib/types/entradas.ts`
- Rewrite: `frontend/lib/supabase/entradas-actions.ts`
- Rewrite: `frontend/components/entradas/EntryForm.tsx`

**Interfaces:**
- Consumes: nada de otros Tasks.
- Produces: `entradaSchema`, `EntradaInput`, `EntradaResultado`, `crearEntrada(datos)`. Consumido por Task 5 (Importar CSV) — reutiliza `entradaSchema` tal como antes, verifica que los nombres de campo coincidan con lo que Importar CSV necesita.

- [ ] **Step 1: Reescribir el schema**

```ts
import { z } from 'zod'

export const entradaSchema = z.object({
  codigo_producto: z.string().trim().min(1, 'El código de producto es requerido'),
  bodega: z.string().trim().min(1, 'La bodega es requerida'),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  valor_unitario: z.coerce.number().min(0, 'El valor unitario no puede ser negativo').optional(),
  motivo: z.string().trim().optional(),
})

export type EntradaInput = z.infer<typeof entradaSchema>
export type EntradaResultado = { ok: true } | { ok: false; error: string }
```

- [ ] **Step 2: Reescribir la Server Action**

`crearEntrada` inserta en `movimientos_inventario` con `codigo_producto`, `tipo_movimiento: 'entrada'`, `estado: 'aplicado'`, `cantidad`, `valor_unitario: parsed.data.valor_unitario ?? null`, `bodega`, `motivo: parsed.data.motivo ?? null`, `actor_id` del usuario (vía `getSessionUser()`, igual que antes). Re-valida con `entradaSchema.safeParse` server-side (mismo patrón de siempre). Nota: la policy real `mov_insert_roles_autorizados` exige `get_user_rol() in ('supervisor','metalmecanica','produccion','instalacion','compras')` — coincide con `ROUTE_PERMISSIONS.entradas` ya actualizado en este plan, así que no hace falta ninguna verificación de rol adicional en el frontend, RLS ya lo cubre.

- [ ] **Step 3: Reescribir el formulario**

`EntryForm.tsx`: campos Código de producto (texto), Bodega (idealmente `<select>` con las 9 bodegas reales — hardcodealas como una constante `BODEGAS_REALES` en el propio componente o en un archivo compartido si prefieres, tu criterio), Cantidad, Valor unitario (opcional), Motivo/Notas (opcional). Mismo patrón RHF+Zod que ya existía, mismo manejo de toasts.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add lib/types/entradas.ts lib/supabase/entradas-actions.ts components/entradas/EntryForm.tsx
git commit -m "feat: adaptar Entradas al schema real de productos y bodegas"
```

---

### Task 4: Ajustes (RPC resolver_ajuste)

**Files:**
- Rewrite: `frontend/lib/types/ajustes.ts`
- Rewrite: `frontend/lib/supabase/ajustes-actions.ts`
- Rewrite: `frontend/lib/dev/preview-ajustes-data.ts`
- Rewrite: `frontend/components/ajustes/AdjustmentForm.tsx`
- Modify: `frontend/components/ajustes/AdjustmentApproval.tsx`, `frontend/components/ajustes/MisAjustesList.tsx` (solo los nombres de campo, la lógica de estado/lista no cambia)

**Interfaces:**
- Consumes: nada de otros Tasks.
- Produces: `solicitarAjusteSchema`, `SolicitarAjusteInput`, `AjustePendiente`, `AjusteMio`, `AjusteResultado`, `solicitarAjuste`, `fetchAjustesPendientes`, `fetchMisAjustes`, `fetchAjustesPendientesCount`, `aprobarAjuste`, `rechazarAjuste`.

- [ ] **Step 1: Reescribir el schema y tipos**

```ts
import { z } from 'zod'

export const solicitarAjusteSchema = z.object({
  codigo_producto: z.string().trim().min(1, 'El código de producto es requerido'),
  bodega: z.string().trim().min(1, 'La bodega es requerida'),
  cantidad: z.coerce.number().refine((v) => v !== 0, 'La cantidad no puede ser cero'),
  valor_unitario: z.coerce.number().min(0).optional(),
  motivo: z.string().trim().min(1, 'El motivo es requerido'),
})

export type SolicitarAjusteInput = z.infer<typeof solicitarAjusteSchema>

export interface AjustePendiente {
  id: number
  codigo_producto: string
  cantidad: number
  bodega: string
  motivo: string
  solicitado_por: string
  created_at: string
}

export interface AjusteMio {
  id: number
  codigo_producto: string
  cantidad: number
  bodega: string
  motivo: string
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  motivo_rechazo: string | null
  created_at: string
  resuelto_at: string | null
}

export type AjusteResultado = { ok: true } | { ok: false; error: string }
```

- [ ] **Step 2: Reescribir la Server Action**

- `solicitarAjuste`: valida, hace `insert` en `ajustes_pendientes` con `movimiento_borrador: {codigo_producto, cantidad, bodega, valor_unitario: ... ?? null, motivo}`, `solicitado_por: user.id`, `estado: 'pendiente'`. Sin cambios de patrón respecto a lo que ya existía, solo el contenido del jsonb.
- `fetchAjustesPendientes`: igual que antes (`.eq('estado','pendiente')`), pero mapea `movimiento_borrador` a `{codigo_producto, cantidad, bodega, motivo}`.
- `fetchMisAjustes`: igual que antes (`.eq('solicitado_por', user.id)`), mapea igual, agrega `codigo_producto`/`bodega` al resultado.
- `fetchAjustesPendientesCount`: sin cambios de lógica.
- `aprobarAjuste(id)` — **reescribir completo**: ya NO invoca `supabase.functions.invoke('aprobar-ajuste', ...)` (esa función no existe en el schema real). En su lugar:
  ```ts
  const { data, error } = await supabase.rpc('resolver_ajuste', {
    p_ajuste_id: id,
    p_decision: 'aprobado',
  })
  if (error) {
    console.error('Failed to resolve ajuste (aprobado):', error)
    return { ok: false, error: 'No se pudo aprobar el ajuste. Intenta de nuevo.' }
  }
  return { ok: true }
  ```
- `rechazarAjuste(id, motivo)` — **reescribir completo**, mismo patrón pero `p_decision: 'rechazado', p_motivo_rechazo: motivo`.
- Bypass dev: igual que antes, simula éxito con un delay falso para ambas.

- [ ] **Step 3: Datos de ejemplo**

Actualiza `preview-ajustes-data.ts` (y su uso en `fetchMisAjustes`'s bypass branch) para usar `codigo_producto`/`bodega` en vez de `vin`.

- [ ] **Step 4: Formulario y listas**

`AdjustmentForm.tsx`: campos Código de producto, Bodega (`<select>`, igual criterio que Entradas), Cantidad, Motivo, quita "Evidencia" si quieres simplificar o déjalo igual (campo de texto libre, no es parte de este cambio de schema). `AdjustmentApproval.tsx`/`MisAjustesList.tsx`: cambia las columnas "VIN" por "Código producto" + agrega "Bodega", el resto de la lógica (estado, botones aprobar/rechazar, toasts) no cambia.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add lib/types/ajustes.ts lib/supabase/ajustes-actions.ts lib/dev/preview-ajustes-data.ts components/ajustes/
git commit -m "feat: adaptar Ajustes al schema real y usar el RPC resolver_ajuste"
```

---

### Task 5: Importar CSV (llamar la Edge Function real)

**Files:**
- Rewrite: `frontend/lib/types/importar.ts`
- Rewrite: `frontend/lib/supabase/importar-actions.ts`
- Rewrite: `frontend/components/importar/CsvImportForm.tsx`

**Interfaces:**
- Consumes: `entradaSchema`/`EntradaInput` de Task 3 (¡confirma que ahora incluye `codigo_producto`/`bodega`, no `vin`!) — o, mejor, define un schema propio de preview local para el CSV si el shape difiere del formulario de Entradas (el CSV real tiene columnas `codigo_producto,cantidad,bodega,valor_unitario`, SIN `motivo` — más angosto que `entradaSchema`). Tu criterio: puedes reusar `entradaSchema` con `motivo` opcional (ya lo es) o definir un `filaCsvSchema` propio más estricto al shape del CSV real — cualquiera es válido, prioriza que el preview en el navegador valide EXACTAMENTE lo mismo que la Edge Function va a aceptar.
- Produces: `importarCsv(file: File): Promise<ImportarResultado>`.

**Cambio de arquitectura importante:** ya NO se valida/parsea el CSV completo en el navegador con PapaParse y se hace un `insert` masivo desde el cliente — el backend real espera el archivo crudo vía `multipart/form-data` en la Edge Function `importar-inventario-csv`, que hace su propio parseo, validación de `codigo_producto`/`bodega` contra los catálogos reales, y el umbral de 30% de error. El frontend pasa a ser mucho más simple: sube el archivo, muestra el resultado que la función devuelve.

- [ ] **Step 1: Reescribir los tipos**

```ts
export interface ImportarResultado {
  exitosas: number
  errores: { fila: number; motivo: string }[]
  abortado: boolean
  motivo_abortado?: string
}
```

- [ ] **Step 2: Reescribir la Server Action**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import type { ImportarResultado } from '@/lib/types/importar'

export async function importarCsv(formData: FormData): Promise<ImportarResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    return { exitosas: 12, errores: [], abortado: false }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.functions.invoke('importar-inventario-csv', {
    body: formData,
  })

  if (error) {
    console.error('Failed to invoke importar-inventario-csv:', error)
    return {
      exitosas: 0,
      errores: [{ fila: 0, motivo: 'No se pudo importar. Intenta de nuevo.' }],
      abortado: true,
    }
  }

  return data as ImportarResultado
}
```

Nota: `supabase.functions.invoke` con un `FormData` como `body` deja que el cliente de Supabase arme el `multipart/form-data` correcto automáticamente — no fijes manualmente el header `Content-Type`.

- [ ] **Step 3: Reescribir el componente**

`CsvImportForm.tsx`: mantiene el cuadro de arrastrar-y-soltar/click que ya existía (no lo rehagas desde cero, es UI que ya funciona bien), pero AL SOLTAR EL ARCHIVO ya no lo parsea con PapaParse — arma un `FormData` con el archivo (`formData.append('file', file)`) y llama `importarCsv(formData)` directo. Muestra el resultado: si `exitosas > 0` un toast de éxito con el conteo; si `errores.length > 0` una tabla/lista con `fila`/`motivo` de cada error; si `abortado`, un mensaje de error destacado con `motivo_abortado`. Puedes quitar la dependencia de `papaparse` de este componente (ya no se usa acá — no la desinstales de `package.json` por si algún otro archivo la sigue usando, solo deja de importarla en este componente si nada más la necesita).

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit`.
Run: `npm run build` (este Task es un buen punto para correr el build completo ya que varios Tasks anteriores tocan Server Actions importadas por Client Components).

- [ ] **Step 5: Commit**

```bash
git add lib/types/importar.ts lib/supabase/importar-actions.ts components/importar/CsvImportForm.tsx
git commit -m "feat: importar CSV via la Edge Function real importar-inventario-csv"
```

---

### Task 6: Usuarios (alinear con las Edge Functions reales)

**Files:**
- Modify: `frontend/lib/supabase/usuarios-actions.ts`
- Modify: `frontend/components/usuarios/UsersTable.tsx`

**Interfaces:**
- Consumes: `crearUsuarioSchema`/`CrearUsuarioInput` (ya existen, sin cambios de forma — `{nombre, email, rol}`, ya no tienen `password`, eso ya se hizo en una sesión anterior).
- Produces: `actualizarEstadoUsuario` cambia de firma/comportamiento (ver abajo).

- [ ] **Step 1: Ajustar `crearUsuario` a la respuesta real**

`crearUsuario` ya invoca `supabase.functions.invoke('crear-usuario', {body: parsed.data})` — eso no cambia. Lo que cambia es que la función real responde `{ok:true, usuario:{id,email,nombre,rol}}` en vez de `{ok:true, id}`. Si el código actual solo revisa `error` y devuelve `{ok:true}` sin leer el `id` de la respuesta, no hace falta tocar nada más — confírmalo leyendo el archivo actual antes de decidir si este paso requiere un cambio real.

- [ ] **Step 2: Reescribir `actualizarEstadoUsuario` para usar `desactivar-usuario`**

Hoy hace un `update` directo de `profiles.activo`. La función real `desactivar-usuario` ya hace ESE update Y banea la cuenta (invalida la sesión) — así que activar y desactivar dejan de ser simétricos:

```ts
export async function actualizarEstadoUsuario(
  id: string,
  activo: boolean
): Promise<UsuarioResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const supabase = await createClient()

  if (!activo) {
    const { error } = await supabase.functions.invoke('desactivar-usuario', {
      body: { user_id: id },
    })
    if (error) {
      console.error('Failed to invoke desactivar-usuario:', error)
      return { ok: false, error: 'No se pudo desactivar el usuario. Intenta de nuevo.' }
    }
    return { ok: true }
  }

  // Reactivar SÍ sigue siendo un update directo — no hay Edge Function de
  // "reactivar" en el schema real, y RLS (profiles_update_supervisor)
  // permite que el supervisor lo haga directo.
  const { error } = await supabase.from('profiles').update({ activo: true }).eq('id', id)

  if (error) {
    console.error('Failed to reactivate usuario:', error)
    return { ok: false, error: 'No se pudo reactivar el usuario. Intenta de nuevo.' }
  }

  return { ok: true }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/usuarios-actions.ts components/usuarios/UsersTable.tsx
git commit -m "feat: usar la Edge Function real desactivar-usuario al desactivar"
```

---

### Task 7: Configuración (`config_app`, no `configuracion`)

**Files:**
- Rewrite: `frontend/lib/types/configuracion.ts`
- Rewrite: `frontend/lib/supabase/configuracion-actions.ts`

**Interfaces:**
- Produces: `Configuracion`, `ConfiguracionInput`, `fetchConfiguracion()`, `actualizarConfiguracion(datos)` — mismos nombres exportados que ya existían (el componente `ConfiguracionForm.tsx` y la página no deberían necesitar cambios si los nombres de función/tipo se mantienen).

- [ ] **Step 1: Repuntar a `config_app`**

Cambia toda ocurrencia de `.from('configuracion')` por `.from('config_app')` en `configuracion-actions.ts`. Los nombres de columna (`bloquear_sin_stock`, `umbral_stock_bajo`) coinciden exactamente con lo que ya estaba escrito — no hace falta tocar el resto de la lógica, solo el nombre de la tabla.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add lib/types/configuracion.ts lib/supabase/configuracion-actions.ts
git commit -m "fix: apuntar Configuracion a la tabla real config_app"
```

---

### Task 8: Dashboard (8 roles reales, vistas reales, umbral desde config_app)

**Files:**
- Modify: `frontend/lib/permissions/dashboard-variante.ts`
- Modify: `frontend/lib/supabase/get-dashboard-data.ts`
- Modify: `frontend/lib/dev/preview-dashboard-data.ts`
- Modify: `frontend/app/(panel)/page.tsx`
- Modify: `frontend/components/dashboard/LowStockList.tsx` (solo el tipo `ProductoBajoStock`, cambia `codigo`→`codigo_producto`, `nombre`→`nombre_producto`)
- Modify/Remove: la función `fetchProductosBajoStock` que vivía en `inventario-saldos-actions.ts` (borrado en Task 1) debe re-crearse dentro de `inventario-actions.ts` (Task 1 ya la reescribió) — este Task solo AJUSTA quién la llama y sus nombres de campo si Task 1 no lo dejó ya resuelto.

**Interfaces:**
- Consumes: `fetchProductosBajoStock` (de Task 1's `inventario-actions.ts`), `Role`/`ALL_ROLES` (ya actualizados).

- [ ] **Step 1: Quitar `ingenieria` del mapeo de variantes**

En `VARIANTE_POR_ROL`, quita la línea `ingenieria: 'bitacora',` (ese rol ya no existe en `Role`). El resto del mapeo (`supervisor→completo`, `comercial→comercial`, `compras→compras`, `produccion|metalmecanica→taller`, `instalacion→instalacion`, `auditoria→bitacora`, `lectura→basico`) sigue igual.

- [ ] **Step 2: Repuntar las queries del Dashboard a las vistas reales**

En `get-dashboard-data.ts`: la query de `totalUnidades`/`valorTotal`/`stockBajo` debe leer de `vista_inventario_actual` con `select('saldo, valor_total')` (ya no `vista_inventario_actual` con columnas viejas — los nombres de columna de esa vista YA son los mismos `saldo`/`valor_total`, así que probablemente esta parte no necesite cambios reales, solo confírmalo). La query de `movimientosHoy`/`entradasVsSalidas` sobre `movimientos_inventario` (`tipo_movimiento`, `created_at`, `estado`) tampoco cambia de forma. La de `ultimosMovimientos` sobre `vista_movimientos_recientes` — confirma que sigue pidiendo columnas que existen en la nueva forma de esa vista (`id, codigo_producto, tipo_movimiento, cantidad, actor_nombre, created_at` en vez de `id, vin, tipo_movimiento, cantidad, actor_nombre, created_at`) y actualiza `lib/types/dashboard.ts`'s `MovimientoReciente` (`codigo_producto` en vez de `vin`) si hace falta.

El umbral de "stock bajo" (`STOCK_BAJO_THRESHOLD`, hoy hardcodeado en `2`) queda igual por ahora — conectarlo a `config_app.umbral_stock_bajo` es una mejora legítima pero agregaría una consulta extra a cada carga del Dashboard; solo hazlo si es trivial, si no, déjalo como está y no te desvíes de este plan.

- [ ] **Step 3: Datos de ejemplo**

Actualiza `preview-dashboard-data.ts` y `lib/types/dashboard.ts` para usar `codigo_producto` en vez de `vin` en `MovimientoReciente`.

- [ ] **Step 4: Página del Dashboard**

`app/(panel)/page.tsx`: revisa los accesos rápidos (`QuickLinksCard`) de las variantes `comercial`/`taller`/`instalacion` — ya no deben enlazar a `/vehiculos` (esa ruta no existe más), enlaza a `/inventario` en su lugar. Ajusta el ícono importado si `Car` ya no se usa en ningún lado (puede quedar un import sin usar que rompa el build).

- [ ] **Step 5: Verificar tipos y build**

Run: `npx tsc --noEmit` — debe dar exit 0 en este punto (último Task del plan).
Run: `npm run build` — debe dar exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/permissions/dashboard-variante.ts lib/supabase/get-dashboard-data.ts lib/dev/preview-dashboard-data.ts lib/types/dashboard.ts "app/(panel)/page.tsx" components/dashboard/LowStockList.tsx
git commit -m "feat: adaptar Dashboard a 8 roles reales y las vistas reales"
```

---

## After This Plan

1. Verificación manual en navegador real con el bypass dev, recorriendo cada módulo — curl no puede probar todo el flujo de filtros/formularios.
2. El proyecto Supabase real (el que ya tiene credenciales configuradas en `.env.local`) TODAVÍA tiene el schema viejo (mis migraciones VIN-based) — no el real. Eso requiere que alguien del lado de backend aplique las 18 migraciones reales de `origin/master` ahí (o se cree un proyecto nuevo desde cero con `supabase db push`). Sin eso, el frontend ya adaptado no tendrá contra qué probar de verdad.
3. `formularios` (ruta `/formularios`) no fue tocado en este plan — revisar si su contenido actual asume algo del modelo VIN viejo en una pasada futura.
4. Las 17 categorías y 9 bodegas reales quedaron como listas de referencia en este documento — si algún `<select>` las necesita hardcodeadas, se pueden copiar de `supabase/migrations/006_adaptar_esquema_datos_reales.sql`, o mejor, consultarlas en vivo desde las tablas `categorias_inventario`/`bodegas` (ambas de solo lectura para cualquier autenticado) en vez de hardcodearlas — evaluar en una próxima iteración.
