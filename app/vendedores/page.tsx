'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function VendedoresRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/empleados')
  }, [router])
  return null
}
