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
