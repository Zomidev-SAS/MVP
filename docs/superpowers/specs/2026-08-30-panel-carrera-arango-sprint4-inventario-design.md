# Diseño: Panel Carrera Arango — Sprint 4 (Tabla de Inventario)

**Fecha:** 2026-08-30
**Fuente:** `Documento_Iniciacion_Frontend_Carrera_Arango.md` (Sprint 4)
**Alcance:** Tabla de inventario con paginación server-side, filtros dinámicos, debounce, alerta de stock bajo, exportación CSV. Reemplaza el placeholder "Próximamente" de `app/(panel)/inventario/page.tsx`.

## Contexto

Sigue el mismo patrón visual/arquitectónico ya establecido en Sprints 1-3: componentes shadcn/ui existentes (`Card`, `Table`, tokens de tema del Sidebar/brand), bypass dev con datos de ejemplo deterministas para previsualizar sin Supabase real, código real escrito completo contra el schema conocido (`vista_inventario_actual`, vía `origin/master`) aunque todavía no verificable en vivo.

## Decisiones de diseño (ya acordadas con el usuario)

- **Filtro "Estado"** (mencionado en el documento, sin columna real en el schema): derivado — `Activo` si `saldo > 0`, `Agotado` si `saldo <= 0`. No es una columna de la base de datos, se calcula al vuelo.
- **Filtro de rango de fechas**: aplica sobre `ultimo_movimiento` (único campo de fecha en `vista_inventario_actual`).
- **Búsqueda por VIN**: coincidencia **exacta** (`.eq('vin', valor)`), tal como especifica el documento ("Búsqueda exacta por VIN") — no parcial.
- **Marca / Categoría**: texto libre, coincidencia parcial (`ilike`) — el documento no especifica un selector de opciones fijas, y `categoria`/`marca` son columnas `text` libres sin enum en el backend real, así que no hay una lista fija de valores que ofrecer en un dropdown.
- **Datos de ejemplo para el bypass dev**: 120 filas fijas y deterministas (sin `Math.random`), suficientes para ver paginación real funcionando (criterio del documento pide "+100 registros de prueba").
- **Exportar CSV**: arma el archivo en el navegador (`Blob` + `URL.createObjectURL`, como pide el documento) usando únicamente las filas de la página actual visibles en pantalla — no vuelve a pedir todos los resultados filtrados al servidor, tal como el documento describe el criterio de aceptación ("la exportación descarga exactamente los datos filtrados en pantalla").

## Arquitectura

**Problema:** el bypass dev (`isDevBypassActive()`) sólo puede evaluarse en el servidor (lee `process.env`, sin prefijo `NEXT_PUBLIC_`), pero la tabla necesita ser interactiva en el cliente (cambiar de página, escribir un filtro, ver resultados sin recargar). Los Server Components puros (patrón usado en el Dashboard de Sprint 3) no alcanzan para esta interactividad.

**Solución:** una Server Action (`'use server'`) llamada `fetchInventario(filtros, pagina)` en `lib/supabase/get-inventario.ts`. Es una función async normal desde la perspectiva del código cliente — Next.js la ejecuta en el servidor bajo el capó. Adentro:
- Si `isDevBypassActive()`: aplica los mismos filtros (en JS) sobre el array fijo de 120 filas de ejemplo (`lib/dev/preview-inventario-data.ts`) y devuelve la página pedida.
- Si no: arma la consulta real contra `vista_inventario_actual` con `.range()` para paginar y los filtros correspondientes (`.eq`, `.ilike`, `.gte`/`.lte`), con `{ error }` chequeado y log, retornando `{ filas: [], total: 0 }` en caso de fallo (no crashea la página).

Ambas ramas devuelven la misma forma: `{ filas: InventarioItem[], total: number }`.

Un Client Component (`components/inventario/InventoryTable.tsx`) mantiene el estado de filtros + página actual en React state, hace debounce de 500ms sobre el campo de búsqueda VIN antes de llamar `fetchInventario`, resetea a página 1 cuando cambia cualquier filtro, y renderiza la tabla + controles de paginación + botón de exportar CSV.

## Componentes y tipos nuevos

- `lib/types/inventario.ts` — `InventarioItem` (`vin, marca, categoria, ubicacion, saldo, valor_unitario, valor_total, ultimo_movimiento`), `InventarioFiltros` (`vin?, marca?, categoria?, estado?: 'activo'|'agotado', desde?, hasta?`), `InventarioPagina` (`{ filas: InventarioItem[]; total: number }`).
- `lib/dev/preview-inventario-data.ts` — genera las 120 filas fijas (VINs, marcas, categorías y fechas variadas para que los filtros tengan algo que filtrar de verdad).
- `lib/supabase/get-inventario.ts` — la Server Action `fetchInventario`.
- `components/inventario/InventoryFilters.tsx` — inputs de filtro (VIN, marca, categoría, estado, rango de fechas) con el debounce en VIN.
- `components/inventario/InventoryTable.tsx` — orquesta estado, llama `fetchInventario`, renderiza tabla (shadcn `Table`), fila con `saldo <= 2` resaltada como alerta, paginación (anterior/siguiente + "mostrando X de Y"), botón exportar CSV.
- `app/(panel)/inventario/page.tsx` se reescribe: mismo patrón de `RoleGuard` que ya tiene, ahora renderiza `<InventoryTable />` en vez del placeholder.

## Página inicial y tamaño de página

20 filas por página (razonable para una tabla de este tipo, el documento no fija un número exacto). Carga inicial: página 1 sin filtros, obtenida al montar el componente (no server-rendered — como es 100% interactivo, no hay ventaja en pre-renderizar la primera página en el servidor aquí).

## Criterio de aceptación

- Con el bypass dev activo, la tabla muestra las 120 filas paginadas (20 por página, 6 páginas), y cada filtro (VIN exacto, marca/categoría parcial, estado derivado, rango de fechas) reduce visiblemente los resultados.
- El botón exportar CSV descarga un archivo con exactamente las filas visibles en la página actual.
- `npx tsc --noEmit` y `npm run build` sin errores.
- El código de la rama real de `fetchInventario` compila correcto contra el schema conocido, aunque no se pueda probar en vivo todavía (mismo caveat que Sprint 3).

## Fuera de alcance

- Selector de opciones fijas para Marca/Categoría (no hay lista fija en el backend real).
- Exportar TODAS las filas filtradas (no sólo la página actual) — el documento pide específicamente "lo filtrado en pantalla".
- Cualquier acción de escritura sobre el inventario (eso es Sprint 5/6 — Entradas y Ajustes).
