import { notFound } from 'next/navigation'
import { fetchDatosPlantaCompras, verificarTokenPlanta } from '@/lib/supabase/planta-actions'
import { PlantaComprasView } from '@/components/planta/PlantaComprasView'

export default async function PlantaComprasPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const valido = await verificarTokenPlanta(token, 'planta-compras')
  if (!valido) notFound()

  const datos = await fetchDatosPlantaCompras(token)
  return <PlantaComprasView datos={datos} />
}
