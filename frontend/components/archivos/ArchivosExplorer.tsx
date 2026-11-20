'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Trash2, Upload } from 'lucide-react'
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
  crearUrlDescarga,
  crearUrlSubida,
  listarArchivos,
  listarCarpetas,
} from '@/lib/supabase/archivos-actions'
import type { ArchivoItem, CarpetaItem } from '@/lib/types/archivos'
import { cn } from '@/lib/utils'

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
  const [archivos, setArchivos] = useState<ArchivoItem[]>([])
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
          return cargarArchivos(primera)
        }
      })
      .catch((error) => {
        console.error('Failed to list carpetas:', error)
        toast.error('No se pudieron cargar las carpetas.')
      })
      .finally(() => setCargando(false))
  }, [])

  async function cargarArchivos(carpeta: CarpetaItem) {
    const res = await listarArchivos(carpeta.nombre)
    if (res.ok) {
      setArchivos(res.archivos)
    } else {
      setArchivos([])
      toast.error(res.error)
    }
  }

  async function seleccionar(carpeta: CarpetaItem) {
    setActiva(carpeta)
    setCargando(true)
    await cargarArchivos(carpeta)
    setCargando(false)
  }

  async function handleSubir(file: File) {
    if (!activa) return
    setSubiendo(true)
    try {
      const prep = await crearUrlSubida(activa.nombre, file.name, file.size)
      if (!prep.ok) {
        toast.error(prep.error)
        return
      }
      // url vacía = vista previa de desarrollo: el servidor ya registró el archivo en memoria.
      if (!prep.url) {
        toast.success(`"${prep.nombre}" subido (demostración).`)
        await cargarArchivos(activa)
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
      await cargarArchivos(activa)
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('No se pudo subir el archivo. Revisa tu conexión.')
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDescargar(nombre: string) {
    if (!activa) return
    setProcesando(nombre)
    const res = await crearUrlDescarga(activa.nombre, nombre)
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

  async function handleBorrar(nombre: string) {
    if (!activa) return
    if (!window.confirm(`¿Borrar "${nombre}"? Azure lo conserva 30 días en la papelera.`)) return
    setProcesando(nombre)
    const res = await borrarArchivo(activa.nombre, nombre)
    setProcesando(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Archivo borrado.')
    setArchivos((prev) => prev.filter((a) => a.nombre !== nombre))
  }

  if (!cargando && carpetas.length === 0) {
    return <p className="text-sm text-muted-foreground">Tu rol no tiene carpetas asignadas.</p>
  }

  return (
    <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
      <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col" aria-label="Carpetas">
        {carpetas.map((c) => (
          <button
            key={c.nombre}
            type="button"
            onClick={() => void seleccionar(c)}
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">{activa ? CARPETA_LABELS[activa.nombre] : ''}</h2>
          {activa?.puedeSubir && (
            <>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleSubir(file)
                }}
              />
              <Button onClick={() => inputRef.current?.click()} disabled={subiendo}>
                <Upload className="mr-2 size-4" />
                {subiendo ? 'Subiendo…' : 'Subir archivo'}
              </Button>
            </>
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
            {archivos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {cargando ? 'Cargando...' : 'Carpeta vacía.'}
                </TableCell>
              </TableRow>
            ) : (
              archivos.map((a) => (
                <TableRow key={a.nombre}>
                  <TableCell className="break-all">{a.nombre}</TableCell>
                  <TableCell>{formatTamano(a.tamano)}</TableCell>
                  <TableCell>{formatFecha(a.modificado)}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={procesando === a.nombre}
                      onClick={() => void handleDescargar(a.nombre)}
                    >
                      <Download className="size-4" />
                      <span className="sr-only">Descargar {a.nombre}</span>
                    </Button>
                    {activa?.puedeBorrar && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={procesando === a.nombre}
                        onClick={() => void handleBorrar(a.nombre)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Borrar {a.nombre}</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
