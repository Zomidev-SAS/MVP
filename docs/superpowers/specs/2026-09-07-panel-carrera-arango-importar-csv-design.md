# Diseño: Panel Carrera Arango — Sprint 6 parte 2 (Importar CSV)

**Fecha:** 2026-09-07
**Fuente:** El documento original (`Documento_Iniciacion_Frontend_Carrera_Arango.md`) ya no está en disco — diseño reconstruido a partir de los patrones ya establecidos en el proyecto (Entradas, Sprint 5).
**Alcance:** Reemplazar el placeholder de `/importar` (permitido a `supervisor` y `compras`) por un formulario de carga masiva de entradas de inventario vía CSV.

## Decisiones de diseño

- **Tipo de import:** cada fila del CSV es una entrada de inventario nueva — mismo schema y misma tabla destino (`movimientos_inventario`, `tipo_movimiento: 'entrada'`) que el formulario manual de Entradas (Sprint 5). No es una carga/sincronización completa del inventario.
- **Columnas del CSV (header requerido):** `vin,marca,categoria,cantidad,valor_unitario,ubicacion,notas` — idénticas a los campos de `entradaSchema` (`lib/types/entradas.ts`), que se reutiliza tal cual, sin crear un schema nuevo.
- **Validación:** el archivo se parsea enteramente en el navegador (PapaParse, con `header: true`). Cada fila se valida con el mismo `entradaSchema.safeParse` que usa Entradas. Se muestra una tabla previa con el estado de cada fila (✓ válida / ✗ con el mensaje de error de Zod) antes de enviar nada al servidor.
- **Envío:** un botón "Importar N filas válidas" (deshabilitado si N=0) llama a una Server Action nueva que inserta solo las filas válidas en un único `insert` con array — no fila por fila.
- **Sin tabla nueva:** a diferencia de Ajustes y Calendario, `movimientos_inventario` ya existe en el schema real (confirmado en sprints anteriores) — esta funcionalidad es la primera de esta sesión que no depende de que el backend cree nada nuevo.
- **Dependencia nueva:** `papaparse` + `@types/papaparse` (parseo de CSV en cliente).

## Arquitectura

- `lib/types/importar.ts` — `FilaCsv` (`{numeroFila: number, valores: Record<string,string>, valida: boolean, datos?: EntradaInput, errores: string[]}`), `ImportarResultado` (`{ok:true, insertados:number} | {ok:false, error:string}`). Reutiliza `entradaSchema`/`EntradaInput` de `@/lib/types/entradas` — no se duplica el schema.
- `lib/supabase/importar-actions.ts` (`'use server'` a nivel de archivo) — `crearEntradasMasivas(filas: EntradaInput[]): Promise<ImportarResultado>`. Bypass dev: simula éxito con el conteo de filas recibidas. Real: un solo `insert` con el array completo de filas mapeadas al mismo shape que `crearEntrada` (`tipo_movimiento:'entrada'`, `estado:'aplicado'`, `actor_id` del usuario autenticado).
- `components/importar/CsvImportForm.tsx` (Client Component): input de archivo (`accept=".csv"`), al seleccionar un archivo lo parsea con PapaParse, valida cada fila con `entradaSchema.safeParse`, arma el array `FilaCsv[]` en estado local y lo muestra en una tabla (reutiliza `components/ui/table`). Botón de importar llama `crearEntradasMasivas` solo con las filas válidas, muestra toast de resultado, limpia el estado al terminar.
- `app/(panel)/importar/page.tsx` se reescribe: `RoleGuard` (sin cambios, ya usa `ROUTE_PERMISSIONS.importar`) + `<CsvImportForm />`.

## Criterio de aceptación

- Subir un CSV con filas válidas e inválidas mezcladas muestra la tabla previa marcando cuáles son cuáles, con el mensaje de error exacto de Zod en las inválidas.
- El botón de importar muestra el conteo correcto de filas válidas y está deshabilitado si no hay ninguna.
- Con bypass dev, importar simula éxito y muestra un toast con el conteo.
- `npx tsc --noEmit` y `npm run build` sin errores (build obligatorio: `CsvImportForm` es Client Component que importa la Server Action directamente).

## Fuera de alcance

- Carga/sincronización completa de inventario (upsert por VIN, manejo de VINs faltantes).
- Plantilla de CSV descargable desde la UI.
- Importar otros tipos de movimiento (salidas, ajustes) vía CSV — solo entradas.
