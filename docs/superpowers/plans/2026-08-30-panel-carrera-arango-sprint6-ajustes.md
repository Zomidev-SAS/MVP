# Panel Carrera Arango — Sprint 6 parte 1 (Ajustes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Ajustes placeholder with a role-conditional page (solicitud form for everyone allowed; an approval table added on top for Supervisor), plus a pending-count badge on the Sidebar's "Ajustes" nav item (Supervisor only).

**Architecture:** One Server Action file (`lib/supabase/ajustes-actions.ts`, file-level `'use server'` — mandatory, see prior-sprint lesson) exports 5 async functions: `solicitarAjuste`, `fetchAjustesPendientes`, `fetchAjustesPendientesCount`, `aprobarAjuste` (real branch calls the `aprobar-ajuste` Edge Function per the source document — doesn't exist yet, code is correct but untestable), `rechazarAjuste` (real branch is a direct table update, no Edge Function needed since it never touches `movimientos_inventario`). `app/(panel)/ajustes/page.tsx` renders the form always (within `RoleGuard`'s already-existing `supervisor|produccion|compras` restriction) and the approval table only when the viewer's role is `supervisor`.

**Tech Stack:** Same as Sprint 5 (React Hook Form + Zod + sonner, already installed).

## Global Constraints

- TypeScript `strict: true`, no `any` anywhere.
- Server Action file MUST use the file-level `'use server'` directive (first line) — the per-function form breaks `npm run build` once a Client Component imports an action directly (established in Sprints 4-5).
- Every Supabase call's `{ error }` checked, logged, turned into a safe fallback (`{ok:false,error}` for mutations, `[]`/`0` for reads) — never thrown.
- Server Action re-validates `solicitarAjuste`'s input with the same Zod schema the client uses.
- Real schema (`ajustes_pendientes`, from `origin/master`): `id, movimiento_borrador jsonb, solicitado_por uuid, estado ('pendiente'|'aprobado'|'rechazado'), motivo_rechazo, resuelto_por, resuelto_at, created_at`.
- "Evidencia" is a free-text description, stored inside `movimiento_borrador.evidencia.descripcion` — not a real file upload.
- Dev bypass (`isDevBypassActive()` from `@/lib/dev/preview-bypass`) simulates all mutations with a 600ms delay + success, and reads return a fixed 5-row example dataset — no persistence, matching every prior sprint's pattern.
- If `useForm<T>(...)` with an explicit generic conflicts with a `z.coerce.number()` field (a friction point already hit in Sprint 5's Entradas form — drop the explicit generic, let it infer from `resolver`+`defaultValues`, and use narrow `as number` casts only on JSX `value={...}` display bindings if needed), resolve it the same way and note it in your report.
- All commands run with `frontend/` as the working directory.

---

### Task 1: Ajustes types, preview data, and Server Actions

**Files:**
- Create: `frontend/lib/types/ajustes.ts`
- Create: `frontend/lib/dev/preview-ajustes-data.ts`
- Create: `frontend/lib/supabase/ajustes-actions.ts`

**Interfaces:**
- Consumes: `createClient` (Sprint 1); `getSessionUser` (Sprint 1); `isDevBypassActive` (Sprint 2).
- Produces: `solicitarAjusteSchema`, `SolicitarAjusteInput`, `AjustePendiente`, `AjusteResultado` from `@/lib/types/ajustes`; `getDevPreviewAjustesData(): AjustePendiente[]` from `@/lib/dev/preview-ajustes-data`; `solicitarAjuste`, `fetchAjustesPendientes`, `fetchAjustesPendientesCount`, `aprobarAjuste`, `rechazarAjuste` from `@/lib/supabase/ajustes-actions`. Tasks 2 and 3 import from these by exact name.

- [ ] **Step 1: Create the types**

Create `frontend/lib/types/ajustes.ts`:

```ts
import { z } from 'zod'

export const solicitarAjusteSchema = z.object({
  vin: z.string().trim().min(5, 'El VIN debe tener al menos 5 caracteres'),
  cantidad: z.coerce.number().refine((v) => v !== 0, 'La cantidad no puede ser cero'),
  motivo: z.string().trim().min(1, 'El motivo es requerido'),
  evidencia: z.string().trim().optional(),
})

export type SolicitarAjusteInput = z.infer<typeof solicitarAjusteSchema>

export interface AjustePendiente {
  id: number
  vin: string
  cantidad: number
  motivo: string
  solicitado_por: string
  created_at: string
}

export type AjusteResultado = { ok: true } | { ok: false; error: string }
```

- [ ] **Step 2: Create the example data**

Create `frontend/lib/dev/preview-ajustes-data.ts`:

```ts
import type { AjustePendiente } from '@/lib/types/ajustes'

export function getDevPreviewAjustesData(): AjustePendiente[] {
  const baseDate = new Date('2026-08-28T00:00:00Z')
  const motivos = [
    'Discrepancia con conteo físico',
    'Producto dañado en bodega',
    'Corrección de registro duplicado',
    'Ajuste por devolución',
    'Diferencia en auditoría',
  ]

  return Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    vin: `VIN-${(3000 + i).toString()}`,
    cantidad: i % 2 === 0 ? -(i + 1) : i + 1,
    motivo: motivos[i],
    solicitado_por: `b0000000-0000-0000-0000-00000000000${i}`,
    created_at: new Date(baseDate.getTime() + i * 4 * 60 * 60 * 1000).toISOString(),
  }))
}
```

- [ ] **Step 3: Create the Server Actions**

Create `frontend/lib/supabase/ajustes-actions.ts` — note `'use server'` is the FIRST LINE OF THE FILE:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewAjustesData } from '@/lib/dev/preview-ajustes-data'
import {
  solicitarAjusteSchema,
  type AjustePendiente,
  type AjusteResultado,
  type SolicitarAjusteInput,
} from '@/lib/types/ajustes'

export async function solicitarAjuste(datos: SolicitarAjusteInput): Promise<AjusteResultado> {
  const parsed = solicitarAjusteSchema.safeParse(datos)
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

  const { error } = await supabase.from('ajustes_pendientes').insert({
    movimiento_borrador: {
      vin: parsed.data.vin,
      cantidad: parsed.data.cantidad,
      motivo: parsed.data.motivo,
      evidencia: { descripcion: parsed.data.evidencia ?? '' },
    },
    solicitado_por: user.id,
    estado: 'pendiente',
  })

  if (error) {
    console.error('Failed to insert ajuste_pendiente:', error)
    return { ok: false, error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }
  }

  return { ok: true }
}

export async function fetchAjustesPendientes(): Promise<AjustePendiente[]> {
  if (isDevBypassActive()) {
    return getDevPreviewAjustesData()
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ajustes_pendientes')
    .select('id, movimiento_borrador, solicitado_por, created_at')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load ajustes_pendientes:', error)
    return []
  }

  return (data ?? []).map((row) => {
    const borrador = row.movimiento_borrador as { vin: string; cantidad: number; motivo: string }
    return {
      id: row.id,
      vin: borrador.vin,
      cantidad: borrador.cantidad,
      motivo: borrador.motivo,
      solicitado_por: row.solicitado_por,
      created_at: row.created_at,
    }
  })
}

export async function fetchAjustesPendientesCount(): Promise<number> {
  if (isDevBypassActive()) {
    return getDevPreviewAjustesData().length
  }

  const supabase = await createClient()

  const { count, error } = await supabase
    .from('ajustes_pendientes')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente')

  if (error) {
    console.error('Failed to count ajustes_pendientes:', error)
    return 0
  }

  return count ?? 0
}

export async function aprobarAjuste(id: number): Promise<AjusteResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const supabase = await createClient()

  const { error } = await supabase.functions.invoke('aprobar-ajuste', {
    body: { ajuste_id: id },
  })

  if (error) {
    console.error('Failed to invoke aprobar-ajuste:', error)
    return { ok: false, error: 'No se pudo aprobar el ajuste. Intenta de nuevo.' }
  }

  return { ok: true }
}

export async function rechazarAjuste(id: number, motivo: string): Promise<AjusteResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('ajustes_pendientes')
    .update({
      estado: 'rechazado',
      motivo_rechazo: motivo,
      resuelto_por: user.id,
      resuelto_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Failed to reject ajuste:', error)
    return { ok: false, error: 'No se pudo rechazar el ajuste. Intenta de nuevo.' }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add lib/types/ajustes.ts lib/dev/preview-ajustes-data.ts lib/supabase/ajustes-actions.ts
git commit -m "feat: agregar tipos, datos de ejemplo y Server Actions de ajustes"
```

---

### Task 2: Pending-count badge on the Sidebar

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx`
- Modify: `frontend/app/(panel)/layout.tsx`

**Interfaces:**
- Consumes: `fetchAjustesPendientesCount` from `@/lib/supabase/ajustes-actions` (Task 1).
- Produces: `Sidebar` gains a new optional prop `ajustesPendientes?: number`.

- [ ] **Step 1: Add the badge to Sidebar**

In `frontend/components/layout/Sidebar.tsx`, change the function signature from:

```tsx
export function Sidebar({ profile }: { profile: Profile }) {
```

to:

```tsx
export function Sidebar({
  profile,
  ajustesPendientes,
}: {
  profile: Profile
  ajustesPendientes?: number
}) {
```

Then find the `<Icon className="h-4 w-4" />` / `{item.label}` block inside the `.map()` and add the badge right after `{item.label}`:

```tsx
              <Icon className="h-4 w-4" />
              {item.label}
              {item.key === 'ajustes' && !!ajustesPendientes && ajustesPendientes > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                  {ajustesPendientes}
                </span>
              )}
```

- [ ] **Step 2: Fetch the count in the layout and pass it down**

In `frontend/app/(panel)/layout.tsx`, add the import:

```ts
import { fetchAjustesPendientesCount } from '@/lib/supabase/ajustes-actions'
```

Then, right before the final `return (`, add:

```ts
  const ajustesPendientes =
    result.profile.rol === 'supervisor' ? await fetchAjustesPendientesCount() : undefined
```

And change:

```tsx
      <Sidebar profile={result.profile} />
```

to:

```tsx
      <Sidebar profile={result.profile} ajustesPendientes={ajustesPendientes} />
```

- [ ] **Step 3: Verify types and build**

Run: `npx tsc --noEmit` — expected exit 0.
Run: `npm run build` — expected exit 0.

- [ ] **Step 4: Verify the badge shows for supervisor**

Confirm `frontend/.env.local` has `DEV_SKIP_AUTH=true` and `DEV_SKIP_AUTH_ROLE=supervisor`. Run `npm run dev` (background), then:

```bash
curl -s http://localhost:3000/ | grep -o "Ajustes"
```

Expected: present (the exact badge number rendering depends on client-side hydration of the Sidebar's own render — the badge's number IS server-rendered though, since `Sidebar` receives `ajustesPendientes` as a prop from the Server Component layout; check for the digit `5` in the same curl output too, as a rough signal it's there). Then switch `.env.local` to `DEV_SKIP_AUTH_ROLE=produccion`, restart `npm run dev`, and confirm `Ajustes` still appears in the nav (via `ROUTE_PERMISSIONS.ajustes` including `produccion`) but without expecting a badge count (the layout only fetches the count for `supervisor`). Restore `DEV_SKIP_AUTH_ROLE=supervisor` afterward. Stop the dev server after.

- [ ] **Step 5: Commit**

```bash
git add components/layout/Sidebar.tsx "app/(panel)/layout.tsx"
git commit -m "feat: agregar badge de ajustes pendientes al Sidebar"
```

---

### Task 3: AdjustmentForm, AdjustmentApproval, and page wiring

**Files:**
- Create: `frontend/components/ajustes/AdjustmentForm.tsx`
- Create: `frontend/components/ajustes/AdjustmentApproval.tsx`
- Modify: `frontend/app/(panel)/ajustes/page.tsx`

**Interfaces:**
- Consumes: `solicitarAjusteSchema`/`SolicitarAjusteInput` and `AjustePendiente` from `@/lib/types/ajustes` (Task 1); `solicitarAjuste`/`fetchAjustesPendientes`/`aprobarAjuste`/`rechazarAjuste` from `@/lib/supabase/ajustes-actions` (Task 1); `formatNumber` (Sprint 3); shadcn `Form`/`Input`/`Textarea`/`Button`/`Table` family (already installed); `RoleGuard`/`ROUTE_PERMISSIONS` (Sprint 2); `getCurrentProfile` (Sprint 2).
- Produces: `AdjustmentForm`, `AdjustmentApproval` components (no props on either). Final task in this plan.

- [ ] **Step 1: Create AdjustmentForm**

Create `frontend/components/ajustes/AdjustmentForm.tsx`:

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
import { solicitarAjusteSchema, type SolicitarAjusteInput } from '@/lib/types/ajustes'
import { solicitarAjuste } from '@/lib/supabase/ajustes-actions'

const VALORES_INICIALES: SolicitarAjusteInput = {
  vin: '',
  cantidad: 0,
  motivo: '',
  evidencia: '',
}

export function AdjustmentForm() {
  const form = useForm<SolicitarAjusteInput>({
    resolver: zodResolver(solicitarAjusteSchema),
    defaultValues: VALORES_INICIALES,
  })

  async function onSubmit(datos: SolicitarAjusteInput) {
    const resultado = await solicitarAjuste(datos)
    if (resultado.ok) {
      toast.success('Solicitud de ajuste enviada.')
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
          name="cantidad"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad Ajuste</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="motivo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motivo</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="evidencia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Evidencia</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Descripción de la evidencia" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Enviando...' : 'Solicitar Ajuste'}
        </Button>
      </form>
    </Form>
  )
}
```

If `useForm<SolicitarAjusteInput>` doesn't type-check against the installed zod/`@hookform/resolvers` versions (the `z.coerce.number()` friction point from Sprint 5), apply the same fix as then: drop the explicit generic (let it infer from `resolver`+`defaultValues`), add a narrow `as number` cast only on the `cantidad` field's `value={...}` JSX binding if needed. Note it in your report.

- [ ] **Step 2: Create AdjustmentApproval**

Create `frontend/components/ajustes/AdjustmentApproval.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  fetchAjustesPendientes,
  aprobarAjuste,
  rechazarAjuste,
} from '@/lib/supabase/ajustes-actions'
import { formatNumber } from '@/lib/format'
import type { AjustePendiente } from '@/lib/types/ajustes'

export function AdjustmentApproval() {
  const [pendientes, setPendientes] = useState<AjustePendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<number | null>(null)

  useEffect(() => {
    cargar()
  }, [])

  function cargar() {
    setLoading(true)
    fetchAjustesPendientes()
      .then(setPendientes)
      .catch((error) => {
        console.error('Failed to fetch ajustes pendientes:', error)
        setPendientes([])
      })
      .finally(() => setLoading(false))
  }

  async function handleAprobar(id: number) {
    setProcesando(id)
    const resultado = await aprobarAjuste(id)
    setProcesando(null)
    if (resultado.ok) {
      toast.success('Ajuste aprobado.')
      cargar()
    } else {
      toast.error(resultado.error)
    }
  }

  async function handleRechazar(id: number) {
    const motivo = window.prompt('Motivo del rechazo:')
    if (!motivo) return
    setProcesando(id)
    const resultado = await rechazarAjuste(id, motivo)
    setProcesando(null)
    if (resultado.ok) {
      toast.success('Ajuste rechazado.')
      cargar()
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Ajustes pendientes de aprobación</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>VIN</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendientes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                {loading ? 'Cargando...' : 'Sin ajustes pendientes.'}
              </TableCell>
            </TableRow>
          ) : (
            pendientes.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.vin}</TableCell>
                <TableCell className="text-right">{formatNumber(item.cantidad)}</TableCell>
                <TableCell>{item.motivo}</TableCell>
                <TableCell>{new Date(item.created_at).toLocaleDateString('es-CO')}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAprobar(item.id)}
                    disabled={procesando === item.id}
                  >
                    Aprobar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRechazar(item.id)}
                    disabled={procesando === item.id}
                  >
                    Rechazar
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

If `Button`'s `size="sm"` prop isn't recognized, open `frontend/components/ui/button.tsx` to confirm the actual size variant name it supports and substitute accordingly — note any substitution in your report (same pattern as prior sprints handling shadcn version differences).

- [ ] **Step 3: Wire the Ajustes page**

Replace the full contents of `frontend/app/(panel)/ajustes/page.tsx` with:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { AdjustmentForm } from '@/components/ajustes/AdjustmentForm'
import { AdjustmentApproval } from '@/components/ajustes/AdjustmentApproval'

export default function AjustesPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.ajustes}>
      <AjustesContent />
    </RoleGuard>
  )
}

async function AjustesContent() {
  const result = await getCurrentProfile()

  if (result.status !== 'authenticated') {
    // Unreachable in practice — RoleGuard already redirected before this
    // renders if there's no session or no profile.
    return null
  }

  const esSupervisor = result.profile.rol === 'supervisor'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-muted-foreground">Solicitar ajuste de inventario</p>
      </div>
      <AdjustmentForm />
      {esSupervisor && <AdjustmentApproval />}
    </div>
  )
}
```

- [ ] **Step 4: Verify types and build**

Run: `npx tsc --noEmit` — expected exit 0.
Run: `npm run build` — expected exit 0 (critical check — `AdjustmentForm`/`AdjustmentApproval` are Client Components importing the Server Actions directly).

- [ ] **Step 5: Verify the page shell renders for both roles**

Confirm `frontend/.env.local` has `DEV_SKIP_AUTH=true` and `DEV_SKIP_AUTH_ROLE=supervisor`. Run `npm run dev` (background), then:

```bash
curl -s http://localhost:3000/ajustes | grep -o "Solicitar Ajuste\|Ajustes pendientes de aprobación\|VIN"
```

Expected: all present, including "Ajustes pendientes de aprobación" (supervisor sees the approval table). Then switch `.env.local` to `DEV_SKIP_AUTH_ROLE=produccion`, restart, run the same curl:

```bash
curl -s http://localhost:3000/ajustes | grep -o "Solicitar Ajuste\|Ajustes pendientes de aprobación"
```

Expected: `Solicitar Ajuste` present, `Ajustes pendientes de aprobación` ABSENT (produccion doesn't see the approval table). Restore `DEV_SKIP_AUTH_ROLE=supervisor` afterward. Stop the dev server after.

- [ ] **Step 6: Commit**

```bash
git add components/ajustes/AdjustmentForm.tsx components/ajustes/AdjustmentApproval.tsx "app/(panel)/ajustes/page.tsx"
git commit -m "feat: agregar formularios de solicitar y aprobar ajustes"
```

---

## After This Plan

Sprint 6 parte 1 (Ajustes) done once Task 3 is committed and reviewed. Remaining:

1. Real browser check of form validation, the reject-reason `window.prompt`, and toast feedback — curl cannot exercise these.
2. Real Supabase project + the `aprobar-ajuste` Edge Function still don't exist — `aprobarAjuste`'s real branch is written correctly against the documented architecture but entirely unverified until both exist.
3. Sprint 6 parte 2 (Importar CSV) is a separate spec/plan.
