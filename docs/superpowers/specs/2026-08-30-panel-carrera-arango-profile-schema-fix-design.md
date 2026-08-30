# Diseño: Corrección de nombres de columna en Profile (nombre/rol vs full_name/role)

**Fecha:** 2026-08-30
**Alcance:** Corrección mecánica de nombres, sin cambio de comportamiento. No es un sprint del documento — es una corrección de deuda técnica descubierta al revisar el schema real.

## Contexto

Sprint 1 (agosto 27) se construyó antes de que existiera ningún schema real de Supabase, así que se asumieron nombres de columna en inglés (`full_name`, `role`) para la tabla `profiles`. El equipo de backend ya pusheó las migraciones reales a `origin/master` (`supabase/migrations/001_create_profiles.sql`), y la tabla real usa:

```sql
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        text not null check (rol in (
                'supervisor','comercial','ingenieria',
                'produccion','compras','auditoria','lectura')),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
```

Los valores del enum `rol` coinciden exactamente con el tipo `Role` ya definido en `lib/types/database.ts` — eso quedó bien. Lo que no coincide son los nombres de columna: `full_name`→`nombre`, `role`→`rol`. `activo` no se usa todavía (queda fuera de alcance, es de Sprint 7).

Corregir esto ahora, antes de Sprint 3, evita arrastrar el nombre incorrecto a más código nuevo.

## Cambio

En `lib/types/database.ts`, la interfaz `Profile` pasa de:

```ts
export interface Profile {
  id: string
  full_name: string | null
  role: Role
}
```

a:

```ts
export interface Profile {
  id: string
  nombre: string | null
  rol: Role
}
```

(El tipo `Role` no cambia — sigue siendo la unión de los 7 valores. Solo cambia el nombre de la propiedad que lo contiene.)

Todo consumidor de `.full_name`/`.role` sobre un `Profile` se actualiza a `.nombre`/`.rol`:

- `lib/supabase/get-current-profile.ts`: la query real cambia de `.select('id, full_name, role')` a `.select('id, nombre, rol')`.
- `lib/dev/preview-bypass.ts`: `getDevPreviewProfile()` retorna `{ id: 'dev-preview-user', nombre: 'Vista Previa Dev', rol }` en vez de `full_name`/`role`.
- `components/shared/RoleGuard.tsx`: `allowed.includes(result.profile.role)` → `allowed.includes(result.profile.rol)`.
- `components/layout/NavUser.tsx`: `getInitials(profile.full_name)` → `getInitials(profile.nombre)`; el texto de rol usa `profile.role` → `profile.rol`.
- `app/(panel)/layout.tsx`: `Sidebar role={result.profile.role}` → `Sidebar role={result.profile.rol}`.
- `app/(panel)/page.tsx`: `Bienvenido, {result.profile.full_name ?? result.user.email}` → `{result.profile.nombre ?? ...}`; `Rol: {result.profile.role}` → `{result.profile.rol}`.

Nota: los props de los componentes (`Sidebar`'s `role: Role`, `RoleGuard`'s `allowed: Role[]`) NO cambian de nombre — siguen siendo `role`/`allowed`, son nombres de prop propios del componente, no columnas de la tabla. Solo cambia dónde se leen los valores del objeto `Profile`.

## Criterio de aceptación

- `npx tsc --noEmit` y `npm run build` sin errores.
- Ningún archivo bajo `app/`, `components/`, `lib/` referencia `full_name` o `.profile.role` después del cambio (grep limpio).
- Con el bypass dev activo, el Dashboard y el Sidebar siguen funcionando igual que antes (mismo comportamiento, nuevos nombres de propiedad).

## Fuera de alcance

- Columna `activo` — no se usa hasta Sprint 7 (gestión de usuarios).
- Cualquier otro ajuste de schema de `movimientos_inventario`/`ajustes_pendientes` — se revisan cuando toque su sprint correspondiente.
