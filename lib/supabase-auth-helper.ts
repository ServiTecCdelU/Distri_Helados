// lib/supabase-auth-helper.ts — Verificación de auth en API routes
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Verifica el token Bearer de la request.
 * Reemplaza: adminAuth.verifyIdToken(token)
 *
 * Uso en API routes:
 *   const user = await verifyAuthToken(request)
 *   if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
 */
export async function verifyAuthToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !user) return null
  return user
}
