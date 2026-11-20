export function AvisoMigracion({ migracion }: { migracion: string }) {
  return (
    <div
      role="status"
      className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
    >
      Falta aplicar la migración <code className="rounded bg-black/10 px-1">{migracion}</code> en
      Supabase para que esta sección guarde y muestre datos reales.
    </div>
  )
}
