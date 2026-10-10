# Panel Carrera Arango — Sprint 2 (Layout, Role Nav, Dev Preview) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Sidebar/Header shell that wraps every protected page, enforce the role permission matrix via a `RoleGuard` + 403 page, add security headers, and wire a `NODE_ENV`-gated dev-only auth bypass so the whole layout is previewable per-role before a real Supabase project exists.

**Architecture:** `lib/permissions/roles.ts` is the single source of truth for which roles see which nav items/routes — both the `Sidebar` (hides links) and `RoleGuard` (blocks direct URL access) read from it. A new `getCurrentProfile()` helper (wrapped in React's `cache()`) centralizes the user+profile lookup so `(panel)/layout.tsx` and each page's `RoleGuard` share one Supabase query per request. The dev bypass (`lib/dev/preview-bypass.ts`) hooks into exactly two existing Sprint 1 files (`middleware.ts`, `get-session-user.ts`) and is inert unless both `NODE_ENV !== 'production'` and `DEV_SKIP_AUTH=true` are set.

**Tech Stack:** Next.js 14+ App Router, TypeScript, Tailwind, shadcn/ui (adds `dropdown-menu`, `avatar`), `lucide-react` (already installed), `@supabase/ssr`.

## Global Constraints

- TypeScript `strict: true`, no `any` anywhere (the one intentional exception: `getDevPreviewUser()`'s `as User` cast, documented inline — this is a type assertion on a partially-typed object literal, not a bare `any`).
- Every Supabase call destructures and checks `{ error }`, or wraps in try/catch — never ignored silently.
- npm only (no yarn/pnpm lockfiles).
- Dev bypass gating is exact: `process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true'`. Both conditions required, in every place the bypass is checked.
- Role values (from `lib/types/database.ts`, already defined in Sprint 1 — do not redefine): `'supervisor' | 'comercial' | 'ingenieria' | 'produccion' | 'compras' | 'auditoria' | 'lectura'`.
- Permission matrix (verbatim from the source document's role matrix — copy exactly, do not alter):
  - `dashboard`, `inventario`: all 7 roles
  - `movimientos`: `supervisor`, `ingenieria`, `auditoria`
  - `entradas`, `ajustes`: `supervisor`, `produccion`, `compras`
  - `importar`: `supervisor`, `compras`
  - `usuarios`: `supervisor` only
- Brand color tokens (exact values, `frontend/app/globals.css` `:root`):
  ```
  --primary: oklch(0.55 0.22 27);
  --primary-foreground: oklch(0.985 0 0);
  --sidebar: oklch(0.09 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.55 0.22 27);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.18 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  ```
- All commands run with `frontend/` as the working directory (repo root also has `docs/`).

---

### Task 1: Security headers

**Files:**
- Modify: `frontend/next.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing later tasks import — this is a standalone config change.

- [ ] **Step 1: Read the current file**

Read `frontend/next.config.ts` to see its exact current contents before editing (it currently only has the base `NextConfig` export from Sprint 1 scaffold).

- [ ] **Step 2: Add the `headers()` function**

Add a `headers` async function to the exported config object (keep whatever config keys already exist, add `headers` alongside them):

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
},
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Verify headers are served**

Run: `npm run dev` (background), then:

```bash
curl -sI http://localhost:3000/login | grep -i "x-frame-options\|x-content-type-options\|referrer-policy\|content-security-policy"
```

Expected: all four headers present in the output. Stop the dev server after.

- [ ] **Step 5: Commit**

```bash
git add next.config.ts
git commit -m "feat: add HTTP security headers"
```

---

### Task 2: Brand theme tokens + logo asset

**Files:**
- Modify: `frontend/app/globals.css`
- Create: `frontend/public/logo.jpeg` (copy from `D:\DESCARGAS\CARRERAARANGO_LOGO.jpeg`)

**Interfaces:**
- Consumes: nothing.
- Produces: the `--primary`, `--sidebar*` CSS custom properties that `Sidebar` (Task 10) reads via Tailwind's `bg-sidebar`, `text-sidebar-foreground`, etc. classes; the `/logo.jpeg` public path that `Sidebar` (Task 10) references in an `<Image>`.

- [ ] **Step 1: Copy the logo file**

```bash
cp "/d/DESCARGAS/CARRERAARANGO_LOGO.jpeg" "frontend/public/logo.jpeg"
```

- [ ] **Step 2: Update the brand tokens in `:root`**

Open `frontend/app/globals.css`. In the `:root { ... }` block (added in Sprint 1's shadcn init), replace these existing lines:

```css
--primary: oklch(0.205 0 0);
--primary-foreground: oklch(0.985 0 0);
```

with:

```css
--primary: oklch(0.55 0.22 27);
--primary-foreground: oklch(0.985 0 0);
```

And replace these existing lines:

```css
--sidebar: oklch(0.985 0 0);
--sidebar-foreground: oklch(0.145 0 0);
--sidebar-primary: oklch(0.205 0 0);
--sidebar-primary-foreground: oklch(0.985 0 0);
--sidebar-accent: oklch(0.97 0 0);
--sidebar-accent-foreground: oklch(0.205 0 0);
--sidebar-border: oklch(0.922 0 0);
--sidebar-ring: oklch(0.708 0 0);
```

with:

```css
--sidebar: oklch(0.09 0 0);
--sidebar-foreground: oklch(0.985 0 0);
--sidebar-primary: oklch(0.55 0.22 27);
--sidebar-primary-foreground: oklch(0.985 0 0);
--sidebar-accent: oklch(0.18 0 0);
--sidebar-accent-foreground: oklch(0.985 0 0);
--sidebar-border: oklch(1 0 0 / 10%);
--sidebar-ring: oklch(0.708 0 0);
```

Leave the `.dark { ... }` block and every other `:root` token untouched — this app uses a single fixed theme, `.dark` is dead code left over from the shadcn template (not in scope to remove this sprint).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exit code 0, no errors. (CSS custom property changes aren't type-checked by `tsc`, so the build is the real verification here.)

- [ ] **Step 4: Commit**

```bash
git add app/globals.css public/logo.jpeg
git commit -m "feat: set brand color tokens and add logo asset"
```

---

### Task 3: Permission matrix module

**Files:**
- Create: `frontend/lib/permissions/roles.ts`

**Interfaces:**
- Consumes: `Role` type from `@/lib/types/database` (Sprint 1).
- Produces: `RouteKey` type, `ROUTE_PERMISSIONS: Record<RouteKey, Role[]>`, `NAV_ITEMS: { key: RouteKey; label: string; href: string; icon: LucideIcon }[]` — all exported from `@/lib/permissions/roles`. Task 6 (RoleGuard consumers) imports `ROUTE_PERMISSIONS`; Task 10 (Sidebar) imports both `ROUTE_PERMISSIONS` and `NAV_ITEMS`.

- [ ] **Step 1: Create the file**

Create `frontend/lib/permissions/roles.ts`:

```ts
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  FilePlus,
  SlidersHorizontal,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/lib/types/database'

export type RouteKey =
  | 'dashboard'
  | 'inventario'
  | 'movimientos'
  | 'entradas'
  | 'ajustes'
  | 'importar'
  | 'usuarios'

const ALL_ROLES: Role[] = [
  'supervisor',
  'comercial',
  'ingenieria',
  'produccion',
  'compras',
  'auditoria',
  'lectura',
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

export const NAV_ITEMS: {
  key: RouteKey
  label: string
  href: string
  icon: LucideIcon
}[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'inventario', label: 'Inventario', href: '/inventario', icon: Package },
  { key: 'movimientos', label: 'Movimientos', href: '/movimientos', icon: ArrowLeftRight },
  { key: 'entradas', label: 'Entradas', href: '/entradas', icon: FilePlus },
  { key: 'ajustes', label: 'Ajustes', href: '/ajustes', icon: SlidersHorizontal },
  { key: 'importar', label: 'Importar CSV', href: '/importar', icon: Upload },
  { key: 'usuarios', label: 'Usuarios', href: '/usuarios', icon: Users },
]
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add lib/permissions/roles.ts
git commit -m "feat: add role permission matrix and nav item list"
```

---

### Task 4: Dev preview bypass module

**Files:**
- Create: `frontend/lib/dev/preview-bypass.ts`
- Modify: `frontend/.env.example`

**Interfaces:**
- Consumes: `Profile`, `Role` types from `@/lib/types/database` (Sprint 1); `User` type from `@supabase/supabase-js`.
- Produces: `isDevBypassActive(): boolean`, `getDevPreviewUser(): User`, `getDevPreviewProfile(): Profile` — all exported from `@/lib/dev/preview-bypass`. Task 5 imports `isDevBypassActive` and `getDevPreviewUser`. Task 6 imports `isDevBypassActive` and `getDevPreviewProfile`.

- [ ] **Step 1: Create the bypass module**

Create `frontend/lib/dev/preview-bypass.ts`:

```ts
import type { User } from '@supabase/supabase-js'
import type { Profile, Role } from '@/lib/types/database'

const VALID_ROLES: Role[] = [
  'supervisor',
  'comercial',
  'ingenieria',
  'produccion',
  'compras',
  'auditoria',
  'lectura',
]

export function isDevBypassActive(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true'
}

export function getDevPreviewUser(): User {
  // Minimal fields the rest of the app actually reads (id, email), completed
  // with placeholder values for the remaining required Supabase User fields.
  // This is a type assertion on an already-typed literal, not a bare `any`.
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

- [ ] **Step 2: Document the dev vars in `.env.example`**

Append to `frontend/.env.example`:

```
# Desarrollo local únicamente. Nunca se activa en producción (NODE_ENV check).
# DEV_SKIP_AUTH=true
# DEV_SKIP_AUTH_ROLE=supervisor
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add lib/dev/preview-bypass.ts .env.example
git commit -m "feat: add NODE_ENV-gated dev auth bypass module"
```

---

### Task 5: Wire dev bypass into middleware and session lookup

**Files:**
- Modify: `frontend/middleware.ts`
- Modify: `frontend/lib/supabase/get-session-user.ts`

**Interfaces:**
- Consumes: `isDevBypassActive`, `getDevPreviewUser` from `@/lib/dev/preview-bypass` (Task 4).
- Produces: when the bypass is active, `getSessionUser()` (existing Sprint 1 export, same signature) returns `getDevPreviewUser()` instead of hitting Supabase, and `middleware.ts` lets every request through unconditionally. Task 6 relies on `getSessionUser()` already returning the fake user so it only needs to fake the *profile*.

- [ ] **Step 1: Add the bypass check to `middleware.ts`**

Open `frontend/middleware.ts`. Add the import at the top:

```ts
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
```

Add this as the very first line inside the `middleware` function body (before `let supabaseResponse = ...`):

```ts
if (isDevBypassActive()) {
  return NextResponse.next()
}
```

- [ ] **Step 2: Add the bypass check to `get-session-user.ts`**

Open `frontend/lib/supabase/get-session-user.ts`. Add the import:

```ts
import { isDevBypassActive, getDevPreviewUser } from '@/lib/dev/preview-bypass'
```

Add this as the first lines inside `getSessionUser`, before `const supabase = await createClient()`:

```ts
if (isDevBypassActive()) {
  return getDevPreviewUser()
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Verify the bypass actually bypasses**

Add to `frontend/.env.local` (create the file if it doesn't have these lines yet — it already has placeholder `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` from Sprint 1):

```
DEV_SKIP_AUTH=true
DEV_SKIP_AUTH_ROLE=supervisor
```

Run: `npm run dev` (background — must be a fresh start, Next does not hot-reload `.env.local` changes), then:

```bash
curl -sI http://localhost:3000/
```

Expected: `200 OK`, NOT a redirect to `/login` (there is no Sidebar/Header yet, so this just proves the redirect chain from Sprint 1 no longer fires — the page itself may render a plain placeholder). Stop the dev server after.

Then verify the bypass is inert without the flag: comment out (or remove) the two `DEV_SKIP_AUTH*` lines from `.env.local`, restart `npm run dev`, run the same curl — expect a `307`/`308` redirect to `/login` again (Sprint 1 behavior restored). Add the two lines back to `.env.local` for the remaining tasks in this plan (later tasks rely on the bypass to verify role filtering).

- [ ] **Step 5: Commit**

```bash
git add middleware.ts lib/supabase/get-session-user.ts
git commit -m "feat: wire dev bypass into middleware and session lookup"
```

---

### Task 6: Shared profile helper, RoleGuard, and 403 page

**Files:**
- Create: `frontend/lib/supabase/get-current-profile.ts`
- Create: `frontend/components/shared/RoleGuard.tsx`
- Create: `frontend/app/acceso-denegado/page.tsx`

**Interfaces:**
- Consumes: `getSessionUser` from `@/lib/supabase/get-session-user` (Sprint 1 + Task 5); `createClient` from `@/lib/supabase/server` (Sprint 1); `isDevBypassActive`, `getDevPreviewProfile` from `@/lib/dev/preview-bypass` (Task 4); `Profile` from `@/lib/types/database` (Sprint 1); `Role` from `@/lib/types/database`; `Button` from `@/components/ui/button` (Sprint 1).
- Produces: `getCurrentProfile(): Promise<{ user: User; profile: Profile } | null>` (React-`cache()`-wrapped) from `@/lib/supabase/get-current-profile` — Task 7, Task 9 (via NavUser's caller), Task 11, Task 12 all call this. `RoleGuard` component from `@/components/shared/RoleGuard`, props `{ allowed: Role[]; children: React.ReactNode }` — Task 7 and Task 12 wrap their page content with it. The `/acceso-denegado` route that `RoleGuard` redirects to.

- [ ] **Step 1: Create the shared profile helper**

Create `frontend/lib/supabase/get-current-profile.ts`:

```ts
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive, getDevPreviewProfile } from '@/lib/dev/preview-bypass'
import type { Profile } from '@/lib/types/database'

export const getCurrentProfile = cache(async () => {
  const user = await getSessionUser()
  if (!user) return null

  if (isDevBypassActive()) {
    return { user, profile: getDevPreviewProfile() }
  }

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

- [ ] **Step 2: Create `RoleGuard`**

Create `frontend/components/shared/RoleGuard.tsx`:

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

- [ ] **Step 3: Create the 403 page**

Create `frontend/app/acceso-denegado/page.tsx`:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AccesoDenegadoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center text-foreground">
      <h1 className="text-3xl font-bold">Acceso denegado</h1>
      <p className="text-muted-foreground">
        Tu rol no tiene permiso para ver esta sección.
      </p>
      <Button asChild>
        <Link href="/">Volver al Dashboard</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Verify the 403 page renders**

Run: `npm run dev` (background), then:

```bash
curl -s http://localhost:3000/acceso-denegado | grep -o "Acceso denegado"
```

Expected: prints `Acceso denegado`. Stop the dev server after.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/get-current-profile.ts components/shared/RoleGuard.tsx "app/acceso-denegado/page.tsx"
git commit -m "feat: add shared profile helper, RoleGuard, and 403 page"
```

---

### Task 7: Wrap the dashboard page with RoleGuard and the shared profile helper

**Files:**
- Modify: `frontend/app/(panel)/page.tsx`

**Interfaces:**
- Consumes: `RoleGuard` from `@/components/shared/RoleGuard` (Task 6); `ROUTE_PERMISSIONS` from `@/lib/permissions/roles` (Task 3); `getCurrentProfile` from `@/lib/supabase/get-current-profile` (Task 6).
- Produces: nothing new — this replaces the page's Sprint-1 direct Supabase query with the shared helper.

- [ ] **Step 1: Replace the page's content**

Replace the full contents of `frontend/app/(panel)/page.tsx` with:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'

export default function DashboardPlaceholderPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.dashboard}>
      <DashboardContent />
    </RoleGuard>
  )
}

async function DashboardContent() {
  const result = await getCurrentProfile()

  if (!result) {
    // Unreachable in practice — RoleGuard already redirected before this
    // renders if there's no session. Guards against the type being nullable.
    return null
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Bienvenido, {result.profile.full_name ?? result.user.email}
      </h1>
      <p className="text-muted-foreground">Rol: {result.profile.role}</p>
    </div>
  )
}
```

This removes the page's old direct `supabase.from('profiles')` query (now centralized in `getCurrentProfile`) and its old `getSessionUser`/`redirect` guard (now handled by `RoleGuard`). Because `getCurrentProfile` is wrapped in React's `cache()`, `RoleGuard`'s call and `DashboardContent`'s call within the same request hit Supabase only once.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Verify it renders with the dev bypass**

Confirm `frontend/.env.local` still has `DEV_SKIP_AUTH=true` and `DEV_SKIP_AUTH_ROLE=supervisor` (from Task 5). Run: `npm run dev` (background), then:

```bash
curl -s http://localhost:3000/ | grep -o "Vista Previa Dev"
```

Expected: prints `Vista Previa Dev` (the dev-bypass profile's `full_name`). Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add "app/(panel)/page.tsx"
git commit -m "feat: wrap dashboard page with RoleGuard and shared profile helper"
```

---

### Task 8: Install shadcn dropdown-menu and avatar components

**Files:**
- Create: `frontend/components/ui/dropdown-menu.tsx`
- Create: `frontend/components/ui/avatar.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` from `@/components/ui/dropdown-menu`; `Avatar`, `AvatarFallback` from `@/components/ui/avatar`. Task 9 imports both sets by these exact names.

- [ ] **Step 1: Install the components**

Run:

```bash
npx shadcn@latest add dropdown-menu avatar -y
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. Confirm `components/ui/dropdown-menu.tsx` and `components/ui/avatar.tsx` now exist and export the names listed above (open the files and check their `export` statements).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: install shadcn dropdown-menu and avatar components"
```

---

### Task 9: LogoutButton and NavUser components

**Files:**
- Create: `frontend/components/layout/LogoutButton.tsx`
- Create: `frontend/components/layout/NavUser.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client` (Sprint 1); `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` from `@/components/ui/dropdown-menu` (Task 8); `Avatar`, `AvatarFallback` from `@/components/ui/avatar` (Task 8); `Profile` from `@/lib/types/database` (Sprint 1).
- Produces: `LogoutButton` component (no props) from `@/components/layout/LogoutButton`; `NavUser` component, props `{ profile: Profile }`, from `@/components/layout/NavUser`. Task 10 imports `NavUser` by this exact name and prop shape.

- [ ] **Step 1: Create `LogoutButton`**

Create `frontend/components/layout/LogoutButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="flex w-full items-center gap-2 text-left text-sm text-destructive"
    >
      <LogOut className="h-4 w-4" />
      {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
    </button>
  )
}
```

- [ ] **Step 2: Create `NavUser`**

Create `frontend/components/layout/NavUser.tsx`:

```tsx
'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { ChevronDown } from 'lucide-react'
import type { Profile } from '@/lib/types/database'

function getInitials(name: string | null): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts[1]?.[0] ?? ''
  return (first + second).toUpperCase()
}

export function NavUser({ profile }: { profile: Profile }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
        </Avatar>
        <div className="text-left text-sm">
          <p className="font-medium leading-none">{profile.full_name ?? 'Usuario'}</p>
          <p className="text-xs capitalize text-muted-foreground">{profile.role}</p>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <LogoutButton />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add components/layout/LogoutButton.tsx components/layout/NavUser.tsx
git commit -m "feat: add LogoutButton and NavUser components"
```

---

### Task 10: Sidebar and Header components

**Files:**
- Create: `frontend/components/layout/Sidebar.tsx`
- Create: `frontend/components/layout/Header.tsx`

**Interfaces:**
- Consumes: `NAV_ITEMS`, `ROUTE_PERMISSIONS` from `@/lib/permissions/roles` (Task 3); `Role`, `Profile` from `@/lib/types/database` (Sprint 1); `cn` from `@/lib/utils` (Sprint 1); `NavUser` from `@/components/layout/NavUser` (Task 9).
- Produces: `Sidebar` component, props `{ role: Role }`, from `@/components/layout/Sidebar`; `Header` component, props `{ profile: Profile }`, from `@/components/layout/Header`. Task 11 imports both by these exact names and prop shapes.

- [ ] **Step 1: Create `Sidebar`**

Create `frontend/components/layout/Sidebar.tsx`:

```tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import type { Role } from '@/lib/types/database'
import { cn } from '@/lib/utils'

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => ROUTE_PERMISSIONS[item.key].includes(role))

  return (
    <aside className="flex w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-center border-b border-sidebar-border p-4">
        <Image
          src="/logo.jpeg"
          alt="Carrera Arango"
          width={140}
          height={80}
          className="h-auto w-full max-w-[140px]"
        />
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create `Header`**

Create `frontend/components/layout/Header.tsx`:

```tsx
import { Bell } from 'lucide-react'
import { NavUser } from '@/components/layout/NavUser'
import type { Profile } from '@/lib/types/database'

export function Header({ profile }: { profile: Profile }) {
  return (
    <header className="flex items-center justify-end gap-4 border-b border-border bg-card px-6 py-3">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
      </button>
      <NavUser profile={profile} />
    </header>
  )
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx components/layout/Header.tsx
git commit -m "feat: add Sidebar and Header components"
```

---

### Task 11: Render Sidebar and Header from the protected layout

**Files:**
- Modify: `frontend/app/(panel)/layout.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile` from `@/lib/supabase/get-current-profile` (Task 6); `Sidebar` from `@/components/layout/Sidebar` (Task 10); `Header` from `@/components/layout/Header` (Task 10).
- Produces: nothing new — this replaces the Sprint-1 bare `<main>` wrapper.

- [ ] **Step 1: Replace the layout**

Replace the full contents of `frontend/app/(panel)/layout.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const result = await getCurrentProfile()

  if (!result) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar role={result.profile.role} />
      <div className="flex flex-1 flex-col">
        <Header profile={result.profile} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Verify the full shell renders with the dev bypass**

Confirm `frontend/.env.local` still has `DEV_SKIP_AUTH=true` and `DEV_SKIP_AUTH_ROLE=supervisor`. Run: `npm run dev` (background), then:

```bash
curl -s http://localhost:3000/ | grep -o "Iniciar sesión\|Vista Previa Dev\|CARRERA ARANGO\|logo.jpeg"
```

Expected: does NOT print `Iniciar sesión` (would mean it redirected to login); DOES show evidence of the dashboard content (`Vista Previa Dev`) and the logo image reference. Then check role filtering — with `DEV_SKIP_AUTH_ROLE=supervisor` all 7 nav items should be present:

```bash
curl -s http://localhost:3000/ | grep -o "Dashboard\|Inventario\|Movimientos\|Entradas\|Ajustes\|Importar CSV\|Usuarios"
```

Expected: all 7 labels present (note: routes for the other 6 don't exist as pages yet until Task 12 — the Sidebar *links* render regardless, since it only depends on the permission matrix, not on the target page existing).

Now test role filtering: change `DEV_SKIP_AUTH_ROLE=lectura` in `.env.local`, restart `npm run dev`, run the same grep. Expected: only `Dashboard` and `Inventario` present (per the matrix — `lectura` has no access to the other 5). Restore `DEV_SKIP_AUTH_ROLE=supervisor` in `.env.local` afterward (later tasks assume it). Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add "app/(panel)/layout.tsx"
git commit -m "feat: render Sidebar and Header from the protected layout"
```

---

### Task 12: Stub pages for the remaining 6 sections

**Files:**
- Create: `frontend/app/(panel)/inventario/page.tsx`
- Create: `frontend/app/(panel)/movimientos/page.tsx`
- Create: `frontend/app/(panel)/entradas/page.tsx`
- Create: `frontend/app/(panel)/ajustes/page.tsx`
- Create: `frontend/app/(panel)/importar/page.tsx`
- Create: `frontend/app/(panel)/usuarios/page.tsx`

**Interfaces:**
- Consumes: `RoleGuard` from `@/components/shared/RoleGuard` (Task 6); `ROUTE_PERMISSIONS` from `@/lib/permissions/roles` (Task 3).
- Produces: nothing later tasks depend on — this plan's final content task.

- [ ] **Step 1: Create the Inventario stub**

Create `frontend/app/(panel)/inventario/page.tsx`:

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

- [ ] **Step 2: Create the Movimientos stub**

Create `frontend/app/(panel)/movimientos/page.tsx`:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function MovimientosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.movimientos}>
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <p className="mt-2 text-muted-foreground">Próximamente.</p>
      </div>
    </RoleGuard>
  )
}
```

- [ ] **Step 3: Create the Entradas stub**

Create `frontend/app/(panel)/entradas/page.tsx`:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function EntradasPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.entradas}>
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold">Entradas</h1>
        <p className="mt-2 text-muted-foreground">Próximamente.</p>
      </div>
    </RoleGuard>
  )
}
```

- [ ] **Step 4: Create the Ajustes stub**

Create `frontend/app/(panel)/ajustes/page.tsx`:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function AjustesPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.ajustes}>
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold">Ajustes</h1>
        <p className="mt-2 text-muted-foreground">Próximamente.</p>
      </div>
    </RoleGuard>
  )
}
```

- [ ] **Step 5: Create the Importar CSV stub**

Create `frontend/app/(panel)/importar/page.tsx`:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function ImportarPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.importar}>
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold">Importar CSV</h1>
        <p className="mt-2 text-muted-foreground">Próximamente.</p>
      </div>
    </RoleGuard>
  )
}
```

- [ ] **Step 6: Create the Usuarios stub**

Create `frontend/app/(panel)/usuarios/page.tsx`:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function UsuariosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.usuarios}>
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <p className="mt-2 text-muted-foreground">Próximamente.</p>
      </div>
    </RoleGuard>
  )
}
```

- [ ] **Step 7: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: exit code 0, route list includes `/inventario`, `/movimientos`, `/entradas`, `/ajustes`, `/importar`, `/usuarios`, `/acceso-denegado`.

- [ ] **Step 8: Verify RoleGuard blocks a disallowed role end-to-end**

Confirm `frontend/.env.local` has `DEV_SKIP_AUTH_ROLE=supervisor`. Run `npm run dev` (background), confirm `/usuarios` is reachable:

```bash
curl -sI http://localhost:3000/usuarios
```

Expected: `200 OK` (supervisor is allowed).

Now change `.env.local` to `DEV_SKIP_AUTH_ROLE=lectura`, restart `npm run dev`, retest:

```bash
curl -sI http://localhost:3000/usuarios
```

Expected: `307`/`308` redirect to `/acceso-denegado` (`lectura` is not in `ROUTE_PERMISSIONS.usuarios`). Restore `DEV_SKIP_AUTH_ROLE=supervisor` in `.env.local`. Stop the dev server after.

- [ ] **Step 9: Commit**

```bash
git add "app/(panel)/inventario" "app/(panel)/movimientos" "app/(panel)/entradas" "app/(panel)/ajustes" "app/(panel)/importar" "app/(panel)/usuarios"
git commit -m "feat: add placeholder pages for the remaining 6 sections"
```

---

## After This Plan

Sprint 2 is done once Task 12 is committed and its final review is clean. Remaining before this is fully production-ready:

1. Real Supabase project + `profiles` table still pending (same caveat as Sprint 1) — the dev bypass is what makes this sprint testable in the meantime. Once real credentials exist, `DEV_SKIP_AUTH` must stay unset (or `false`) in any shared/deployed environment — it only needs to exist in a developer's own `.env.local`.
2. Sprint 3 (Dashboard KPIs with Realtime) replaces the dashboard placeholder content; Sprints 4-6 replace the 6 "Próximamente" stubs with real content — each is its own spec/plan.
3. Badge de notificación en el Sidebar (ajustes pendientes, Supervisor-only) is explicitly deferred to Sprint 6 per the spec.
