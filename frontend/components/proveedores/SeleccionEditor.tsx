'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Download, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { SelectorProveedor } from '@/components/proveedores/SelectorProveedor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { descargarCsvSeleccion, descargarPdfSeleccion } from '@/lib/export/proveedor-seleccion'
import { CALIDADES, ETIQUETA_CALIDAD, type Calidad } from '@/lib/proveedores/desempeno'
import { calidadDeIndice, compararCandidatos } from '@/lib/proveedores/seleccion'
import {
  eliminarSeleccion,
  fetchReferenciaProveedor,
  guardarSeleccion,
} from '@/lib/supabase/proveedor-seleccion-actions'
import type { ProveedorFila } from '@/lib/types/proveedor'
import {
  guardarSeleccionSchema,
  type EstadoSeleccion,
  type GuardarSeleccionInput,
  type Seleccion,
} from '@/lib/types/proveedor-seleccion'
import { cn } from '@/lib/utils'

const MAX_CANDIDATOS = 10

const SELECT_CLASS =
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

interface CandidatoForm {
  clave: string
  modo: 'catalogo' | 'nuevo'
  proveedor_id: number | null
  nombre_nuevo: string
  precio: string
  tiempo: string
  calidad: Calidad | null
  observaciones: string
  referencia: string | null
}

function candidatoVacio(clave: string): CandidatoForm {
  return {
    clave,
    modo: 'catalogo',
    proveedor_id: null,
    nombre_nuevo: '',
    precio: '',
    tiempo: '',
    calidad: null,
    observaciones: '',
    referencia: null,
  }
}

function estadoInicial(seleccion: Seleccion | null): { lista: CandidatoForm[]; elegida: string | null } {
  if (!seleccion || seleccion.candidatos.length === 0) {
    return { lista: [candidatoVacio('c-0'), candidatoVacio('c-1')], elegida: null }
  }
  const lista = seleccion.candidatos.map(
    (c, i): CandidatoForm => ({
      clave: `c-${i}`,
      modo: c.es_nuevo ? 'nuevo' : 'catalogo',
      proveedor_id: c.proveedor_id,
      nombre_nuevo: c.es_nuevo ? c.nombre : '',
      precio: c.precio == null ? '' : String(c.precio),
      tiempo: c.tiempo_entrega_dias == null ? '' : String(c.tiempo_entrega_dias),
      calidad: c.calidad,
      observaciones: c.observaciones ?? '',
      referencia: null,
    })
  )
  const indice = seleccion.candidatos.findIndex((c) =>
    seleccion.proveedor_elegido_id != null
      ? c.proveedor_id === seleccion.proveedor_elegido_id
      : c.es_nuevo && c.nombre === seleccion.nombre_elegido
  )
  return { lista, elegida: indice >= 0 ? lista[indice].clave : null }
}

function aNumero(valor: string): number | null {
  const limpio = valor.trim()
  if (!limpio) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

function precioTexto(valor: number | null): string {
  return valor == null ? '—' : `$${valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

interface SeleccionEditorProps {
  seleccion: Seleccion | null
  proveedores: ProveedorFila[]
  puedeEliminar: boolean
}

export function SeleccionEditor({ seleccion, proveedores, puedeEliminar }: SeleccionEditorProps) {
  const router = useRouter()
  const [titulo, setTitulo] = useState(seleccion?.titulo ?? '')
  const [necesidad, setNecesidad] = useState(seleccion?.necesidad ?? '')
  const [conclusion, setConclusion] = useState(seleccion?.conclusion ?? '')
  const [inicial] = useState(() => estadoInicial(seleccion))
  const [candidatos, setCandidatos] = useState<CandidatoForm[]>(inicial.lista)
  const [elegidaClave, setElegidaClave] = useState<string | null>(inicial.elegida)
  const [guardando, setGuardando] = useState(false)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  // Claves estables entre servidor y navegador: las filas nuevas siguen numerando desde aquí.
  const siguienteClave = useRef(inicial.lista.length)

  const indiceElegido = candidatos.findIndex((c) => c.clave === elegidaClave)
  const elegido = indiceElegido >= 0 ? indiceElegido : null

  const nombreDe = (c: CandidatoForm) =>
    c.modo === 'catalogo'
      ? (proveedores.find((p) => p.id === c.proveedor_id)?.nombre ?? '')
      : c.nombre_nuevo.trim()

  const comparables = candidatos.map((c) => ({
    precio: aNumero(c.precio),
    tiempo_entrega_dias: aNumero(c.tiempo),
    calidad: c.calidad,
  }))
  const comparacion = compararCandidatos(comparables)

  function actualizar(clave: string, cambio: (c: CandidatoForm) => CandidatoForm) {
    setCandidatos((lista) => lista.map((c) => (c.clave === clave ? cambio(c) : c)))
  }

  function elegirProveedor(clave: string, proveedor: ProveedorFila) {
    actualizar(clave, (c) => ({ ...c, proveedor_id: proveedor.id, referencia: 'Buscando su historial...' }))
    fetchReferenciaProveedor(proveedor.id)
      .then((ref) => {
        const partes = [
          ref.tiempo_promedio_dias != null &&
            `entrega en ${ref.tiempo_promedio_dias.toLocaleString('es-CO')} días en promedio`,
          ref.calidad_indice != null && `calidad ${ref.calidad_indice.toLocaleString('es-CO')} / 100`,
        ].filter(Boolean)
        actualizar(clave, (c) => ({
          ...c,
          tiempo:
            c.tiempo || ref.tiempo_promedio_dias == null
              ? c.tiempo
              : String(Math.round(ref.tiempo_promedio_dias * 10) / 10),
          calidad: c.calidad ?? calidadDeIndice(ref.calidad_indice),
          referencia: partes.length ? `Del historial: ${partes.join(', ')}.` : 'Sin historial para precargar.',
        }))
      })
      .catch(() => actualizar(clave, (c) => ({ ...c, referencia: null })))
  }

  function quitar(clave: string) {
    setCandidatos((lista) => lista.filter((c) => c.clave !== clave))
    if (elegidaClave === clave) setElegidaClave(null)
  }

  function elegirColumna(indice: number) {
    setElegidaClave(candidatos[indice].clave)
  }

  function agregarCandidato() {
    const clave = `c-${siguienteClave.current}`
    siguienteClave.current += 1
    setCandidatos((lista) => [...lista, candidatoVacio(clave)])
  }

  async function guardar(estado: EstadoSeleccion) {
    const entrada: GuardarSeleccionInput = {
      id: seleccion?.id ?? null,
      titulo,
      necesidad,
      estado,
      elegido,
      conclusion,
      candidatos: candidatos.map((c) => ({
        proveedor_id: c.modo === 'catalogo' ? c.proveedor_id : null,
        nombre_nuevo: c.modo === 'nuevo' ? c.nombre_nuevo.trim() : '',
        precio: aNumero(c.precio),
        tiempo_entrega_dias: aNumero(c.tiempo),
        calidad: c.calidad,
        observaciones: c.observaciones,
      })),
    }
    const validado = guardarSeleccionSchema.safeParse(entrada)
    if (!validado.success) {
      toast.error(validado.error.issues[0]?.message ?? 'Revisa la evaluación.')
      return
    }

    setGuardando(true)
    const resultado = await guardarSeleccion(validado.data)
    setGuardando(false)
    if (!resultado.ok) {
      toast.error(resultado.error)
      return
    }
    toast.success(estado === 'decidida' ? 'Evaluación decidida y guardada.' : 'Borrador guardado.')
    if (!seleccion) router.replace(`/proveedores/seleccion/${resultado.id}`)
    else router.refresh()
  }

  async function borrar() {
    if (!seleccion) return
    const resultado = await eliminarSeleccion(seleccion.id)
    if (!resultado.ok) {
      toast.error(resultado.error)
      return
    }
    toast.success('Evaluación eliminada.')
    router.push('/proveedores?vista=seleccion')
  }

  function exportable() {
    return {
      titulo: titulo || 'Evaluación sin título',
      necesidad: necesidad || null,
      conclusion: conclusion || null,
      estado: seleccion?.estado ?? 'borrador',
      elegido,
      candidatos: candidatos.map((c, i) => ({
        nombre: nombreDe(c) || `Proveedor ${i + 1}`,
        es_nuevo: c.modo === 'nuevo',
        precio: aNumero(c.precio),
        tiempo_entrega_dias: aNumero(c.tiempo),
        calidad: c.calidad,
        observaciones: c.observaciones || null,
      })),
    } as const
  }

  const idsElegidos = candidatos.map((c) => c.proveedor_id).filter((id): id is number => id != null)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/proveedores?vista=seleccion"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          Evaluaciones de selección
        </Link>
        <h1 className="text-2xl font-semibold">
          {seleccion ? seleccion.titulo : 'Nueva evaluación de selección'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Compara proveedores en precio, tiempo de entrega y calidad, y deja constancia de cuál se elige.
          {seleccion && ` ${seleccion.estado === 'decidida' ? 'Decidida' : 'En borrador'}.`}
        </p>
      </div>

      <section className="grid max-w-3xl gap-4 sm:grid-cols-[1fr_1.4fr]">
        <div className="space-y-1.5">
          <Label htmlFor="titulo-seleccion">Título</Label>
          <Input
            id="titulo-seleccion"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Fibra de vidrio 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="necesidad-seleccion">Qué se necesita</Label>
          <Textarea
            id="necesidad-seleccion"
            rows={2}
            value={necesidad}
            onChange={(e) => setNecesidad(e.target.value)}
            placeholder="Producto o servicio, cantidades, condiciones..."
          />
        </div>
      </section>

      <section aria-labelledby="titulo-candidatos" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="titulo-candidatos" className="text-base font-semibold">
            Proveedores a comparar
          </h2>
          <Button
            variant="outline"
            size="sm"
            disabled={candidatos.length >= MAX_CANDIDATOS}
            onClick={agregarCandidato}
          >
            <Plus aria-hidden="true" />
            Agregar proveedor
          </Button>
        </div>

        <ul className="space-y-3">
          {candidatos.map((c, i) => (
            <li key={c.clave} className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm" role="group" aria-label={`Origen del proveedor ${i + 1}`}>
                  {(['catalogo', 'nuevo'] as const).map((modo) => (
                    <button
                      key={modo}
                      type="button"
                      aria-pressed={c.modo === modo}
                      onClick={() =>
                        actualizar(c.clave, (actual) => ({ ...actual, modo, referencia: null }))
                      }
                      className={cn(
                        'rounded-md px-2.5 py-1 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                        c.modo === modo ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'
                      )}
                    >
                      {modo === 'catalogo' ? 'Del catálogo' : 'Proveedor nuevo'}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={candidatos.length <= 2}
                  onClick={() => quitar(c.clave)}
                  aria-label={`Quitar proveedor ${i + 1}`}
                >
                  <Trash2 aria-hidden="true" />
                  Quitar
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground" id={`nombre-${c.clave}`}>
                    Proveedor
                  </p>
                  {c.modo === 'catalogo' ? (
                    <SelectorProveedor
                      proveedores={proveedores}
                      valor={c.proveedor_id}
                      onSeleccionar={(p) => elegirProveedor(c.clave, p)}
                      excluirIds={idsElegidos.filter((id) => id !== c.proveedor_id)}
                      aria-label={`Proveedor ${i + 1}`}
                    />
                  ) : (
                    <Input
                      value={c.nombre_nuevo}
                      onChange={(e) =>
                        actualizar(c.clave, (actual) => ({ ...actual, nombre_nuevo: e.target.value }))
                      }
                      placeholder="Nombre del proveedor nuevo"
                      aria-labelledby={`nombre-${c.clave}`}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`precio-${c.clave}`} className="text-xs font-normal text-muted-foreground">
                    Precio
                  </Label>
                  <Input
                    id={`precio-${c.clave}`}
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={c.precio}
                    onChange={(e) => actualizar(c.clave, (actual) => ({ ...actual, precio: e.target.value }))}
                    placeholder="$"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`tiempo-${c.clave}`} className="text-xs font-normal text-muted-foreground">
                    Entrega (días)
                  </Label>
                  <Input
                    id={`tiempo-${c.clave}`}
                    type="number"
                    min={0}
                    step="0.5"
                    value={c.tiempo}
                    onChange={(e) => actualizar(c.clave, (actual) => ({ ...actual, tiempo: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`calidad-${c.clave}`} className="text-xs font-normal text-muted-foreground">
                    Calidad
                  </Label>
                  <select
                    id={`calidad-${c.clave}`}
                    className={SELECT_CLASS}
                    value={c.calidad ?? ''}
                    onChange={(e) =>
                      actualizar(c.clave, (actual) => ({
                        ...actual,
                        calidad: e.target.value === '' ? null : (e.target.value as Calidad),
                      }))
                    }
                  >
                    <option value="">Sin evaluar</option>
                    {CALIDADES.map((calidad) => (
                      <option key={calidad} value={calidad}>
                        {ETIQUETA_CALIDAD[calidad]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Input
                value={c.observaciones}
                onChange={(e) =>
                  actualizar(c.clave, (actual) => ({ ...actual, observaciones: e.target.value }))
                }
                placeholder="Observaciones: condiciones de pago, garantía, certificaciones..."
                aria-label={`Observaciones del proveedor ${i + 1}`}
              />
              {c.referencia && <p className="text-xs text-muted-foreground">{c.referencia}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-cuadro" className="space-y-3">
        <h2 id="titulo-cuadro" className="text-base font-semibold">
          Cuadro comparativo
        </h2>
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Criterio</TableHead>
                {candidatos.map((c, i) => (
                  <TableHead key={c.clave} className="align-bottom whitespace-normal">
                    <span className="block font-medium text-foreground">
                      {nombreDe(c) || `Proveedor ${i + 1}`}
                    </span>
                    <span className="flex flex-wrap gap-1 pb-1 pt-0.5 text-xs font-normal">
                      {c.modo === 'nuevo' && <span className="text-muted-foreground">Nuevo</span>}
                      {comparacion.recomendado === i && (
                        <span className="rounded-md bg-[color-mix(in_oklch,var(--success)_15%,transparent)] px-1.5 text-[var(--success)]">
                          Recomendado
                        </span>
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <FilaCriterio
                etiqueta="Precio"
                valores={comparables.map((v) => precioTexto(v.precio))}
                mejores={comparables.map((v) => v.precio != null && v.precio === comparacion.mejores.precio)}
              />
              <FilaCriterio
                etiqueta="Tiempo de entrega"
                valores={comparables.map((v) =>
                  v.tiempo_entrega_dias == null ? '—' : `${v.tiempo_entrega_dias.toLocaleString('es-CO')} días`
                )}
                mejores={comparables.map(
                  (v) => v.tiempo_entrega_dias != null && v.tiempo_entrega_dias === comparacion.mejores.tiempo
                )}
              />
              <FilaCriterio
                etiqueta="Calidad"
                valores={comparables.map((v) => (v.calidad ? ETIQUETA_CALIDAD[v.calidad] : '—'))}
                mejores={comparacion.puntajes.map(
                  (p) => p.calidad != null && p.calidad === comparacion.mejores.calidad
                )}
              />
              <TableRow>
                <TableCell className="font-medium">Puntaje global</TableCell>
                {comparacion.puntajes.map((p, i) => (
                  <TableCell key={candidatos[i].clave} className="tabular-nums">
                    {p.global == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={cn(comparacion.recomendado === i && 'font-semibold')}>
                        {p.global.toLocaleString('es-CO')}
                        <span className="text-muted-foreground"> / 100</span>
                      </span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-transparent">
                <TableCell className="font-medium">Proveedor elegido</TableCell>
                {candidatos.map((c, i) => (
                  <TableCell key={c.clave}>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="proveedor-elegido"
                        checked={elegido === i}
                        onChange={() => elegirColumna(i)}
                        className="h-4 w-4"
                      />
                      Elegir
                    </label>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Precio y tiempo se califican en proporción al mejor (que vale 100); la calidad vale 100 si es Bien,
          50 si es Regular y 0 si es Mal. La recomendación es orientativa: la decisión la toma quien evalúa.
        </p>
      </section>

      <section className="max-w-3xl space-y-1.5">
        <Label htmlFor="conclusion-seleccion">Conclusión</Label>
        <Textarea
          id="conclusion-seleccion"
          rows={3}
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          placeholder="Por qué se elige este proveedor frente a los demás."
        />
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button disabled={guardando} onClick={() => guardar('decidida')}>
          {guardando ? 'Guardando...' : 'Marcar como decidida'}
        </Button>
        <Button variant="outline" disabled={guardando} onClick={() => guardar('borrador')}>
          Guardar borrador
        </Button>
        <Button variant="outline" onClick={() => descargarCsvSeleccion(exportable())}>
          <Download aria-hidden="true" />
          CSV
        </Button>
        <Button variant="outline" onClick={() => descargarPdfSeleccion(exportable())}>
          <Download aria-hidden="true" />
          PDF
        </Button>
        {seleccion && puedeEliminar && (
          <span className="ml-auto flex items-center gap-2 text-sm">
            {confirmandoBorrado ? (
              <>
                ¿Eliminar esta evaluación?
                <Button variant="destructive" size="sm" onClick={borrar}>
                  Sí, eliminar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmandoBorrado(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmandoBorrado(true)}>
                Eliminar
              </Button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

function FilaCriterio({
  etiqueta,
  valores,
  mejores,
}: {
  etiqueta: string
  valores: string[]
  mejores: boolean[]
}) {
  const hayVarios = valores.filter((v) => v !== '—').length > 1
  return (
    <TableRow>
      <TableCell className="font-medium">{etiqueta}</TableCell>
      {valores.map((valor, i) => (
        <TableCell key={i} className="tabular-nums">
          <span className={cn('inline-flex items-center gap-1.5', mejores[i] && hayVarios && 'font-medium')}>
            {mejores[i] && hayVarios && (
              <Check aria-label="Mejor valor" className="h-3.5 w-3.5 text-[var(--success)]" />
            )}
            <span className={cn(valor === '—' && 'text-muted-foreground')}>{valor}</span>
          </span>
        </TableCell>
      ))}
    </TableRow>
  )
}
