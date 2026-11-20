'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ConfigDesempeno, PesosDesempeno } from '@/lib/proveedores/desempeno'
import {
  actualizarConfigDesempeno,
  fetchConfigDesempeno,
} from '@/lib/supabase/proveedor-config-actions'

const DIVISIONES: Array<{ clave: keyof PesosDesempeno; etiqueta: string }> = [
  { clave: 'calidad', etiqueta: 'Calidad' },
  { clave: 'devoluciones', etiqueta: 'Devoluciones' },
  { clave: 'cantidad', etiqueta: 'Cantidad' },
  { clave: 'tiempo', etiqueta: 'Tiempo' },
]

function numero(valor: string): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

export function ProveedoresConfig() {
  const [config, setConfig] = useState<ConfigDesempeno | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    fetchConfigDesempeno()
      .then(setConfig)
      .catch((error) => console.error('Failed to fetch proveedor config:', error))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!config) return

    setGuardando(true)
    const resultado = await actualizarConfigDesempeno(config)
    setGuardando(false)

    if (resultado.ok) toast.success('Evaluación de proveedores guardada.')
    else toast.error(resultado.error)
  }

  if (!config) {
    return <p className="text-sm text-muted-foreground">Cargando evaluación de proveedores...</p>
  }

  const totalPesos = DIVISIONES.reduce((total, d) => total + config.pesos[d.clave], 0)

  return (
    <section aria-labelledby="titulo-evaluacion-proveedores" className="max-w-2xl space-y-4">
      <div>
        <h2 id="titulo-evaluacion-proveedores" className="text-lg font-semibold">
          Evaluación de proveedores
        </h2>
        <p className="text-sm text-muted-foreground">
          Cómo se calcula el porcentaje de cumplimiento de cada orden de compra y del proveedor.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="umbral-proveedor">Porcentaje para aprobar</Label>
          <Input
            id="umbral-proveedor"
            type="number"
            min={0}
            max={100}
            value={config.umbral}
            onChange={(e) => setConfig({ ...config, umbral: numero(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground">
            Un proveedor con este porcentaje o más se considera bueno.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Peso de cada división</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DIVISIONES.map((division) => (
              <div key={division.clave} className="space-y-1">
                <Label htmlFor={`peso-${division.clave}`} className="text-xs text-muted-foreground">
                  {division.etiqueta}
                </Label>
                <Input
                  id={`peso-${division.clave}`}
                  type="number"
                  min={0}
                  max={100}
                  value={config.pesos[division.clave]}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      pesos: { ...config.pesos, [division.clave]: numero(e.target.value) },
                    })
                  }
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Suman <span className="tabular-nums">{totalPesos}</span>.{' '}
            {totalPesos === 100
              ? 'Cada número es el porcentaje que aporta la división.'
              : 'No hace falta que sumen 100: se reparten en proporción.'}
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="penalizacion-dia">Puntos menos por día de retraso</Label>
            <Input
              id="penalizacion-dia"
              type="number"
              min={0}
              step="0.5"
              value={config.penalizacionDia}
              onChange={(e) => setConfig({ ...config, penalizacionDia: numero(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="penalizacion-devolucion">Puntos menos por devolución</Label>
            <Input
              id="penalizacion-devolucion"
              type="number"
              min={0}
              step="0.5"
              value={config.penalizacionDevolucion}
              onChange={(e) =>
                setConfig({ ...config, penalizacionDevolucion: numero(e.target.value) })
              }
            />
          </div>
        </div>

        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar evaluación'}
        </Button>
      </form>
    </section>
  )
}
