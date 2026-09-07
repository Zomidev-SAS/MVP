# Diseño: Panel Carrera Arango — Sprint 5 parte 2 (Formulario de Entradas)

**Fecha:** 2026-08-30
**Fuente:** `Documento_Iniciacion_Frontend_Carrera_Arango.md` (Sprint 5, mitad del formulario de Entradas Manuales)
**Alcance:** Formulario de registro manual de entradas de inventario. Reemplaza el placeholder de `app/(panel)/entradas/page.tsx`.

## Contexto

Registra unidades nuevas cuando llegan por vía distinta a la app móvil. A diferencia de Inventario/Movimientos (Sprints 4-5 parte 1), esto es un formulario de **escritura**, no una tabla de lectura — primer formulario del proyecto, primer uso de React Hook Form + Zod + toasts (todos mencionados explícitamente en el documento para este sprint).

## Decisiones de diseño (ya acordadas con el usuario)

- **Campos:** VIN, Marca, Categoría, Cantidad, Valor Unitario, Ubicación, Notas — tal cual el documento. "Notas" mapea a la columna real `motivo` (no hay columna `notas` separada en el schema).
- **Comportamiento en bypass dev:** simula éxito (delay falso + toast) sin persistir en ningún lado — cada pantalla del proyecto usa su propio set de datos independiente, consistente con Inventario/Movimientos/Dashboard.
- **Validación:** React Hook Form + Zod, tal como pide el documento. Nuevas dependencias: `react-hook-form`, `zod`, `@hookform/resolvers`.
- **Toasts:** `sonner` (reemplazo moderno recomendado por shadcn del componente `toast` original, que está deprecado).

## Reglas de validación (Zod)

- `vin`: string, mínimo 5 caracteres (coincide con el `check (length(trim(vin)) >= 5)` real de la tabla `movimientos_inventario`).
- `marca`, `categoria`, `ubicacion`: string, requeridos, mínimo 1 carácter.
- `cantidad`: número, mayor a 0.
- `valor_unitario`: número, mayor o igual a 0 (opcional en el schema real, pero si se ingresa debe ser válido).
- `notas`: string, opcional.

## Arquitectura

Server Action `crearEntrada(datos)` en `lib/supabase/entradas-actions.ts` (`'use server'` a nivel de archivo — mismo patrón/lección de Sprint 4-5). Rama bypass dev: `await new Promise(r => setTimeout(r, 600))` y retorna `{ ok: true }` sin tocar nada. Rama real: `INSERT` en `movimientos_inventario` con `tipo_movimiento: 'entrada'`, `estado: 'aplicado'`, `actor_id` del usuario autenticado (via `getSessionUser()`), y los campos del formulario — `{ error }` chequeado, retorna `{ ok: false, error: string }` en caso de fallo (no lanza excepción, el formulario muestra el error en un toast).

Client Component `EntryForm` usa `useForm` (react-hook-form) + `zodResolver`, shadcn `Form` (nuevo, se instala este sprint junto con `sonner`), llama `crearEntrada` en el submit, muestra toast de éxito o error, resetea el formulario si tuvo éxito, deshabilita el botón de envío mientras está pendiente.

## Tipos y componentes nuevos

- `lib/types/entradas.ts` — `EntradaInput` (schema Zod inferido) y `EntradaResultado` (`{ok: true} | {ok: false, error: string}`).
- `lib/supabase/entradas-actions.ts` — `crearEntrada`.
- `components/entradas/EntryForm.tsx`.
- `app/(panel)/entradas/page.tsx` se reescribe.
- `app/layout.tsx` agrega el `<Toaster />` de sonner (una sola vez, a nivel raíz, para que los toasts de cualquier página del panel funcionen).

## Criterio de aceptación

- Con bypass dev, llenar el formulario con datos válidos y enviarlo muestra un spinner, luego un toast de éxito, y el formulario se limpia.
- Enviar con un campo inválido (ej. VIN de 3 caracteres) muestra el error de validación de Zod sin llamar a la Server Action.
- `npx tsc --noEmit` y `npm run build` sin errores (build obligatorio por la lección de Server Actions).

## Fuera de alcance

- Que la entrada realmente aparezca en Inventario/Movimientos en modo bypass (decisión ya tomada: no).
- Cualquier flujo de aprobación (eso es Ajustes, Sprint 6 — Entradas se aplica directo, sin aprobación, según la matriz de roles del documento).
