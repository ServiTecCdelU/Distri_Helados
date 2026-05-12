'use client'

import { useEffect, useState, useRef } from 'react'
import type { User } from '@/lib/types'
import { onAuthChange, signOut } from '@/services/auth-service'
import { ensureUserProfile } from '@/services/users-service'

// ── Store global: una sola suscripción, todos los hooks leen de acá ──

let globalUser: User | null = null
let globalLoading = true
let listeners: Array<() => void> = []
let subscribed = false

function notify() {
  listeners.forEach((fn) => fn())
}

function subscribe() {
  if (subscribed) return
  subscribed = true

  let processing = false
  let lastUid: string | null = null

  onAuthChange(async (supabaseUser) => {
    if (!supabaseUser) {
      lastUid = null
      globalUser = null
      globalLoading = false
      notify()
      return
    }

    if (supabaseUser.id === lastUid) {
      // Ya procesado, solo asegurar que loading sea false
      if (globalLoading) {
        globalLoading = false
        notify()
      }
      return
    }
    if (processing) return
    processing = true

    try {
      const profile = await ensureUserProfile({
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Usuario',
      })

      if (!profile.isActive) {
        lastUid = null
        globalUser = null
        globalLoading = false
        notify()
        await signOut()
        return
      }

      lastUid = supabaseUser.id
      globalUser = profile
    } catch (err) {
      console.error('Error loading profile:', err)
      globalUser = null
    } finally {
      globalLoading = false
      processing = false
      notify()
    }
  })
}

export const useAuth = () => {
  const [, forceUpdate] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    subscribe()

    const listener = () => {
      if (mountedRef.current) forceUpdate((n) => n + 1)
    }
    listeners.push(listener)

    return () => {
      mountedRef.current = false
      listeners = listeners.filter((fn) => fn !== listener)
    }
  }, [])

  return { user: globalUser, loading: globalLoading }
}
