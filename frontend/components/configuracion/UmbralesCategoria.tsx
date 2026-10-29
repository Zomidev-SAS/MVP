'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchUmbralesCategoria,
  guardarUmbralCategoria,
  quitarUmbralCategoria,
} from '@/lib/supabase/configuracion-actions'
import type { UmbralesCategoriaData } from '@/lib/types/configuracion'

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'

export function UmbralesCategoria({ umbralGeneral }: { umbralGeneral: number }) {
  const [data, setData] = useState<UmbralesCategoriaData | null>(null)
  const [categoria, setCategoria] = useState('')
  const [umbral, setUmbral] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setData(await fetchUmbralesCategoria())
    } catch (error) {
      console.error('Failed to fetch umbrales por categoria:', error)
      setData({ categorias: [], umbrales: [], error: 'No se pudieron cargar los umbrales.' })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar()
  }, [cargar])

  async function handleGuardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!categoria) {
      toast.error('Elige una categoría.')
      return
    }
    if (umbral === '' || Number.isNaN(Number(umbral))) {
      toast.error('Escribe el umbral (un número de 0 o más).')
      return
    }

    setGuardando(true)
    const resultado = await guardarUmbralCategoria(categoria, Math.floor(Number(umbral)))
    setGuardando(false)

    if (resultado.ok) {
      toast.success(`Umbral de ${categoria} guardado.`)
      setCategoria('')
      setUmbral('')
      await cargar()
    } else {
      toast.error(resultado.error)
    }
  }

  async function handleQuitar(nombre: string) {
    const resultado = await quitarUmbralCategoria(nombre)
    if (resultado.ok) {
      toast.success(`${nombre} vuelve a usar el umbral general.`)
      await cargar()
    } else {
      toast.error(resultado.error)
    }
  }

  function handleEditar(nombre: string, valor: number) {
    setCategoria(nombre)
    setUmbral(String(valor))
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Cargando umbrales por categoría...</p>
  }

  const yaConfiguradas = new Set(data.umbrales.map((u) => u.categoria))

  return (
    <section className="space-y-4 rounded-md border p-4">
      <div>
        <h2 className="text-base font-semibold">Umbral de cantidad baja por categoría</h2>
        <p className="text-xs text-muted-foreground">
          Elige una categoría y el mínimo: se avisa (alerta y notificación) cuando el saldo total de un
          producto de esa categoría llega o baja de ese número. Las categorías sin umbral propio usan
          el umbral general ({umbralGeneral}).
        </p>
      </div>

      {data.error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{data.error}</p>
        </div>
      )}

      <form onSubmit={handleGuardar} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="umbral-categoria">Categoría</Label>
          <select
            id="umbral-categoria"
            value={categoria}
            onChange={(e) => {
              const nueva = e.target.value
              setCategoria(nueva)
              const actual = data.umbrales.find((u) => u.categoria === nueva)
              setUmbral(actual ? String(actual.umbral) : '')
            }}
            className={SELECT_CLASS}
            disabled={data.categorias.length === 0}
          >
            <option value="">Selecciona una categoría...</option>
            {data.categorias.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
                {yaConfiguradas.has(nombre) ? ' (configurada)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="umbral-valor">Avisar en o bajo</Label>
          <Input
            id="umbral-valor"
            type="number"
            min={0}
            step={1}
            placeholder="Ej. 100"
            value={umbral}
            onChange={(e) => setUmbral(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={guardando || data.categorias.length === 0}>
          {guardando ? 'Guardando...' : yaConfiguradas.has(categoria) ? 'Actualizar' : 'Agregar'}
        </Button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Configurados ({data.umbrales.length})</h3>
        {data.umbrales.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Aún no hay umbrales por categoría. Todas usan el umbral general ({umbralGeneral}).
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {data.umbrales.map((u) => (
              <div key={u.categoria} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.categoria}</p>
                  <p className="text-xs text-muted-foreground">
                    Avisa en {u.umbral} o menos
                    {u.en_alerta > 0
                      ? ` · ${u.en_alerta} producto${u.en_alerta === 1 ? '' : 's'} en alerta ahora`
                      : ' · sin productos en alerta'}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold tabular-nums">
                  {u.umbral}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar umbral de ${u.categoria}`}
                  onClick={() => handleEditar(u.categoria, u.umbral)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar umbral de ${u.categoria}`}
                  onClick={() => handleQuitar(u.categoria)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
