# Importar CSV (Sprint 6 parte 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el placeholder de `/importar` por un formulario de carga masiva de entradas de inventario vía CSV, con preview y validación en el navegador antes de enviar nada.

**Architecture:** El CSV se parsea enteramente en el navegador con PapaParse; cada fila se valida con el `entradaSchema` ya existente (Sprint 5, `lib/types/entradas.ts` — no se crea un schema nuevo). Un Server Action nuevo (`crearEntradasMasivas`, `'use server'` a nivel de archivo) inserta solo las filas válidas en un único `insert` con array sobre `movimientos_inventario` (tabla que ya existe en el schema real).

**Tech Stack:** PapaParse (dependencia nueva), Zod (ya instalado), sonner (ya instalado), shadcn `Table`/`Button` (ya instalados).

## Global Constraints

- TypeScript `strict: true`, sin `any`.
- Server Action file con `'use server'` como PRIMERA línea del archivo (lección ya establecida — la forma por función rompe `npm run build` cuando un Client Component importa la acción directamente).
- El Server Action re-valida cada fila con `entradaSchema.safeParse` server-side, aunque el cliente ya validó — nunca confiar solo en la validación del cliente.
- Cada llamada a Supabase revisa `{ error }`, lo loguea, y cae a un fallback seguro — nunca lanza excepción.
- Reutilizar `entradaSchema`/`EntradaInput` de `@/lib/types/entradas` tal cual — no duplicar el schema de validación.
- `movimientos_inventario` ya existe en el schema real (confirmado en sprints anteriores) — a diferencia de Ajustes/Calendario, esta funcionalidad no depende de que el backend cree nada nuevo.

---

### Task 1: Tipos y Server Action de importación

**Files:**
- Create: `frontend/lib/types/importar.ts`
- Create: `frontend/lib/supabase/importar-actions.ts`

**Interfaces:**
- Consumes: `entradaSchema`/`EntradaInput` desde `@/lib/types/entradas` (Sprint 5); `createClient` (Sprint 1); `getSessionUser` (Sprint 1); `isDevBypassActive` (Sprint 2).
- Produces: `FilaCsv`, `ImportarResultado` desde `@/lib/types/importar`; `crearEntradasMasivas(filas: EntradaInput[]): Promise<ImportarResultado>` desde `@/lib/supabase/importar-actions`. Task 2 importa estos nombres exactos.

- [ ] **Step 1: Instalar PapaParse**

Run desde `frontend/`:

```bash
npm install papaparse
npm install -D @types/papaparse
```

- [ ] **Step 2: Crear los tipos**

Create `frontend/lib/types/importar.ts`:

```ts
import type { EntradaInput } from '@/lib/types/entradas'

export interface FilaCsv {
  numeroFila: number
  valores: Record<string, string>
  valida: boolean
  datos?: EntradaInput
  errores: string[]
}

export type ImportarResultado =
  | { ok: true; insertados: number }
  | { ok: false; error: string }
```

- [ ] **Step 3: Crear la Server Action**

Create `frontend/lib/supabase/importar-actions.ts` — `'use server'` debe ser la PRIMERA línea del archivo:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { entradaSchema, type EntradaInput } from '@/lib/types/entradas'
import type { ImportarResultado } from '@/lib/types/importar'

export async function crearEntradasMasivas(filas: EntradaInput[]): Promise<ImportarResultado> {
  const validas = filas.filter((fila) => entradaSchema.safeParse(fila).success)

  if (validas.length === 0) {
    return { ok: false, error: 'No hay filas válidas para importar.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    return { ok: true, insertados: validas.length }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const filasParaInsertar = validas.map((fila) => ({
    vin: fila.vin,
    marca: fila.marca,
    categoria: fila.categoria,
    cantidad: fila.cantidad,
    valor_unitario: fila.valor_unitario ?? null,
    ubicacion: fila.ubicacion,
    motivo: fila.notas ?? null,
    tipo_movimiento: 'entrada' as const,
    estado: 'aplicado' as const,
    actor_id: user.id,
  }))

  const { error } = await supabase.from('movimientos_inventario').insert(filasParaInsertar)

  if (error) {
    console.error('Failed to insert entradas masivas:', error)
    return { ok: false, error: 'No se pudo importar. Intenta de nuevo.' }
  }

  return { ok: true, insertados: validas.length }
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/types/importar.ts lib/supabase/importar-actions.ts
git commit -m "feat: agregar tipos y Server Action para importar entradas via CSV"
```

---

### Task 2: CsvImportForm y wiring de la página

**Files:**
- Create: `frontend/components/importar/CsvImportForm.tsx`
- Modify: `frontend/app/(panel)/importar/page.tsx`

**Interfaces:**
- Consumes: `entradaSchema` desde `@/lib/types/entradas` (Sprint 5); `FilaCsv` desde `@/lib/types/importar` (Task 1); `crearEntradasMasivas` desde `@/lib/supabase/importar-actions` (Task 1); shadcn `Table`/`Button` (ya instalados); `RoleGuard`/`ROUTE_PERMISSIONS` (Sprint 2).
- Produces: `CsvImportForm` (sin props). Última tarea de este plan.

- [ ] **Step 1: Crear CsvImportForm**

Create `frontend/components/importar/CsvImportForm.tsx`:

```tsx
'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { entradaSchema } from '@/lib/types/entradas'
import { crearEntradasMasivas } from '@/lib/supabase/importar-actions'
import type { FilaCsv } from '@/lib/types/importar'

export function CsvImportForm() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [filas, setFilas] = useState<FilaCsv[]>([])
  const [enviando, setEnviando] = useState(false)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const filasProcesadas: FilaCsv[] = results.data.map((valores, i) => {
          const parsed = entradaSchema.safeParse(valores)
          return {
            numeroFila: i + 1,
            valores,
            valida: parsed.success,
            datos: parsed.success ? parsed.data : undefined,
            errores: parsed.success ? [] : parsed.error.issues.map((issue) => issue.message),
          }
        })
        setFilas(filasProcesadas)
      },
    })
  }

  const filasValidas = filas.filter((f) => f.valida && f.datos)

  async function handleImportar() {
    setEnviando(true)
    const datos = filasValidas.map((f) => f.datos!)
    const resultado = await crearEntradasMasivas(datos)
    setEnviando(false)
    if (resultado.ok) {
      toast.success(`${resultado.insertados} entradas importadas.`)
      setFilas([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          El archivo debe tener las columnas: vin, marca, categoria, cantidad, valor_unitario,
          ubicacion, notas.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="text-sm"
        />
      </div>

      {filas.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  <TableHead>VIN</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((fila) => (
                  <TableRow key={fila.numeroFila}>
                    <TableCell>{fila.numeroFila}</TableCell>
                    <TableCell>{fila.valores.vin ?? '—'}</TableCell>
                    <TableCell>
                      {fila.valida ? (
                        <span className="text-green-600">✓ Válida</span>
                      ) : (
                        <span className="text-red-500">✗ {fila.errores.join(', ')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            type="button"
            onClick={handleImportar}
            disabled={filasValidas.length === 0 || enviando}
          >
            {enviando ? 'Importando...' : `Importar ${filasValidas.length} filas válidas`}
          </Button>
        </>
      )}
    </div>
  )
}
```

Si `Papa.parse` no tipa bien contra `@types/papaparse` (ej. el genérico de `results.data`), ajusta el tipo mínimamente (p. ej. anotar `results: Papa.ParseResult<Record<string, string>>` en el callback) sin usar `any`, y anótalo en tu reporte.

- [ ] **Step 2: Reescribir la página de Importar**

Replace el contenido completo de `frontend/app/(panel)/importar/page.tsx` con:

```tsx
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { CsvImportForm } from '@/components/importar/CsvImportForm'

export default function ImportarPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.importar}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Importar CSV</h1>
          <p className="text-muted-foreground">Carga masiva de entradas de inventario</p>
        </div>
        <CsvImportForm />
      </div>
    </RoleGuard>
  )
}
```

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit` — esperado exit 0.
Run: `npm run build` — esperado exit 0 (chequeo crítico: `CsvImportForm` es Client Component que importa la Server Action de Task 1 directamente).

- [ ] **Step 4: Verificar visualmente con curl**

Confirma que `frontend/.env.local` tiene `DEV_SKIP_AUTH=true` y `DEV_SKIP_AUTH_ROLE=supervisor` (o `compras`, ambos permitidos por `ROUTE_PERMISSIONS.importar`). Corre `npm run dev` (background), luego:

```bash
curl -s http://localhost:3000/importar | grep -o "Importar CSV\|vin, marca, categoria"
```

Expected: ambos presentes. Detén el servidor de dev después.

- [ ] **Step 5: Commit**

```bash
git add components/importar/CsvImportForm.tsx "app/(panel)/importar/page.tsx"
git commit -m "feat: agregar formulario de importar CSV de entradas"
```

---

## After This Plan

1. Verificación manual en navegador real con un archivo CSV de ejemplo (subir, ver preview, importar) — curl no puede ejercitar la subida de archivos ni el parseo real.
2. A diferencia de Ajustes/Calendario, esta funcionalidad no depende de tablas nuevas — debería funcionar contra Supabase real apenas exista el proyecto, sin cambios adicionales.
3. Quedan pendientes del plan original de 8 sprints: Sprint 7 (Gestión de Usuarios, ruta `/usuarios` ya placeholder) y Sprint 8 (deploy/VPS).
