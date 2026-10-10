# Crear usuarios desde el panel (Sprint 7, extensión) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el supervisor agregue un usuario nuevo (nombre, correo, contraseña, rol) desde `/usuarios`.

**Architecture:** Se extienden los archivos ya existentes de Sprint 7 (`lib/types/usuarios.ts`, `lib/supabase/usuarios-actions.ts`) con el schema y la Server Action de creación. La Server Action invoca la Edge Function `crear-usuario` (no existe todavía — responsabilidad del equipo de backend, mismo patrón que `aprobar-ajuste` de Sprint 6). Un Client Component nuevo (`CreateUserDialog`) agrega el botón + formulario RHF+Zod, insertado en la página junto a `UsersTable`.

**Tech Stack:** React Hook Form + Zod + `@hookform/resolvers` (ya instalados), `sonner` (ya instalado), shadcn `Dialog`/`Form`/`Input`/`Button` (ya instalados).

## Global Constraints

- TypeScript `strict: true`, sin `any`.
- Server Action file mantiene `'use server'` como PRIMERA línea del archivo (ya está así en `lib/supabase/usuarios-actions.ts` — no se toca esa línea).
- El servicio real nunca usa el service role key de Supabase directamente desde el frontend — la creación de usuarios pasa siempre por `supabase.functions.invoke('crear-usuario', ...)`.
- La Edge Function `crear-usuario` no existe todavía — la rama real de `crearUsuario` queda escrita correctamente pero sin probar hasta que el equipo de backend la implemente (contrato documentado en el spec: recibe `{nombre, email, password, rol}`, crea el usuario de Auth y su fila en `profiles`).
- Bypass dev simula éxito con un delay falso, sin persistir — mismo criterio que el resto del proyecto.

---

### Task 1: Schema de creación de usuario y Server Action

**Files:**
- Modify: `frontend/lib/types/usuarios.ts`
- Modify: `frontend/lib/supabase/usuarios-actions.ts`

**Interfaces:**
- Consumes: `ALL_ROLES`/`Role` desde `@/lib/types/database` (Sprint 1); `isDevBypassActive` (Sprint 2); `createClient` (Sprint 1).
- Produces: `crearUsuarioSchema`, `CrearUsuarioInput` desde `@/lib/types/usuarios`; `crearUsuario(datos: CrearUsuarioInput): Promise<UsuarioResultado>` desde `@/lib/supabase/usuarios-actions`. Task 2 importa estos nombres exactos.

- [ ] **Step 1: Agregar el schema de creación de usuario**

`frontend/lib/types/usuarios.ts` tiene actualmente este contenido completo:

```ts
import type { Role } from '@/lib/types/database'

export interface UsuarioListado {
  id: string
  nombre: string | null
  rol: Role
  activo: boolean
  created_at: string
}

export type UsuarioResultado = { ok: true } | { ok: false; error: string }
```

Reemplázalo por:

```ts
import { z } from 'zod'
import { ALL_ROLES, type Role } from '@/lib/types/database'

export interface UsuarioListado {
  id: string
  nombre: string | null
  rol: Role
  activo: boolean
  created_at: string
}

export type UsuarioResultado = { ok: true } | { ok: false; error: string }

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  email: z.string().trim().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol: z.enum(ALL_ROLES as [Role, ...Role[]]),
})

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>
```

Si `z.enum(ALL_ROLES as [Role, ...Role[]])` no compila contra la versión instalada de zod, usa en su lugar `z.enum(ALL_ROLES as unknown as [Role, ...Role[]])`, o si sigue sin funcionar, reemplázalo por `z.custom<Role>((val) => typeof val === 'string' && (ALL_ROLES as readonly string[]).includes(val), { message: 'Rol inválido' })` — cualquiera de las dos formas es aceptable, anota en tu reporte cuál usaste.

- [ ] **Step 2: Agregar la Server Action `crearUsuario`**

`frontend/lib/supabase/usuarios-actions.ts` tiene actualmente este contenido completo:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewUsuariosData } from '@/lib/dev/preview-usuarios-data'
import type { Role } from '@/lib/types/database'
import type { UsuarioListado, UsuarioResultado } from '@/lib/types/usuarios'

export async function fetchUsuarios(): Promise<UsuarioListado[]> {
  if (isDevBypassActive()) {
    return getDevPreviewUsuariosData()
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, rol, activo, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load profiles:', error)
    return []
  }

  return data ?? []
}

export async function actualizarRolUsuario(id: string, rol: Role): Promise<UsuarioResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('profiles').update({ rol }).eq('id', id)

  if (error) {
    console.error('Failed to update rol:', error)
    return { ok: false, error: 'No se pudo actualizar el rol. Intenta de nuevo.' }
  }

  return { ok: true }
}

export async function actualizarEstadoUsuario(
  id: string,
  activo: boolean
): Promise<UsuarioResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('profiles').update({ activo }).eq('id', id)

  if (error) {
    console.error('Failed to update activo:', error)
    return { ok: false, error: 'No se pudo actualizar el estado. Intenta de nuevo.' }
  }

  return { ok: true }
}
```

Cambia la línea de import de tipos (`import type { UsuarioListado, UsuarioResultado } from '@/lib/types/usuarios'`) por:

```ts
import { crearUsuarioSchema, type CrearUsuarioInput, type UsuarioListado, type UsuarioResultado } from '@/lib/types/usuarios'
```

Y agrega esta función al final del archivo (después de `actualizarEstadoUsuario`):

```ts

export async function crearUsuario(datos: CrearUsuarioInput): Promise<UsuarioResultado> {
  const parsed = crearUsuarioSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const supabase = await createClient()

  const { error } = await supabase.functions.invoke('crear-usuario', {
    body: parsed.data,
  })

  if (error) {
    console.error('Failed to invoke crear-usuario:', error)
    return { ok: false, error: 'No se pudo crear el usuario. Intenta de nuevo.' }
  }

  return { ok: true }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add lib/types/usuarios.ts lib/supabase/usuarios-actions.ts
git commit -m "feat: agregar schema y Server Action para crear usuarios"
```

---

### Task 2: CreateUserDialog y wiring de la página

**Files:**
- Create: `frontend/components/usuarios/CreateUserDialog.tsx`
- Modify: `frontend/app/(panel)/usuarios/page.tsx`

**Interfaces:**
- Consumes: `ALL_ROLES`/`Role` desde `@/lib/types/database` (Sprint 1); `crearUsuarioSchema`/`CrearUsuarioInput` desde `@/lib/types/usuarios` (Task 1); `crearUsuario` desde `@/lib/supabase/usuarios-actions` (Task 1); shadcn `Dialog`/`Form`/`Input`/`Button` (ya instalados).
- Produces: `CreateUserDialog` (sin props). Última tarea de este plan.

- [ ] **Step 1: Crear CreateUserDialog**

Create `frontend/components/usuarios/CreateUserDialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ALL_ROLES, type Role } from '@/lib/types/database'
import { crearUsuarioSchema, type CrearUsuarioInput } from '@/lib/types/usuarios'
import { crearUsuario } from '@/lib/supabase/usuarios-actions'

const VALORES_INICIALES: CrearUsuarioInput = {
  nombre: '',
  email: '',
  password: '',
  rol: 'lectura',
}

export function CreateUserDialog() {
  const [abierto, setAbierto] = useState(false)

  const form = useForm<CrearUsuarioInput>({
    resolver: zodResolver(crearUsuarioSchema),
    defaultValues: VALORES_INICIALES,
  })

  async function onSubmit(datos: CrearUsuarioInput) {
    const resultado = await crearUsuario(datos)
    if (resultado.ok) {
      toast.success('Usuario creado.')
      setAbierto(false)
      form.reset(VALORES_INICIALES)
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setAbierto(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Agregar usuario
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar usuario</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                      >
                        {ALL_ROLES.map((rol: Role) => (
                          <option key={rol} value={rol}>
                            {rol}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creando...' : 'Crear usuario'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Insertar el diálogo en la página de Usuarios**

`frontend/app/(panel)/usuarios/page.tsx` tiene actualmente este contenido completo:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { UsersTable } from '@/components/usuarios/UsersTable'

export default function UsuariosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.usuarios}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-muted-foreground">Gestión de roles y acceso</p>
        </div>
        <UsersTable />
      </div>
    </RoleGuard>
  )
}
```

Reemplázalo por:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { UsersTable } from '@/components/usuarios/UsersTable'
import { CreateUserDialog } from '@/components/usuarios/CreateUserDialog'

export default function UsuariosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.usuarios}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Usuarios</h1>
            <p className="text-muted-foreground">Gestión de roles y acceso</p>
          </div>
          <CreateUserDialog />
        </div>
        <UsersTable />
      </div>
    </RoleGuard>
  )
}
```

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit` — esperado exit 0.
Run: `npm run build` — esperado exit 0 (chequeo crítico: `CreateUserDialog` es Client Component que importa la Server Action de Task 1 directamente).

- [ ] **Step 4: Verificar visualmente con curl**

Confirma que `frontend/.env.local` tiene `DEV_SKIP_AUTH=true` y `DEV_SKIP_AUTH_ROLE=supervisor`. Corre `npm run dev` (background — revisa antes si ya hay un servidor en el puerto 3000 de una sesión previa y mátalo primero), luego:

```bash
curl -s http://localhost:3000/usuarios | grep -o "Agregar usuario"
```

Expected: presente. Detén el servidor de dev después.

- [ ] **Step 5: Commit**

```bash
git add components/usuarios/CreateUserDialog.tsx "app/(panel)/usuarios/page.tsx"
git commit -m "feat: agregar formulario para crear usuarios desde el panel"
```

---

## After This Plan

1. Verificación manual en navegador real de: llenar el formulario, ver el toast, que el diálogo se cierre — curl no puede ejercitar interacción de clicks ni el Dialog.
2. La Edge Function `crear-usuario` no existe todavía — la rama real queda escrita correctamente pero sin probar hasta que el equipo de backend la implemente (mismo estado que `aprobar-ajuste`).
3. Con esto, Sprint 7 queda completo (rol, activo/inactivo, y ahora creación de usuarios). Queda pendiente del plan original de 8 sprints: Sprint 8 (deploy/VPS).
