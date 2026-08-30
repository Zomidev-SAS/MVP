# Diseño: Panel Carrera Arango — Sprint 2 (Layout, Navegación y Protección por Rol)

**Fecha:** 2026-08-30
**Fuente:** `Documento_Iniciacion_Frontend_Carrera_Arango.md` (Sprint 2) + mockup visual compartido por el usuario
**Alcance de este spec:** Layout global (Sidebar + Header), RolGuard por ruta con página 403, headers de seguridad HTTP, y un bypass de autenticación solo-para-desarrollo. Contenido real de Inventario/Movimientos/Entradas/Ajustes/Importar CSV/Usuarios queda fuera — placeholders "Próximamente" hasta sus sprints correspondientes (3-6 del documento).

## Contexto

Sprint 1 entregó login funcional, middleware de sesión y un dashboard placeholder mínimo (`app/(panel)/page.tsx`), sin Sidebar ni Header — cada página se renderiza sola dentro de un `<main>` vacío. Este sprint construye el "marco" visual que aparece en todas las pantallas del mockup (sidebar negro navegable, header con usuario/rol/notificaciones) y establece el control de acceso por rol que el resto de sprints reutiliza.

**Restricción vigente:** el proyecto Supabase real todavía no existe (ver spec de Sprint 1). Este sprint agrega un mecanismo de desarrollo — gateado y nunca activable en producción — para poder previsualizar el layout completo y probar el filtrado por rol sin credenciales reales.

## Stack y convenciones heredadas

Next.js 14+ App Router, TypeScript estricto, Tailwind + shadcn/ui, `@supabase/ssr`. Mismas reglas de Sprint 1: toda llamada a Supabase maneja `{ error }` explícitamente, sin `any`, npm como gestor de paquetes.

## Paleta de marca

El logo (`frontend/public/logo.jpeg`, provisto por el usuario) es rojo/negro/blanco. El mockup usa sidebar negro, contenido en fondo claro, rojo como color de acento (botones primarios, ítem de navegación activo, badges de alerta). Se fija este tema único — sin selector claro/oscuro en este sprint (YAGNI, el mockup no lo pide).

Cambios en `app/globals.css` (`:root`, el resto de tokens shadcn ya existentes se mantienen):

```css
--primary: oklch(0.55 0.22 27);          /* rojo marca */
--primary-foreground: oklch(0.985 0 0);  /* blanco */
--sidebar: oklch(0.09 0 0);              /* negro/carbón */
--sidebar-foreground: oklch(0.985 0 0);
--sidebar-primary: oklch(0.55 0.22 27);  /* ítem activo = rojo marca */
--sidebar-primary-foreground: oklch(0.985 0 0);
--sidebar-accent: oklch(0.18 0 0);       /* hover */
--sidebar-accent-foreground: oklch(0.985 0 0);
--sidebar-border: oklch(1 0 0 / 10%);
```

El resto del contenido (`--background`, `--foreground`, `--card`, etc.) permanece en los valores claros ya definidos en Sprint 1 — coincide con el fondo blanco de las pantallas del mockup.

## Matriz de permisos (fuente única de verdad)

`lib/permissions/roles.ts`, usando el tipo `Role` ya definido en `lib/types/database.ts` (`'supervisor' | 'comercial' | 'ingenieria' | 'produccion' | 'compras' | 'auditoria' | 'lectura'`):

```ts
export type RouteKey =
  | 'dashboard'
  | 'inventario'
  | 'movimientos'
  | 'entradas'
  | 'ajustes'
  | 'importar'
  | 'usuarios'

const ALL_ROLES: Role[] = [
  'supervisor', 'comercial', 'ingenieria', 'produccion',
  'compras', 'auditoria', 'lectura',
]

export const ROUTE_PERMISSIONS: Record<RouteKey, Role[]> = {
  dashboard: ALL_ROLES,
  inventario: ALL_ROLES,
  movimientos: ['supervisor', 'ingenieria', 'auditoria'],
  entradas: ['supervisor', 'produccion', 'compras'],
  ajustes: ['supervisor', 'produccion', 'compras'],
  importar: ['supervisor', 'compras'],
  usuarios: ['supervisor'],
}

export const NAV_ITEMS: { key: RouteKey; label: string; href: string; icon: LucideIcon }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'inventario', label: 'Inventario', href: '/inventario', icon: Package },
  { key: 'movimientos', label: 'Movimientos', href: '/movimientos', icon: ArrowLeftRight },
  { key: 'entradas', label: 'Entradas', href: '/entradas', icon: FilePlus },
  { key: 'ajustes', label: 'Ajustes', href: '/ajustes', icon: SlidersHorizontal },
  { key: 'importar', label: 'Importar CSV', href: '/importar', icon: Upload },
  { key: 'usuarios', label: 'Usuarios', href: '/usuarios', icon: Users },
]
```

Copiado directamente de la tabla de matriz de roles del documento (sección 3). `NAV_ITEMS` es la lista que recorre el Sidebar para renderizar (y filtrar) los links; `ROUTE_PERMISSIONS` es lo que usa `RoleGuard` en cada página.

## Bypass de autenticación para desarrollo

`lib/dev/preview-bypass.ts`:

```ts
import type { User } from '@supabase/supabase-js'
import type { Profile, Role } from '@/lib/types/database'

const VALID_ROLES: Role[] = [
  'supervisor', 'comercial', 'ingenieria', 'produccion',
  'compras', 'auditoria', 'lectura',
]

export function isDevBypassActive(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true'
}

export function getDevPreviewUser(): User {
  // Objeto User completo con valores placeholder — evita `any`.
  return {
    id: 'dev-preview-user',
    email: 'dev@carreraarango.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User
}

export function getDevPreviewProfile(): Profile {
  const envRole = process.env.DEV_SKIP_AUTH_ROLE
  const role: Role = VALID_ROLES.includes(envRole as Role) ? (envRole as Role) : 'supervisor'
  return { id: 'dev-preview-user', full_name: 'Vista Previa Dev', role }
}
```

Nota de implementación: `User` de `@supabase/supabase-js` tiene más campos opcionales que los listados; se construye el objeto con los campos usados por el resto del código (`id`, `email`) y se completa con `as User` solo para los campos restantes — no es un `any`, es una aserción de tipo sobre un objeto ya parcialmente tipado. Si TypeScript exige más campos obligatorios, se agregan con valores vacíos razonables en vez de ampliar la aserción.

Puntos de integración (dos, ambos ya existentes de Sprint 1):
- `middleware.ts`: si `isDevBypassActive()`, `return NextResponse.next()` antes de tocar Supabase.
- `lib/supabase/get-session-user.ts`: si `isDevBypassActive()`, retorna `getDevPreviewUser()` sin llamar a Supabase.

`.env.example` documenta las dos variables como comentario (sin valor, para que el equipo sepa que existen):

```
# Desarrollo local únicamente. Nunca se activa en producción (NODE_ENV check).
# DEV_SKIP_AUTH=true
# DEV_SKIP_AUTH_ROLE=supervisor
```

**Uso:** el desarrollador agrega ambas líneas (sin `#`) a su `.env.local` (gitignored), reinicia `npm run dev` (Next no recarga `.env.local` en caliente) y entra sin login, viendo el panel como el rol elegido.

## Helper de perfil compartido

`lib/supabase/get-current-profile.ts` reemplaza la consulta ad-hoc que hoy vive dentro de `app/(panel)/page.tsx`, y es el único lugar que conoce el bypass de desarrollo:

```ts
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive, getDevPreviewProfile } from '@/lib/dev/preview-bypass'
import type { Profile } from '@/lib/types/database'

export const getCurrentProfile = cache(async (): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>; profile: Profile } | null
> => {
  if (isDevBypassActive()) {
    const user = (await getSessionUser())! // dev bypass ya hace que esto no sea null
    return { user, profile: getDevPreviewProfile() }
  }

  const user = await getSessionUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single<Profile>()

  if (error || !profile) {
    console.error('Failed to load profile:', error)
    return null
  }

  return { user, profile }
})
```

Envuelto en `cache()` de React: dentro de una misma request, `(panel)/layout.tsx` y el `RoleGuard` de la página pueden llamarlo ambos sin duplicar la consulta a Supabase.

## Componentes de layout

- **`components/layout/Sidebar.tsx`** (Client Component): recibe `role: Role` como prop. Filtra `NAV_ITEMS` por `ROUTE_PERMISSIONS[item.key].includes(role)`, renderiza logo (`next/image` con `frontend/public/logo.jpeg`) arriba, links con ícono de `lucide-react` en el medio, resalta el link activo comparando `usePathname()` con `item.href`.
- **`components/layout/Header.tsx`**: barra superior con ícono de campana (`Bell`, estático — sin datos reales todavía, eso es Sprint 6) y `<NavUser>`.
- **`components/layout/NavUser.tsx`** (Client Component): recibe `profile: Profile`. Avatar con iniciales de `full_name`, nombre + rol, dropdown (shadcn `DropdownMenu` — se agrega vía `npx shadcn add dropdown-menu avatar`) con `<LogoutButton>` adentro.
- **`components/layout/LogoutButton.tsx`** (Client Component): botón que llama `createClient().auth.signOut()` (cliente browser) y luego `router.push('/login')` + `router.refresh()`.

`app/(panel)/layout.tsx` pasa a:

```tsx
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentProfile()

  if (!result) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={result.profile.role} />
      <div className="flex flex-1 flex-col">
        <Header profile={result.profile} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

## RoleGuard y página 403

`components/shared/RoleGuard.tsx` (Server Component):

```tsx
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import type { Role } from '@/lib/types/database'

export async function RoleGuard({
  allowed,
  children,
}: {
  allowed: Role[]
  children: React.ReactNode
}) {
  const result = await getCurrentProfile()

  if (!result || !allowed.includes(result.profile.role)) {
    redirect('/acceso-denegado')
  }

  return <>{children}</>
}
```

`app/acceso-denegado/page.tsx`: página standalone (fuera de `(panel)`, sin Sidebar/Header — si no tenés permiso para una sección no tiene sentido mostrarte la navegación completa), mensaje centrado "Acceso denegado" + botón para volver al Dashboard. Sigue protegida por el middleware (requiere sesión — solo usuarios logueados con rol incorrecto llegan acá, nunca anónimos).

Cada página bajo `(panel)/` se envuelve así (ejemplo Inventario):

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function InventarioPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.inventario}>
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold">Inventario</h1>
        <p className="mt-2 text-muted-foreground">Próximamente.</p>
      </div>
    </RoleGuard>
  )
}
```

Mismo patrón para `movimientos`, `entradas`, `ajustes`, `importar`, `usuarios`. El dashboard existente (`app/(panel)/page.tsx`) se envuelve igual con `ROUTE_PERMISSIONS.dashboard` y su fetch de perfil ad-hoc se reemplaza por `getCurrentProfile()` (ya lo tiene disponible vía el `RoleGuard`/layout, elimina la consulta Supabase duplicada que señaló el review final de Sprint 1).

## Headers de seguridad

`next.config.ts`, agregando `headers()`:

```ts
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Content-Security-Policy',
          value:
            "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
        },
      ],
    },
  ]
}
```

(HSTS se agrega en Nginx en Sprint 8, no aplica en dev local sobre HTTP.)

## Criterios de aceptación

- Con `DEV_SKIP_AUTH=true` y `DEV_SKIP_AUTH_ROLE=<rol>`, el Sidebar muestra solo los links permitidos para ese rol, coincidiendo exactamente con la matriz del documento.
- Navegar manualmente (escribir la URL) a una sección no permitida para el rol activo redirige a `/acceso-denegado`.
- `DEV_SKIP_AUTH` sin definir (o `NODE_ENV=production`) se comporta exactamente como Sprint 1 — login real requerido, sin bypass posible.
- `npx tsc --noEmit` y `npm run build` sin errores.
- Headers de seguridad presentes en la respuesta (verificable con `curl -I` en dev, o `securityheaders.com` en producción — Sprint 8).

## Fuera de alcance (explícito)

- Contenido real de Inventario/Movimientos/Entradas/Ajustes/Importar CSV/Usuarios — Sprints 3-6.
- Badge de notificación por ajustes pendientes en el Sidebar — Sprint 6 (requiere datos reales de Supabase).
- Selector de tema claro/oscuro.
- Credenciales Supabase reales — sigue pendiente de que el usuario cree el proyecto.
