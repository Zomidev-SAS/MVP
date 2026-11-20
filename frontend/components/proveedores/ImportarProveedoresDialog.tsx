'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { descargarCsv, generarCsv } from '@/lib/export/csv'
import { leerCsvProveedores, type LecturaProveedores } from '@/lib/proveedores/importacion'
import { importarProveedores } from '@/lib/supabase/proveedores-actions'

const FILAS_VISTA_PREVIA = 8
const ERRORES_VISIBLES = 6

interface ImportarProveedoresDialogProps {
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
  onImportado: () => void
}

function descargarPlantilla() {
  const contenido = generarCsv(
    ['NIT', 'Nombre', 'Correo', 'Teléfono', 'Contacto'],
    [['890.903.938-8', 'Proveedor de ejemplo S.A.S.', 'ventas@ejemplo.com', '604 444 1200', 'Nombre Apellido']]
  )
  descargarCsv('plantilla-proveedores.csv', contenido)
}

export function ImportarProveedoresDialog({
  abierto,
  onOpenChange,
  onImportado,
}: ImportarProveedoresDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [lectura, setLectura] = useState<LecturaProveedores | null>(null)
  const [importando, setImportando] = useState(false)

  function manejarCambioApertura(siguiente: boolean) {
    if (!siguiente) {
      setNombreArchivo(null)
      setLectura(null)
      if (inputRef.current) inputRef.current.value = ''
    }
    onOpenChange(siguiente)
  }

  async function manejarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    if (!archivo) return
    setNombreArchivo(archivo.name)
    try {
      setLectura(leerCsvProveedores(await archivo.text()))
    } catch (error) {
      console.error('Failed to read proveedores CSV:', error)
      setLectura(null)
      toast.error('No se pudo leer el archivo.')
    }
  }

  async function manejarImportar() {
    if (!lectura || lectura.filas.length === 0) return
    setImportando(true)
    const resultado = await importarProveedores(lectura.filas)
    setImportando(false)

    if (!resultado.ok) {
      toast.error(resultado.error)
      return
    }

    toast.success(
      `${resultado.creados} proveedor${resultado.creados === 1 ? '' : 'es'} nuevo${resultado.creados === 1 ? '' : 's'}` +
        (resultado.actualizados > 0 ? ` y ${resultado.actualizados} actualizados.` : '.')
    )
    manejarCambioApertura(false)
    onImportado()
  }

  const validas = lectura?.filas.length ?? 0
  const errores = lectura?.errores ?? []

  return (
    <Dialog open={abierto} onOpenChange={manejarCambioApertura}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar proveedores</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sube un archivo CSV con NIT y nombre (correo, teléfono y contacto son opcionales). Si el
            NIT ya existe, se actualiza sin borrar los datos que ya estaban.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={manejarArchivo}
              className="sr-only"
              id="archivo-proveedores"
            />
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              <FileSpreadsheet aria-hidden="true" />
              {nombreArchivo ? 'Cambiar archivo' : 'Elegir archivo'}
            </Button>
            {nombreArchivo && <span className="truncate text-sm">{nombreArchivo}</span>}
            <Button type="button" variant="link" className="ml-auto px-0" onClick={descargarPlantilla}>
              Descargar plantilla
            </Button>
          </div>

          {lectura && (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium tabular-nums">{validas}</span>{' '}
                {validas === 1 ? 'proveedor listo' : 'proveedores listos'} para importar
                {errores.length > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium tabular-nums text-destructive">
                      {errores.length}
                    </span>{' '}
                    {errores.length === 1 ? 'fila con error' : 'filas con error'}
                  </>
                )}
              </p>

              {validas > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <Table className="min-w-[480px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>NIT</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Correo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lectura.filas.slice(0, FILAS_VISTA_PREVIA).map((fila) => (
                        <TableRow key={fila.nit}>
                          <TableCell className="whitespace-nowrap tabular-nums">{fila.nit}</TableCell>
                          <TableCell>{fila.nombre}</TableCell>
                          <TableCell className="text-muted-foreground">{fila.email || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validas > FILAS_VISTA_PREVIA && (
                    <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                      Y {validas - FILAS_VISTA_PREVIA} más.
                    </p>
                  )}
                </div>
              )}

              {errores.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {errores.slice(0, ERRORES_VISIBLES).map((error) => (
                    <li key={`${error.linea}-${error.motivo}`} className="text-destructive">
                      Línea <span className="tabular-nums">{error.linea}</span>: {error.motivo}
                    </li>
                  ))}
                  {errores.length > ERRORES_VISIBLES && (
                    <li className="text-muted-foreground">
                      Y {errores.length - ERRORES_VISIBLES} errores más.
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          <Button type="button" disabled={validas === 0 || importando} onClick={manejarImportar}>
            {importando
              ? 'Importando...'
              : validas > 0
                ? `Importar ${validas} proveedor${validas === 1 ? '' : 'es'}`
                : 'Importar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
