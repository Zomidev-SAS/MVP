'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { crearNota, eliminarNota, fetchNotas } from '@/lib/supabase/notas-actions'
import type { NotaPersonal } from '@/lib/types/notas'

export function NotesPanel() {
  const [notas, setNotas] = useState<NotaPersonal[]>([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    fetchNotas()
      .then(setNotas)
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setGuardando(true)
    const res = await crearNota(texto.trim())
    setGuardando(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setTexto('')
    toast.success('Nota guardada.')
    setNotas(await fetchNotas())
  }

  async function handleBorrar(id: number) {
    const res = await eliminarNota(id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setNotas((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Mis notas</h3>
      <form onSubmit={handleSubmit} className="mb-3 space-y-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Apunte rápido..."
          rows={2}
          className="text-sm"
        />
        <Button type="submit" size="sm" disabled={guardando || !texto.trim()}>
          <Plus className="mr-1 h-3 w-3" />
          Agregar nota
        </Button>
      </form>
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : notas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin notas personales.</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {notas.map((nota) => (
            <li
              key={nota.id}
              className="flex items-start justify-between gap-2 rounded-md border p-2"
            >
              <div className="min-w-0">
                <p className="text-sm">{nota.contenido}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(nota.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleBorrar(nota.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Borrar nota"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
