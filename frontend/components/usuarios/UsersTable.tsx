'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ALL_ROLES, type Role } from '@/lib/types/database'
import {
  fetchUsuarios,
  actualizarRolUsuario,
  actualizarEstadoUsuario,
} from '@/lib/supabase/usuarios-actions'
import type { UsuarioListado } from '@/lib/types/usuarios'

export function UsersTable() {
  const [usuarios, setUsuarios] = useState<UsuarioListado[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)

  useEffect(() => {
    fetchUsuarios()
      .then(setUsuarios)
      .catch((error) => {
        console.error('Failed to fetch usuarios:', error)
        setUsuarios([])
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCambiarRol(id: string, rol: Role) {
    setProcesando(id)
    const resultado = await actualizarRolUsuario(id, rol)
    setProcesando(null)
    if (resultado.ok) {
      toast.success('Rol actualizado.')
      setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, rol } : u)))
    } else {
      toast.error(resultado.error)
    }
  }

  async function handleToggleEstado(id: string, activoActual: boolean) {
    setProcesando(id)
    const resultado = await actualizarEstadoUsuario(id, !activoActual)
    setProcesando(null)
    if (resultado.ok) {
      toast.success(activoActual ? 'Usuario desactivado.' : 'Usuario activado.')
      setUsuarios((prev) =>
        prev.map((u) => (u.id === id ? { ...u, activo: !activoActual } : u))
      )
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {usuarios.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              {loading ? 'Cargando...' : 'Sin usuarios.'}
            </TableCell>
          </TableRow>
        ) : (
          usuarios.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell className="font-medium">{usuario.nombre ?? '—'}</TableCell>
              <TableCell>
                <select
                  value={usuario.rol}
                  disabled={procesando === usuario.id}
                  onChange={(e) => handleCambiarRol(usuario.id, e.target.value as Role)}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                >
                  {ALL_ROLES.map((rol) => (
                    <option key={rol} value={rol}>
                      {rol}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                {usuario.activo ? (
                  <span className="text-green-600">Activo</span>
                ) : (
                  <span className="text-muted-foreground">Inactivo</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={procesando === usuario.id}
                  onClick={() => handleToggleEstado(usuario.id, usuario.activo)}
                >
                  {usuario.activo ? 'Desactivar' : 'Activar'}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
