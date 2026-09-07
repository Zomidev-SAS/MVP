# Panel Carrera Arango — Sprint 5 parte 2 (Formulario de Entradas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Entradas placeholder with a validated manual-entry form (React Hook Form + Zod) that writes to `movimientos_inventario` for real, with toast feedback and a dev-bypass mode that simulates success without persisting.

**Architecture:** A Zod schema (`entradaSchema`) is the single source of truth for validation, used both client-side (via `zodResolver`) and re-validated server-side inside the Server Action (never trust the client). The Server Action `crearEntrada` uses the file-level `'use server'` directive (mandatory — see Sprint 4/5 lesson) and either simulates success (dev bypass) or inserts a real row with `tipo_movimiento: 'entrada'`, `estado: 'aplicado'`, `actor_id` from the current session.

**Tech Stack:** Next.js Server Actions, React Hook Form, Zod, `@hookform/resolvers`, shadcn `Form`/`Textarea` (new this task) + `sonner` for toasts (new this task).

## Global Constraints

- TypeScript `strict: true`, no `any` anywhere.
- Server Action file MUST use the file-level `'use server'` directive (first line of the file) — the per-function form breaks `npm run build` once a Client Component imports it directly (Sprint 4/5 lesson).
- Every Supabase call's `{ error }` checked, logged, and turned into a user-facing `{ ok: false, error: string }` — never thrown.
- The Server Action re-validates input with the same Zod schema the client uses — never trust client-side validation alone.
- "Notas" field maps to the real `motivo` column — there is no separate `notas` column.
- Dev bypass (`isDevBypassActive()` from `@/lib/dev/preview-bypass`, Sprint 2): simulates a 600ms delay then returns success, without persisting anywhere.
- Real insert columns: `vin, marca, categoria, cantidad, valor_unitario, ubicacion, motivo, tipo_movimiento: 'entrada', estado: 'aplicado', actor_id`. Do not set `evidencia` or `idempotency_key` — both have safe defaults/are nullable in the real schema.
- All commands run with `frontend/` as the working directory.

---

### Task 1: Entrada types, Zod schema, and Server Action

**Files:**
- Create: `frontend/lib/types/entradas.ts`
- Create: `frontend/lib/supabase/entradas-actions.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (Sprint 1); `getSessionUser` from `@/lib/supabase/get-session-user` (Sprint 1); `isDevBypassActive` from `@/lib/dev/preview-bypass` (Sprint 2).
- Produces: `entradaSchema` (Zod), `EntradaInput` (inferred type), `EntradaResultado` type from `@/lib/types/entradas`; `crearEntrada(datos: EntradaInput): Promise<EntradaResultado>` from `@/lib/supabase/entradas-actions`. Task 2 imports all of these by exact name.

- [ ] **Step 1: Install new dependencies**

Run: `npm install react-hook-form zod @hookform/resolvers`

- [ ] **Step 2: Create the Zod schema and types**

Create `frontend/lib/types/entradas.ts`:

```ts
import { z } from 'zod'

export const entradaSchema = z.object({
  vin: z.string().trim().min(5, 'El VIN debe tener al menos 5 caracteres'),
  marca: z.string().trim().min(1, 'La marca es requerida'),
  categoria: z.string().trim().min(1, 'La categoría es requerida'),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  valor_unitario: z.coerce
    .number()
    .min(0, 'El valor unitario no puede ser negativo')
    .optional(),
  ubicacion: z.string().trim().min(1, 'La ubicación es requerida'),
  notas: z.string().trim().optional(),
})

export type EntradaInput = z.infer<typeof entradaSchema>

export type EntradaResultado = { ok: true } | { ok: false; error: string }
```

- [ ] **Step 3: Create the Server Action**

Create `frontend/lib/supabase/entradas-actions.ts` — note `'use server'` is the FIRST LINE OF THE FILE:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { entradaSchema, type EntradaInput, type EntradaResultado } from '@/lib/types/entradas'

export async function crearEntrada(datos: EntradaInput): Promise<EntradaResultado> {
  const parsed = entradaSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('movimientos_inventario').insert({
    vin: parsed.data.vin,
    marca: parsed.data.marca,
    categoria: parsed.data.categoria,
    cantidad: parsed.data.cantidad,
    valor_unitario: parsed.data.valor_unitario ?? null,
    ubicacion: parsed.data.ubicacion,
    motivo: parsed.data.notas ?? null,
    tipo_movimiento: 'entrada',
    estado: 'aplicado',
    actor_id: user.id,
  })

  if (error) {
    console.error('Failed to insert entrada:', error)
    return { ok: false, error: 'No se pudo registrar la entrada. Intenta de nuevo.' }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add lib/types/entradas.ts lib/supabase/entradas-actions.ts package.json package-lock.json
git commit -m "feat: agregar schema Zod y Server Action crearEntrada"
```

---

### Task 2: EntryForm component, toasts, and page wiring

**Files:**
- Create: `frontend/components/entradas/EntryForm.tsx`
- Modify: `frontend/app/layout.tsx` (add `<Toaster />`)
- Modify: `frontend/app/(panel)/entradas/page.tsx`

**Interfaces:**
- Consumes: `entradaSchema`, `EntradaInput` from `@/lib/types/entradas` (Task 1); `crearEntrada` from `@/lib/supabase/entradas-actions` (Task 1); `RoleGuard` (Sprint 2); `ROUTE_PERMISSIONS` (Sprint 2); shadcn `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`, `Textarea`, `Input`, `Button` (Sprint 1/this task); `sonner`'s `toast` and `Toaster`.
- Produces: `EntryForm` component (no props) from `@/components/entradas/EntryForm`. Task 2's own page.tsx imports it — final task in this plan, nothing downstream.

- [ ] **Step 1: Install shadcn form/textarea/sonner**

Run: `npx shadcn@latest add form textarea sonner -y`

Check `git status` before committing anything in this task — only the intended files (a prior sprint had a mistake with stray `npm run dev` log files getting swept into `git add -A`).

- [ ] **Step 2: Add the Toaster to the root layout**

In `frontend/app/layout.tsx`, add the import:

```ts
import { Toaster } from "@/components/ui/sonner";
```

And change the `<body>` line from:

```tsx
      <body className="min-h-full flex flex-col antialiased">{children}</body>
```

to:

```tsx
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <Toaster />
      </body>
```

(If the file's current `<body>` line doesn't match exactly due to earlier edits, just add `{children}` followed by `<Toaster />` as siblings inside whatever the current `<body>` contains — the goal is `<Toaster />` rendered once at the root, alongside `children`, not nested inside it.)

- [ ] **Step 3: Create EntryForm**

Create `frontend/components/entradas/EntryForm.tsx`:

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { entradaSchema, type EntradaInput } from '@/lib/types/entradas'
import { crearEntrada } from '@/lib/supabase/entradas-actions'

const VALORES_INICIALES: EntradaInput = {
  vin: '',
  marca: '',
  categoria: '',
  cantidad: 0,
  valor_unitario: undefined,
  ubicacion: '',
  notas: '',
}

export function EntryForm() {
  const form = useForm<EntradaInput>({
    resolver: zodResolver(entradaSchema),
    defaultValues: VALORES_INICIALES,
  })

  async function onSubmit(datos: EntradaInput) {
    const resultado = await crearEntrada(datos)
    if (resultado.ok) {
      toast.success('Entrada registrada correctamente.')
      form.reset(VALORES_INICIALES)
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
        <FormField
          control={form.control}
          name="vin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>VIN</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="marca"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marca</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="categoria"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cantidad"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="valor_unitario"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor Unitario</FormLabel>
              <FormControl>
                <Input type="number" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ubicacion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ubicación</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Entrada'}
        </Button>
      </form>
    </Form>
  )
}
```

If `tsc` reports a mismatch on the shadcn `Form`/`FormField` API (versions occasionally differ), open the actual installed `frontend/components/ui/form.tsx` and adjust only the mismatched usage, noting the substitution in your report — same pattern as prior sprints handling shadcn version differences.

- [ ] **Step 4: Wire the Entradas page**

Replace the full contents of `frontend/app/(panel)/entradas/page.tsx` with:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { EntryForm } from '@/components/entradas/EntryForm'

export default function EntradasPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.entradas}>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Nueva Entrada</h1>
        <EntryForm />
      </div>
    </RoleGuard>
  )
}
```

- [ ] **Step 5: Verify types and build**

Run: `npx tsc --noEmit` — expected exit 0.
Run: `npm run build` — expected exit 0 (critical check per the Server Action lesson — `EntryForm` is a Client Component importing `crearEntrada` directly).

- [ ] **Step 6: Verify the page shell renders**

Confirm `frontend/.env.local` has `DEV_SKIP_AUTH=true` and `DEV_SKIP_AUTH_ROLE=supervisor`. Run `npm run dev` (background), then:

```bash
curl -s http://localhost:3000/entradas | grep -o "Nueva Entrada\|VIN\|Marca\|Categoría\|Cantidad\|Guardar Entrada"
```

Expected: all present. The actual form submission (validation errors, toast, dev-bypass simulated success) requires real browser interaction — curl cannot submit a form or observe client-side state; note this as unverified-by-construction in your report, same caveat as prior sprints' interactive components. Stop the dev server after.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: agregar formulario de Entradas con validacion y toasts"
```

(Confirm via `git status` before this commit that only the intended files are staged: the shadcn form/textarea/sonner install, `EntryForm.tsx`, `app/layout.tsx`, and `app/(panel)/entradas/page.tsx`.)

---

## After This Plan

Sprint 5 (both Movimientos and Entradas) is done once this task is committed and reviewed. Remaining:

1. A real browser check of the form's validation errors, loading spinner, and toast feedback — curl cannot exercise these.
2. Real Supabase project still doesn't exist — `crearEntrada`'s real-insert branch is written and type-checks but is unverified against a live database.
3. Sprint 6 (Ajustes + Importar CSV) is a separate spec/plan.
