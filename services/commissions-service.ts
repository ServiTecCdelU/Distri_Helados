// services/commissions-service-supabase.ts
import { supabase } from '@/lib/supabase'
import type { SellerCommission } from '@/lib/types'

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

export const getCommissionsBySeller = async (sellerId: string): Promise<SellerCommission[]> => {
  const { data, error } = await supabase
    .from('comisiones')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapCommission)
}

export const getCommissionSummaryBySeller = async (sellerId: string) => {
  const commissions = await getCommissionsBySeller(sellerId)
  const total = commissions.reduce((acc, c) => acc + c.commissionAmount, 0)
  const pending = commissions.filter(c => !c.isPaid)
  const pendingTotal = pending.reduce((acc, c) => acc + c.commissionAmount, 0)
  return { total, pendingTotal, count: commissions.length, pendingCount: pending.length }
}
