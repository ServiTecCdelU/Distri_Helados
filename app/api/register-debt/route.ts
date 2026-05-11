import { NextResponse } from 'next/server'
import { firestore } from '@/lib/firebase'
import { generateReadableId } from '@/services/firestore-helpers'
import { serverTimestamp, setDoc, doc, updateDoc, getDoc } from 'firebase/firestore'

const CLIENTS_COLLECTION = 'clientes'
const TRANSACTIONS_COLLECTION = 'transacciones'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clientId, amount, description } = body
    if (!clientId || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    // incrementar deuda en cliente
    const clientRef = doc(firestore, CLIENTS_COLLECTION, clientId)
    await updateDoc(clientRef, { currentBalance: (await (await getDoc(clientRef)).data())?.currentBalance + amount })

    // crear transacción
    const name = ((await getDoc(clientRef)).data()?.name) || 'deuda'
    const txId = await generateReadableId(firestore, TRANSACTIONS_COLLECTION, 'transaccion', name)
    await setDoc(doc(firestore, TRANSACTIONS_COLLECTION, txId), {
      clientId,
      type: 'debt',
      amount,
      description: description || 'Ajuste de deuda',
      date: serverTimestamp(),
    })

    return NextResponse.json({ id: txId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
