import { NextResponse } from 'next/server'
import { adminFirestore } from '@/lib/firebase-admin'
import { toDate } from '@/services/firestore-helpers'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id
    const snap = await adminFirestore.collection('transacciones').where('clientId', '==', clientId).orderBy('date', 'desc').get()
    const data = snap.docs.map(d => {
      const dt = d.data()
      return {
        id: d.id,
        clientId: dt.clientId,
        type: dt.type,
        amount: dt.amount,
        description: dt.description,
        date: toDate(dt.date),
        saleId: dt.saleId || null,
      }
    })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
