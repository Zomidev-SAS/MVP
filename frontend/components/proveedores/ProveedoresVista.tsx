'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ImportarProveedoresDialog } from '@/components/proveedores/ImportarProveedoresDialog'
import { ProveedorFormDialog } from '@/components/proveedores/ProveedorFormDialog'
import { ProveedoresLista } from '@/components/proveedores/ProveedoresLista'
import { SelectorProveedor } from '@/components/proveedores/SelectorProveedor'
import { fetchProveedores } from '@/lib/supabase/proveedores-actions'
import { MIGRACION_PENDIENTE, type ProveedorFila } from '@/lib/types/proveedor'

export function ProveedoresVista({ puedeEliminar }: { puedeEliminar: boolean }) {
  const router = useRouter()
  const [filas, setFilas] = useState<ProveedorFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [editando, setEditando] = useState<ProveedorFila | null>(null)
  const [importarAbierto, setImportarAbierto] = useState(false)

  const cargar = useCallback(() => {
    fetchProveedores()
      .then((resultado) => {
        setFilas(resultado.filas)
        setError(resultado.error ?? null)
      })
      .catch((fallo) => {
        console.error('Failed to fetch proveedores:', fallo)
        setFilas([])
        setError('No se pudieron cargar los proveedores.')
      })
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  function recargar() {
    setCargando(true)
    cargar()
  }

  function nuevo() {
    setEditando(null)
    setFormularioAbierto(true)
  }

  function editar(proveedor: ProveedorFila) {
    setEditando(proveedor)
    setFormularioAbierto(true)
  }

  const sinMigracion = error === MIGRACION_PENDIENTE

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72">
          <SelectorProveedor
            proveedores={filas}
            valor={null}
            onSeleccionar={(proveedor) => router.push(`/proveedores/${proveedor.id}`)}
            placeholder="Elegir proveedor"
            aria-label="Elegir un proveedor para ver su historial"
            disabled={cargando || filas.length === 0}
          />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" disabled={sinMigracion} onClick={() => setImportarAbierto(true)}>
            Importar CSV
          </Button>
          <Button disabled={sinMigracion} onClick={nuevo}>
            Nuevo proveedor
          </Button>
        </div>
      </div>

      <ProveedoresLista
        filas={filas}
        cargando={cargando}
        error={error}
        puedeEliminar={puedeEliminar}
        onNuevo={nuevo}
        onImportar={() => setImportarAbierto(true)}
        onEditar={editar}
        onEliminado={recargar}
      />

      <ProveedorFormDialog
        abierto={formularioAbierto}
        onOpenChange={setFormularioAbierto}
        proveedor={editando}
        onGuardado={recargar}
      />
      <ImportarProveedoresDialog
        abierto={importarAbierto}
        onOpenChange={setImportarAbierto}
        onImportado={recargar}
      />
    </div>
  )
}
