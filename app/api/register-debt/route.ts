import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateReadableId } from '@/services/supabase-helpers'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clientId, amount, description } = body
    if (!clientId || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    // Ajustar saldo con RPC atómico
    await supabaseAdmin.rpc('adjust_client_balance', {
      p_client_id: clientId,
      p_amount: amount,
    })

    // Obtener nombre del cliente para el ID legible
    const { data: client } = await supabaseAdmin
      .from('clientes')
      .select('name')
      .eq('id', clientId)
      .single()
    const name = client?.name || 'deuda'

    const txId = await generateReadableId('transacciones', 'transaccion', name)
    await supabaseAdmin.from('transacciones').insert({
      id: txId,
      client_id: clientId,
      type: 'debt',
      amount,
      description: description || 'Ajuste de deuda',
    })

    return NextResponse.json({ id: txId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
