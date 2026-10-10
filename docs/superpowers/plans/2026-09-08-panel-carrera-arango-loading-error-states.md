# Estados de carga y error del panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar estados de carga (`loading.tsx`) y de error (`error.tsx`) a todas las rutas del panel, más un error global y una página 404, usando componentes visuales compartidos.

**Architecture:** Dos componentes presentacionales compartidos (`LoadingSkeleton`, `ErrorState`) reutilizados por los `loading.tsx`/`error.tsx` de cada ruta, siguiendo las convenciones de archivo especial de Next.js App Router (Suspense automático por `loading.tsx`, error boundary por `error.tsx`, con bubbling hacia el padre si una ruta hija no define el suyo).

**Tech Stack:** Next.js App Router file conventions (`loading.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`). Sin dependencias nuevas.

## Global Constraints

- TypeScript `strict: true`, sin `any`.
- `error.tsx` y `global-error.tsx` DEBEN ser Client Components (`'use client'` como primera línea) — es un requisito de Next.js, no una elección de estilo.
- `global-error.tsx` reemplaza el root layout completo cuando se activa, por eso DEBE incluir sus propias etiquetas `<html>` y `<body>` — a diferencia de cualquier otro archivo de este plan.
- `loading.tsx` NO se propaga a rutas hijas — cada carpeta de ruta necesita su propio archivo para tener estado de carga.
- `error.tsx` SÍ se propaga hacia arriba — una ruta sin su propio `error.tsx` usa el del segmento padre más cercano que sí tenga uno. Por eso un solo `app/(panel)/error.tsx` cubre el dashboard y todas las rutas anidadas (`/inventario`, `/movimientos`, etc.) que no definen uno propio.
- No se modifica ninguna página existente — este plan solo agrega archivos nuevos.

---

### Task 1: Componentes compartidos de carga y error

**Files:**
- Create: `frontend/components/shared/LoadingSkeleton.tsx`
- Create: `frontend/components/shared/ErrorState.tsx`

**Interfaces:**
- Consumes: `Button` desde `@/components/ui/button` (ya instalado); `lucide-react` (ya instalado).
- Produces: `LoadingSkeleton` (sin props) desde `@/components/shared/LoadingSkeleton`; `ErrorState({message?, onRetry?})` desde `@/components/shared/ErrorState`. Tasks 2-4 importan estos nombres exactos.

- [ ] **Step 1: Crear LoadingSkeleton**

Create `frontend/components/shared/LoadingSkeleton.tsx`:

```tsx
export function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  )
}
```

- [ ] **Step 2: Crear ErrorState**

Create `frontend/components/shared/ErrorState.tsx`:

```tsx
'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ErrorState({
  message = 'Ocurrió un error inesperado.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <p className="text-lg font-medium">{message}</p>
      <p className="text-sm text-muted-foreground">
        Intenta de nuevo. Si el problema persiste, contacta a soporte.
      </p>
      {onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add components/shared/LoadingSkeleton.tsx components/shared/ErrorState.tsx
git commit -m "feat: agregar componentes compartidos de estado de carga y error"
```

---

### Task 2: loading.tsx para cada ruta del panel

**Files:**
- Create: `frontend/app/(panel)/loading.tsx`
- Create: `frontend/app/(panel)/inventario/loading.tsx`
- Create: `frontend/app/(panel)/movimientos/loading.tsx`
- Create: `frontend/app/(panel)/entradas/loading.tsx`
- Create: `frontend/app/(panel)/ajustes/loading.tsx`
- Create: `frontend/app/(panel)/importar/loading.tsx`
- Create: `frontend/app/(panel)/usuarios/loading.tsx`

**Interfaces:**
- Consumes: `LoadingSkeleton` desde `@/components/shared/LoadingSkeleton` (Task 1).
- Produces: nada nuevo — son archivos de convención de Next.js, no se importan desde código propio.

- [ ] **Step 1: Crear los 7 archivos `loading.tsx`**

Cada uno de los 7 archivos listados arriba tiene EXACTAMENTE este mismo contenido:

```tsx
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'

export default function Loading() {
  return <LoadingSkeleton />
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add "app/(panel)/loading.tsx" "app/(panel)/inventario/loading.tsx" "app/(panel)/movimientos/loading.tsx" "app/(panel)/entradas/loading.tsx" "app/(panel)/ajustes/loading.tsx" "app/(panel)/importar/loading.tsx" "app/(panel)/usuarios/loading.tsx"
git commit -m "feat: agregar estados de carga a las rutas del panel"
```

---

### Task 3: error.tsx del panel, global-error.tsx y not-found.tsx

**Files:**
- Create: `frontend/app/(panel)/error.tsx`
- Create: `frontend/app/global-error.tsx`
- Create: `frontend/app/not-found.tsx`

**Interfaces:**
- Consumes: `ErrorState` desde `@/components/shared/ErrorState` (Task 1).
- Produces: nada nuevo — son archivos de convención de Next.js.

- [ ] **Step 1: Crear el error boundary del panel**

Create `frontend/app/(panel)/error.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/shared/ErrorState'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Panel route error:', error)
  }, [error])

  return <ErrorState onRetry={reset} />
}
```

- [ ] **Step 2: Crear el error global**

Create `frontend/app/global-error.tsx` — DEBE incluir `<html>`/`<body>` propios porque reemplaza el root layout completo cuando se activa:

```tsx
'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/shared/ErrorState'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="es">
      <body>
        <ErrorState message="La aplicación tuvo un error inesperado." onRetry={reset} />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Crear la página 404**

Create `frontend/app/not-found.tsx`:

```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-lg font-medium">Página no encontrada</p>
      <p className="text-sm text-muted-foreground">
        La página que buscas no existe o fue movida.
      </p>
      <Link
        href="/"
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit` — esperado exit 0.
Run: `npm run build` — esperado exit 0.

- [ ] **Step 5: Verificar con curl que las rutas del panel siguen respondiendo**

Confirma que `frontend/.env.local` tiene `DEV_SKIP_AUTH=true` y `DEV_SKIP_AUTH_ROLE=supervisor`. Corre `npm run dev` (background — revisa antes si ya hay un servidor en el puerto 3000 y mátalo primero), luego:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/inventario
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/ruta-que-no-existe
```

Expected: los primeros dos `200`, el tercero `404`. Detén el servidor de dev después.

- [ ] **Step 6: Commit**

```bash
git add "app/(panel)/error.tsx" app/global-error.tsx app/not-found.tsx
git commit -m "feat: agregar error boundary del panel, error global y pagina 404"
```

---

## After This Plan

1. Verificación manual en navegador real: forzar un error (ej. lanzar una excepción temporalmente en una página) para confirmar que `error.tsx` captura y el botón "Reintentar" funciona — no verificable por curl.
2. El `loading.tsx` solo se nota visualmente en conexiones lentas o con throttling — con `DEV_SKIP_AUTH` los datos de ejemplo cargan casi instantáneo, así que el skeleton pasa muy rápido en desarrollo normal.
3. `error.tsx` de `app/(panel)/` NO captura errores lanzados dentro de `app/(panel)/layout.tsx` mismo (limitación conocida de Next.js: un error boundary no cubre el layout de su propio segmento) — para eso está `global-error.tsx`, que sí lo cubre al estar en el segmento raíz.
