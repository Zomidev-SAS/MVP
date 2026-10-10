import { notFound } from 'next/navigation'
import { verificarTokenPlanta, fetchDatosPlanta } from '@/lib/supabase/planta-actions'
import { PlantaKioskView } from '@/components/planta/PlantaKioskView'

export default async function PlantaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const valido = await verificarTokenPlanta(token)
  if (!valido) notFound()

  const { vehiculosPorEtapa, entradasSalidas, productosStockBajo } = await fetchDatosPlanta(token)

  return (
    <PlantaKioskView
      vehiculosPorEtapa={vehiculosPorEtapa}
      entradasSalidas={entradasSalidas}
      productosStockBajo={productosStockBajo}
    />
  )
}
