# Diseño: Panel Carrera Arango — Sprint 7 (Gestión de Usuarios)

**Fecha:** 2026-09-07
**Fuente:** El documento original ya no está en disco — diseño reconstruido a partir de los patrones ya establecidos y del schema real de `profiles` conocido (id, nombre, rol, activo, created_at).
**Alcance:** Reemplazar el placeholder de `/usuarios` (permitido solo a `supervisor`, ya en `ROUTE_PERMISSIONS.usuarios`) por una tabla de administración: ver todos los usuarios, cambiar su rol, activar/desactivar su cuenta.

## Decisiones de diseño

- **Sin creación de usuarios:** crear una cuenta nueva requiere la Admin API de Supabase Auth (service role key), que no debe vivir en el frontend. Se documenta como fuera de alcance — el alta de usuarios es responsabilidad del backend/infra.
- **Cambiar rol:** un `<select>` nativo por fila con las 7 opciones de `Role` (`lib/types/database.ts`, ya existente). Al cambiar, se llama la Server Action de inmediato (sin botón de confirmar aparte) — es un panel de administración de bajo volumen, no un formulario largo.
- **Activar/Desactivar:** un botón por fila que alterna `activo`. Sin diálogo de confirmación — mismo criterio de simplicidad.
- **Sin guarda de auto-bloqueo:** un supervisor podría cambiarse su propio rol o desactivarse a sí mismo sin que la UI lo impida. Decisión consciente de v1 (documentada, no un descuido) — se puede agregar después si se vuelve un problema real.
- **Tipos propios, no se toca el `Profile` compartido:** `lib/types/database.ts`'s `Profile` (`{id, nombre, rol}`) lo usa el resto de la app (Sidebar, RoleGuard, sesión actual) y no incluye `activo`/`created_at`. Se define un tipo nuevo `UsuarioListado` específico de esta página en vez de extender el compartido, para no arriesgar esos otros consumidores.

## Arquitectura

- `lib/types/usuarios.ts` — `UsuarioListado` (`{id, nombre: string|null, rol: Role, activo: boolean, created_at: string}`), `UsuarioResultado` (`{ok:true} | {ok:false, error:string}`).
- `lib/dev/preview-usuarios-data.ts` — ~6 filas de ejemplo, roles distintos, mezcla de activo/inactivo.
- `lib/supabase/usuarios-actions.ts` (`'use server'` a nivel de archivo):
  - `fetchUsuarios(): Promise<UsuarioListado[]>` — bypass dev: datos de ejemplo. Real: `select id, nombre, rol, activo, created_at` de `profiles`, orden por `created_at asc`.
  - `actualizarRolUsuario(id: string, rol: Role): Promise<UsuarioResultado>` — real: `update profiles set rol` donde `id = id`.
  - `actualizarEstadoUsuario(id: string, activo: boolean): Promise<UsuarioResultado>` — real: `update profiles set activo` donde `id = id`.
- `components/usuarios/UsersTable.tsx` (Client Component): fetch al montar (mismo patrón que `AdjustmentApproval`), tabla con `<select>` de rol y botón de activar/desactivar por fila, toast por acción, actualiza el estado local optimistamente tras cada éxito.
- `app/(panel)/usuarios/page.tsx` se reescribe: `RoleGuard` (sin cambios) + `<UsersTable />`.

## Criterio de aceptación

- Con bypass dev, la tabla muestra las ~6 filas de ejemplo con su rol y estado.
- Cambiar el rol de una fila en el `<select>` muestra un toast de éxito y refleja el nuevo rol sin recargar.
- Alternar el estado de una fila muestra un toast y actualiza el botón/etiqueta sin recargar.
- `npx tsc --noEmit` y `npm run build` sin errores (build obligatorio: `UsersTable` es Client Component que importa las Server Actions directamente).

## Fuera de alcance

- Crear usuarios nuevos (Admin API de Supabase Auth).
- Guardas de auto-bloqueo (supervisor cambiándose su propio rol/estado).
- Confirmaciones/diálogos antes de aplicar un cambio.
