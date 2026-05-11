import { NextResponse } from 'next/server'
import { registerCashPayment } from '@/services/payments-service'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clientId, amount, description } = body
    if (!clientId || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }
    const tx = await registerCashPayment({ clientId, amount, description })
    return NextResponse.json(tx)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
