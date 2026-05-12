// services/auth-service-supabase.ts — Reemplazo de auth-service.ts para Supabase
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password })

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: { prompt: 'select_account' },
    },
  })

export const signOut = () => supabase.auth.signOut()

export const onAuthChange = (callback: (user: SupabaseUser | null) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return () => subscription.unsubscribe()
}

export const getAuthToken = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  } catch {
    return null
  }
}
