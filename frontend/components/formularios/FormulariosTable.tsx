'use client'

import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { FormulariosFilters } from '@/components/formularios/FormulariosFilters'
import { FormularioDetailDialog } from '@/components/formularios/FormularioDetailDialog'
import { fetchFormularios } from '@/lib/supabase/formularios-actions'
import { FORMULARIOS_PAGE_SIZE } from '@/lib/supabase/formularios-page-size'
import type { OpcionFiltro } from '@/lib/formularios/opciones-filtro'
import {
  formatearFechaFormulario,
  vistaFormulario,
  type FormularioListado,
  type FormulariosFiltros,
} from '@/lib/types/formularios'

const FILTROS_INICIALES: FormulariosFiltros = {
  busqueda: '',
  tipo: 'todos',
  filtros: 'todos',
}

const OPCIONES_FILTRO_INICIALES: OpcionFiltro[] = [
  { value: 'todos', label: 'Todos', grupo: 'General' },
]

export function FormulariosTable() {
  const [filtros, setFiltros] = useState<FormulariosFiltros>(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [filas, setFilas] = useState<FormularioListado[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [totalDb, setTotalDb] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [seleccionado, setSeleccionado] = useState<FormularioListado | null>(null)
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [opcionesFiltro, setOpcionesFiltro] = useState<OpcionFiltro[]>(OPCIONES_FILTRO_INICIALES)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      fetchFormularios(filtros, pagina)
        .then((resultado) => {
          setFilas(resultado.filas)
          setTotal(resultado.total)
          setTotalDb(resultado.totalDb)
          setOpcionesFiltro(resultado.opcionesFiltro)
          setErrorMsg(resultado.error ?? null)
        })
        .catch((error) => {
          console.error('Failed to fetch formularios:', error)
          setFilas([])
          setTotal(0)
          setTotalDb(0)
          setErrorMsg('No se pudo cargar formularios.')
        })
        .finally(() => setLoading(false))
    }, 500)

    return () => clearTimeout(timeout)
  }, [filtros, pagina])

  function handleFiltrosChange(nuevosFiltros: FormulariosFiltros) {
    setFiltros(nuevosFiltros)
    setPagina(1)
  }

  function handleRowClick(formulario: FormularioListado) {
    setSeleccionado(formulario)
    setDialogAbierto(true)
  }

  const totalPaginas = Math.max(1, Math.ceil(total / FORMULARIOS_PAGE_SIZE))

  return (
    <div className="space-y-4">
      <FormulariosFilters
        filtros={filtros}
        opcionesFiltro={opcionesFiltro}
        onChange={handleFiltrosChange}
      />

      <p className="text-sm text-muted-foreground">
        {loading
          ? 'Cargando...'
          : `Mostrando ${filas.length} de ${total} formularios (${totalDb} en base de datos)`}
      </p>

      {errorMsg && !loading && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {errorMsg}
          {totalDb === 0 && (
            <p className="mt-1 text-xs opacity-90">
              Si hay datos en Supabase, corré el SQL de{' '}
              <code className="rounded bg-black/10 px-1">supabase/sql/formularios-rls.sql</code>
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Tipo</TableHead>
              <TableHead className="whitespace-nowrap">Marca</TableHead>
              <TableHead className="whitespace-nowrap">Chasis</TableHead>
              <TableHead className="whitespace-nowrap">Fecha ingreso</TableHead>
              <TableHead className="whitespace-nowrap">Fecha salida</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {loading ? 'Cargando...' : 'Sin formularios.'}
                </TableCell>
              </TableRow>
            ) : (
              filas.map((item) => {
                const vista = vistaFormulario(item)
                return (
                  <TableRow
                    key={item.id}
                    onClick={() => handleRowClick(item)}
                    className="cursor-pointer hover:bg-accent"
                  >
                    <TableCell className="whitespace-nowrap font-medium">
                      {vista.tipoLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {vista.marca ?? ''}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-sm">
                      {vista.chasis}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatearFechaFormulario(vista.fechaIngreso)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatearFechaFormulario(vista.fechaSalida)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground md:hidden">
        Desliza horizontalmente para ver todas las columnas.
      </p>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPagina((p) => Math.max(1, p - 1))}
          disabled={pagina <= 1}
        >
          Anterior
        </Button>
        <p className="text-sm text-muted-foreground">
          Página {pagina} de {totalPaginas}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          disabled={pagina >= totalPaginas}
        >
          Siguiente
        </Button>
      </div>

      <FormularioDetailDialog
        formulario={seleccionado}
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
      />
    </div>
  )
}
