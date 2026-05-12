// hooks/use-auth-supabase.ts — Reemplazo de use-auth.ts para Supabase
'use client'

import { useEffect, useState } from 'react'
import type { User } from '@/lib/types'
import { onAuthChange, signOut } from '@/services/auth-service-supabase'
import { ensureUserProfile } from '@/services/users-service-supabase'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (supabaseUser) => {
      if (!supabaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      const profile = await ensureUserProfile({
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Usuario',
      })

      if (!profile.isActive) {
        await signOut()
        setUser(null)
        setLoading(false)
        return
      }

      setUser(profile)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { user, loading }
}
