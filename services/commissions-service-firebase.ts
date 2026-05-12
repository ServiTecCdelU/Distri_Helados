import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { SellerCommission } from '@/lib/types'
import { toDate } from '@/services/firestore-helpers'

const COMMISSIONS_COLLECTION = 'comisiones'

export const getCommissionsBySeller = async (sellerId: string): Promise<SellerCommission[]> => {
  const snapshot = await getDocs(
    query(
      collection(firestore, COMMISSIONS_COLLECTION),
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc')
    )
  )
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      sellerId: data.sellerId,
      saleId: data.saleId,
      saleNumber: data.saleNumber,
      clientName: data.clientName || undefined,
      saleTotal: data.saleTotal,
      commissionRate: data.commissionRate,
      commissionAmount: data.commissionAmount,
      isPaid: data.isPaid ?? false,
      paidAt: data.paidAt ? toDate(data.paidAt) : undefined,
      createdAt: toDate(data.createdAt),
    }
  })
}

export const getCommissionSummaryBySeller = async (sellerId: string) => {
  const commissions = await getCommissionsBySeller(sellerId)
  const total = commissions.reduce((acc, commission) => acc + commission.commissionAmount, 0)
  const pending = commissions.filter((commission) => !commission.isPaid)
  const pendingTotal = pending.reduce((acc, commission) => acc + commission.commissionAmount, 0)
  return {
    total,
    pendingTotal,
    count: commissions.length,
    pendingCount: pending.length,
  }
}
