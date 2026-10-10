# Panel Carrera Arango — Sprint 7 (Gestión de Usuarios) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el placeholder de `/usuarios` por una tabla de administración (solo `supervisor`) que lista todos los usuarios y permite cambiar su rol y activar/desactivar su cuenta.

**Architecture:** Un Server Action file (`lib/supabase/usuarios-actions.ts`, `'use server'` a nivel de archivo) expone `fetchUsuarios`, `actualizarRolUsuario`, `actualizarEstadoUsuario` sobre la tabla `profiles` ya existente. Un Client Component (`components/usuarios/UsersTable.tsx`) hace su propio fetch al montar (mismo patrón que `AdjustmentApproval`, Sprint 6) y aplica cada cambio de inmediato (sin diálogo de confirmación), actualizando su estado local de forma optimista tras cada éxito.

**Tech Stack:** shadcn `Table`/`Button` (ya instalados), `sonner` (ya instalado). Sin dependencias nuevas.

## Global Constraints

- TypeScript `strict: true`, sin `any`.
- Server Action file con `'use server'` como PRIMERA línea del archivo (lección ya establecida — la forma por función rompe `npm run build` cuando un Client Component importa la acción directamente).
- Cada llamada a Supabase revisa `{ error }`, lo loguea, y cae a un fallback seguro (`[]` en lecturas, `{ok:false,error}` en mutaciones) — nunca lanza excepción.
- `profiles` ya existe en el schema real (`id, nombre, rol, activo, created_at`) — no se crea tabla nueva ni se documenta SQL para backend.
- No se toca el tipo compartido `Profile` de `lib/types/database.ts` (lo consumen Sidebar/RoleGuard/sesión) — se define un tipo `UsuarioListado` propio de esta página.
- Sin creación de usuarios nuevos, sin guardas de auto-bloqueo, sin diálogos de confirmación — decisiones de alcance ya tomadas en el spec.

---

### Task 1: Tipos, datos de ejemplo y Server Actions de usuarios

**Files:**
- Create: `frontend/lib/types/usuarios.ts`
- Create: `frontend/lib/dev/preview-usuarios-data.ts`
- Create: `frontend/lib/supabase/usuarios-actions.ts`

**Interfaces:**
- Consumes: `createClient` (Sprint 1); `isDevBypassActive` (Sprint 2); `Role` desde `@/lib/types/database` (Sprint 1).
- Produces: `UsuarioListado`, `UsuarioResultado` desde `@/lib/types/usuarios`; `getDevPreviewUsuariosData(): UsuarioListado[]` desde `@/lib/dev/preview-usuarios-data`; `fetchUsuarios`, `actualizarRolUsuario`, `actualizarEstadoUsuario` desde `@/lib/supabase/usuarios-actions`. Task 2 importa estos nombres exactos.

- [ ] **Step 1: Crear los tipos**

Create `frontend/lib/types/usuarios.ts`:

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

- [ ] **Step 2: Crear los datos de ejemplo**

Create `frontend/lib/dev/preview-usuarios-data.ts`:

```ts
import type { UsuarioListado } from '@/lib/types/usuarios'

export function getDevPreviewUsuariosData(): UsuarioListado[] {
  return [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      nombre: 'Ana Martínez',
      rol: 'supervisor',
      activo: true,
      created_at: '2026-01-10T08:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      nombre: 'Carlos Ruiz',
      rol: 'comercial',
      activo: true,
      created_at: '2026-01-15T08:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      nombre: 'Diana Gómez',
      rol: 'ingenieria',
      activo: true,
      created_at: '2026-02-01T08:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000004',
      nombre: 'Esteban Torres',
      rol: 'produccion',
      activo: false,
      created_at: '2026-02-10T08:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000005',
      nombre: 'Fernanda López',
      rol: 'compras',
      activo: true,
      created_at: '2026-02-20T08:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000006',
      nombre: 'Gabriel Ortiz',
      rol: 'auditoria',
      activo: false,
      created_at: '2026-03-01T08:00:00.000Z',
    },
  ]
}
```

- [ ] **Step 3: Crear las Server Actions**

Create `frontend/lib/supabase/usuarios-actions.ts` — `'use server'` debe ser la PRIMERA línea del archivo:

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

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add lib/types/usuarios.ts lib/dev/preview-usuarios-data.ts lib/supabase/usuarios-actions.ts
git commit -m "feat: agregar tipos, datos de ejemplo y Server Actions de usuarios"
```

---

### Task 2: UsersTable y wiring de la página

**Files:**
- Create: `frontend/components/usuarios/UsersTable.tsx`
- Modify: `frontend/app/(panel)/usuarios/page.tsx`

**Interfaces:**
- Consumes: `ALL_ROLES`/`Role` desde `@/lib/types/database` (Sprint 1); `UsuarioListado` desde `@/lib/types/usuarios` (Task 1); `fetchUsuarios`/`actualizarRolUsuario`/`actualizarEstadoUsuario` desde `@/lib/supabase/usuarios-actions` (Task 1); shadcn `Table`/`Button` (ya instalados); `RoleGuard`/`ROUTE_PERMISSIONS` (Sprint 2).
- Produces: `UsersTable` (sin props). Última tarea de este plan.

- [ ] **Step 1: Crear UsersTable**

Create `frontend/components/usuarios/UsersTable.tsx`:

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
import { ALL_ROLES, type Role } from '@/lib/types/database'
import {
  fetchUsuarios,
  actualizarRolUsuario,
  actualizarEstadoUsuario,
} from '@/lib/supabase/usuarios-actions'
import type { UsuarioListado } from '@/lib/types/usuarios'

export function UsersTable() {
  const [usuarios, setUsuarios] = useState<UsuarioListado[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)

  useEffect(() => {
    fetchUsuarios()
      .then(setUsuarios)
      .catch((error) => {
        console.error('Failed to fetch usuarios:', error)
        setUsuarios([])
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCambiarRol(id: string, rol: Role) {
    setProcesando(id)
    const resultado = await actualizarRolUsuario(id, rol)
    setProcesando(null)
    if (resultado.ok) {
      toast.success('Rol actualizado.')
      setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, rol } : u)))
    } else {
      toast.error(resultado.error)
    }
  }

  async function handleToggleEstado(id: string, activoActual: boolean) {
    setProcesando(id)
    const resultado = await actualizarEstadoUsuario(id, !activoActual)
    setProcesando(null)
    if (resultado.ok) {
      toast.success(activoActual ? 'Usuario desactivado.' : 'Usuario activado.')
      setUsuarios((prev) =>
        prev.map((u) => (u.id === id ? { ...u, activo: !activoActual } : u))
      )
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {usuarios.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              {loading ? 'Cargando...' : 'Sin usuarios.'}
            </TableCell>
          </TableRow>
        ) : (
          usuarios.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell className="font-medium">{usuario.nombre ?? '—'}</TableCell>
              <TableCell>
                <select
                  value={usuario.rol}
                  disabled={procesando === usuario.id}
                  onChange={(e) => handleCambiarRol(usuario.id, e.target.value as Role)}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                >
                  {ALL_ROLES.map((rol) => (
                    <option key={rol} value={rol}>
                      {rol}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                {usuario.activo ? (
                  <span className="text-green-600">Activo</span>
                ) : (
                  <span className="text-muted-foreground">Inactivo</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={procesando === usuario.id}
                  onClick={() => handleToggleEstado(usuario.id, usuario.activo)}
                >
                  {usuario.activo ? 'Desactivar' : 'Activar'}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Reescribir la página de Usuarios**

Replace el contenido completo de `frontend/app/(panel)/usuarios/page.tsx` con:

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

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit` — esperado exit 0.
Run: `npm run build` — esperado exit 0 (chequeo crítico: `UsersTable` es Client Component que importa las Server Actions de Task 1 directamente).

- [ ] **Step 4: Verificar visualmente con curl**

Confirma que `frontend/.env.local` tiene `DEV_SKIP_AUTH=true` y `DEV_SKIP_AUTH_ROLE=supervisor` (única role permitida en `ROUTE_PERMISSIONS.usuarios`). Corre `npm run dev` (background), luego:

```bash
curl -s http://localhost:3000/usuarios | grep -o "Ana Martínez\|supervisor\|Activo"
```

Expected: los tres presentes. Detén el servidor de dev después.

- [ ] **Step 5: Commit**

```bash
git add components/usuarios/UsersTable.tsx "app/(panel)/usuarios/page.tsx"
git commit -m "feat: agregar tabla de gestion de usuarios"
```

---

## After This Plan

1. Verificación manual en navegador real de: cambiar un rol en el `<select>`, alternar activo/inactivo — curl no puede ejercitar interacción.
2. `profiles` ya existe en el schema real — a diferencia de Ajustes/Calendario, esta funcionalidad debería funcionar contra Supabase real apenas exista el proyecto (sujeto a que la política RLS de `profiles` permita `update` a un `supervisor` sobre cualquier fila — no verificable desde el frontend).
3. Con esto termina el Sprint 7. Queda pendiente del plan original de 8 sprints: Sprint 8 (deploy/VPS).
