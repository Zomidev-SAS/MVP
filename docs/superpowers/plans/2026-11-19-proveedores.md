# Sección Proveedores — Plan de implementación

> **Para quien ejecute:** usar superpowers:executing-plans (inline, como en las tareas anteriores de esta sesión) o superpowers:subagent-driven-development. Los pasos usan casillas `- [ ]`.

**Objetivo:** agregar al panel la sección Proveedores: catálogo con filtro, historial por proveedor con las columnas del Excel de referencia, desempeño por OC (calidad, devoluciones, cantidad, tiempo), reevaluación anual con porcentaje, evaluación de selección con cuadro comparativo, y constancias en CSV y PDF.

**Arquitectura:** cuatro migraciones nuevas (080–083, las aplica backend) más una librería pura de cálculo (`lib/proveedores/`), Server Actions con `requireRole`, páginas Server Component con componentes cliente, y exportaciones con `papaparse` y `jspdf` (ya instalados). Cantidad y tiempo se calculan solos desde la OC; calidad, devoluciones y observaciones se capturan a mano.

**Tech stack:** Next.js 16 (App Router), React, TypeScript, Supabase, `react-hook-form` + `zod`, shadcn sobre `@base-ui/react`, `lucide-react`, `jspdf` + `jspdf-autotable`, `papaparse`.

**Spec:** `docs/superpowers/specs/2026-11-19-proveedores-design.md` — leerlo antes de empezar.

## Restricciones globales

- **Next.js 16 tiene cambios incompatibles** (`frontend/AGENTS.md`): antes de escribir páginas, layouts o Server Actions nuevos, leer la guía correspondiente en `frontend/node_modules/next/dist/docs/`. En rutas dinámicas `params` es una `Promise` (`const { id } = await params`), igual que `app/planta/[token]/page.tsx`.
- **Archivos `'use server'` solo exportan funciones `async`.** Tipos, esquemas `zod` y constantes van en `lib/types/` o `lib/proveedores/`.
- **Regla de lint `react-hooks/set-state-in-effect`:** no llamar `setState` directo en el cuerpo de un `useEffect`; ponerlo dentro del callback de un `setTimeout` o de una promesa (patrón de `FormulariosTable.tsx` y `VehiculoProcesoDialog.tsx`).
- Los componentes de `components/ui` usan `@base-ui/react`, no Radix: revisar el archivo del componente antes de usar props (ej. `Input` no reenvía `ref`; `Menu.Item` no tiene `onSelect`).
- **Roles:** `ROUTE_PERMISSIONS.proveedores = ['supervisor', 'comercial', 'compras', 'auditoria']`. Todos ven y modifican; borrar solo `supervisor`. Dentro de las Server Actions usar `requireRole(ROUTE_PERMISSIONS.proveedores)` (y `['supervisor']` para borrar).
- **Backend:** las migraciones se dejan escritas en `supabase/migrations/`; **no** se corre `supabase db push` ni se aplica nada a la base. Si una tabla/columna aún no existe (código Postgres `42P01` / `42703`), la Server Action devuelve `{ error: 'migracion_pendiente' }` y la UI muestra un aviso con el número de migración, como hace `FormulariosTable`.
- **Preview (`DEV_SKIP_AUTH`):** cada acción de lectura devuelve datos de `lib/dev/preview-proveedores-data.ts`; las de escritura validan con `zod`, esperan ~400 ms y devuelven `{ ok: true }` sin persistir (patrón de `calendario-actions.ts`).
- Todo el texto de interfaz y los nombres en español. Commits en español, sin `Co-Authored-By`.
- **No hay framework de tests** en el repo. Verificación por tarea: `npx tsc --noEmit` y `npm run lint` (los errores de `set-state-in-effect` en archivos ajenos ya existían; solo importan los de archivos nuevos). Las fórmulas de `lib/proveedores/desempeno.ts` se comprueban además con un script desechable en el scratchpad (`node --experimental-strip-types`), que **no** se commitea. Verificación funcional final: manual en el navegador con `DEV_SKIP_AUTH=true` (si ya hay un `next dev` corriendo en este directorio, usar ese; Next no permite dos instancias en la misma carpeta).
- Exportaciones CSV: separador `;`, UTF-8 con BOM, `escapeFormulae: true`.

## Mapa de archivos

**Migraciones (backend aplica):** `080_proveedores.sql`, `081_proveedor_desempeno.sql`, `082_proveedor_reevaluaciones.sql`, `083_proveedor_selecciones.sql`.

**Lógica pura (`frontend/lib/proveedores/`):** `nit.ts`, `desempeno.ts` (puntajes), `historial.ts` (arma las filas desde OC + desempeño), `reevaluacion.ts`, `seleccion.ts`, `importacion.ts` (lectura y validación de CSV).

**Tipos (`frontend/lib/types/`):** `proveedor.ts`, `proveedor-desempeno.ts`, `proveedor-reevaluacion.ts`, `proveedor-seleccion.ts`.

**Server Actions (`frontend/lib/supabase/`):** `proveedores-actions.ts`, `proveedor-desempeno-actions.ts`, `proveedor-config-actions.ts`, `proveedor-reevaluacion-actions.ts`, `proveedor-seleccion-actions.ts`.

**Exportaciones (`frontend/lib/export/`):** `csv.ts` (helper común), `proveedor-desempeno.ts`, `proveedor-reevaluacion.ts`, `proveedor-seleccion.ts`.

**Preview:** `frontend/lib/dev/preview-proveedores-data.ts`.

**Páginas:** `app/(panel)/proveedores/page.tsx` + `loading.tsx`, `app/(panel)/proveedores/[id]/page.tsx` + `loading.tsx`, `app/(panel)/proveedores/seleccion/[id]/page.tsx` + `loading.tsx`.

**Componentes (`frontend/components/proveedores/`):** `SelectorProveedor.tsx` (desplegable buscable con todos los proveedores por nombre, reutilizable), `ProveedoresTabs.tsx`, `ProveedoresLista.tsx`, `ProveedorFormDialog.tsx`, `ImportarProveedoresDialog.tsx`, `ProveedorFicha.tsx`, `HistorialTabla.tsx`, `DesempenoDialog.tsx`, `ImportarHistorialDialog.tsx`, `ReevaluacionPanel.tsx`, `SeleccionLista.tsx`, `SeleccionEditor.tsx`, `AvisoMigracion.tsx`; y `components/configuracion/ProveedoresConfig.tsx`.

**Modificados:** `lib/permissions/roles.ts`, `components/layout/Sidebar.tsx` (y `MobileSidebarSheet.tsx` si duplica la lógica de activo), `app/(panel)/configuracion/page.tsx`, `components/compras/OrdenDetalle.tsx` (un botón/enlace).

---

# FASE 1 — Sección, catálogo e historial

Entregable: la sección existe en el menú, se ve y filtra el catálogo de proveedores, se importan proveedores por CSV y cada proveedor tiene su historial de OC con las columnas del Excel calculadas solas.

### Tarea 1: Migración 080 (catálogo de proveedores)

**Archivos:** crear `supabase/migrations/080_proveedores.sql`.

- [ ] **Paso 1: escribir la migración**

```sql
-- 080: catálogo de proveedores (sección Proveedores del panel).
--
-- Hasta ahora el proveedor solo existía repetido dentro de cada línea de OC (NIT, nombre, correo).
-- Esta tabla es el catálogo: se siembra con los proveedores ya usados en las OC y se mantiene
-- sola con un trigger cuando se crea una línea con un NIT nuevo. El NIT se compara solo por
-- dígitos (nit_normalizado), así "890.900.123-4" y "8909001234" son el mismo proveedor.
-- Todos los roles de la sección (supervisor, comercial, compras, auditoria) ven y modifican;
-- borrar solo supervisor.

begin;

create table if not exists proveedores (
  id              bigint generated always as identity primary key,
  nit             text not null check (length(trim(nit)) >= 1),
  nit_normalizado text generated always as (regexp_replace(nit, '\D', '', 'g')) stored,
  nombre          text not null check (length(trim(nombre)) >= 1),
  email           text,
  telefono        text,
  contacto        text,
  notas           text,
  activo          boolean not null default true,
  origen          text not null default 'manual' check (origen in ('manual', 'oc', 'importado', 'siigo')),
  creado_por      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint proveedores_nit_con_numeros check (regexp_replace(nit, '\D', '', 'g') <> '')
);

create unique index if not exists uq_proveedores_nit_normalizado on proveedores (nit_normalizado);
create index if not exists idx_proveedores_nombre on proveedores (lower(nombre));

-- El NIT normalizado de las líneas de OC permite consultar el historial de un proveedor con índice.
alter table orden_compra_items
  add column if not exists proveedor_nit_normalizado text
  generated always as (nullif(regexp_replace(coalesce(proveedor_nit, ''), '\D', '', 'g'), '')) stored;

create index if not exists idx_oc_items_nit_normalizado on orden_compra_items (proveedor_nit_normalizado);

-- Siembra: un proveedor por NIT, con el nombre y correo de la línea más reciente.
insert into proveedores (nit, nombre, email, origen)
select distinct on (regexp_replace(i.proveedor_nit, '\D', '', 'g'))
  trim(i.proveedor_nit),
  coalesce(nullif(trim(i.proveedor_nombre), ''), trim(i.proveedor_nit)),
  nullif(trim(i.proveedor_email), ''),
  'oc'
from orden_compra_items i
where i.proveedor_nit is not null
  and regexp_replace(i.proveedor_nit, '\D', '', 'g') <> ''
order by regexp_replace(i.proveedor_nit, '\D', '', 'g'), i.id desc
on conflict do nothing;

-- Mantiene el catálogo al día cuando llega una línea de OC con un proveedor nuevo.
create or replace function fn_oc_item_sync_proveedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.proveedor_nit is not null and regexp_replace(new.proveedor_nit, '\D', '', 'g') <> '' then
    insert into proveedores (nit, nombre, email, origen)
    values (
      trim(new.proveedor_nit),
      coalesce(nullif(trim(new.proveedor_nombre), ''), trim(new.proveedor_nit)),
      nullif(trim(new.proveedor_email), ''),
      'oc'
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_oc_item_sync_proveedor on orden_compra_items;
create trigger trg_oc_item_sync_proveedor
  after insert on orden_compra_items
  for each row execute function fn_oc_item_sync_proveedor();

-- Quién creó el proveedor lo fuerza el servidor, no el cliente.
create or replace function fn_proveedores_set_autor()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proveedores_set_autor on proveedores;
create trigger trg_proveedores_set_autor
  before insert or update on proveedores
  for each row execute function fn_proveedores_set_autor();

alter table proveedores enable row level security;

drop policy if exists proveedores_select on proveedores;
create policy proveedores_select on proveedores
  for select using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedores_insert on proveedores;
create policy proveedores_insert on proveedores
  for insert with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedores_update on proveedores;
create policy proveedores_update on proveedores
  for update
  using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'))
  with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedores_delete on proveedores;
create policy proveedores_delete on proveedores
  for delete using (get_user_rol() = 'supervisor');

revoke all on proveedores from anon;
grant select, insert, update, delete on proveedores to authenticated;
grant all on proveedores to service_role;

commit;
```

- [ ] **Paso 2: revisión manual del SQL** (no se aplica): releer buscando errores de sintaxis, que `begin`/`commit` cierren y que no dependa de nada que no exista (`get_user_rol()` viene de la migración 008; `orden_compra_items` de la 028).
- [ ] **Paso 3: commit**

```bash
git add supabase/migrations/080_proveedores.sql
git commit -m "feat(proveedores): migración 080 con catálogo de proveedores, siembra desde las OC y RLS"
```

### Tarea 2: Permisos, menú y rutas

**Archivos:** modificar `frontend/lib/permissions/roles.ts`, `frontend/components/layout/Sidebar.tsx` (y `MobileSidebarSheet.tsx` si repite la lógica).

**Interfaces — produce:** `RouteKey` incluye `'proveedores'`; `ROUTE_PERMISSIONS.proveedores`; ítem de menú `Proveedores` (`/proveedores`, ícono `Truck`) dentro del grupo "Módulos de planta", después de `compras`.

- [ ] **Paso 1:** en `roles.ts` importar `Truck` de `lucide-react`; agregar `'proveedores'` a `RouteKey`; agregar `proveedores: ['supervisor', 'comercial', 'compras', 'auditoria'] as const` a `ROUTE_PERMISSIONS`; agregar el ítem a `NAV_ITEMS` y la clave a `NAV_GROUPS[0].keys` justo después de `'compras'`.
- [ ] **Paso 2:** en `getRouteKeyForPath` agregar `if (pathname === '/proveedores' || pathname.startsWith('/proveedores/')) return 'proveedores'` antes del `find` (así el `middleware.ts` también protege `/proveedores/[id]`).
- [ ] **Paso 3:** en `Sidebar.tsx` cambiar `const isActive = pathname === item.href` por `pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`))` para que la ficha mantenga activo el ítem. Revisar `MobileSidebarSheet.tsx` por si calcula "activo" aparte.
- [ ] **Paso 4:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 5: commit** `feat(proveedores): permisos, ruta y entrada de menú para Proveedores`

### Tarea 3: Tipos, NIT, CSV común e importación

**Archivos:** crear `lib/proveedores/nit.ts`, `lib/types/proveedor.ts`, `lib/export/csv.ts`, `lib/proveedores/importacion.ts`.

**Interfaces — produce:**
- `normalizarNit(nit: string | null | undefined): string`
- `Proveedor`, `GuardarProveedorInput`, `guardarProveedorSchema`, `ProveedorResultado`, `ProveedorFila` (resumen para la lista: proveedor + `total_ordenes`, `ordenes_puntuadas`, `porcentaje_promedio`, `ultima_reevaluacion`).
- `generarCsv(columnas: string[], filas: (string | number | null)[][]): string`, `descargarCsv(nombreArchivo: string, contenido: string): void`
- `leerCsvProveedores(texto: string): { filas: GuardarProveedorInput[]; errores: { linea: number; motivo: string }[] }`

- [ ] **Paso 1:** `nit.ts`

```ts
export function normalizarNit(nit: string | null | undefined): string {
  return (nit ?? '').replace(/\D/g, '')
}
```

- [ ] **Paso 2:** `lib/types/proveedor.ts`: la interfaz `Proveedor` (campos de la tabla 080), el esquema

```ts
import { z } from 'zod'

export const guardarProveedorSchema = z.object({
  nit: z.string().trim().min(1, 'El NIT es requerido').refine((v) => /\d/.test(v), 'El NIT debe tener números'),
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  email: z.string().trim().refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email inválido'),
  telefono: z.string().trim(),
  contacto: z.string().trim(),
  notas: z.string().trim(),
})
export type GuardarProveedorInput = z.infer<typeof guardarProveedorSchema>
export type ProveedorResultado = { ok: true; id?: number } | { ok: false; error: string }
```

- [ ] **Paso 3:** `lib/export/csv.ts`

```ts
import Papa from 'papaparse'

export function generarCsv(columnas: string[], filas: (string | number | null)[][]): string {
  const csv = Papa.unparse(
    { fields: columnas, data: filas },
    { delimiter: ';', newline: '\r\n', escapeFormulae: true }
  )
  return `﻿${csv}`
}

export function descargarCsv(nombreArchivo: string, contenido: string): void {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Paso 4:** `lib/proveedores/importacion.ts`: `leerCsvProveedores` con `Papa.parse(texto, { header: true, skipEmptyLines: true, transformHeader })`; reconocer encabezados sin importar mayúsculas/tildes/espacios (`nit`, `nombre`, `proveedor`, `email`/`correo`, `telefono`/`teléfono`, `contacto`); cada fila se valida con `guardarProveedorSchema`; las inválidas van a `errores` con su número de línea; las filas con NIT repetido dentro del archivo se descartan con el motivo "NIT repetido en el archivo". Detectar delimitador automáticamente (`Papa.parse` sin forzarlo) porque el cliente puede traer `,` o `;`.
- [ ] **Paso 5:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 6: commit** `feat(proveedores): tipos, normalización de NIT, helper de CSV y lectura del CSV de proveedores`

### Tarea 4: Server Actions del catálogo y preview

**Archivos:** crear `lib/supabase/proveedores-actions.ts`, `lib/dev/preview-proveedores-data.ts`.

**Interfaces — produce (todas `async`):**
- `fetchProveedores(): Promise<{ filas: ProveedorFila[]; error?: 'migracion_pendiente' | string }>`
- `fetchProveedorById(id: number): Promise<Proveedor | null>`
- `crearProveedor(input: GuardarProveedorInput): Promise<ProveedorResultado>`
- `actualizarProveedor(id: number, input: GuardarProveedorInput): Promise<ProveedorResultado>`
- `eliminarProveedor(id: number): Promise<ProveedorResultado>` (solo `supervisor`)
- `importarProveedores(filas: GuardarProveedorInput[]): Promise<{ ok: true; creados: number; actualizados: number } | { ok: false; error: string }>`
- Consume: `requireRole`, `createClient`, `isDevBypassActive`, `ROUTE_PERMISSIONS` (patrón de `calendario-actions.ts` y `vehiculo-proceso-actions.ts`).

- [ ] **Paso 1:** datos de preview: 6–8 proveedores con NIT con puntos y guion, uno con nombre cortado ("… LTDA"), con `total_ordenes` y `porcentaje_promedio` variados (alguno `null`).
- [ ] **Paso 2:** `fetchProveedores` consulta `proveedores` ordenado por nombre y, para el resumen, cuenta OC por `proveedor_nit_normalizado` en `orden_compra_items` (un solo query agrupado en JS). En esta fase `ordenes_puntuadas`, `porcentaje_promedio` y `ultima_reevaluacion` salen `0` / `null` (se completan en las fases 2 y 3).
- [ ] **Paso 3:** escritura: validar con `guardarProveedorSchema`; `requireRole(ROUTE_PERMISSIONS.proveedores)`; guardar `email`/`telefono`/`contacto`/`notas` vacíos como `null`; el error `23505` (NIT duplicado) devuelve "Ya existe un proveedor con ese NIT".
- [ ] **Paso 4:** `importarProveedores`: `upsert` por `nit_normalizado` en lotes de 200; para los existentes **no** pisar un campo con vacío (solo actualizar si el CSV trae valor); `origen = 'importado'` en los nuevos.
- [ ] **Paso 5:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 6: commit** `feat(proveedores): acciones del catálogo (listar, crear, editar, eliminar, importar) y datos de preview`

### Tarea 5: Página de lista y diálogos

**Archivos:** crear `app/(panel)/proveedores/page.tsx`, `app/(panel)/proveedores/loading.tsx`, `components/proveedores/ProveedoresTabs.tsx`, `SelectorProveedor.tsx`, `ProveedoresLista.tsx`, `ProveedorFormDialog.tsx`, `ImportarProveedoresDialog.tsx`, `AvisoMigracion.tsx`.

**Interfaces — produce:** `SelectorProveedor({ proveedores, valor, onSeleccionar, placeholder?, excluirIds? }: { proveedores: ProveedorFila[]; valor: number | null; onSeleccionar: (proveedor: ProveedorFila) => void; placeholder?: string; excluirIds?: number[] })`. Desplegable con campo de búsqueda: muestra el **nombre** (y el NIT en gris), filtra por nombre o NIT sin tildes ni mayúsculas (el NIT ignorando puntos y guiones), lista solo proveedores activos y muestra "Sin coincidencias" cuando no hay. Se construye con `components/ui/popover.tsx` + `Input` (no hay un componente `Command`/combobox en `components/ui`; revisar la API de `popover.tsx` antes de usarlo porque es base-ui).

- [ ] **Paso 1:** `page.tsx` (Server Component con `RoleGuard allowed={ROUTE_PERMISSIONS.proveedores}`, mismo esqueleto que `compras/page.tsx`): título "Proveedores", subtítulo breve, y `<ProveedoresTabs />`. `loading.tsx` con `LoadingSkeleton`.
- [ ] **Paso 2:** `ProveedoresTabs` (cliente, `components/ui/tabs`): pestaña "Proveedores" (`ProveedoresLista`) y pestaña "Evaluación de selección" (en esta fase solo un estado vacío "Disponible en la fase 3"; se reemplaza en la Tarea 18).
- [ ] **Paso 2b:** `SelectorProveedor` según la interfaz de arriba. En `ProveedoresTabs`, sobre la lista, un `SelectorProveedor` con la etiqueta "Elegir proveedor" que al seleccionar navega a `/proveedores/{id}` (`useRouter().push`). Los proveedores se cargan una sola vez con `fetchProveedores` y se comparten entre el selector y la lista.
- [ ] **Paso 3:** `ProveedoresLista`: carga con `fetchProveedores` (estado de carga con skeleton, todo `setState` dentro de callbacks de promesa); buscador por nombre o NIT (sin tildes ni mayúsculas, ignorando puntos/guiones del NIT con `normalizarNit`); tarjeta-resumen con el conteo; cada fila es desplegable (nombre, NIT; al abrir: correo, teléfono, contacto, nº de OC, % cumplimiento) con los botones "Abrir historial" (`Link` a `/proveedores/{id}`), "Editar" y, solo `supervisor` (recibir `puedeEliminar` por prop desde la página), "Eliminar" con confirmación. Botones superiores "Nuevo proveedor" e "Importar CSV".
- [ ] **Paso 4:** `ProveedorFormDialog`: `react-hook-form` + `zodResolver(guardarProveedorSchema)`, patrón de `EventoFormDialog.tsx`; crea o edita según reciba `proveedor`; `toast` de éxito/error; llama `onGuardado` para recargar.
- [ ] **Paso 5:** `ImportarProveedoresDialog`: selector de archivo o arrastrar; lee el texto con `File.text()`, usa `leerCsvProveedores`, muestra vista previa (primeras 10 filas), cantidad válida y la lista de errores con su línea; botón "Importar N proveedores" llama `importarProveedores` y muestra creados/actualizados.
- [ ] **Paso 6:** `AvisoMigracion`: banner ámbar reutilizable `({ migracion }: { migracion: string })` con el texto "Falta aplicar la migración {migracion} en Supabase" (mismo estilo que el aviso de `FormulariosTable`).
- [ ] **Paso 7:** verificación manual en el navegador con `DEV_SKIP_AUTH=true`: aparece "Proveedores" en el menú, la lista carga, el buscador filtra por nombre y por NIT con o sin puntos, crear/editar muestran toast, la importación muestra vista previa y errores con un CSV de prueba (válido, con una fila sin NIT y con un NIT repetido). Con rol `lectura` (`DEV_SKIP_AUTH_ROLE=lectura`) la ruta redirige a acceso denegado.
- [ ] **Paso 8:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 9: commit** `feat(proveedores): pantalla de proveedores con lista filtrable, alta, edición e importación CSV`

### Tarea 6: Ficha del proveedor e historial

**Archivos:** crear `lib/proveedores/historial.ts`, `app/(panel)/proveedores/[id]/page.tsx` + `loading.tsx`, `components/proveedores/ProveedorFicha.tsx`, `HistorialTabla.tsx`; ampliar `lib/supabase/proveedores-actions.ts` con `fetchHistorialProveedor`.

**Interfaces — produce:**
- `FilaHistorial` (la base de todo el módulo): `{ clave: string; orden_id: number | null; numero_oc: string | null; titulo: string; fecha_oc: string | null; estado: 'en_curso' | 'listo' | 'cancelada' | 'historico'; fecha_entrega_prometida: string | null; fecha_entrega_real: string | null; diferencia_dias: number | null; cantidad_pedida: number | null; cantidad_recibida: number | null; factura_remision: string | null; devoluciones: number; observaciones: string | null; desempeno_id: number | null; calidad: Calidad | null; porcentaje: number | null }` (en esta fase `devoluciones = 0`, `calidad = null`, `porcentaje = null`, `desempeno_id = null`).
- `construirFilasHistorial(ordenes: OrdenCompra[], nitNormalizado: string): FilaHistorial[]` (pura): por cada OC con líneas de ese NIT, una fila; `fecha_entrega_prometida = fecha_vencimiento`; `fecha_entrega_real` = fecha de la última recepción que completó lo pedido de las líneas de ese proveedor, si no `fecha_cierre`, si no `null`; cantidades sumadas solo de las líneas de ese proveedor; `factura_remision = prefijo + número` si existen; orden descendente por `fecha_oc`.
- `fetchHistorialProveedor(proveedorId: number): Promise<{ proveedor: Proveedor | null; filas: FilaHistorial[]; error?: string }>`.

- [ ] **Paso 1:** extender `fetchHistorialProveedor`: cargar el proveedor, luego `orden_compra_items` con `proveedor_nit_normalizado = nit_normalizado`, las `ordenes_compra` de esos `orden_id`, y las `orden_compra_recepciones` de esas órdenes; reusar la forma de `OrdenCompra` de `lib/types/orden-compra.ts` y los `SELECT_*` de `ordenes-compra-actions.ts` (si no se pueden importar porque ese archivo es `'use server'`, replicar el `select` mínimo necesario). Preview: filas de ejemplo.
- [ ] **Paso 2:** `historial.ts` con `construirFilasHistorial` y una función `fechaRealEntrega` aparte para poder probarla. Incluir `diferencia_dias` con `diferenciaEnDias` (se define en la Tarea 8; mientras tanto, una copia mínima local que se reemplaza en esa tarea).
- [ ] **Paso 3:** `[id]/page.tsx` (`params` es `Promise`): `RoleGuard`, `notFound()` si no existe el proveedor, encabezado con nombre, NIT y datos de contacto, botón "Volver a proveedores", y `<ProveedorFicha proveedorId filas />`.
- [ ] **Paso 4:** `ProveedorFicha` (cliente, `Tabs`): pestaña "Historial" con `HistorialTabla` y pestaña "Reevaluación anual" (placeholder "Fase 3"). `HistorialTabla`: tabla con columnas OC, Fecha de OC, Fecha de entrega, Fecha real, Diferencia (días; verde si ≤ 0, ámbar si > 0), Cantidad (recibida/pedida), Devoluciones, Factura o remisión y Estado (usar `CLASE_ESTADO_OC`/`ETIQUETA_ESTADO_OC` ya existentes); envuelta en `overflow-x-auto`; filtro por rango de fechas y por estado; contador de OC.
- [ ] **Paso 5:** verificación manual con `DEV_SKIP_AUTH=true`: entrar desde "Abrir historial", ver la tabla con las columnas del Excel, filtros funcionando, la ficha de un proveedor inexistente da 404.
- [ ] **Paso 6:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 7: commit** `feat(proveedores): ficha del proveedor con historial de órdenes y columnas de control de entrega`

**Cierre de la Fase 1:** revisión de todo lo hecho (`git diff` de la fase), `npx tsc --noEmit`, `npm run lint`; informar al usuario que falta que backend aplique la 080.

---

# FASE 2 — Desempeño por OC, configuración y exportación

Entregable: cada OC de un proveedor tiene su desempeño con las 4 divisiones, con porcentaje; el supervisor configura umbral y pesos; se exporta el cuadro en CSV y PDF; se importa el historial del Excel.

### Tarea 7: Migración 081 (desempeño y configuración)

**Archivos:** crear `supabase/migrations/081_proveedor_desempeno.sql`.

- [ ] **Paso 1: escribir la migración**

```sql
-- 081: desempeño de proveedores por orden de compra + parámetros de evaluación.
--
-- Una fila por (OC, proveedor): se crea sola cuando se crea la línea de la OC ("se genera la OC y
-- se abre su desempeño"). También admite filas históricas importadas (orden_id nulo + numero_oc).
-- Las fechas y cantidades son sobrescrituras: si están en null, el panel las deriva de la OC.
-- Calidad (bien/regular/mal), devoluciones y observaciones son captura manual.

begin;

create table if not exists proveedor_desempeno (
  id                      bigint generated always as identity primary key,
  proveedor_id            bigint not null references proveedores(id) on delete cascade,
  orden_id                bigint references ordenes_compra(id) on delete cascade,
  numero_oc               text,
  fecha_oc                date,
  fecha_entrega_prometida date,
  fecha_entrega_real      date,
  factura_remision        text,
  cantidad_pedida         numeric check (cantidad_pedida is null or cantidad_pedida >= 0),
  cantidad_recibida       numeric check (cantidad_recibida is null or cantidad_recibida >= 0),
  calidad                 text check (calidad is null or calidad in ('bien', 'regular', 'mal')),
  calidad_comentario      text,
  devoluciones            integer not null default 0 check (devoluciones >= 0),
  devoluciones_detalle    text,
  cantidad_observaciones  text,
  pagos_acordados         text,
  tiempo_observaciones    text,
  observaciones           text,
  actualizado_por         uuid references auth.users(id),
  actualizado_por_nombre  text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint desempeno_tiene_origen check (orden_id is not null or numero_oc is not null)
);

create unique index if not exists uq_desempeno_orden_proveedor
  on proveedor_desempeno (orden_id, proveedor_id) where orden_id is not null;
create unique index if not exists uq_desempeno_historico
  on proveedor_desempeno (proveedor_id, lower(numero_oc)) where orden_id is null;
create index if not exists idx_desempeno_proveedor on proveedor_desempeno (proveedor_id);

-- Quién y cuándo lo fuerza el servidor.
create or replace function fn_proveedor_desempeno_autor()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_por := auth.uid();
  new.actualizado_por_nombre := (select nombre from profiles where id = auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proveedor_desempeno_autor on proveedor_desempeno;
create trigger trg_proveedor_desempeno_autor
  before insert or update on proveedor_desempeno
  for each row execute function fn_proveedor_desempeno_autor();

-- La función de la 080 ahora también abre el desempeño de la OC para ese proveedor.
create or replace function fn_oc_item_sync_proveedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nit text := regexp_replace(coalesce(new.proveedor_nit, ''), '\D', '', 'g');
begin
  if v_nit <> '' then
    insert into proveedores (nit, nombre, email, origen)
    values (
      trim(new.proveedor_nit),
      coalesce(nullif(trim(new.proveedor_nombre), ''), trim(new.proveedor_nit)),
      nullif(trim(new.proveedor_email), ''),
      'oc'
    )
    on conflict do nothing;

    insert into proveedor_desempeno (proveedor_id, orden_id)
    select p.id, new.orden_id
    from proveedores p
    where p.nit_normalizado = v_nit
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Las OC que ya existen también arrancan con su desempeño.
insert into proveedor_desempeno (proveedor_id, orden_id)
select distinct p.id, i.orden_id
from orden_compra_items i
join proveedores p on p.nit_normalizado = i.proveedor_nit_normalizado
where i.proveedor_nit_normalizado is not null
on conflict do nothing;

-- Parámetros de evaluación (los edita el supervisor desde Configuración).
alter table config_app
  add column if not exists proveedor_umbral_aprobacion integer not null default 85
    check (proveedor_umbral_aprobacion between 0 and 100),
  add column if not exists proveedor_peso_calidad integer not null default 25
    check (proveedor_peso_calidad between 0 and 100),
  add column if not exists proveedor_peso_devoluciones integer not null default 25
    check (proveedor_peso_devoluciones between 0 and 100),
  add column if not exists proveedor_peso_cantidad integer not null default 25
    check (proveedor_peso_cantidad between 0 and 100),
  add column if not exists proveedor_peso_tiempo integer not null default 25
    check (proveedor_peso_tiempo between 0 and 100),
  add column if not exists proveedor_penalizacion_dia numeric not null default 5
    check (proveedor_penalizacion_dia >= 0),
  add column if not exists proveedor_penalizacion_devolucion numeric not null default 25
    check (proveedor_penalizacion_devolucion >= 0);

alter table proveedor_desempeno enable row level security;

drop policy if exists proveedor_desempeno_select on proveedor_desempeno;
create policy proveedor_desempeno_select on proveedor_desempeno
  for select using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_desempeno_insert on proveedor_desempeno;
create policy proveedor_desempeno_insert on proveedor_desempeno
  for insert with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_desempeno_update on proveedor_desempeno;
create policy proveedor_desempeno_update on proveedor_desempeno
  for update
  using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'))
  with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_desempeno_delete on proveedor_desempeno;
create policy proveedor_desempeno_delete on proveedor_desempeno
  for delete using (get_user_rol() = 'supervisor');

revoke all on proveedor_desempeno from anon;
grant select, insert, update, delete on proveedor_desempeno to authenticated;
grant all on proveedor_desempeno to service_role;

commit;
```

- [ ] **Paso 2:** revisión manual del SQL (depende de la 080; `config_app` de la 013 ya tiene la política de update solo para supervisor).
- [ ] **Paso 3: commit** `feat(proveedores): migración 081 con desempeño por orden y parámetros de evaluación`

### Tarea 8: Librería de puntajes

**Archivos:** crear `lib/types/proveedor-desempeno.ts`, `lib/proveedores/desempeno.ts`; reemplazar la copia local de `diferenciaEnDias` en `historial.ts`.

**Interfaces — produce:** `CALIDADES`, `Calidad`, `PUNTAJE_CALIDAD`, `ETIQUETA_CALIDAD`, `ConfigDesempeno`, `CONFIG_DESEMPENO_DEFAULT`, `EntradaDesempeno`, `PuntajesDesempeno`, `diferenciaEnDias`, `calcularPuntajes`, `promedio`.

- [ ] **Paso 1:** escribir `lib/proveedores/desempeno.ts`

```ts
export const CALIDADES = ['bien', 'regular', 'mal'] as const
export type Calidad = (typeof CALIDADES)[number]

export const PUNTAJE_CALIDAD: Record<Calidad, number> = { bien: 100, regular: 50, mal: 0 }
export const ETIQUETA_CALIDAD: Record<Calidad, string> = { bien: 'Bien', regular: 'Regular', mal: 'Mal' }

export interface ConfigDesempeno {
  umbral: number
  pesos: { calidad: number; devoluciones: number; cantidad: number; tiempo: number }
  penalizacionDia: number
  penalizacionDevolucion: number
}

export const CONFIG_DESEMPENO_DEFAULT: ConfigDesempeno = {
  umbral: 85,
  pesos: { calidad: 25, devoluciones: 25, cantidad: 25, tiempo: 25 },
  penalizacionDia: 5,
  penalizacionDevolucion: 25,
}

export interface EntradaDesempeno {
  calidad: Calidad | null
  devoluciones: number
  cantidadPedida: number | null
  cantidadRecibida: number | null
  fechaPrometida: string | null // aaaa-mm-dd
  fechaReal: string | null // aaaa-mm-dd
}

export interface PuntajesDesempeno {
  calidad: number | null
  devoluciones: number
  cantidad: number | null
  tiempo: number | null
  diferenciaDias: number | null
  global: number | null
}

const DIA_MS = 86_400_000
const acotar = (n: number) => Math.min(100, Math.max(0, n))

/** Días entre la fecha prometida y la real. Negativo = llegó antes (igual que el Excel de control). */
export function diferenciaEnDias(prometida: string | null, real: string | null): number | null {
  if (!prometida || !real) return null
  const a = Date.parse(`${prometida}T00:00:00Z`)
  const b = Date.parse(`${real}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / DIA_MS)
}

export function calcularPuntajes(e: EntradaDesempeno, c: ConfigDesempeno): PuntajesDesempeno {
  const diferenciaDias = diferenciaEnDias(e.fechaPrometida, e.fechaReal)
  const calidad = e.calidad ? PUNTAJE_CALIDAD[e.calidad] : null
  const devoluciones = acotar(100 - c.penalizacionDevolucion * e.devoluciones)
  const cantidad =
    e.cantidadPedida != null && e.cantidadPedida > 0 && e.cantidadRecibida != null
      ? acotar((e.cantidadRecibida / e.cantidadPedida) * 100)
      : null
  const tiempo =
    diferenciaDias == null ? null : acotar(100 - c.penalizacionDia * Math.max(0, diferenciaDias))

  const partes: Array<[number | null, number]> = [
    [calidad, c.pesos.calidad],
    [devoluciones, c.pesos.devoluciones],
    [cantidad, c.pesos.cantidad],
    [tiempo, c.pesos.tiempo],
  ]
  let suma = 0
  let pesoTotal = 0
  for (const [puntaje, peso] of partes) {
    if (puntaje == null || peso <= 0) continue
    suma += puntaje * peso
    pesoTotal += peso
  }
  const global = pesoTotal > 0 ? Math.round((suma / pesoTotal) * 10) / 10 : null

  return { calidad, devoluciones, cantidad, tiempo, diferenciaDias, global }
}

export function promedio(valores: Array<number | null>): number | null {
  const utiles = valores.filter((v): v is number => v != null)
  if (utiles.length === 0) return null
  return Math.round((utiles.reduce((s, v) => s + v, 0) / utiles.length) * 10) / 10
}
```

- [ ] **Paso 2:** `lib/types/proveedor-desempeno.ts`: `GuardarDesempenoInput` (`zod`: `calidad` enum o `null`, `calidad_comentario`, `devoluciones` entero ≥ 0, `devoluciones_detalle`, `cantidad_observaciones`, `pagos_acordados`, `tiempo_observaciones`, `observaciones`, `fecha_entrega_real`/`fecha_entrega_prometida` como `aaaa-mm-dd` o vacío, `factura_remision`), y `DesempenoResultado`.
- [ ] **Paso 3:** verificación con un script desechable en el scratchpad (`node --experimental-strip-types`) que importe `desempeno.ts` y compruebe: OC sin retraso, sin devoluciones, calidad "bien", cantidad completa → global 100; 45 días antes (diferencia −45) → tiempo 100; 3 días tarde con penalización 5 → tiempo 85; 2 devoluciones con penalización 25 → devoluciones 50; sin calidad → se excluye del promedio (pesos renormalizados); sin fechas → tiempo `null`. No commitear el script.
- [ ] **Paso 4:** en `historial.ts` importar `diferenciaEnDias` de `desempeno.ts` y borrar la copia local.
- [ ] **Paso 5:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 6: commit** `feat(proveedores): librería de puntajes de desempeño (calidad, devoluciones, cantidad, tiempo)`

### Tarea 9: Configuración de evaluación (supervisor)

**Archivos:** crear `lib/supabase/proveedor-config-actions.ts`, `components/configuracion/ProveedoresConfig.tsx`; modificar `app/(panel)/configuracion/page.tsx`.

**Interfaces — produce:** `fetchConfigDesempeno(): Promise<ConfigDesempeno>` (cae a `CONFIG_DESEMPENO_DEFAULT` si no hay columnas o en preview), `actualizarConfigDesempeno(input): Promise<{ ok: true } | { ok: false; error: string }>` (solo `supervisor`).

- [ ] **Paso 1:** acciones: leer las 7 columnas nuevas de `config_app` (`id = 1`); si el error es `42703`, devolver el default. Escribir con `update` validando con `zod` (umbral 0–100, pesos 0–100 y al menos uno mayor que 0, penalizaciones ≥ 0). `requireRole(ROUTE_PERMISSIONS.configuracion)`.
- [ ] **Paso 2:** `ProveedoresConfig`: formulario `react-hook-form` con umbral, cuatro pesos (mostrar el total y avisar si no suma 100: se normalizan igual), penalización por día de retraso y por devolución, texto de ayuda con el significado de cada una; patrón de `UmbralesCategoria.tsx`/`ConfiguracionForm.tsx`.
- [ ] **Paso 3:** montar `<ProveedoresConfig />` en la página de Configuración, debajo de lo existente.
- [ ] **Paso 4:** verificación manual (rol supervisor en preview): editar y guardar muestra toast; valores inválidos muestran el error.
- [ ] **Paso 5:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 6: commit** `feat(proveedores): configuración del umbral, pesos y penalizaciones de la evaluación`

### Tarea 10: Acciones de desempeño

**Archivos:** crear `lib/supabase/proveedor-desempeno-actions.ts`; modificar `proveedores-actions.ts` y `historial.ts`.

**Interfaces — produce:**
- `fetchDesempenoProveedor(proveedorId: number): Promise<{ proveedor: Proveedor | null; filas: FilaHistorial[]; config: ConfigDesempeno; error?: string }>` — carga las filas de la Tarea 6, mezcla con `proveedor_desempeno` (una por orden; las históricas aparecen como filas sin orden) y calcula `porcentaje`.
- `guardarDesempeno(proveedorId: number, ordenId: number | null, numeroOc: string | null, input: GuardarDesempenoInput): Promise<DesempenoResultado>` (hace `upsert` por `(orden_id, proveedor_id)` o por `(proveedor_id, numero_oc)`).
- `FilaHistorial` pasa a llevar `puntajes: PuntajesDesempeno | null` (solo para OC `listo` o históricas; las `en_curso` y `cancelada` van en `null`).

- [ ] **Paso 1:** ampliar `construirFilasHistorial` para recibir `desempenos: DesempenoRow[]` y `config: ConfigDesempeno`: los campos sobrescritos de la fila (fecha prometida/real, cantidades, factura) tienen prioridad sobre lo derivado de la OC; incluir las filas históricas (sin `orden_id`); calcular `puntajes` con `calcularPuntajes`.
- [ ] **Paso 2:** `fetchDesempenoProveedor` y `guardarDesempeno` con `requireRole(ROUTE_PERMISSIONS.proveedores)`, `zod`, errores `42P01`/`42703` → `migracion_pendiente`; preview: valores de ejemplo y escritura simulada.
- [ ] **Paso 3:** actualizar `fetchProveedores` para completar `ordenes_puntuadas` y `porcentaje_promedio` por proveedor (usando la misma lógica, un solo recorrido en memoria).
- [ ] **Paso 4:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 5: commit** `feat(proveedores): acciones de desempeño por orden y porcentaje por proveedor`

### Tarea 11: Interfaz de desempeño

**Archivos:** crear `components/proveedores/DesempenoDialog.tsx`; modificar `HistorialTabla.tsx`, `ProveedorFicha.tsx`, `ProveedoresLista.tsx`.

- [ ] **Paso 1:** `DesempenoDialog` (patrón de `VehiculoProcesoDialog`/`EventoFormDialog`): encabezado con proveedor, número de OC y estado; cuatro secciones con el porcentaje en vivo de cada una y el global arriba (con color: verde si ≥ umbral, ámbar si ≥ umbral − 15, rojo si no):
  - **Calidad:** desplegable (`Select`) Bien / Regular / Mal / Sin evaluar + comentario.
  - **Devoluciones:** número entero ≥ 0 + texto "¿qué se devuelve y por qué?".
  - **Cantidad:** muestra pedida / recibida / % (solo lectura, vienen de la OC; editables solo en filas históricas) + campos "pagos acordados" (ej. "2 pagos") y observaciones.
  - **Tiempo:** fecha de entrega prometida, fecha real (editables; si se vacían se vuelve a derivar de la OC), diferencia en días y observación de demora.
  - Campo general "Observaciones" y "Factura o remisión". Si la OC está en curso, mostrar el aviso "Se puntúa cuando la OC se finalice" pero permitir capturar.
  - Guarda con `guardarDesempeno`, `toast`, recarga la ficha. Muestra "Última actualización por {nombre} · {fecha}".
- [ ] **Paso 2:** `HistorialTabla`: agregar columnas Calidad (chip), Observaciones, Cantidad % y **Cumplimiento %** (global), clic en la fila abre `DesempenoDialog`; resumen superior con promedio general, nº de OC puntuadas y semáforo contra el umbral.
- [ ] **Paso 3:** `ProveedoresLista`: mostrar el `%` promedio con el semáforo en la fila y en el desplegable.
- [ ] **Paso 4:** verificación manual con `DEV_SKIP_AUTH=true`: abrir una OC, cambiar calidad/devoluciones/fechas y ver el porcentaje moverse en vivo; guardar; una OC en curso muestra el aviso; para un rol sin acceso, redirección.
- [ ] **Paso 5:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 6: commit** `feat(proveedores): captura de desempeño por orden con las cuatro divisiones y porcentaje en vivo`

### Tarea 12: Exportación del desempeño (CSV y PDF) y resultado de OC

**Archivos:** crear `lib/export/proveedor-desempeno.ts`; modificar `ProveedorFicha.tsx` y `DesempenoDialog.tsx`.

**Interfaces — produce:** `descargarCsvDesempeno(proveedor, filas, config)`, `descargarPdfDesempeno(proveedor, filas, config)`, `descargarCsvResultadoOC(proveedor, fila, config)`, `descargarPdfResultadoOC(proveedor, fila, config)`.

- [ ] **Paso 1:** CSV del proveedor con las columnas del Excel de referencia en este orden: NÚMERO (consecutivo), ORDEN DE COMPRA, FECHA DE OC, PROVEEDOR, FECHA DE ENTREGA, FECHA REAL DE ENTREGA, DIFERENCIA EN DÍAS, DEVOLUCIONES, OBSERVACIONES, FACTURA O REMISIÓN, y a continuación CALIDAD, CANTIDAD PEDIDA, CANTIDAD RECIBIDA, PUNTAJE CALIDAD, PUNTAJE DEVOLUCIONES, PUNTAJE CANTIDAD, PUNTAJE TIEMPO, CUMPLIMIENTO %. Usa `generarCsv`/`descargarCsv`. Nombre de archivo `desempeno-{nombre-proveedor}-{aaaa-mm-dd}.csv`.
- [ ] **Paso 2:** PDF del proveedor (`jsPDF` + `autoTable`, mismo estilo que `orden-compra-pdf.ts`): encabezado "Proceso de compras y almacén — Control de desempeño de proveedores", datos del proveedor, resumen (promedio general, OC puntuadas, umbral y resultado), barras horizontales por división (promedio de cada una) dibujadas con `doc.rect`, tabla de OC (`autoTable`) y un párrafo de análisis generado con el texto de las observaciones más relevantes (devoluciones, demoras) — texto armado por reglas simples, sin IA.
- [ ] **Paso 3:** "Resultado de la OC" (una fila): CSV y PDF de una sola OC con sus 4 divisiones y observaciones; botón en `DesempenoDialog`.
- [ ] **Paso 4:** botones "Descargar CSV" y "Descargar PDF" en `ProveedorFicha` (sobre la tabla).
- [ ] **Paso 5:** verificación manual: abrir los CSV en un editor (separador `;`, tildes correctas, fórmulas escapadas) y el PDF (texto legible, tabla sin cortarse, barras proporcionales).
- [ ] **Paso 6:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 7: commit** `feat(proveedores): exportación del desempeño y del resultado de la OC en CSV y PDF`

### Tarea 13: Importar el historial del Excel

**Archivos:** crear `components/proveedores/ImportarHistorialDialog.tsx`; ampliar `lib/proveedores/importacion.ts` y `proveedor-desempeno-actions.ts`.

**Interfaces — produce:** `leerCsvHistorial(texto: string, formatoFecha: 'dmy' | 'mdy'): { filas: FilaHistorialImportada[]; errores: { linea: number; motivo: string }[] }`, `detectarFormatoFecha(texto: string): 'dmy' | 'mdy' | 'ambiguo'`, `importarHistorialDesempeno(proveedorId: number, filas: FilaHistorialImportada[]): Promise<{ ok: true; creados: number; actualizados: number } | { ok: false; error: string }>`.

- [ ] **Paso 1:** `leerCsvHistorial` reconoce los encabezados del Excel (sin importar tildes, mayúsculas ni espacios): ORDEN DE COMPRA → `numero_oc` (obligatorio), FECHA DE OC, FECHA DE ENTREGA, FECHA REAL DE ENTREGA, DEVOLUCIONES (entero), OBSERVACIONES, FACTURA O REMISIÓN; ignora NÚMERO, PROVEEDOR y DIFERENCIA EN DÍAS (se recalcula). Convierte fechas `m/d/aaaa` o `d/m/aaaa` según `formatoFecha`; `detectarFormatoFecha` mira si algún primer componente supera 12 (→ `dmy`) o algún segundo componente lo supera (→ `mdy`); si no puede, devuelve `ambiguo`.
- [ ] **Paso 2:** `importarHistorialDesempeno`: `upsert` por `(proveedor_id, lower(numero_oc))` con `orden_id = null`; si ya existe una OC del panel con ese `numero_oc` (campo `ordenes_compra.numero_oc`), se vincula a su `orden_id` en vez de duplicar. Lotes de 200. `requireRole(ROUTE_PERMISSIONS.proveedores)`.
- [ ] **Paso 3:** `ImportarHistorialDialog`: selector de archivo, selector de formato de fecha (preseleccionado según la detección; si es `ambiguo`, obliga a elegir), vista previa de 10 filas con las fechas ya convertidas, errores por línea y botón "Importar N filas". Botón "Importar historial" en `ProveedorFicha`.
- [ ] **Paso 4:** verificación manual con un CSV armado con las columnas del Excel de referencia (fechas `m/d/aaaa`): las fechas se leen bien, la diferencia en días coincide con la del Excel (ej. 8/22/2025 vs 7/8/2025 → −45), y reimportar el mismo archivo actualiza en vez de duplicar.
- [ ] **Paso 5:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 6: commit** `feat(proveedores): importar historial de desempeño desde el Excel de control`

### Tarea 14: Acceso desde el detalle de la OC

**Archivos:** modificar `components/compras/OrdenDetalle.tsx` (cambio mínimo: ese archivo es grande y cambia seguido).

- [ ] **Paso 1:** agregar un enlace "Ver desempeño del proveedor" (`Link` a `/proveedores/{id}?orden={orden.id}`, solo si el rol puede entrar a Proveedores; recibir `puedeVerProveedores` por prop desde `ComprasTable`/`compras/page.tsx` calculándolo con `ROUTE_PERMISSIONS.proveedores.includes(rol)`). Para encontrar el `id` del proveedor, resolverlo por NIT con una acción liviana `fetchProveedorIdPorNit(nit: string): Promise<number | null>` en `proveedores-actions.ts`.
- [ ] **Paso 2:** en `ProveedorFicha`, si llega `?orden=` abrir automáticamente el `DesempenoDialog` de esa OC.
- [ ] **Paso 3:** verificación manual: desde una OC se llega al desempeño de esa OC; para un rol sin acceso el enlace no aparece.
- [ ] **Paso 4:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 5: commit** `feat(proveedores): enlace al desempeño del proveedor desde el detalle de la orden de compra`

**Cierre de la Fase 2:** revisión de todo lo hecho, `tsc`, `lint`; avisar que falta que backend aplique la 081.

---

# FASE 3 — Reevaluación anual y evaluación de selección

Entregable: una reevaluación por proveedor y año con porcentaje, decisión y constancia; y el cuadro comparativo de selección de proveedores nuevos.

### Tarea 15: Migración 082 (reevaluaciones)

**Archivos:** crear `supabase/migrations/082_proveedor_reevaluaciones.sql`.

- [ ] **Paso 1: escribir la migración**

```sql
-- 082: reevaluación anual de proveedores (una por proveedor y año).
--
-- porcentaje y detalle son una copia del cálculo en el momento de evaluar, para que la constancia
-- no cambie si después cambian los pesos o el umbral. El motivo es obligatorio cuando no se continúa.

begin;

create table if not exists proveedor_reevaluaciones (
  id                bigint generated always as identity primary key,
  proveedor_id      bigint not null references proveedores(id) on delete cascade,
  anio              integer not null check (anio between 2000 and 2100),
  porcentaje        numeric not null check (porcentaje between 0 and 100),
  umbral            numeric not null check (umbral between 0 and 100),
  resultado         text not null check (resultado in ('continuar', 'no_continuar')),
  motivo            text,
  detalle           jsonb not null default '{}'::jsonb,
  creado_por        uuid references auth.users(id),
  creado_por_nombre text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint reevaluacion_motivo_si_no_continua
    check (resultado = 'continuar' or length(trim(coalesce(motivo, ''))) >= 1),
  constraint uq_reevaluacion_proveedor_anio unique (proveedor_id, anio)
);

create or replace function fn_proveedor_reevaluacion_autor()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado_por_nombre := (select nombre from profiles where id = auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proveedor_reevaluacion_autor on proveedor_reevaluaciones;
create trigger trg_proveedor_reevaluacion_autor
  before insert or update on proveedor_reevaluaciones
  for each row execute function fn_proveedor_reevaluacion_autor();

alter table proveedor_reevaluaciones enable row level security;

drop policy if exists proveedor_reevaluaciones_select on proveedor_reevaluaciones;
create policy proveedor_reevaluaciones_select on proveedor_reevaluaciones
  for select using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_reevaluaciones_insert on proveedor_reevaluaciones;
create policy proveedor_reevaluaciones_insert on proveedor_reevaluaciones
  for insert with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_reevaluaciones_update on proveedor_reevaluaciones;
create policy proveedor_reevaluaciones_update on proveedor_reevaluaciones
  for update
  using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'))
  with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_reevaluaciones_delete on proveedor_reevaluaciones;
create policy proveedor_reevaluaciones_delete on proveedor_reevaluaciones
  for delete using (get_user_rol() = 'supervisor');

revoke all on proveedor_reevaluaciones from anon;
grant select, insert, update, delete on proveedor_reevaluaciones to authenticated;
grant all on proveedor_reevaluaciones to service_role;

commit;
```

- [ ] **Paso 2:** revisión manual del SQL.
- [ ] **Paso 3: commit** `feat(proveedores): migración 082 con reevaluación anual de proveedores`

### Tarea 16: Lógica y acciones de reevaluación

**Archivos:** crear `lib/types/proveedor-reevaluacion.ts`, `lib/proveedores/reevaluacion.ts`, `lib/supabase/proveedor-reevaluacion-actions.ts`.

**Interfaces — produce:**
- `ResumenReevaluacion`: `{ anio: number; ordenes_puntuadas: number; porcentaje: number | null; promedios: { calidad: number | null; devoluciones: number | null; cantidad: number | null; tiempo: number | null }; umbral: number; supera_umbral: boolean | null; devoluciones_totales: number; dias_retraso_promedio: number | null }`
- `calcularReevaluacion(filas: FilaHistorial[], anio: number, config: ConfigDesempeno): ResumenReevaluacion` (pura): solo filas puntuables cuya fecha de referencia (real, si no cierre, si no fecha de OC) cae en `anio`; `porcentaje = promedio` de los `global` de esas filas; promedios por división con `promedio()`.
- `fetchReevaluaciones(proveedorId)`, `guardarReevaluacion(proveedorId, anio, resultado, motivo)` (recalcula en el servidor y guarda `porcentaje`, `umbral` y `detalle`; rechaza si `resultado = 'no_continuar'` o el porcentaje es menor al umbral y no hay motivo).

- [ ] **Paso 1:** escribir `calcularReevaluacion` y el esquema `zod` (`resultado` enum, `motivo` string; `superRefine` para la regla del motivo).
- [ ] **Paso 2:** acciones con `requireRole(ROUTE_PERMISSIONS.proveedores)`, preview con una reevaluación de ejemplo, `migracion_pendiente` ante `42P01`; `fetchProveedores` completa `ultima_reevaluacion`.
- [ ] **Paso 3:** verificación con script desechable: año sin OC → `porcentaje = null`; dos OC con 100 y 70 → 85; cruce de año por fecha real.
- [ ] **Paso 4:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 5: commit** `feat(proveedores): cálculo y acciones de la reevaluación anual`

### Tarea 17: Interfaz y constancia de la reevaluación

**Archivos:** crear `components/proveedores/ReevaluacionPanel.tsx`, `lib/export/proveedor-reevaluacion.ts`; modificar `ProveedorFicha.tsx`.

- [ ] **Paso 1:** `ReevaluacionPanel` (pestaña "Reevaluación anual"): selector de año; análisis en pantalla (el mismo contenido que el PDF/CSV): porcentaje grande con semáforo contra el umbral, barras por división (`recharts`, `ChartContainer` de `components/ui/chart.tsx`), cantidad de OC, devoluciones, retraso promedio; formulario con decisión (`Continuar` / `No continuar`) y motivo (obligatorio si no se continúa o si el porcentaje queda bajo el umbral); lista de reevaluaciones previas con quién y cuándo. Indicador "Ya reevaluado en {año}" si existe y permite editarla.
- [ ] **Paso 2:** exportación: CSV (una fila de resumen + filas de las OC del año) y PDF (encabezado, resumen, barras, tabla de OC, decisión y motivo, espacio de firma) con `descargarCsvReevaluacion` / `descargarPdfReevaluacion`, usando los datos guardados (`detalle`) cuando la reevaluación ya existe.
- [ ] **Paso 3:** verificación manual: guardar una reevaluación aprobada y otra "no continuar" sin motivo (debe rechazar); descargar CSV/PDF y comprobar que coinciden con la pantalla.
- [ ] **Paso 4:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 5: commit** `feat(proveedores): reevaluación anual con análisis, decisión y constancia en CSV y PDF`

### Tarea 18: Migración 083 (evaluación de selección)

**Archivos:** crear `supabase/migrations/083_proveedor_selecciones.sql`.

- [ ] **Paso 1: escribir la migración**

```sql
-- 083: evaluación de selección de proveedores nuevos (cuadro comparativo).
--
-- Una selección compara varios candidatos (proveedores existentes o nuevos todavía sin catálogo)
-- en precio, tiempo de entrega y calidad. La decisión final la toma una persona.

begin;

create table if not exists proveedor_selecciones (
  id                    bigint generated always as identity primary key,
  titulo                text not null check (length(trim(titulo)) >= 1),
  necesidad             text,
  estado                text not null default 'borrador' check (estado in ('borrador', 'decidida')),
  proveedor_elegido_id  bigint references proveedores(id) on delete set null,
  nombre_elegido        text,
  conclusion            text,
  creado_por            uuid references auth.users(id),
  creado_por_nombre     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists proveedor_seleccion_candidatos (
  id                  bigint generated always as identity primary key,
  seleccion_id        bigint not null references proveedor_selecciones(id) on delete cascade,
  proveedor_id        bigint references proveedores(id) on delete set null,
  nombre_nuevo        text,
  precio              numeric check (precio is null or precio >= 0),
  tiempo_entrega_dias numeric check (tiempo_entrega_dias is null or tiempo_entrega_dias >= 0),
  calidad             text check (calidad is null or calidad in ('bien', 'regular', 'mal')),
  observaciones       text,
  orden               smallint not null default 1,
  constraint candidato_tiene_proveedor check (
    proveedor_id is not null or length(trim(coalesce(nombre_nuevo, ''))) >= 1
  )
);

create index if not exists idx_seleccion_candidatos_seleccion
  on proveedor_seleccion_candidatos (seleccion_id, orden);

create or replace function fn_proveedor_seleccion_autor()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado_por_nombre := (select nombre from profiles where id = auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proveedor_seleccion_autor on proveedor_selecciones;
create trigger trg_proveedor_seleccion_autor
  before insert or update on proveedor_selecciones
  for each row execute function fn_proveedor_seleccion_autor();

alter table proveedor_selecciones enable row level security;
alter table proveedor_seleccion_candidatos enable row level security;

drop policy if exists proveedor_selecciones_select on proveedor_selecciones;
create policy proveedor_selecciones_select on proveedor_selecciones
  for select using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_selecciones_insert on proveedor_selecciones;
create policy proveedor_selecciones_insert on proveedor_selecciones
  for insert with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_selecciones_update on proveedor_selecciones;
create policy proveedor_selecciones_update on proveedor_selecciones
  for update
  using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'))
  with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_selecciones_delete on proveedor_selecciones;
create policy proveedor_selecciones_delete on proveedor_selecciones
  for delete using (get_user_rol() = 'supervisor');

drop policy if exists proveedor_seleccion_candidatos_select on proveedor_seleccion_candidatos;
create policy proveedor_seleccion_candidatos_select on proveedor_seleccion_candidatos
  for select using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_seleccion_candidatos_insert on proveedor_seleccion_candidatos;
create policy proveedor_seleccion_candidatos_insert on proveedor_seleccion_candidatos
  for insert with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_seleccion_candidatos_update on proveedor_seleccion_candidatos;
create policy proveedor_seleccion_candidatos_update on proveedor_seleccion_candidatos
  for update
  using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'))
  with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_seleccion_candidatos_delete on proveedor_seleccion_candidatos;
create policy proveedor_seleccion_candidatos_delete on proveedor_seleccion_candidatos
  for delete using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

revoke all on proveedor_selecciones from anon;
revoke all on proveedor_seleccion_candidatos from anon;
grant select, insert, update, delete on proveedor_selecciones to authenticated;
grant select, insert, update, delete on proveedor_seleccion_candidatos to authenticated;
grant all on proveedor_selecciones to service_role;
grant all on proveedor_seleccion_candidatos to service_role;

commit;
```

- [ ] **Paso 2:** revisión manual del SQL.
- [ ] **Paso 3: commit** `feat(proveedores): migración 083 con evaluación de selección de proveedores`

### Tarea 19: Lógica y acciones de selección

**Archivos:** crear `lib/types/proveedor-seleccion.ts`, `lib/proveedores/seleccion.ts`, `lib/supabase/proveedor-seleccion-actions.ts`.

**Interfaces — produce:**
- `Candidato`: `{ id?: number; proveedor_id: number | null; nombre: string; es_nuevo: boolean; precio: number | null; tiempo_entrega_dias: number | null; calidad: Calidad | null; observaciones: string }`
- `compararCandidatos(candidatos: Candidato[]): { mejores: { precio: number | null; tiempo: number | null; calidad: number | null }; puntajes: Array<{ indice: number; precio: number | null; tiempo: number | null; calidad: number | null; global: number | null }>; recomendado: number | null }` (índices dentro del arreglo recibido): `precio = min_precio / precio × 100`, `tiempo = min_tiempo / tiempo × 100` (si el tiempo es 0 se trata como 100), `calidad = PUNTAJE_CALIDAD`; `global = promedio` de los disponibles; `recomendado` = mayor `global` (empate → menor precio).
- `fetchSelecciones()`, `fetchSeleccionById(id)` (con candidatos), `guardarSeleccion(input)` (crea o actualiza la selección y reemplaza sus candidatos), `eliminarSeleccion(id)` (solo `supervisor`), `fetchReferenciaProveedor(proveedorId)` (devuelve `{ tiempo_promedio_dias, calidad_promedio_indice }` calculado del historial para precargar un candidato existente).

- [ ] **Paso 1:** `compararCandidatos` pura + verificación con script desechable (dos candidatos: A precio 100/tiempo 10/calidad bien, B precio 80/tiempo 15/calidad regular → A: precio 80, tiempo 100, calidad 100; B: precio 100, tiempo 66.7, calidad 50).
- [ ] **Paso 2:** esquema `zod` de la selección (título obligatorio, al menos 2 candidatos, cada candidato con proveedor existente o nombre nuevo, precio ≥ 0) y acciones con `requireRole(ROUTE_PERMISSIONS.proveedores)`; preview y `migracion_pendiente`.
- [ ] **Paso 3:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 4: commit** `feat(proveedores): comparación de candidatos y acciones de la evaluación de selección`

### Tarea 20: Interfaz y constancia de la selección

**Archivos:** crear `app/(panel)/proveedores/seleccion/[id]/page.tsx` + `loading.tsx`, `components/proveedores/SeleccionLista.tsx`, `SeleccionEditor.tsx`, `lib/export/proveedor-seleccion.ts`; modificar `ProveedoresTabs.tsx`.

- [ ] **Paso 1:** `SeleccionLista` en la pestaña "Evaluación de selección": lista de evaluaciones (título, estado, elegido, fecha, quién), botón "Nueva evaluación" que lleva al editor (`/proveedores/seleccion/nuevo`; el segmento `[id]` acepta el texto `nuevo`).
- [ ] **Paso 2:** `SeleccionEditor`: título y necesidad; filas de candidatos (agregar/quitar): elegir un proveedor existente con el `SelectorProveedor` (desplegable con todos por nombre; excluye los ya elegidos en otras filas con `excluirIds`; al elegirlo precarga tiempo y calidad con `fetchReferenciaProveedor`) o escribir un nombre nuevo; precio, tiempo de entrega (días), calidad (desplegable) y observaciones. **Cuadro comparativo** en vivo con `compararCandidatos`: resalta con color el mejor valor de cada criterio, muestra el puntaje global, marca "Recomendado" y permite elegir el proveedor ganador; campo "Conclusión"; botón "Marcar como decidida".
- [ ] **Paso 3:** exportación: CSV (una fila por candidato con sus valores y puntajes + fila de conclusión) y PDF (título, necesidad, cuadro comparativo con el mejor de cada criterio resaltado, recomendado, elegido y conclusión).
- [ ] **Paso 4:** verificación manual: crear una evaluación con un proveedor existente y uno nuevo, ver el cuadro y los resaltados, decidir, descargar CSV/PDF.
- [ ] **Paso 5:** `npx tsc --noEmit` y `npm run lint`.
- [ ] **Paso 6: commit** `feat(proveedores): evaluación de selección con cuadro comparativo y constancia`

### Tarea 21: Revisión final

- [ ] **Paso 1:** `npx tsc --noEmit` y `npm run lint` sobre todo el proyecto; confirmar que no hay errores nuevos en archivos de Proveedores.
- [ ] **Paso 2:** QA manual con `DEV_SKIP_AUTH=true` y cada rol (`supervisor`, `comercial`, `compras`, `auditoria` entran y pueden modificar; `produccion`, `metalmecanica`, `instalacion` y `lectura` son redirigidos): menú, lista, filtro, ficha, desempeño, exportaciones, configuración (solo `supervisor` la ve), reevaluación, selección.
- [ ] **Paso 3:** revisar `git diff` completo buscando datos sensibles o `console.log` olvidados.
- [ ] **Paso 4:** actualizar `docs/ESTADO_SECCION_2.md` o crear una nota breve en `docs/` con el estado de Proveedores y las migraciones 080–083 pendientes de aplicar.
- [ ] **Paso 5: commit** `docs(proveedores): estado de la sección Proveedores y migraciones pendientes`

---

## Pendiente de backend (no lo hace el frontend)

1. Aplicar las migraciones 080, 081, 082 y 083, en ese orden.
1b. **Cargar todos los proveedores de Siigo en el catálogo:** extender la Edge Function `siigo-sync-catalogo` (`supabase/functions/siigo-sync-catalogo/index.ts`, bloque "Proveedores") para que, además de comparar nombres, haga `upsert` en `proveedores` por `nit_normalizado` de cada proveedor que devuelve `listarProveedoresSiigo` (`origen = 'siigo'`; actualizar `nombre` y `activo` si cambiaron; no pisar `email`/`telefono`/`contacto`/`notas` ya escritos a mano). El endpoint que usa hoy (`/v1/customers`) trae terceros en general, así que hay que **filtrar por tipo proveedor** (revisar el campo `type` de la respuesta de Siigo) para no llenar el desplegable con clientes. Hace falta una primera corrida completa (`{ completo: true }`). Hasta que esto esté, el desplegable muestra los proveedores de las OC, los creados a mano y los importados por archivo.
2. Envío automático por correo del resultado de la OC y del recordatorio anual de reevaluación (Edge Function sobre `cola_correos` con adjuntos, migración 045, y `pg_cron`); lo coordina el usuario con Juan Pablo. Mientras tanto, el resultado se descarga a mano.
3. Confirmar con compras cómo se escribe el NIT de un mismo proveedor (con o sin dígito de verificación), porque se compara solo por dígitos.

## Autorreview contra el spec

- Catálogo, filtro, importación → Tareas 1–5. Historial con columnas del Excel → Tarea 6. Desempeño con 4 divisiones, calidad desplegable, porcentaje configurable → Tareas 7–11. CSV/PDF y resultado de OC → Tarea 12. Importar historial del Excel → Tarea 13. Acceso desde la OC → Tarea 14. Reevaluación anual con constancia → Tareas 15–17. Evaluación de selección → Tareas 18–20. Permisos "todos ven y modifican" → restricciones globales y todas las RLS. CSV en vez de xlsx → Tarea 3.
- Nombres consistentes entre tareas: `FilaHistorial` (Tarea 6, ampliada en la 10), `ConfigDesempeno`, `calcularPuntajes`, `diferenciaEnDias` (Tarea 8), `ResumenReevaluacion` (Tarea 16), `Candidato`/`compararCandidatos` (Tarea 19).
