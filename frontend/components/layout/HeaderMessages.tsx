'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { marcarMensajeLeido, crearMensajePanel } from '@/lib/supabase/notificaciones-actions'
import type { MensajePanel } from '@/lib/types/notificaciones'

export function HeaderMessages({
  initial,
  esSupervisor,
}: {
  initial: MensajePanel[]
  esSupervisor: boolean
}) {
  const [mensajes, setMensajes] = useState(initial)
  const [mensajeAbierto, setMensajeAbierto] = useState<number | null>(null)
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevoCuerpo, setNuevoCuerpo] = useState('')
  const [publicando, setPublicando] = useState(false)

  const sinLeer = mensajes.filter((m) => !m.leido).length

  async function abrirMensaje(m: MensajePanel) {
    setMensajeAbierto(m.id === mensajeAbierto ? null : m.id)
    if (!m.leido) {
      const res = await marcarMensajeLeido(m.id)
      if (res.ok) {
        setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, leido: true } : x)))
      }
    }
  }

  async function publicarMensaje() {
    setPublicando(true)
    const res = await crearMensajePanel({
      titulo: nuevoTitulo,
      cuerpo: nuevoCuerpo,
      nivel: 'aviso',
    })
    setPublicando(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Mensaje publicado.')
    setNuevoTitulo('')
    setNuevoCuerpo('')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative text-muted-foreground hover:text-foreground"
        aria-label="Mensajes del panel"
      >
        <MessageSquare className="h-5 w-5" />
        {sinLeer > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <p className="border-b px-3 py-2 text-sm font-medium">Mensajes</p>
        <div className="max-h-[24rem] overflow-y-auto p-2">
          {mensajes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin mensajes.</p>
          ) : (
            <ul className="space-y-2">
              {mensajes.map((m) => (
                <li key={m.id} className="rounded-md border">
                  <button
                    type="button"
                    onClick={() => abrirMensaje(m)}
                    className="flex w-full items-start justify-between gap-2 p-2 text-left hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className={`text-sm ${m.leido ? 'font-normal' : 'font-semibold'}`}>
                        {m.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString('es-CO')}
                        {m.rol_destino ? ` · ${m.rol_destino}` : ' · Todos'}
                      </p>
                    </div>
                    {mensajeAbierto === m.id ? (
                      <ChevronUp className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                  {mensajeAbierto === m.id && (
                    <p className="border-t px-2 pb-2 pt-1 text-sm text-muted-foreground">{m.cuerpo}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {esSupervisor && (
            <>
              <DropdownMenuSeparator className="my-2" />
              <p className="mb-2 text-xs font-medium text-muted-foreground">Publicar aviso</p>
              <div className="space-y-2">
                <Input
                  placeholder="Título"
                  value={nuevoTitulo}
                  onChange={(e) => setNuevoTitulo(e.target.value)}
                />
                <Textarea
                  placeholder="Mensaje para todos los usuarios..."
                  value={nuevoCuerpo}
                  onChange={(e) => setNuevoCuerpo(e.target.value)}
                  rows={2}
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={publicando || !nuevoTitulo.trim() || !nuevoCuerpo.trim()}
                  onClick={publicarMensaje}
                >
                  {publicando ? 'Publicando...' : 'Enviar mensaje'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
