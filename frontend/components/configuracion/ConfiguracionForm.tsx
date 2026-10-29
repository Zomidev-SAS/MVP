'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchConfiguracion,
  actualizarConfiguracion,
  fetchUmbralesCategoria,
  guardarUmbralesCategoria,
} from '@/lib/supabase/configuracion-actions'
import type { Configuracion, UmbralCategoria } from '@/lib/types/configuracion'

export function ConfiguracionForm() {
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [umbrales, setUmbrales] = useState<UmbralCategoria[]>([])

  useEffect(() => {
    fetchConfiguracion()
      .then(setConfig)
      .catch((error) => {
        console.error('Failed to fetch configuracion:', error)
      })
    fetchUmbralesCategoria()
      .then(setUmbrales)
      .catch((error) => {
        console.error('Failed to fetch umbrales por categoria:', error)
      })
  }, [])

  function cambiarUmbral(categoria: string, valor: string) {
    setUmbrales((actuales) =>
      actuales.map((u) =>
        u.categoria === categoria
          ? { ...u, umbral: valor === '' ? null : Math.max(0, Math.floor(Number(valor))) }
          : u
      )
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!config) return

    setGuardando(true)
    const resultado = await actualizarConfiguracion(config)
    const resultadoCategorias =
      resultado.ok && umbrales.length > 0 ? await guardarUmbralesCategoria(umbrales) : resultado
    setGuardando(false)

    if (resultadoCategorias.ok) {
      toast.success('Configuración guardada.')
    } else {
      toast.error(resultadoCategorias.error)
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

      {umbrales.length > 0 && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Umbral por categoría</p>
            <p className="text-xs text-muted-foreground">
              Cada categoría puede tener su propio mínimo: se avisa cuando el saldo total llega o baja
              de ese número. Si la dejas vacía usa el umbral general de arriba.
            </p>
          </div>
          <div className="divide-y rounded-md border">
            {umbrales.map((u) => (
              <div key={u.categoria} className="flex items-center justify-between gap-3 px-3 py-2">
                <Label htmlFor={`umbral-${u.categoria}`} className="text-sm font-normal">
                  {u.categoria}
                </Label>
                <Input
                  id={`umbral-${u.categoria}`}
                  type="number"
                  min={0}
                  placeholder={String(config.umbral_stock_bajo)}
                  value={u.umbral ?? ''}
                  onChange={(e) => cambiarUmbral(u.categoria, e.target.value)}
                  className="w-28"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" disabled={guardando}>
        {guardando ? 'Guardando...' : 'Guardar'}
      </Button>
    </form>
  )
}
