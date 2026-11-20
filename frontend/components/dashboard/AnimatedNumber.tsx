'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCOP, formatNumber } from '@/lib/format'

const DURATION_MS = 500

const FORMATTERS = {
  number: formatNumber,
  currency: formatCOP,
} as const

function useCountUp(target: number) {
  const [display, setDisplay] = useState(target)
  const previousRef = useRef(target)
  const mountedRef = useRef(false)

  useEffect(() => {
    const from = previousRef.current
    const to = target
    previousRef.current = to

    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }

    if (from === to) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(to)
      return
    }

    let frame: number
    let start: number | null = null

    function tick(now: number) {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / DURATION_MS)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])

  return display
}

export function AnimatedNumber({
  value,
  format = 'number',
}: {
  value: number
  format?: keyof typeof FORMATTERS
}) {
  const display = useCountUp(value)
  const formatear = FORMATTERS[format]

  return <span className="tabular-nums">{formatear(display)}</span>
}
