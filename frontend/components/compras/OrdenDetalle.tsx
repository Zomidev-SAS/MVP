'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Download, FileSearch, FileText, History, PackageCheck, Pencil, RotateCcw, Send, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DocumentoOc } from '@/components/compras/DocumentoOc'
import { PasosOrden } from '@/components/compras/PasosOrden'
import { RecepcionLineas } from '@/components/compras/RecepcionLineas'
import { SiigoStatusBadge } from '@/components/compras/SiigoStatusBadge'
import { derivarEstadoSiigo } from '@/lib/supabase/orden-compra-siigo-status'
import {
  actualizarFechaCierreOrden,
  actualizarFechaVencimientoOrden,
  actualizarObservacionesEntrega,
  fetchAuditoriaOrden,
} from '@/lib/supabase/ordenes-compra-actions'
import { releerLineasDocumento } from '@/lib/supabase/ordenes-compra-documento-actions'
import {
  ETIQUETA_ACCION_AUDITORIA,
  ETIQUETA_MEDIO_PAGO,
  resumenRecepcion,
  type AuditoriaOrdenCompra,
  type OrdenCompra,
} from '@/lib/types/orden-compra'

function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface OrdenDetalleProps {
  orden: OrdenCompra
  /** Compras y supervisor pueden modificar la orden; el resto solo la ve. */
  puedeGestionar: boolean
  puedeFirmar: boolean
  enviandoSiigo: boolean
  onRecargar: () => void
  onEditar: () => void
  onEliminar: () => void
  onFinalizar: () => void
  onCancelar: () => void
  onReabrir: (motivo: string) => void
  onPdf: () => void
  onCsv: () => void
  onEnviarSiigo: (esReintento: boolean) => void
}

/** Todo lo de una orden de compra, que antes ocupaba la tabla entera: se ve al desplegarla. */
export function OrdenDetalle({
  orden,
  puedeGestionar,
  puedeFirmar,
  enviandoSiigo,
  onRecargar,
  onEditar,
  onEliminar,
  onFinalizar,
  onCancelar,
  onReabrir,
  onPdf,
  onCsv,
  onEnviarSiigo,
}: OrdenDetalleProps) {
  const siigo = derivarEstadoSiigo(orden)
  const enCurso = orden.estado === 'en_curso'
  const editable = puedeGestionar && enCurso

  // Reabrir pide el motivo y queda en el historial con quién y cuándo.
  const [reabriendo, setReabriendo] = useState(false)
  const [motivoReapertura, setMotivoReapertura] = useState('')
  const [releyendo, setReleyendo] = useState(false)
  const [historial, setHistorial] = useState<AuditoriaOrdenCompra[]>([])

  useEffect(() => {
    let vigente = true
    fetchAuditoriaOrden(orden.id)
      .then((filas) => {
        if (vigente) setHistorial(filas)
      })
      .catch((error) => console.error('Failed to load OC history:', error))
    return () => {
      vigente = false
    }
  }, [orden.id, orden.updated_at])

  async function releerDocumento() {
    setReleyendo(true)
    try {
      const res = await releerLineasDocumento(orden.id)
      if (!res.ok) {
        toast.error(res.error)
      } else if (res.agregadas === 0) {
        toast.success(`El documento tiene ${res.total} líneas y la orden ya las tiene todas.`)
      } else {
        toast.success(`Se agregaron ${res.agregadas} líneas que faltaban (el documento tiene ${res.total}).`)
        onRecargar()
      }
    } finally {
      setReleyendo(false)
    }
  }

  // Fecha de entrega esperada y nota de entregas: se editan aquí mismo.
  const [fecha, setFecha] = useState(orden.fecha_vencimiento ?? '')
  const [guardandoFecha, setGuardandoFecha] = useState(false)
  const [cierre, setCierre] = useState(orden.fecha_cierre ?? '')
  const [guardandoCierre, setGuardandoCierre] = useState(false)
  const [editandoTexto, setEditandoTexto] = useState(false)
  const [texto, setTexto] = useState(orden.observaciones_entrega ?? '')

  async function guardarFecha() {
    setGuardandoFecha(true)
    try {
      const res = await actualizarFechaVencimientoOrden(orden.id, fecha || null)
      if (res.ok) {
        toast.success(fecha ? 'Fecha de entrega guardada.' : 'Fecha de entrega quitada.')
        onRecargar()
      } else {
        toast.error(res.error)
      }
    } finally {
      setGuardandoFecha(false)
    }
  }

  async function guardarCierre() {
    setGuardandoCierre(true)
    try {
      const res = await actualizarFechaCierreOrden(orden.id, cierre || null)
      if (res.ok) {
        toast.success(cierre ? 'Fecha de cierre guardada.' : 'Fecha de cierre quitada.')
        onRecargar()
      } else {
        toast.error(res.error)
      }
    } finally {
      setGuardandoCierre(false)
    }
  }

  async function guardarTexto() {
    const res = await actualizarObservacionesEntrega(orden.id, texto)
    if (res.ok) {
      toast.success('Nota guardada.')
      setEditandoTexto(false)
      onRecargar()
    } else {
      toast.error(res.error)
    }
  }

  const faltantes = orden.items.reduce((acc, i) => acc + resumenRecepcion(i).restante, 0)
  const todoRecibido = orden.items.length > 0 && orden.items.every((i) => resumenRecepcion(i).completa)
  const proveedor = orden.items[0]?.proveedor_nombre ?? orden.proveedor_nombre
  const nit = orden.items[0]?.proveedor_nit ?? orden.proveedor_nit

  return (
    <div className="space-y-4 py-1" onClick={(e) => e.stopPropagation()}>
      <PasosOrden orden={orden} />

      {editable && todoRecibido && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <PackageCheck aria-hidden className="h-4 w-4 text-primary" />
            Llegó todo lo pedido. ¿Cerramos la orden?
          </span>
          <Button type="button" size="sm" onClick={onFinalizar}>
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Finalizar orden
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Productos y recepción */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Productos y recepción</h3>
          <RecepcionLineas orden={orden} onActualizado={onRecargar} puedeAsignarCodigo={puedeGestionar} />
        </section>

        {/* Datos de la orden */}
        <section className="space-y-3 text-sm">
          <h3 className="text-sm font-semibold">Datos de la orden</h3>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Proveedor</dt>
            <dd>
              {proveedor ?? '—'}
              {nit && <span className="ml-1 font-mono text-xs text-muted-foreground">NIT {nit}</span>}
            </dd>
            {orden.numero_oc && (
              <>
                <dt className="text-muted-foreground">N.º en Siigo</dt>
                <dd className="font-mono text-xs">{orden.numero_oc}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Pedido</dt>
            <dd>{formatearFecha(orden.fecha_pedido)}</dd>
            {orden.medio_pago && (
              <>
                <dt className="text-muted-foreground">Pago</dt>
                <dd>{ETIQUETA_MEDIO_PAGO[orden.medio_pago]}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Siigo</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <SiigoStatusBadge estado={siigo.estado} />
              {siigo.referencia && <span className="text-xs text-muted-foreground">Ref. {siigo.referencia}</span>}
            </dd>
          </dl>

          {/* Fecha de entrega esperada */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`fecha-${orden.id}`}>
              Entrega esperada
            </label>
            {editable ? (
              <div className="flex gap-1">
                <Input
                  id={`fecha-${orden.id}`}
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="h-8 max-w-[11rem]"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={guardandoFecha || fecha === (orden.fecha_vencimiento ?? '')}
                  onClick={guardarFecha}
                >
                  {guardandoFecha ? '…' : 'Guardar'}
                </Button>
              </div>
            ) : (
              <p>{formatearFecha(orden.fecha_vencimiento)}</p>
            )}
          </div>

          {/* Fecha de cierre: se escribe o se elige; compras y supervisor pueden cambiarla siempre */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`cierre-${orden.id}`}>
              Fecha de cierre
            </label>
            {puedeGestionar ? (
              <div className="flex gap-1">
                <Input
                  id={`cierre-${orden.id}`}
                  type="date"
                  value={cierre}
                  onChange={(e) => setCierre(e.target.value)}
                  className="h-8 max-w-[11rem]"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={guardandoCierre || cierre === (orden.fecha_cierre ?? '')}
                  onClick={guardarCierre}
                >
                  {guardandoCierre ? '…' : 'Guardar'}
                </Button>
              </div>
            ) : (
              <p>{formatearFecha(orden.fecha_cierre)}</p>
            )}
          </div>

          {/* Documento y firma (órdenes cargadas desde Siigo) */}
          {orden.documento_path && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Documento</p>
              <DocumentoOc orden={orden} puedeFirmar={puedeFirmar} onActualizado={onRecargar} />
            </div>
          )}
        </section>
      </div>

      {/* Seguimiento de entregas y notas */}
      <div className="grid gap-3 md:grid-cols-2">
        <section className="space-y-1">
          <h3 className="text-sm font-semibold">Seguimiento de entregas</h3>
          {editandoTexto ? (
            <div className="space-y-1">
              <Textarea
                rows={2}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Ej. Llegaron 100 tornillos de 1000"
                className="text-sm"
              />
              <div className="flex gap-1">
                <Button type="button" size="sm" onClick={guardarTexto}>Guardar</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditandoTexto(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={!puedeGestionar}
              onClick={() => {
                setTexto(orden.observaciones_entrega ?? '')
                setEditandoTexto(true)
              }}
              className="w-full rounded-md border border-dashed px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground"
            >
              {orden.observaciones_entrega?.trim() || (puedeGestionar ? 'Click para anotar entregas…' : 'Sin notas de entrega.')}
            </button>
          )}
        </section>

        {orden.observaciones?.trim() && (
          <section className="space-y-1">
            <h3 className="text-sm font-semibold">Observaciones de la orden</h3>
            <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">{orden.observaciones.trim()}</p>
          </section>
        )}
      </div>

      {puedeGestionar && reabriendo && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm">
          <p className="font-medium">¿Por qué se reabre la orden?</p>
          <p className="text-xs text-muted-foreground">
            Queda registrado con tu nombre y la hora. Si ya se envió la factura de compra a Siigo, no se anula sola.
          </p>
          <Input
            value={motivoReapertura}
            onChange={(e) => setMotivoReapertura(e.target.value)}
            placeholder="Ej.: se cerró por equivocación"
            aria-label="Motivo de la reapertura"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!motivoReapertura.trim()}
              onClick={() => {
                onReabrir(motivoReapertura.trim())
                setReabriendo(false)
                setMotivoReapertura('')
              }}
            >
              Reabrir orden
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReabriendo(false)}>
              No reabrir
            </Button>
          </div>
        </div>
      )}

      {puedeGestionar && orden.estado === 'listo' && (
        <p className="text-xs text-muted-foreground">
          Esta orden está cerrada: puedes modificarla y cada cambio queda registrado con tu nombre y la hora.
        </p>
      )}

      {historial.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <History aria-hidden className="h-4 w-4" />
            Historial de cambios
          </h3>
          <ul className="space-y-1.5 text-sm">
            {historial.map((h) => (
              <li key={h.id} className="rounded-md bg-muted/40 px-3 py-2">
                <span className="font-medium">{ETIQUETA_ACCION_AUDITORIA[h.accion]}</span> por{' '}
                <span className="font-medium">{h.usuario_nombre}</span> ·{' '}
                {new Date(h.created_at).toLocaleString('es-CO', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'America/Bogota',
                })}
                {h.motivo && <span className="block text-muted-foreground">Motivo: {h.motivo}</span>}
                {h.cambios.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                    {h.cambios.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Acciones */}
      {puedeGestionar && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {enCurso && (
            <Button type="button" size="sm" onClick={onFinalizar}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Finalizar orden
              {faltantes > 0 && <span className="ml-1 text-xs opacity-80">(faltan {faltantes.toLocaleString('es-CO')})</span>}
            </Button>
          )}
          {(enCurso || orden.estado === 'listo') && (
            <Button type="button" size="sm" variant="outline" onClick={onEditar}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {enCurso ? 'Editar / agregar productos' : 'Editar orden cerrada'}
            </Button>
          )}
          {!enCurso && !reabriendo && (
            <Button type="button" size="sm" variant="outline" onClick={() => setReabriendo(true)}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reabrir
            </Button>
          )}
          {orden.origen === 'documento_siigo' && orden.documento_path && (
            <Button type="button" size="sm" variant="ghost" disabled={releyendo} onClick={releerDocumento}>
              <FileSearch className="mr-1 h-3.5 w-3.5" />
              {releyendo ? 'Leyendo…' : 'Releer documento'}
            </Button>
          )}
          {!orden.documento_path && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={onPdf}>
                <FileText className="mr-1 h-3.5 w-3.5 text-red-600" />
                PDF
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onCsv}>
                <Download className="mr-1 h-3.5 w-3.5" />
                CSV
              </Button>
            </>
          )}
          {siigo.estado === 'pendiente' && orden.estado === 'listo' && (
            <Button type="button" size="sm" variant="outline" disabled={enviandoSiigo} onClick={() => onEnviarSiigo(false)}>
              <Send className="mr-1 h-3.5 w-3.5" />
              {enviandoSiigo ? 'Enviando…' : 'Enviar a Siigo'}
            </Button>
          )}
          {siigo.estado === 'error' && (
            <Button type="button" size="sm" variant="outline" disabled={enviandoSiigo} onClick={() => onEnviarSiigo(true)}>
              <Send className="mr-1 h-3.5 w-3.5" />
              {enviandoSiigo ? 'Enviando…' : 'Reintentar envío'}
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {enCurso && (
              <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Cancelar orden
              </Button>
            )}
            {enCurso && (
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onEliminar}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Eliminar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
