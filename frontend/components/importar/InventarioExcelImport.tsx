'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { publicarInventarioSaldos } from '@/lib/supabase/inventario-saldos-actions'

export function InventarioExcelImport() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)

  function seleccionarArchivo(file: File) {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Usa un archivo Excel (.xlsx)')
      return
    }
    setArchivo(file)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) seleccionarArchivo(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setArrastrando(false)
    const file = event.dataTransfer.files?.[0]
    if (file) seleccionarArchivo(file)
  }

  async function handlePublicar() {
    if (!archivo) return

    setEnviando(true)
    const formData = new FormData()
    formData.append('archivo', archivo)

    const resultado = await publicarInventarioSaldos(formData)
    setEnviando(false)

    if (resultado.ok) {
      toast.success(`${resultado.total} productos publicados. Todo el equipo ya puede verlos en Inventario.`)
      setArchivo(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-semibold">Publicar saldos de inventario</h2>
        <p className="text-sm text-muted-foreground">
          Sube el Excel &quot;Saldos de inventario.xlsx&quot;. Se guarda en Supabase y lo ve cualquier
          usuario del panel.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors',
          arrastrando ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
        )}
      >
        <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          {archivo ? archivo.name : 'Arrastra el Excel o haz clic para seleccionar'}
        </p>
        <p className="text-xs text-muted-foreground">Formato .xlsx · reemplaza el inventario publicado</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <Button type="button" onClick={handlePublicar} disabled={!archivo || enviando}>
        {enviando ? 'Publicando...' : 'Publicar inventario para el equipo'}
      </Button>
    </div>
  )
}
