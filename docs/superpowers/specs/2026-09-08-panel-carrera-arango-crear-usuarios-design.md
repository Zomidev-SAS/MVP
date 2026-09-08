# Diseño: Panel Carrera Arango — Crear usuarios (Sprint 7, extensión)

**Fecha:** 2026-09-08
**Fuente:** Petición directa del usuario, extensión de Sprint 7 (Gestión de Usuarios, ya implementado — cambiar rol y activar/desactivar). El spec original de Sprint 7 dejó explícitamente "crear usuarios nuevos" fuera de alcance porque requiere la Admin API de Supabase Auth. Este spec cubre esa pieza.

**Alcance:** El supervisor puede agregar un usuario nuevo desde `/usuarios` — nombre, correo, contraseña, rol — sin necesidad de que el usuario se registre por su cuenta.

## Decisiones de diseño

- **Arquitectura:** crear un usuario de Auth con contraseña asignada por otro usuario (no auto-registro) requiere `supabase.auth.admin.createUser()`, que exige el `service_role` key de Supabase. Ese key NUNCA debe vivir en el frontend (control total sobre todas las cuentas). Se usa el mismo patrón ya establecido para `aprobar-ajuste` (Sprint 6): una Edge Function (`crear-usuario`) que vive en el backend, con el service role key ahí, invocada desde el frontend vía `supabase.functions.invoke('crear-usuario', {...})`. La función no existe todavía — el código del frontend queda correcto y listo para cuando el equipo de backend la implemente, igual que `aprobar-ajuste`.
- **Contrato de la Edge Function (para el equipo de backend):** recibe `{ nombre: string, email: string, password: string, rol: Role }`. Internamente: `supabase.auth.admin.createUser({ email, password, email_confirm: true })`, luego `insert` en `profiles` con `{ id: <id del usuario creado>, nombre, rol, activo: true }`. Responde error si el email ya existe o si la creación falla.
- **Formulario:** Dialog (mismo patrón que `AdjustmentForm`/`EntryForm`, RHF+Zod) con botón "+ Agregar usuario" en la página de Usuarios. Campos: nombre (requerido), email (formato válido), contraseña (mínimo 8 caracteres), rol (`<select>` con `ALL_ROLES`, igual que el `<select>` de cambio de rol ya existente en `UsersTable`).
- **Quién asigna la contraseña:** el supervisor la escribe directamente en el formulario (no se genera automáticamente, no hay flujo de "invitación por correo" en esta versión).
- **Bypass dev:** simula éxito con un delay falso, sin persistir — mismo criterio que el resto del proyecto (`solicitarAjuste`, `crearEntrada`, `crearEvento`). La tabla de usuarios de ejemplo no se actualiza con el usuario simulado, ya que el generador de datos de ejemplo es estático.
- **Sin reenvío de contraseña ni "olvidé mi contraseña" real todavía** — fuera de alcance, ya lo estaba desde el login (Sprint 1).

## Arquitectura

- `lib/types/usuarios.ts` se extiende: `crearUsuarioSchema` (Zod: `nombre` mínimo 1 carácter, `email` formato válido, `password` mínimo 8 caracteres, `rol` uno de `ALL_ROLES`), `CrearUsuarioInput` (`z.infer`).
- `lib/supabase/usuarios-actions.ts` se extiende: `crearUsuario(datos: CrearUsuarioInput): Promise<UsuarioResultado>` — valida con Zod, bypass dev simula éxito, rama real invoca `supabase.functions.invoke('crear-usuario', { body: datos })` y revisa `{ error }`.
- `components/usuarios/CreateUserDialog.tsx` (Client Component nuevo): botón "+ Agregar usuario" + `Dialog` con el formulario RHF+Zod. Al enviar llama `crearUsuario`, toast de éxito/error, cierra el diálogo y limpia el formulario al terminar.
- `app/(panel)/usuarios/page.tsx` se modifica: agrega `<CreateUserDialog />` junto al encabezado, antes de `<UsersTable />`.

## Criterio de aceptación

- Con bypass dev, llenar el formulario con datos válidos y enviarlo muestra un spinner, luego un toast de éxito, y el diálogo se cierra.
- Enviar con un campo inválido (ej. contraseña de 4 caracteres, email mal formado) muestra el error de validación de Zod sin llamar a la Server Action.
- `npx tsc --noEmit` y `npm run build` sin errores (build obligatorio: `CreateUserDialog` es Client Component que importa la Server Action directamente).

## Fuera de alcance

- La Edge Function `crear-usuario` en sí (responsabilidad del equipo de backend, mismo criterio que `aprobar-ajuste`).
- Generación automática de contraseña, invitación por correo, verificación de email.
- Editar/eliminar usuarios existentes más allá de lo que ya hace `UsersTable` (rol, activo/inactivo).
