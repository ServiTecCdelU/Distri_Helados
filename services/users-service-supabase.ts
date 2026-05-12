// services/users-service-supabase.ts — Reemplazo de users-service.ts para Supabase
import { supabase } from '@/lib/supabase'
import type { User, UserRole, EmployeeType } from '@/lib/types'

function mapRow(row: any): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    sellerId: row.seller_id ?? undefined,
    employeeType: row.employee_type as EmployeeType | undefined,
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at),
  }
}

export const getUserProfile = async (authUid: string): Promise<User | null> => {
  // Buscar por auth_uid
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_uid', authUid)
    .single()

  if (error || !data) {
    // Fallback: buscar por doc ID directo (usuarios legacy)
    const { data: legacy } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', authUid)
      .single()

    if (!legacy) return null
    return mapRow(legacy)
  }

  return mapRow(data)
}

export const ensureUserProfile = async (data: {
  id: string // auth UID de Supabase
  email: string
  name: string
  role?: UserRole
}): Promise<User> => {
  // Chequear si el email coincide con un vendedor registrado
  const { data: sellerMatch } = await supabase
    .from('vendedores')
    .select('id, employee_type')
    .eq('email', data.email)
    .single()

  const matchingSeller = sellerMatch?.id ?? null
  const matchingEmployeeType = sellerMatch?.employee_type as EmployeeType | undefined

  const existing = await getUserProfile(data.id)

  if (existing) {
    // Si existe perfil pero no es seller/admin y hay vendedor vinculado, actualizar
    if (matchingSeller && existing.role !== 'seller' && existing.role !== 'admin') {
      await supabase
        .from('usuarios')
        .update({
          role: 'seller',
          seller_id: matchingSeller,
          employee_type: matchingEmployeeType ?? null,
        })
        .eq('id', existing.id)

      return {
        ...existing,
        role: 'seller',
        sellerId: matchingSeller,
        employeeType: matchingEmployeeType,
      }
    }

    // Si ya es seller pero cambió el sellerId, sincronizar
    if (matchingSeller && existing.role === 'seller' && existing.sellerId !== matchingSeller) {
      await supabase
        .from('usuarios')
        .update({
          seller_id: matchingSeller,
          employee_type: matchingEmployeeType ?? existing.employeeType ?? null,
        })
        .eq('id', existing.id)

      return {
        ...existing,
        sellerId: matchingSeller,
        employeeType: matchingEmployeeType ?? existing.employeeType,
      }
    }

    // Vincular auth_uid si no lo tiene (usuario migrado de Firebase)
    if (!existing.id.startsWith('usuario_') || data.id !== existing.id) {
      await supabase
        .from('usuarios')
        .update({ auth_uid: data.id })
        .eq('id', existing.id)
    }

    return existing
  }

  // Crear nuevo perfil — generar readable ID via RPC
  const { data: newId } = await supabase.rpc('generate_readable_id', {
    p_table: 'usuarios',
    p_prefix: 'usuario',
    p_identifier: data.name,
  })
  const docId = newId || `usuario_${Date.now()}`

  const autoRole: UserRole = matchingSeller ? 'seller' : (data.role ?? 'customer')

  const profile: User = {
    id: docId,
    email: data.email,
    name: data.name,
    role: autoRole,
    sellerId: matchingSeller ?? undefined,
    employeeType: matchingEmployeeType,
    isActive: true,
    createdAt: new Date(),
  }

  await supabase.from('usuarios').insert({
    id: docId,
    auth_uid: data.id,
    email: profile.email,
    name: profile.name,
    role: autoRole,
    seller_id: matchingSeller,
    employee_type: matchingEmployeeType ?? null,
    is_active: true,
  })

  return profile
}
