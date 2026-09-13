'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { construirDetalleFormulario } from '@/lib/formularios/detalle'
import type { FormularioListado } from '@/lib/types/formularios'

function BadgeTipo({ label }: { label: string }) {
  const esEntrada = label === 'Entrada'
  const esSalida = label === 'Salida'

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        esEntrada
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : esSalida
            ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200'
            : 'bg-muted text-muted-foreground'
      }`}
    >
      {label}
    </span>
  )
}

function TarjetaFecha({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div className="rounded-md border border-border/80 bg-muted/30 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 min-h-[1.25rem] text-sm font-semibold leading-snug text-foreground">
        {valor ?? ''}
      </p>
    </div>
  )
}

function SeccionDetalle({
  titulo,
  filas,
}: {
  titulo: string
  filas: Array<{ clave: string; etiqueta: string; valor: string }>
}) {
  if (filas.length === 0) return null

  return (
    <section>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </h3>
      <dl className="divide-y divide-border/70 overflow-hidden rounded-md border border-border/80 bg-card">
        {filas.map((campo) => (
          <div
            key={campo.clave}
            className="grid grid-cols-1 gap-0.5 px-2.5 py-2 sm:grid-cols-[minmax(0,38%)_minmax(0,62%)] sm:gap-2"
          >
            <dt className="text-xs text-muted-foreground">{campo.etiqueta}</dt>
            <dd className="text-sm font-medium leading-snug text-foreground">{campo.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function FormularioDetailDialog({
  formulario,
  open,
  onOpenChange,
}: {
  formulario: FormularioListado | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const detalle = formulario ? construirDetalleFormulario(formulario) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex h-[min(72vh,22rem)] w-[calc(100%-2rem)] max-w-sm flex-col gap-0 overflow-hidden p-0 sm:max-w-sm">
        {detalle && (
          <>
            <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 text-left">
              <div className="flex items-start justify-between gap-2 pr-7">
                <DialogTitle className="font-mono text-sm leading-tight">
                  {detalle.chasis}
                </DialogTitle>
                <BadgeTipo label={detalle.tipoLabel} />
              </div>
            </DialogHeader>

            <div className="formulario-dialog-scroll min-h-0 flex-1 space-y-4 overflow-y-scroll overscroll-y-contain px-4 py-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <TarjetaFecha label="Fecha ingreso" valor={detalle.fechaIngreso} />
                <TarjetaFecha label="Fecha salida" valor={detalle.fechaSalida} />
              </div>

              {detalle.secciones.map((seccion) => (
                <SeccionDetalle key={seccion.titulo} titulo={seccion.titulo} filas={seccion.filas} />
              ))}

              {detalle.secciones.length === 0 &&
                !detalle.fechaIngreso &&
                !detalle.fechaSalida && (
                  <p className="text-sm text-muted-foreground">Sin información adicional.</p>
                )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
