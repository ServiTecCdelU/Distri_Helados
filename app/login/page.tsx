'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IceCream, Loader2 } from 'lucide-react'
import { signInWithGoogle } from '@/services/auth-service'
import { useAuth } from '@/hooks/use-auth'
import type { User } from '@/lib/types'

function getHomeRoute(user: User): string {
  if (user.role === 'customer') return '/tienda'
  if (user.role === 'seller') {
    if (user.employeeType === 'transportista') return '/pedidos'
    return '/ventas/nueva'
  }
  return '/caja'
}

export default function LoginPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && user) {
      router.push(getHomeRoute(user))
    }
  }, [authLoading, user, router])

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)

    try {
      await signInWithGoogle()
    } catch {
      setError('No se pudo iniciar sesión con Google')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary">
              <IceCream className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Helados Mio</CardTitle>
          <CardDescription>Ingrese sus credenciales para acceder al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={loading || authLoading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar sesión con Google
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
