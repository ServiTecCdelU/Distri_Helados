//services\sellers-service.ts
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Seller, SellerCommission } from '@/lib/types'
import { toDate, generateReadableId } from '@/services/firestore-helpers'

const SELLERS_COLLECTION = 'vendedores'
const COMMISSIONS_COLLECTION = 'comisiones'

export const getSellers = async (): Promise<Seller[]> => {
  const snapshot = await getDocs(collection(firestore, SELLERS_COLLECTION))
  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data()
        return {
          id: docSnap.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          employeeType: data.employeeType ?? 'vendedor',
          commissionRate: data.commissionRate,
          // transportistaCommissionRate is optional in some documents, map it when present
          transportistaCommissionRate: data.transportistaCommissionRate,
          isActive: data.isActive ?? true,
          totalSales: data.totalSales ?? 0,
          totalCommission: data.totalCommission ?? 0,
          createdAt: toDate(data.createdAt),
        }
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export const getSellerById = async (id: string): Promise<Seller | undefined> => {
  const snapshot = await getDoc(doc(firestore, SELLERS_COLLECTION, id))
  if (!snapshot.exists()) return undefined
  const data = snapshot.data()
  return {
    id: snapshot.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    employeeType: data.employeeType ?? 'vendedor',
    commissionRate: data.commissionRate,
    // map transportistaCommissionRate when present in the document
    transportistaCommissionRate: data.transportistaCommissionRate,
    isActive: data.isActive ?? true,
    totalSales: data.totalSales ?? 0,
    totalCommission: data.totalCommission ?? 0,
    createdAt: toDate(data.createdAt),
  }
}

export const createSeller = async (
  seller: Omit<Seller, 'id' | 'createdAt' | 'totalSales' | 'totalCommission'>
): Promise<Seller> => {
  const docId = await generateReadableId(firestore, SELLERS_COLLECTION, 'vendedor', seller.name)
  const payload: Record<string, any> = { totalSales: 0, totalCommission: 0, createdAt: serverTimestamp() }
  for (const [k, v] of Object.entries(seller)) { if (v !== undefined) payload[k] = v }
  await setDoc(doc(firestore, SELLERS_COLLECTION, docId), payload)
  return {
    ...seller,
    id: docId,
    totalSales: 0,
    totalCommission: 0,
    createdAt: new Date(),
  }
}

export const updateSeller = async (id: string, updates: Partial<Seller>): Promise<Seller> => {
  const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
  await updateDoc(doc(firestore, SELLERS_COLLECTION, id), cleanUpdates)
  const updated = await getSellerById(id)
  if (!updated) throw new Error('Seller not found')

  // Si cambio el employeeType, actualizar tambien el usuario vinculado
  if (updates.employeeType) {
    const usersSnapshot = await getDocs(
      query(collection(firestore, 'usuarios'), where('sellerId', '==', id))
    )
    const userUpdates = usersSnapshot.docs.map((userDoc) =>
      updateDoc(doc(firestore, 'usuarios', userDoc.id), { employeeType: updates.employeeType })
    )
    await Promise.all(userUpdates)
  }

  return updated
}

export const deleteSeller = async (id: string): Promise<void> => {
  await deleteDoc(doc(firestore, SELLERS_COLLECTION, id))
}

export const getSellerCommissions = async (sellerId: string): Promise<SellerCommission[]> => {
  const snapshot = await getDocs(
    query(
      collection(firestore, COMMISSIONS_COLLECTION),
      where('sellerId', '==', sellerId)
    )
  )
  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        sellerId: data.sellerId,
        saleId: data.saleId,
        saleTotal: data.saleTotal,
        commissionRate: data.commissionRate,
        commissionAmount: data.commissionAmount,
        isPaid: data.isPaid ?? false,
        paidAt: data.paidAt ? toDate(data.paidAt) : undefined,
        createdAt: toDate(data.createdAt),
      }
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export const getAllCommissions = async (): Promise<SellerCommission[]> => {
  const snapshot = await getDocs(collection(firestore, COMMISSIONS_COLLECTION))
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      sellerId: data.sellerId,
      saleId: data.saleId,
      saleTotal: data.saleTotal,
      commissionRate: data.commissionRate,
      commissionAmount: data.commissionAmount,
      isPaid: data.isPaid ?? false,
      paidAt: data.paidAt ? toDate(data.paidAt) : undefined,
      createdAt: toDate(data.createdAt),
    }
  })
}

export const payCommission = async (commissionId: string): Promise<SellerCommission> => {
  await updateDoc(doc(firestore, COMMISSIONS_COLLECTION, commissionId), {
    isPaid: true,
    paidAt: serverTimestamp(),
  })
  const updated = await getDoc(doc(firestore, COMMISSIONS_COLLECTION, commissionId))
  if (!updated.exists()) throw new Error('Commission not found')
  const data = updated.data()
  return {
    id: updated.id,
    sellerId: data.sellerId,
    saleId: data.saleId,
    saleTotal: data.saleTotal,
    commissionRate: data.commissionRate,
    commissionAmount: data.commissionAmount,
    isPaid: data.isPaid ?? true,
    paidAt: data.paidAt ? toDate(data.paidAt) : undefined,
    createdAt: toDate(data.createdAt),
  }
}

export const payAllCommissions = async (sellerId: string): Promise<void> => {
  const snapshot = await getDocs(
    query(
      collection(firestore, COMMISSIONS_COLLECTION),
      where('sellerId', '==', sellerId),
      where('isPaid', '==', false)
    )
  )
  const updates = snapshot.docs.map((docSnap) =>
    updateDoc(doc(firestore, COMMISSIONS_COLLECTION, docSnap.id), {
      isPaid: true,
      paidAt: serverTimestamp(),
    })
  )
  await Promise.all(updates)
}
