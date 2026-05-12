// services/payments-service-supabase.ts
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import { generateReadableId } from '@/services/supabase-helpers'

export const registerCashPayment = async (data: {
  clientId: string
  amount: number
  description?: string
}): Promise<Transaction> => {
  // Ajustar saldo atómicamente
  await supabase.rpc('adjust_client_balance', {
    p_client_id: data.clientId,
    p_amount: -data.amount,
  })

  // Obtener nombre del cliente para el ID legible
  const { data: client } = await supabase
    .from('clientes')
    .select('name')
    .eq('id', data.clientId)
    .single()
  const clientName = client?.name || 'pago'

  const id = await generateReadableId('transacciones', 'transaccion', clientName)
  const { error } = await supabase.from('transacciones').insert({
    id,
    client_id: data.clientId,
    type: 'payment',
    amount: data.amount,
    description: data.description || 'Pago en efectivo',
    date: new Date().toISOString(),
  })
  if (error) throw error

  return {
    id,
    clientId: data.clientId,
    type: 'payment',
    amount: data.amount,
    description: data.description || 'Pago en efectivo',
    date: new Date(),
  }
}
