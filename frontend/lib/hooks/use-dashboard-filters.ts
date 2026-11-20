'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { DashboardFiltros, RangoFecha } from '@/lib/types/dashboard-graficas'

const RANGOS_VALIDOS: RangoFecha[] = ['hoy', '7d', '30d', '90d', 'personalizado']

export function useDashboardFilters(): {
  filtros: DashboardFiltros
  setRango: (r: RangoFecha, personalizado?: { desde: string; hasta: string }) => void
  setBodega: (id: string | null) => void
  setCategoria: (id: string | null) => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filtros = useMemo<DashboardFiltros>(() => {
    const rangoParam = searchParams.get('rango')
    const rango: RangoFecha = RANGOS_VALIDOS.includes(rangoParam as RangoFecha)
      ? (rangoParam as RangoFecha)
      : '7d'
    return {
      rango,
      desde: searchParams.get('desde') ?? undefined,
      hasta: searchParams.get('hasta') ?? undefined,
      bodegaId: searchParams.get('bodega') ?? undefined,
      categoriaId: searchParams.get('categoria') ?? undefined,
    }
  }, [searchParams])

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const setRango = useCallback(
    (r: RangoFecha, personalizado?: { desde: string; hasta: string }) => {
      pushParams({
        rango: r,
        desde: r === 'personalizado' ? personalizado?.desde ?? null : null,
        hasta: r === 'personalizado' ? personalizado?.hasta ?? null : null,
      })
    },
    [pushParams]
  )

  const setBodega = useCallback((id: string | null) => pushParams({ bodega: id }), [pushParams])
  const setCategoria = useCallback((id: string | null) => pushParams({ categoria: id }), [pushParams])

  return { filtros, setRango, setBodega, setCategoria }
}
