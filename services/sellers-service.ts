// services/sellers-service-supabase.ts
import { supabase } from '@/lib/supabase'
import type { Seller, SellerCommission } from '@/lib/types'
import { generateReadableId } from '@/services/supabase-helpers'

function mapSeller(r: any): Seller {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    employeeType: r.employee_type ?? 'vendedor',
    commissionRate: r.commission_rate,
    transportistaCommissionRate: r.transportista_commission_rate,
    isActive: r.is_active ?? true,
    totalSales: r.total_sales ?? 0,
    totalCommission: r.total_commission ?? 0,
    createdAt: new Date(r.created_at),
  }
}

function mapCommission(r: any): SellerCommission {
  return {
    id: r.id,
    sellerId: r.seller_id,
    saleId: r.sale_id,
    saleNumber: r.sale_number,
    clientName: r.client_name || undefined,
    saleTotal: r.sale_total,
    commissionRate: r.commission_rate,
    commissionAmount: r.commission_amount,
    isPaid: r.is_paid ?? false,
    paidAt: r.paid_at ? new Date(r.paid_at) : undefined,
    createdAt: new Date(r.created_at),
  }
}

export const getSellers = async (): Promise<Seller[]> => {
  const { data, error } = await supabase
    .from('vendedores')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapSeller)
}

export const getSellerById = async (id: string): Promise<Seller | undefined> => {
  const { data, error } = await supabase
    .from('vendedores')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return undefined
  return mapSeller(data)
}

export const createSeller = async (
  seller: Omit<Seller, 'id' | 'createdAt' | 'totalSales' | 'totalCommission'>
): Promise<Seller> => {
  const id = await generateReadableId('vendedores', 'vendedor', seller.name)
  const { error } = await supabase.from('vendedores').insert({
    id,
    name: seller.name,
    email: seller.email,
    phone: seller.phone,
    employee_type: seller.employeeType,
    commission_rate: seller.commissionRate,
    transportista_commission_rate: seller.transportistaCommissionRate ?? null,
    is_active: seller.isActive,
    total_sales: 0,
    total_commission: 0,
  })
  if (error) throw error
  return { ...seller, id, totalSales: 0, totalCommission: 0, createdAt: new Date() }
}

export const updateSeller = async (id: string, updates: Partial<Seller>): Promise<Seller> => {
  const row: any = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.email !== undefined) row.email = updates.email
  if (updates.phone !== undefined) row.phone = updates.phone
  if (updates.employeeType !== undefined) row.employee_type = updates.employeeType
  if (updates.commissionRate !== undefined) row.commission_rate = updates.commissionRate
  if (updates.transportistaCommissionRate !== undefined) row.transportista_commission_rate = updates.transportistaCommissionRate
  if (updates.isActive !== undefined) row.is_active = updates.isActive

  const { error } = await supabase.from('vendedores').update(row).eq('id', id)
  if (error) throw error

  // Sincronizar employeeType al usuario vinculado
  if (updates.employeeType) {
    await supabase
      .from('usuarios')
      .update({ employee_type: updates.employeeType })
      .eq('seller_id', id)
  }

  const updated = await getSellerById(id)
  if (!updated) throw new Error('Seller not found')
  return updated
}

export const deleteSeller = async (id: string): Promise<void> => {
  const { error } = await supabase.from('vendedores').delete().eq('id', id)
  if (error) throw error
}

export const getSellerCommissions = async (sellerId: string): Promise<SellerCommission[]> => {
  const { data, error } = await supabase
    .from('comisiones')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapCommission)
}

export const getAllCommissions = async (): Promise<SellerCommission[]> => {
  const { data, error } = await supabase
    .from('comisiones')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapCommission)
}

export const payCommission = async (commissionId: string): Promise<SellerCommission> => {
  const { error } = await supabase
    .from('comisiones')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', commissionId)
  if (error) throw error

  const { data } = await supabase.from('comisiones').select('*').eq('id', commissionId).single()
  if (!data) throw new Error('Commission not found')
  return mapCommission(data)
}

export const payAllCommissions = async (sellerId: string): Promise<void> => {
  const { error } = await supabase
    .from('comisiones')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('seller_id', sellerId)
    .eq('is_paid', false)
  if (error) throw error
}

export const resetCommissions = async (sellerId: string): Promise<void> => {
  // Marcar todas como pagadas
  await supabase
    .from('comisiones')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('seller_id', sellerId)
    .eq('is_paid', false)

  // Eliminar todas las comisiones del empleado
  const { error: delError } = await supabase
    .from('comisiones')
    .delete()
    .eq('seller_id', sellerId)
  if (delError) throw delError

  // Resetear contadores del vendedor
  const { error } = await supabase
    .from('vendedores')
    .update({ total_sales: 0, total_commission: 0 })
    .eq('id', sellerId)
  if (error) throw error
}
