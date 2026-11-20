'use client'

import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { diferenciaEnDias, formatearFechaNumerica } from '@/lib/proveedores/fechas'
import {
  detectarFormatoFecha,
  leerCsvHistorial,
  type FormatoFecha,
} from '@/lib/proveedores/importacion'
import { importarHistorialDesempeno } from '@/lib/supabase/proveedor-desempeno-actions'
import { cn } from '@/lib/utils'

const FILAS_VISTA_PREVIA = 8
const ERRORES_VISIBLES = 6

const OPCIONES_FORMATO: Array<{ valor: FormatoFecha; etiqueta: string; ejemplo: string }> = [
  { valor: 'dmy', etiqueta: 'Día/mes/año', ejemplo: '31/12/2025' },
  { valor: 'mdy', etiqueta: 'Mes/día/año', ejemplo: '12/31/2025' },
]

interface ImportarHistorialDialogProps {
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
  proveedorId: number
  proveedorNombre: string
  onImportado: () => void
}

export function ImportarHistorialDialog({
  abierto,
  onOpenChange,
  proveedorId,
  proveedorNombre,
  onImportado,
}: ImportarHistorialDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [texto, setTexto] = useState<string | null>(null)
  const [formato, setFormato] = useState<FormatoFecha | null>(null)
  const [detectado, setDetectado] = useState<FormatoFecha | 'ambiguo' | null>(null)
  const [importando, setImportando] = useState(false)

  const lectura = useMemo(
    () => (texto != null && formato ? leerCsvHistorial(texto, formato) : null),
    [texto, formato]
  )

  function limpiar() {
    setNombreArchivo(null)
    setTexto(null)
    setFormato(null)
    setDetectado(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function manejarCambioApertura(siguiente: boolean) {
    if (!siguiente) limpiar()
    onOpenChange(siguiente)
  }

  async function manejarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    if (!archivo) return
    try {
      const contenido = await archivo.text()
      const deteccion = detectarFormatoFecha(contenido)
      setNombreArchivo(archivo.name)
      setTexto(contenido)
      setDetectado(deteccion)
      setFormato(deteccion === 'ambiguo' ? null : deteccion)
    } catch (error) {
      console.error('Failed to read historial CSV:', error)
      toast.error('No se pudo leer el archivo.')
    }
  }

  async function manejarImportar() {
    if (!lectura || lectura.filas.length === 0) return
    setImportando(true)
    const resultado = await importarHistorialDesempeno(proveedorId, lectura.filas)
    setImportando(false)

    if (!resultado.ok) {
      toast.error(resultado.error)
      return
    }
    const partes = [
      resultado.creados > 0 && `${resultado.creados} nuevas`,
      resultado.actualizados > 0 && `${resultado.actualizados} actualizadas`,
    ].filter(Boolean)
    toast.success(`Historial importado: ${partes.join(' y ') || 'sin cambios'}.`)
    manejarCambioApertura(false)
    onImportado()
  }

  const validas = lectura?.filas.length ?? 0
  const errores = lectura?.errores ?? []

  return (
    <Dialog open={abierto} onOpenChange={manejarCambioApertura}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar historial · {proveedorNombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Guarda tu cuadro de control de entregas como CSV y súbelo aquí. Se leen las columnas Orden
            de compra, Fecha de OC, Fecha de entrega, Fecha real de entrega, Devoluciones,
            Observaciones y Factura o remisión; las filas de título de arriba se ignoran. Si una orden
            ya existe en el panel, se completa sobre ella.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={manejarArchivo}
              className="sr-only"
              id="archivo-historial"
            />
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              <FileSpreadsheet aria-hidden="true" />
              {nombreArchivo ? 'Cambiar archivo' : 'Elegir archivo'}
            </Button>
            {nombreArchivo && <span className="truncate text-sm">{nombreArchivo}</span>}
          </div>

          {texto != null && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">¿Cómo están escritas las fechas?</legend>
              <div className="flex flex-wrap gap-2">
                {OPCIONES_FORMATO.map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    aria-pressed={formato === opcion.valor}
                    onClick={() => setFormato(opcion.valor)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-left text-sm outline-none transition-colors',
                      'focus-visible:ring-3 focus-visible:ring-ring/50',
                      formato === opcion.valor
                        ? 'border-foreground bg-muted font-medium'
                        : 'border-input hover:bg-muted'
                    )}
                  >
                    {opcion.etiqueta}{' '}
                    <span className="tabular-nums text-muted-foreground">{opcion.ejemplo}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {detectado === 'ambiguo'
                  ? 'No se pudo saber por las fechas del archivo: elige el formato.'
                  : 'Lo detectamos por las fechas del archivo; cámbialo si no es así.'}
              </p>
            </fieldset>
          )}

          {lectura && (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium tabular-nums">{validas}</span>{' '}
                {validas === 1 ? 'orden lista' : 'órdenes listas'} para importar
                {errores.length > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium tabular-nums text-destructive">{errores.length}</span>{' '}
                    {errores.length === 1 ? 'fila con error' : 'filas con error'}
                  </>
                )}
              </p>

              {validas > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <Table className="min-w-[620px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Orden</TableHead>
                        <TableHead>Fecha de OC</TableHead>
                        <TableHead>Prometida</TableHead>
                        <TableHead>Real</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                        <TableHead className="text-right">Devoluciones</TableHead>
                        <TableHead>Factura</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lectura.filas.slice(0, FILAS_VISTA_PREVIA).map((fila) => {
                        const diferencia = diferenciaEnDias(
                          fila.fecha_entrega_prometida,
                          fila.fecha_entrega_real
                        )
                        return (
                          <TableRow key={fila.numero_oc}>
                            <TableCell className="font-medium">{fila.numero_oc}</TableCell>
                            <TableCell className="tabular-nums">
                              {formatearFechaNumerica(fila.fecha_oc) ?? '—'}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {formatearFechaNumerica(fila.fecha_entrega_prometida) ?? '—'}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {formatearFechaNumerica(fila.fecha_entrega_real) ?? '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{diferencia ?? '—'}</TableCell>
                            <TableCell className="text-right tabular-nums">{fila.devoluciones}</TableCell>
                            <TableCell className="tabular-nums">{fila.factura_remision ?? '—'}</TableCell>
                          </TableRow>
                        )
                      })}
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
                    <li className="text-muted-foreground">Y {errores.length - ERRORES_VISIBLES} errores más.</li>
                  )}
                </ul>
              )}
            </div>
          )}

          <Button type="button" disabled={validas === 0 || importando} onClick={manejarImportar}>
            {importando
              ? 'Importando...'
              : validas > 0
                ? `Importar ${validas} ${validas === 1 ? 'orden' : 'órdenes'}`
                : 'Importar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
