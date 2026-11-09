'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChevronRight, Download, Folder, FolderPlus, Pencil, Trash2, Upload } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { CARPETA_LABELS } from '@/lib/archivos/matriz'
import {
  borrarArchivo,
  borrarSubcarpeta,
  crearSubcarpeta,
  crearUrlDescarga,
  crearUrlSubida,
  listarCarpetas,
  listarContenido,
  renombrar,
} from '@/lib/supabase/archivos-actions'
import type { CarpetaItem, Contenido } from '@/lib/types/archivos'
import { cn } from '@/lib/utils'

const VACIO: Contenido = { subcarpetas: [], archivos: [] }

function formatTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  )
}

export function ArchivosExplorer() {
  const [carpetas, setCarpetas] = useState<CarpetaItem[]>([])
  const [activa, setActiva] = useState<CarpetaItem | null>(null)
  const [ruta, setRuta] = useState('')
  const [contenido, setContenido] = useState<Contenido>(VACIO)
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [procesando, setProcesando] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listarCarpetas()
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setCarpetas(res.carpetas)
        const primera = res.carpetas[0]
        if (primera) {
          setActiva(primera)
          return cargar(primera, '')
        }
      })
      .catch((error) => {
        console.error('Failed to list carpetas:', error)
        toast.error('No se pudieron cargar las carpetas.')
      })
      .finally(() => setCargando(false))
  }, [])

  async function cargar(carpeta: CarpetaItem, nuevaRuta: string) {
    const res = await listarContenido(carpeta.nombre, nuevaRuta)
    if (res.ok) {
      setContenido({ subcarpetas: res.subcarpetas, archivos: res.archivos })
      setRuta(nuevaRuta)
    } else {
      toast.error(res.error)
    }
  }

  /** Cambia de carpeta o de nivel y recarga la lista. */
  async function abrir(carpeta: CarpetaItem, nuevaRuta: string) {
    setActiva(carpeta)
    setCargando(true)
    await cargar(carpeta, nuevaRuta)
    setCargando(false)
  }

  async function recargar() {
    if (activa) await cargar(activa, ruta)
  }

  async function handleSubir(file: File) {
    if (!activa) return
    setSubiendo(true)
    try {
      const prep = await crearUrlSubida(activa.nombre, ruta, file.name, file.size)
      if (!prep.ok) {
        toast.error(prep.error)
        return
      }
      // url vacía = vista previa de desarrollo: el servidor ya registró el archivo en memoria.
      if (!prep.url) {
        toast.success(`"${prep.nombre}" subido (demostración).`)
        await recargar()
        return
      }
      const resp = await fetch(prep.url, {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      })
      if (!resp.ok) {
        toast.error(`Azure rechazó la subida (${resp.status}).`)
        return
      }
      toast.success(`"${prep.nombre}" subido.`)
      await recargar()
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('No se pudo subir el archivo. Revisa tu conexión.')
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDescargar(rutaArchivo: string, nombre: string) {
    if (!activa) return
    setProcesando(rutaArchivo)
    const res = await crearUrlDescarga(activa.nombre, rutaArchivo)
    setProcesando(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    if (!res.url) {
      toast.info(`Descarga de "${nombre}" simulada (demostración).`)
      return
    }
    window.location.assign(res.url)
  }

  async function handleNuevaCarpeta() {
    if (!activa) return
    const nombre = window.prompt('Nombre de la carpeta nueva:')?.trim()
    if (!nombre) return
    setProcesando('nueva')
    const res = await crearSubcarpeta(activa.nombre, ruta, nombre)
    setProcesando(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Carpeta "${nombre}" creada.`)
    await recargar()
  }

  async function handleRenombrar(rutaActual: string, nombreActual: string, esDirectorio: boolean) {
    if (!activa) return
    const nuevo = window.prompt(`Nuevo nombre para "${nombreActual}":`, nombreActual)?.trim()
    if (!nuevo || nuevo === nombreActual) return
    setProcesando(rutaActual)
    const res = await renombrar(activa.nombre, rutaActual, nuevo, esDirectorio)
    setProcesando(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Renombrado.')
    await recargar()
  }

  async function handleBorrarArchivo(rutaArchivo: string, nombre: string) {
    if (!activa) return
    if (!window.confirm(`¿Borrar "${nombre}"? Azure lo conserva 30 días en la papelera.`)) return
    setProcesando(rutaArchivo)
    const res = await borrarArchivo(activa.nombre, rutaArchivo)
    setProcesando(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Archivo borrado.')
    await recargar()
  }

  async function handleBorrarCarpeta(rutaCarpeta: string, nombre: string) {
    if (!activa) return
    const ok = window.confirm(
      `¿Borrar la carpeta "${nombre}" con TODO lo que tiene dentro? Azure lo conserva 30 días en la papelera.`
    )
    if (!ok) return
    setProcesando(rutaCarpeta)
    const res = await borrarSubcarpeta(activa.nombre, rutaCarpeta)
    setProcesando(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Carpeta "${nombre}" borrada.`)
    await recargar()
  }

  if (!cargando && carpetas.length === 0) {
    return <p className="text-sm text-muted-foreground">Tu rol no tiene carpetas asignadas.</p>
  }

  const tramos = ruta ? ruta.split('/') : []
  const vacia = contenido.subcarpetas.length === 0 && contenido.archivos.length === 0

  return (
    <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
      <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col" aria-label="Carpetas">
        {carpetas.map((c) => (
          <button
            key={c.nombre}
            type="button"
            onClick={() => void abrir(c, '')}
            className={cn(
              'rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors',
              activa?.nombre === c.nombre
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            {CARPETA_LABELS[c.nombre]}
          </button>
        ))}
      </nav>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1 text-lg font-medium">
            {activa && (
              <button
                type="button"
                className={cn('hover:underline', tramos.length === 0 && 'cursor-default hover:no-underline')}
                onClick={() => tramos.length > 0 && void abrir(activa, '')}
              >
                {CARPETA_LABELS[activa.nombre]}
              </button>
            )}
            {tramos.map((tramo, i) => (
              <span key={tramos.slice(0, i + 1).join('/')} className="flex items-center gap-1">
                <ChevronRight className="size-4 text-muted-foreground" />
                <button
                  type="button"
                  className={cn('hover:underline', i === tramos.length - 1 && 'cursor-default hover:no-underline')}
                  onClick={() => i < tramos.length - 1 && activa && void abrir(activa, tramos.slice(0, i + 1).join('/'))}
                >
                  {tramo}
                </button>
              </span>
            ))}
          </nav>

          {activa?.puedeSubir && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleSubir(file)
                }}
              />
              {activa.puedeModificar && (
                <Button variant="outline" onClick={() => void handleNuevaCarpeta()} disabled={procesando === 'nueva'}>
                  <FolderPlus className="mr-2 size-4" />
                  Nueva carpeta
                </Button>
              )}
              <Button onClick={() => inputRef.current?.click()} disabled={subiendo}>
                <Upload className="mr-2 size-4" />
                {subiendo ? 'Subiendo…' : 'Subir archivo'}
              </Button>
            </div>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tamaño</TableHead>
              <TableHead>Modificado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vacia ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {cargando ? 'Cargando...' : 'Carpeta vacía.'}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {contenido.subcarpetas.map((s) => (
                  <TableRow key={`d:${s.ruta}`}>
                    <TableCell className="break-all">
                      <button
                        type="button"
                        className="flex items-center gap-2 font-medium hover:underline"
                        onClick={() => activa && void abrir(activa, s.ruta)}
                      >
                        <Folder className="size-4 shrink-0 text-primary" />
                        {s.nombre}
                      </button>
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell className="space-x-1 text-right">
                      {activa?.puedeModificar && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={procesando === s.ruta}
                          onClick={() => void handleRenombrar(s.ruta, s.nombre, true)}
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Renombrar carpeta {s.nombre}</span>
                        </Button>
                      )}
                      {activa?.puedeBorrar && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={procesando === s.ruta}
                          onClick={() => void handleBorrarCarpeta(s.ruta, s.nombre)}
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">Borrar carpeta {s.nombre}</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {contenido.archivos.map((a) => (
                  <TableRow key={`f:${a.ruta}`}>
                    <TableCell className="break-all">{a.nombre}</TableCell>
                    <TableCell>{formatTamano(a.tamano)}</TableCell>
                    <TableCell>{formatFecha(a.modificado)}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={procesando === a.ruta}
                        onClick={() => void handleDescargar(a.ruta, a.nombre)}
                      >
                        <Download className="size-4" />
                        <span className="sr-only">Descargar {a.nombre}</span>
                      </Button>
                      {activa?.puedeModificar && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={procesando === a.ruta}
                          onClick={() => void handleRenombrar(a.ruta, a.nombre, false)}
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Renombrar {a.nombre}</span>
                        </Button>
                      )}
                      {activa?.puedeBorrar && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={procesando === a.ruta}
                          onClick={() => void handleBorrarArchivo(a.ruta, a.nombre)}
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">Borrar {a.nombre}</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
