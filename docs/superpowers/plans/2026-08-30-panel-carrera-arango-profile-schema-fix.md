# Profile Schema Fix (full_name/role -> nombre/rol) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `Profile.full_name`/`Profile.role` to `Profile.nombre`/`Profile.rol` everywhere, matching the real `profiles` table schema already pushed to `origin/master` (`nombre text`, `rol text`), instead of the English names guessed in Sprint 1 before any real migration existed.

**Architecture:** A single type definition (`Profile` in `lib/types/database.ts`) drives every consumer. This is one atomic rename across 7 interdependent files — `tsc` only passes once all seven agree, so this ships as one task, not several.

**Tech Stack:** TypeScript, Next.js App Router (unchanged from Sprint 1/2).

## Global Constraints

- TypeScript `strict: true`, no `any` anywhere.
- Commit messages in Spanish (prefixes `feat:`/`fix:`/`chore:` stay in English), sole authorship, no `Co-Authored-By` trailer.
- Pure rename — no behavior change. If any step requires more than swapping an identifier, stop and flag it rather than improvising.
- All commands run with `frontend/` as the working directory.

---

### Task 1: Rename Profile.full_name/role to nombre/rol across all 7 consumers

**Files:**
- Modify: `frontend/lib/types/database.ts`
- Modify: `frontend/lib/supabase/get-current-profile.ts`
- Modify: `frontend/lib/dev/preview-bypass.ts`
- Modify: `frontend/components/shared/RoleGuard.tsx`
- Modify: `frontend/components/layout/NavUser.tsx`
- Modify: `frontend/app/(panel)/layout.tsx`
- Modify: `frontend/app/(panel)/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Profile` now has fields `nombre: string | null` and `rol: Role` (was `full_name`/`role`). Every file below is both a producer and consumer of this shape — there are no other files in the codebase using `Profile.full_name`/`.role` (verified: `grep -rn "full_name\|profile\.role" frontend/app frontend/components frontend/lib` returns exactly the lines listed in this task, nowhere else).

- [ ] **Step 1: Update the `Profile` type**

In `frontend/lib/types/database.ts`, find:

```ts
export interface Profile {
  id: string
  full_name: string | null
  role: Role
}
```

Replace with:

```ts
export interface Profile {
  id: string
  nombre: string | null
  rol: Role
}
```

Leave everything else in the file (the `Role` type, `ROLE_SET`, `ALL_ROLES`) untouched.

- [ ] **Step 2: Update the real Supabase query and the discriminated-union types**

In `frontend/lib/supabase/get-current-profile.ts`, find this line (currently line 24):

```ts
    .select('id, full_name, role')
```

Replace with:

```ts
    .select('id, nombre, rol')
```

Nothing else in this file changes — the `CurrentProfileResult` union, the `cache()` wrapping, and the dev-bypass branch already reference `Profile` structurally (via `profile: Profile`), so they pick up the new field names automatically once the type changes in Step 1.

- [ ] **Step 3: Update the dev-preview fake profile**

In `frontend/lib/dev/preview-bypass.ts`, find (currently lines 30-31):

```ts
  const role: Role = isValid ? (envRole as Role) : 'supervisor'
  return { id: 'dev-preview-user', full_name: 'Vista Previa Dev', role }
```

Replace with:

```ts
  const rol: Role = isValid ? (envRole as Role) : 'supervisor'
  return { id: 'dev-preview-user', nombre: 'Vista Previa Dev', rol }
```

(Renaming the local variable `role` → `rol` here too, purely for internal consistency with the field it fills — not required for compilation, but keep it since you're already touching this line.)

- [ ] **Step 4: Update RoleGuard's role check**

In `frontend/components/shared/RoleGuard.tsx`, find (currently line 18):

```ts
  if (result.status === 'no-profile' || !allowed.includes(result.profile.role)) {
```

Replace with:

```ts
  if (result.status === 'no-profile' || !allowed.includes(result.profile.rol)) {
```

Do NOT rename the `allowed` prop or the `RoleGuard` function's own parameter names — only the `.profile.role` → `.profile.rol` property access changes.

- [ ] **Step 5: Update NavUser's display**

In `frontend/components/layout/NavUser.tsx`, find (currently lines 29, 32-33):

```tsx
          <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
        </Avatar>
        <span className="text-left text-sm">
          <span className="block font-medium leading-none">{profile.full_name ?? 'Usuario'}</span>
          <span className="block text-xs capitalize text-muted-foreground">{profile.role}</span>
```

Replace with:

```tsx
          <AvatarFallback>{getInitials(profile.nombre)}</AvatarFallback>
        </Avatar>
        <span className="text-left text-sm">
          <span className="block font-medium leading-none">{profile.nombre ?? 'Usuario'}</span>
          <span className="block text-xs capitalize text-muted-foreground">{profile.rol}</span>
```

The `getInitials` function itself (parameter name, body) does not change — it already takes `string | null` and doesn't care what the caller calls the field.

- [ ] **Step 6: Update the panel layout's Sidebar prop**

In `frontend/app/(panel)/layout.tsx`, find (currently line 29):

```tsx
      <Sidebar role={result.profile.role} />
```

Replace with:

```tsx
      <Sidebar role={result.profile.rol} />
```

`Sidebar`'s own prop is still named `role` (that's the component's own prop name, unrelated to the `Profile` field name) — only the right-hand side `result.profile.role` → `result.profile.rol` changes.

- [ ] **Step 7: Update the dashboard page's display**

In `frontend/app/(panel)/page.tsx`, find (currently lines 25, 27):

```tsx
        Bienvenido, {result.profile.full_name ?? result.user.email}
      </h1>
      <p className="text-muted-foreground">Rol: {result.profile.role}</p>
```

Replace with:

```tsx
        Bienvenido, {result.profile.nombre ?? result.user.email}
      </h1>
      <p className="text-muted-foreground">Rol: {result.profile.rol}</p>
```

- [ ] **Step 8: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 9: Verify no stray references remain**

Run (from `frontend/`):

```bash
grep -rn "full_name\|\.profile\.role\b" app components lib
```

Expected: no output (empty result). If anything matches, it was missed in Steps 1-7 — fix it before continuing.

- [ ] **Step 10: Verify the app still renders correctly with the dev bypass**

Confirm `frontend/.env.local` has `DEV_SKIP_AUTH=true` and `DEV_SKIP_AUTH_ROLE=supervisor` (restore if missing). Run `npm run build` (regenerates `.next/types`), then `npm run dev` (background). Run:

```bash
curl -s http://localhost:3000/ | grep -o "Vista Previa Dev\|Bienvenido"
```

Expected: both strings present (dashboard still renders the dev-preview profile's name correctly through the renamed field). Stop the dev server after.

- [ ] **Step 11: Commit**

```bash
git add lib/types/database.ts lib/supabase/get-current-profile.ts lib/dev/preview-bypass.ts components/shared/RoleGuard.tsx components/layout/NavUser.tsx "app/(panel)/layout.tsx" "app/(panel)/page.tsx"
git commit -m "$(cat <<'EOF'
fix: renombrar Profile.full_name/role a nombre/rol

El schema real de profiles (origin/master, supabase/migrations/001_create_profiles.sql)
usa columnas en español (nombre, rol), no los nombres en inglés
asumidos en Sprint 1 antes de que existiera ninguna migración real.
EOF
)"
```

---

## After This Plan

Sprint 3 (Dashboard KPIs) can now proceed using the correct `Profile.nombre`/`.rol` field names, and should also use the now-known real schema for `movimientos_inventario` / `vista_inventario_actual` / `vista_valorizacion_basica` / `vista_movimientos_recientes` (columns: `vin`, `tipo_movimiento` ∈ `'entrada'|'salida_vin'|'ajuste'|'reverso'`, `cantidad`, `valor_unitario`, `marca`, `categoria`, `ubicacion`, `saldo`, `valor_total`, `created_at`, etc.) rather than guessing column names again.
