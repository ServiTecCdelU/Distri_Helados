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
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Client, Transaction } from '@/lib/types'
import { toDate, generateReadableId } from '@/services/firestore-helpers'

const CLIENTS_COLLECTION = 'clientes'
const TRANSACTIONS_COLLECTION = 'transacciones'

export const getClients = async (): Promise<Client[]> => {
  const snapshot = await getDocs(collection(firestore, CLIENTS_COLLECTION))
  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        name: data.name,
        dni: data.dni ?? '',
        cuit: data.cuit,
        email: data.email,
        phone: data.phone,
        address: data.address,
        addresses: Array.isArray(data.addresses)
          ? data.addresses.filter((a: any) => a && typeof a.address === 'string')
          : undefined,
        taxCategory: data.taxCategory ?? 'consumidor_final',
        creditLimit: data.creditLimit,
        currentBalance: data.currentBalance ?? 0,
        notes: data.notes ?? '', // ← AGREGADO
        createdAt: toDate(data.createdAt),
      }
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export const getClientById = async (id: string): Promise<Client | undefined> => {
  const snapshot = await getDoc(doc(firestore, CLIENTS_COLLECTION, id))
  if (!snapshot.exists()) return undefined
  const data = snapshot.data()
  return {
    id: snapshot.id,
    name: data.name,
    dni: data.dni ?? '',
    cuit: data.cuit,
    email: data.email,
    phone: data.phone,
    address: data.address,
    taxCategory: data.taxCategory ?? 'consumidor_final',
    creditLimit: data.creditLimit,
    currentBalance: data.currentBalance ?? 0,
    notes: data.notes ?? '', // ← AGREGADO
    createdAt: toDate(data.createdAt),
  }
}

export const createClient = async (
  client: Omit<Client, 'id' | 'createdAt' | 'currentBalance'>
): Promise<Client> => {
  const docId = await generateReadableId(firestore, CLIENTS_COLLECTION, 'cliente', client.name)
  await setDoc(doc(firestore, CLIENTS_COLLECTION, docId), {
    ...client,
    currentBalance: 0,
    taxCategory: client.taxCategory ?? 'consumidor_final',
    notes: client.notes ?? '',
    createdAt: serverTimestamp(),
  })
  return {
    ...client,
    taxCategory: client.taxCategory ?? 'consumidor_final',
    currentBalance: 0,
    notes: client.notes ?? '',
    id: docId,
    createdAt: new Date(),
  }
}

export const updateClient = async (id: string, updates: Partial<Client>): Promise<Client> => {
  await updateDoc(doc(firestore, CLIENTS_COLLECTION, id), {
    ...updates,
  })
  const updated = await getClientById(id)
  if (!updated) throw new Error('Client not found')
  return updated
}

export const deleteClient = async (id: string): Promise<void> => {
  await deleteDoc(doc(firestore, CLIENTS_COLLECTION, id))
}

export const getClientsPaginated = async (
  pageSize: number = 50,
  lastDoc?: QueryDocumentSnapshot,
): Promise<{ data: Client[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> => {
  let q = query(
    collection(firestore, CLIENTS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  )

  if (lastDoc) {
    q = query(
      collection(firestore, CLIENTS_COLLECTION),
      orderBy('createdAt', 'desc'),
      startAfter(lastDoc),
      limit(pageSize),
    )
  }

  const snapshot = await getDocs(q)
  const data = snapshot.docs.map((docSnap) => {
    const d = docSnap.data()
    return {
      id: docSnap.id,
      name: d.name,
      dni: d.dni ?? '',
      cuit: d.cuit,
      email: d.email,
      phone: d.phone,
      address: d.address,
      addresses: Array.isArray(d.addresses)
        ? d.addresses.filter((a: any) => a && typeof a.address === 'string')
        : undefined,
      taxCategory: d.taxCategory ?? 'consumidor_final',
      creditLimit: d.creditLimit,
      currentBalance: d.currentBalance ?? 0,
      notes: d.notes ?? '',
      createdAt: toDate(d.createdAt),
    } as Client
  })
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null

  return {
    data,
    lastDoc: lastVisible,
    hasMore: snapshot.docs.length === pageSize,
  }
}

export const getClientTransactions = async (clientId: string): Promise<Transaction[]> => {
  const snapshot = await getDocs(
    query(
      collection(firestore, TRANSACTIONS_COLLECTION),
      where('clientId', '==', clientId),
      orderBy('date', 'desc')
    )
  )
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      clientId: data.clientId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      date: toDate(data.date),
      saleId: data.saleId,
    }
  })
}