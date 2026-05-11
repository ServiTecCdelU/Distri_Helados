'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const MIN_DURATION_MS = 350

export function RouteLoader() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const startRef = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const now = Date.now()
    startRef.current = now
    setVisible(true)

    timeoutRef.current = setTimeout(() => {
      setVisible(false)
    }, MIN_DURATION_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-foreground">Cargando...</span>
      </div>
    </div>
  )
}
