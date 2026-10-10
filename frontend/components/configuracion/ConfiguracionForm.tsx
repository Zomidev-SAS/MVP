'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchConfiguracion, actualizarConfiguracion } from '@/lib/supabase/configuracion-actions'
import type { Configuracion } from '@/lib/types/configuracion'

export function ConfiguracionForm() {
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    fetchConfiguracion()
      .then(setConfig)
      .catch((error) => {
        console.error('Failed to fetch configuracion:', error)
      })
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!config) return

    setGuardando(true)
    const resultado = await actualizarConfiguracion(config)
    setGuardando(false)

    if (resultado.ok) {
      toast.success('Configuración guardada.')
    } else {
      toast.error(resultado.error)
    }
  }

  if (!config) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-6">
      <div className="flex items-center justify-between rounded-md border p-4">
        <div>
          <p className="text-sm font-medium">Bloquear salidas sin stock</p>
          <p className="text-xs text-muted-foreground">
            Impide registrar salidas cuando el saldo llegaría a negativo.
          </p>
        </div>
        <input
          type="checkbox"
          checked={config.bloquear_sin_stock}
          onChange={(e) => setConfig({ ...config, bloquear_sin_stock: e.target.checked })}
          className="h-5 w-5"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="umbral">Umbral de stock bajo</Label>
        <Input
          id="umbral"
          type="number"
          min={0}
          value={config.umbral_stock_bajo}
          onChange={(e) => setConfig({ ...config, umbral_stock_bajo: Number(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">
          Cantidad igual o menor a esta se marca como stock bajo en el Dashboard e Inventario.
        </p>
      </div>

      <Button type="submit" disabled={guardando}>
        {guardando ? 'Guardando...' : 'Guardar'}
      </Button>
    </form>
  )
}
