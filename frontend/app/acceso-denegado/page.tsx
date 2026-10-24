import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function AccesoDenegadoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center text-foreground">
      <h1 className="text-3xl font-bold">Acceso denegado</h1>
      <p className="text-muted-foreground">
        Tu rol no tiene permiso para ver esta sección.
      </p>
      <Link href="/" className={buttonVariants()}>
        Volver al Dashboard
      </Link>
    </div>
  )
}
