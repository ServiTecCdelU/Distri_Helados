'use client'

import { useEffect, useState, useRef } from 'react'
import type { User } from '@/lib/types'
import { onAuthChange, signOut } from '@/services/auth-service'
import { ensureUserProfile } from '@/services/users-service'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const processingRef = useRef(false)
  const lastUidRef = useRef<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (supabaseUser) => {
      if (!supabaseUser) {
        lastUidRef.current = null
        setUser(null)
        setLoading(false)
        return
      }

      // Evitar reprocesar el mismo usuario
      if (supabaseUser.id === lastUidRef.current) return
      if (processingRef.current) return
      processingRef.current = true

      try {
        const profile = await ensureUserProfile({
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Usuario',
        })

        if (!profile.isActive) {
          lastUidRef.current = null
          await signOut()
          setUser(null)
          setLoading(false)
          return
        }

        lastUidRef.current = supabaseUser.id
        setUser(profile)
      } catch (err) {
        console.error('Error loading profile:', err)
        setUser(null)
      } finally {
        setLoading(false)
        processingRef.current = false
      }
    })

    return () => unsubscribe()
  }, [])

  return { user, loading }
}
