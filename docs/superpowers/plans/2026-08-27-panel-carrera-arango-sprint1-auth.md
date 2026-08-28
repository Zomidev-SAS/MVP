# Panel Carrera Arango — Sprint 1 (Auth Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js panel project and deliver working session-based authentication (login, middleware route protection, role lookup from `profiles`) ready to point at the real Supabase project once it exists.

**Architecture:** Next.js 14 App Router with two route groups — `(auth)` for the public login page and `(panel)` for everything behind a session check. `@supabase/ssr` provides three integration points: a browser client for the login form, a server client for Server Components, and an independent cookie-based client inside `middleware.ts` (middleware can't use `next/headers`). All three call sites wrap `auth.getUser()` in try/catch and fail closed (treat errors as "no user") so the app doesn't crash before real Supabase credentials exist.

**Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, `@supabase/ssr`, `@supabase/supabase-js`, npm.

## Global Constraints

- TypeScript `strict: true`, no `any` anywhere.
- Every Supabase call destructures and checks `{ error }` (or wraps in try/catch for network-level failures) — never ignored silently.
- Use `@supabase/ssr` only. Never `@supabase/auth-helpers-nextjs` (deprecated).
- npm is the package manager (no yarn/pnpm lockfiles).
- No self-registration UI or route anywhere.
- `service_role_key` never appears in any file under `app/`, `lib/`, or `components/`.
- `middleware.ts` lives at the project root (sibling of `app/`), not inside `app/`.
- `.env.local` must never be committed; `.env.example` must always be committed.

---

### Task 1: Scaffold Next.js project with Tailwind and base config

**Files:**
- Create: entire project scaffold via `create-next-app` (package.json, tsconfig.json, next.config.ts, app/layout.tsx, app/page.tsx, app/globals.css, public/, .eslintrc, etc.)
- Modify: `app/layout.tsx` (add `robots: noindex` metadata)
- Modify: `.gitignore` (un-ignore `.env.example`)
- Create: `.env.example`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a running Next.js dev server on `http://localhost:3000`; `app/layout.tsx` exporting a `RootLayout` component later tasks will not touch again.

- [ ] **Step 1: Run create-next-app in the current directory**

Run (from `d:\Proyectos vscode\MVP`):

```bash
npx create-next-app@latest . --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --no-turbopack
```

When prompted about the directory not being empty, confirm yes (only `.git/` and `docs/` exist, both on `create-next-app`'s safe list).

**Step 2: Verify scaffold**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Fix `.gitignore` so `.env.example` can be committed**

The generated `.gitignore` contains a line `.env*` which also matches `.env.example`. Open `.gitignore` and add this line immediately after the `.env*` line:

```
!.env.example
```

- [ ] **Step 4: Create `.env.example`**

Create file `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 5: Add noindex metadata to the root layout**

Open `app/layout.tsx`. Find the `export const metadata: Metadata = { ... }` block and replace it with:

```tsx
export const metadata: Metadata = {
  title: "Panel Carrera Arango",
  description: "Panel de control de inventario Carrera Arango",
  robots: {
    index: false,
    follow: false,
  },
};
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: build completes successfully (exit code 0), no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with Tailwind and noindex metadata"
```

---

### Task 2: Install and configure shadcn/ui

**Files:**
- Modify: `components.json` (created by shadcn init)
- Modify: `app/globals.css` (shadcn CSS variables)
- Create: `components/ui/button.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/ui/label.tsx`
- Create: `components/ui/card.tsx`
- Create: `lib/utils.ts` (shadcn's `cn` helper)

**Interfaces:**
- Consumes: the Tailwind config from Task 1.
- Produces: `Button`, `Input`, `Label`, `Card`/`CardHeader`/`CardTitle`/`CardContent` components importable from `@/components/ui/*`; a `cn(...)` utility from `@/lib/utils`. Task 6 (login page) imports all of these by exact name.

- [ ] **Step 1: Initialize shadcn/ui with defaults**

Run:

```bash
npx shadcn@latest init -d
```

- [ ] **Step 2: Verify init**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. Confirm `components.json` and `lib/utils.ts` now exist.

- [ ] **Step 3: Add the four components needed for the login form**

Run:

```bash
npx shadcn@latest add button input label card -y
```

- [ ] **Step 4: Verify components installed**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. Confirm `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/card.tsx` all exist.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: install shadcn/ui with button, input, label, card"
```

---

### Task 3: Supabase client factories (browser + server)

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars.
- Produces: `createClient()` from `@/lib/supabase/client` (sync, for Client Components) and `createClient()` from `@/lib/supabase/server` (async, for Server Components) — both return a Supabase client with `.auth` and `.from(...)`. Tasks 5, 6, 7 import these by exact path.

- [ ] **Step 1: Install Supabase packages**

Run:

```bash
npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Create the browser client**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create the server client**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component during render; middleware
            // already refreshes the session cookie on every request.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Supabase browser and server client factories"
```

---

### Task 4: Role and Profile types

**Files:**
- Create: `lib/types/database.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Role` union type (7 values) and `Profile` interface, both exported from `@/lib/types/database`. Task 7 imports `Profile` by exact name.

**Note:** the exact string values for `Role` are a placeholder guess (lowercase, no accents) matching the 7 roles in the document's permission matrix. Confirm the real column values with the Backend team once the `profiles` table exists (Sprint 1 coordination item, week 2 per the source document) and update this file if they differ — nothing else in this plan depends on the specific string values, only on the type having 7 members.

- [ ] **Step 1: Create the types file**

Create `lib/types/database.ts`:

```ts
export type Role =
  | 'supervisor'
  | 'comercial'
  | 'ingenieria'
  | 'produccion'
  | 'compras'
  | 'auditoria'
  | 'lectura'

export interface Profile {
  id: string
  full_name: string | null
  role: Role
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Role and Profile types"
```

---

### Task 5: Session middleware

**Files:**
- Create: `middleware.ts` (project root, sibling of `app/`)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars. Does NOT import from `lib/supabase/*` — middleware needs the request/response cookie API, not `next/headers`.
- Produces: redirect behavior other tasks depend on for their manual verification (Task 6 and Task 7 assume unauthenticated requests never reach their pages).

- [ ] **Step 1: Create `middleware.ts`**

Create `middleware.ts` at the project root:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser()
    user = fetchedUser
  } catch {
    user = null
  }

  const isLoginPage = request.nextUrl.pathname.startsWith('/login')

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Create a local `.env.local` with placeholder values for manual testing**

This file is gitignored and never committed. Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
```

- [ ] **Step 4: Verify redirect behavior manually**

Run: `npm run dev` (in background or a separate terminal)

Then run:

```bash
curl -sI http://localhost:3000/
```

Expected: response includes `HTTP/1.1 307` (or 308) and a `location` header pointing to `/login`. This confirms the middleware fails closed (redirects to login) even though the placeholder Supabase URL can't actually be reached.

Stop the dev server after checking.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts
git commit -m "feat: add session middleware that redirects unauthenticated requests to /login"
```

(Do not add `.env.local` — confirm `git status` shows it as ignored, not staged.)

---

### Task 6: Login page

**Files:**
- Create: `app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client` (Task 3); `Button`, `Input`, `Label`, `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/*` (Task 2).
- Produces: a route at `/login` other tasks don't depend on programmatically (terminal page).

- [ ] **Step 1: Create the login page**

Create `app/(auth)/login/page.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError('Credenciales inválidas. Verifica tu correo y contraseña.')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@carreraarango.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </Button>
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed text-center text-sm text-muted-foreground opacity-50"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Verify the page renders**

Run: `npm run dev`, then:

```bash
curl -s http://localhost:3000/login | grep -o "Iniciar sesión"
```

Expected: prints `Iniciar sesión` (confirms the page renders without crashing and isn't redirected away by middleware). Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login/page.tsx"
git commit -m "feat: add login page"
```

---

### Task 7: Protected layout and placeholder dashboard page

**Files:**
- Create: `app/(panel)/layout.tsx`
- Create: `app/(panel)/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (Task 3); `Profile` type from `@/lib/types/database` (Task 4).
- Produces: the `/` route, terminal for Sprint 1 (Sprint 2 will add Sidebar/Header around this same layout).

- [ ] **Step 1: Create the protected layout**

Create `app/(panel)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  let user = null
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser()
    user = fetchedUser
  } catch {
    user = null
  }

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create the placeholder dashboard page**

Create `app/(panel)/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types/database'

export default async function DashboardPlaceholderPage() {
  const supabase = await createClient()

  let user = null
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser()
    user = fetchedUser
  } catch {
    user = null
  }

  if (!user) {
    return null
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single<Profile>()

  if (error || !profile) {
    return (
      <p>
        No se pudo cargar tu perfil ({error?.message ?? 'perfil no encontrado'}).
      </p>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Bienvenido, {profile.full_name ?? user.email}
      </h1>
      <p className="text-muted-foreground">Rol: {profile.role}</p>
    </div>
  )
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Verify full build**

Run: `npm run build`
Expected: build completes successfully (exit code 0), all five routes listed (`/`, `/login`, plus Next.js internals), no TypeScript errors.

- [ ] **Step 5: Verify the redirect chain end-to-end with placeholder credentials**

Run: `npm run dev`, then:

```bash
curl -sI http://localhost:3000/
```

Expected: `307`/`308` redirect to `/login` (same as Task 5, confirming the layout's own guard is consistent with the middleware — defense in depth, not a contradiction).

Stop the dev server after checking.

- [ ] **Step 6: Commit**

```bash
git add "app/(panel)/layout.tsx" "app/(panel)/page.tsx"
git commit -m "feat: add protected layout and placeholder dashboard page"
```

---

## After This Plan

Sprint 1 is done once Task 7 is committed. Remaining work before this is truly end-to-end:

1. **User action required:** create the real Supabase project, run Supabase Auth setup (disable public sign-up), create the `profiles` table with a `role` column matching the `Role` type in `lib/types/database.ts`, and create at least one test user + profile row.
2. Replace the placeholder values in `.env.local` with the real `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Manually verify the two criteria from the spec that couldn't be tested without real credentials: successful login redirects to `/` and shows the correct email/role; failed login shows the inline error without redirecting.

Sprint 2 (Sidebar, Header, RolGuard, security headers, 403 page) is a separate spec/plan.
