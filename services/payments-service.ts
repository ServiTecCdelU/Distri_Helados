import {
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Transaction } from '@/lib/types'
import { generateReadableId } from '@/services/firestore-helpers'

const CLIENTS_COLLECTION = 'clientes'
const TRANSACTIONS_COLLECTION = 'transacciones'

export const registerCashPayment = async (data: {
  clientId: string
  amount: number
  description?: string
}): Promise<Transaction> => {
  await updateDoc(doc(firestore, CLIENTS_COLLECTION, data.clientId), {
    currentBalance: increment(-data.amount),
  })

  const clientSnap = await getDoc(doc(firestore, CLIENTS_COLLECTION, data.clientId))
  const clientName = clientSnap.exists() ? (clientSnap.data().name || 'pago') : 'pago'

  const docId = await generateReadableId(firestore, TRANSACTIONS_COLLECTION, 'transaccion', clientName)
  await setDoc(doc(firestore, TRANSACTIONS_COLLECTION, docId), {
    clientId: data.clientId,
    type: 'payment',
    amount: data.amount,
    description: data.description || 'Pago en efectivo',
    date: serverTimestamp(),
  })

  return {
    id: docId,
    clientId: data.clientId,
    type: 'payment',
    amount: data.amount,
    description: data.description || 'Pago en efectivo',
    date: new Date(),
  }
}
