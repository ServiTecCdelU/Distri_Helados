'use client'

import { useEffect, useState } from 'react'
import type { User } from '@/lib/types'
import { onAuthChange, signOut } from '@/services/auth-service'
import { ensureUserProfile } from '@/services/users-service'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      const profile = await ensureUserProfile({
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
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
