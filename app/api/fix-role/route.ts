import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/fix-role?email=tu@email.com
// Temporal: actualiza el rol del usuario a admin
export async function GET(req: Request) {
  const url = new URL(req.url)
  const email = url.searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Falta ?email=' }, { status: 400 })
  }

  // Buscar usuario por email
  const { data: user, error } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'Usuario no encontrado', detail: error }, { status: 404 })
  }

  // Actualizar a admin
  const { error: updateError } = await supabaseAdmin
    .from('usuarios')
    .update({ role: 'admin', is_active: true })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'Error al actualizar', detail: updateError }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Usuario actualizado a admin',
    userId: user.id,
    email: user.email,
    previousRole: user.role,
    newRole: 'admin',
  })
}
