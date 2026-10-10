'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { toast } from 'sonner'
import { UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { importarCsv } from '@/lib/supabase/importar-actions'
import type { ImportarResultado } from '@/lib/types/importar'

export function CsvImportForm() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [resultado, setResultado] = useState<ImportarResultado | null>(null)

  function seleccionarArchivo(file: File) {
    setArchivo(file)
    setResultado(null)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    seleccionarArchivo(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setArrastrando(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    seleccionarArchivo(file)
  }

  async function handleImportar() {
    if (!archivo) return

    setEnviando(true)
    const formData = new FormData()
    formData.append('file', archivo)

    const res = await importarCsv(formData)
    setEnviando(false)
    setResultado(res)

    if (res.abortado) {
      toast.error(res.motivo_abortado ?? 'La importación fue abortada.')
      return
    }

    if (res.exitosas > 0) {
      toast.success(`${res.exitosas} filas importadas correctamente.`)
      setArchivo(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } else if (res.errores.length > 0) {
      toast.error('No se importó ninguna fila. Revisa los errores.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          El archivo debe tener las columnas: codigo_producto, cantidad, bodega, valor_unitario
          (bodega y valor_unitario son opcionales).
        </p>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={handleDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
            arrastrando ? 'border-primary bg-accent' : 'border-muted-foreground/25 hover:bg-accent/50'
          )}
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            Arrastra tu archivo aquí o haz click para{' '}
            <span className="text-primary">Subir Archivo</span>
          </p>
          <p className="text-xs text-muted-foreground">Solo archivos .csv</p>
          {archivo && <p className="mt-2 text-sm font-medium text-foreground">{archivo.name}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {archivo && (
        <Button type="button" onClick={handleImportar} disabled={enviando}>
          {enviando ? 'Importando...' : 'Importar archivo'}
        </Button>
      )}

      {resultado && (
        <div className="space-y-3">
          {resultado.abortado ? (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              Importación abortada. {resultado.motivo_abortado}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {resultado.exitosas} filas importadas correctamente.
            </p>
          )}

          {resultado.errores.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fila</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.errores.map((err, i) => (
                    <TableRow key={`${err.fila}-${i}`}>
                      <TableCell>{err.fila}</TableCell>
                      <TableCell className="text-red-500">{err.motivo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
