'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { AvisoMigracion } from '@/components/proveedores/AvisoMigracion'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { analisisDesempeno, type ProveedorExportable } from '@/lib/export/proveedor-desempeno'
import {
  descargarCsvReevaluacion,
  descargarPdfReevaluacion,
} from '@/lib/export/proveedor-reevaluacion'
import type { ConfigDesempeno } from '@/lib/proveedores/desempeno'
import { formatearFechaCorta, fechaDeTimestamp } from '@/lib/proveedores/fechas'
import {
  CLASE_PUNTO_NIVEL,
  formatearEntero,
  formatearPorcentaje,
  nivelCumplimiento,
} from '@/lib/proveedores/formato'
import type { FilaHistorial } from '@/lib/proveedores/historial'
import {
  aniosDisponibles,
  calcularReevaluacion,
  filasDelAnio,
  motivoObligatorio,
} from '@/lib/proveedores/reevaluacion'
import { guardarReevaluacion } from '@/lib/supabase/proveedor-reevaluacion-actions'
import { MIGRACION_PENDIENTE } from '@/lib/types/proveedor'
import {
  ETIQUETA_RESULTADO,
  RESULTADOS_REEVALUACION,
  type Reevaluacion,
  type ResultadoReevaluacion,
} from '@/lib/types/proveedor-reevaluacion'
import { cn } from '@/lib/utils'

const SELECT_CLASS =
  'flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

const DIVISIONES = [
  { clave: 'calidad', etiqueta: 'Calidad' },
  { clave: 'devoluciones', etiqueta: 'Devoluciones' },
  { clave: 'cantidad', etiqueta: 'Cantidad' },
  { clave: 'tiempo', etiqueta: 'Tiempo' },
] as const

interface ReevaluacionPanelProps {
  filas: FilaHistorial[]
  config: ConfigDesempeno
  proveedorId: number
  proveedor: ProveedorExportable
  reevaluaciones: Reevaluacion[]
  error?: string
}

function anioInicial(filas: FilaHistorial[], config: ConfigDesempeno, anioActual: number): number {
  const anios = aniosDisponibles(filas, anioActual)
  return anios.find((a) => calcularReevaluacion(filas, a, config).porcentaje != null) ?? anioActual
}

export function ReevaluacionPanel({
  filas,
  config,
  proveedorId,
  proveedor,
  reevaluaciones,
  error,
}: ReevaluacionPanelProps) {
  const router = useRouter()
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(() => anioInicial(filas, config, anioActual))
  const existenteInicial = reevaluaciones.find((r) => r.anio === anio)
  const [resultado, setResultado] = useState<ResultadoReevaluacion>(
    existenteInicial?.resultado ?? 'continuar'
  )
  const [motivo, setMotivo] = useState(existenteInicial?.motivo ?? '')
  const [guardando, setGuardando] = useState(false)

  const anios = useMemo(
    () =>
      [...new Set([...aniosDisponibles(filas, anioActual), ...reevaluaciones.map((r) => r.anio)])].sort(
        (a, b) => b - a
      ),
    [filas, anioActual, reevaluaciones]
  )
  const ordenesDelAnio = useMemo(() => filasDelAnio(filas, anio), [filas, anio])
  const calculo = useMemo(() => calcularReevaluacion(filas, anio, config), [filas, anio, config])
  const analisis = useMemo(
    () => analisisDesempeno(calculo, ordenesDelAnio, config),
    [calculo, ordenesDelAnio, config]
  )
  const existente = reevaluaciones.find((r) => r.anio === anio) ?? null
  const exigeMotivo = motivoObligatorio(resultado, calculo.porcentaje, config.umbral)
  const sinMigracion = error === MIGRACION_PENDIENTE

  function cambiarAnio(siguiente: number) {
    setAnio(siguiente)
    const registro = reevaluaciones.find((r) => r.anio === siguiente)
    setResultado(registro?.resultado ?? 'continuar')
    setMotivo(registro?.motivo ?? '')
  }

  async function guardar() {
    if (exigeMotivo && !motivo.trim()) {
      toast.error('Escribe el motivo de la decisión.')
      return
    }
    setGuardando(true)
    const respuesta = await guardarReevaluacion(proveedorId, { anio, resultado, motivo })
    setGuardando(false)
    if (respuesta.ok) {
      toast.success(`Reevaluación ${anio} guardada.`)
      router.refresh()
    } else {
      toast.error(respuesta.error)
    }
  }

  return (
    <div className="space-y-5">
      {sinMigracion && <AvisoMigracion migracion="082_proveedor_reevaluaciones.sql" />}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <select
          value={anio}
          onChange={(e) => cambiarAnio(Number(e.target.value))}
          aria-label="Año a reevaluar"
          className={SELECT_CLASS}
        >
          {anios.map((a) => (
            <option key={a} value={a}>
              Año {a}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">
          {existente
            ? `Reevaluado: ${ETIQUETA_RESULTADO[existente.resultado].toLowerCase()} · ${existente.creado_por_nombre ?? 'sin nombre'}, ${formatearFechaCorta(fechaDeTimestamp(existente.updated_at))}`
            : `Sin reevaluación registrada para ${anio}.`}
        </p>
      </div>

      <section aria-label={`Análisis ${anio}`} className="rounded-md border">
        <div className="grid gap-6 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Cumplimiento {anio}</p>
            <p className="flex items-center gap-2 text-4xl font-semibold tabular-nums">
              {calculo.porcentaje != null && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-3 w-3 rounded-full',
                    CLASE_PUNTO_NIVEL[nivelCumplimiento(calculo.porcentaje, config.umbral)]
                  )}
                />
              )}
              {calculo.porcentaje == null ? '—' : formatearPorcentaje(calculo.porcentaje)}
            </p>
            <p className="text-sm text-muted-foreground">
              {calculo.superaUmbral == null
                ? 'No hay órdenes finalizadas en este año.'
                : calculo.superaUmbral
                  ? `Aprueba: está sobre el ${formatearPorcentaje(config.umbral)}.`
                  : `No alcanza el ${formatearPorcentaje(config.umbral)} requerido.`}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Órdenes calificadas</dt>
                <dd className="tabular-nums">
                  {formatearEntero(calculo.calificadas)} de {formatearEntero(calculo.total)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Entregas con retraso</dt>
                <dd className="tabular-nums">{formatearEntero(calculo.conRetraso)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Devoluciones</dt>
                <dd className="tabular-nums">{formatearEntero(calculo.devoluciones)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Retraso promedio</dt>
                <dd className="tabular-nums">
                  {calculo.diasRetrasoPromedio == null
                    ? '—'
                    : `${calculo.diasRetrasoPromedio.toLocaleString('es-CO')} días`}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-3">
            <ul className="space-y-2.5" aria-label="Cumplimiento por división">
              {DIVISIONES.map((division) => {
                const valor = calculo.promedios[division.clave]
                return (
                  <li key={division.clave} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm">
                    <span>{division.etiqueta}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${valor ?? 0}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {valor == null ? 'No aplica' : formatearPorcentaje(valor)}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="space-y-1.5 border-t pt-3 text-sm">
              {analisis.map((linea) => (
                <p key={linea}>{linea}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="titulo-decision" className="space-y-3">
        <h2 id="titulo-decision" className="text-base font-semibold">
          Decisión {anio}
        </h2>
        <fieldset className="flex flex-wrap gap-2" disabled={calculo.porcentaje == null}>
          <legend className="sr-only">¿Se continúa con el proveedor?</legend>
          {RESULTADOS_REEVALUACION.map((opcion) => (
            <label
              key={opcion}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
                resultado === opcion ? 'border-foreground bg-muted font-medium' : 'border-input hover:bg-muted'
              )}
            >
              <input
                type="radio"
                name="resultado-reevaluacion"
                value={opcion}
                checked={resultado === opcion}
                onChange={() => setResultado(opcion)}
                className="h-4 w-4"
              />
              {ETIQUETA_RESULTADO[opcion]}
            </label>
          ))}
        </fieldset>

        <div className="max-w-2xl space-y-1.5">
          <Label htmlFor="motivo-reevaluacion">
            Motivo {exigeMotivo ? '(obligatorio)' : '(opcional)'}
          </Label>
          <Textarea
            id="motivo-reevaluacion"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={calculo.porcentaje == null}
            placeholder={
              resultado === 'no_continuar'
                ? 'Por qué no se sigue con este proveedor: incumplimientos, calidad, tiempos...'
                : 'Comentarios de la evaluación'
            }
            aria-describedby="ayuda-motivo"
          />
          <p id="ayuda-motivo" className="text-xs text-muted-foreground">
            Es obligatorio si no se continúa o si el proveedor queda por debajo del umbral.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={guardar}
            disabled={guardando || calculo.porcentaje == null || sinMigracion}
          >
            {guardando ? 'Guardando...' : existente ? 'Actualizar reevaluación' : 'Guardar reevaluación'}
          </Button>
          <Button
            variant="outline"
            disabled={!existente}
            onClick={() => existente && descargarCsvReevaluacion(proveedor, existente, ordenesDelAnio)}
          >
            <Download aria-hidden="true" />
            Constancia CSV
          </Button>
          <Button
            variant="outline"
            disabled={!existente}
            onClick={() => existente && descargarPdfReevaluacion(proveedor, existente, ordenesDelAnio)}
          >
            <Download aria-hidden="true" />
            Constancia PDF
          </Button>
          {!existente && (
            <p className="text-xs text-muted-foreground">La constancia se descarga después de guardar.</p>
          )}
        </div>
      </section>

      {reevaluaciones.length > 0 && (
        <section aria-labelledby="titulo-anteriores" className="space-y-2">
          <h2 id="titulo-anteriores" className="text-base font-semibold">
            Reevaluaciones registradas
          </h2>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Año</TableHead>
                  <TableHead className="text-right">Cumplimiento</TableHead>
                  <TableHead>Decisión</TableHead>
                  <TableHead>Registrada por</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reevaluaciones.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums font-medium">{r.anio}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearPorcentaje(r.porcentaje)}</TableCell>
                    <TableCell className={cn(r.resultado === 'no_continuar' && 'text-destructive')}>
                      {ETIQUETA_RESULTADO[r.resultado]}
                    </TableCell>
                    <TableCell>{r.creado_por_nombre ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatearFechaCorta(fechaDeTimestamp(r.updated_at)) ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  )
}
