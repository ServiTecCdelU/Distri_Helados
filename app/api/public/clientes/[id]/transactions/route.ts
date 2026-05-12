import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id
    const { data, error } = await supabaseAdmin
      .from('transacciones')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const result = (data || []).map(r => ({
      id: r.id,
      clientId: r.client_id,
      type: r.type,
      amount: r.amount,
      description: r.description,
      date: r.created_at,
      saleId: r.sale_id || null,
    }))
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
