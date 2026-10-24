'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'

interface CampoSugerenciasProps<T> {
  value: string
  onChange: (valor: string) => void
  onBlur?: () => void
  buscar: (texto: string) => Promise<T[]>
  onSeleccionar: (item: T) => void
  renderItem: (item: T) => ReactNode
  claveItem: (item: T) => string
  /** Mínimo de caracteres antes de buscar. */
  minimo?: number
  placeholder?: string
  inputMode?: 'text' | 'numeric'
}

/**
 * Input con lista de sugerencias para autorrellenar mientras se escribe.
 * La búsqueda corre mientras la persona teclea (con una pequeña espera) y
 * descarta respuestas viejas si llegó una más reciente.
 */
export function CampoSugerencias<T>({
  value,
  onChange,
  onBlur,
  buscar,
  onSeleccionar,
  renderItem,
  claveItem,
  minimo = 2,
  placeholder,
  inputMode,
}: CampoSugerenciasProps<T>) {
  const [items, setItems] = useState<T[]>([])
  const [abierto, setAbierto] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimaBusqueda = useRef(0)

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  function manejarCambio(texto: string) {
    onChange(texto)
    if (temporizador.current) clearTimeout(temporizador.current)

    if (texto.trim().length < minimo) {
      ultimaBusqueda.current += 1
      setItems([])
      setAbierto(false)
      return
    }

    temporizador.current = setTimeout(async () => {
      const id = ++ultimaBusqueda.current
      try {
        const resultado = await buscar(texto.trim())
        if (id !== ultimaBusqueda.current) return
        setItems(resultado)
        setAbierto(resultado.length > 0)
      } catch {
        if (id === ultimaBusqueda.current) {
          setItems([])
          setAbierto(false)
        }
      }
    }, 250)
  }

  function seleccionar(item: T) {
    ultimaBusqueda.current += 1
    setItems([])
    setAbierto(false)
    onSeleccionar(item)
  }

  return (
    <div className="relative">
      <Input
        value={value}
        autoComplete="off"
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => manejarCambio(e.target.value)}
        onFocus={() => {
          if (items.length > 0) setAbierto(true)
        }}
        onBlur={() => {
          setAbierto(false)
          onBlur?.()
        }}
      />
      {abierto && items.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {items.map((item) => (
            <li key={claveItem(item)} role="option" aria-selected={false}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted"
                // mouseDown evita que el input pierda el foco antes de seleccionar.
                onMouseDown={(e) => {
                  e.preventDefault()
                  seleccionar(item)
                }}
              >
                {renderItem(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
