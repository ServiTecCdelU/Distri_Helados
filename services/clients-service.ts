// services/clients-service-supabase.ts
import { supabase } from '@/lib/supabase'
import type { Client, Transaction } from '@/lib/types'
import { generateReadableId } from '@/services/supabase-helpers'

function mapRow(r: any): Client {
  return {
    id: r.id,
    name: r.name,
    dni: r.dni ?? '',
    cuit: r.cuit,
    email: r.email,
    phone: r.phone,
    address: r.address,
    addresses: r.cliente_direcciones
      ? r.cliente_direcciones
          .filter((a: any) => a && typeof a.address === 'string')
          .map((a: any) => ({ city: a.city, address: a.address, lat: a.lat, lng: a.lng }))
      : undefined,
    taxCategory: r.tax_category ?? 'consumidor_final',
    creditLimit: r.credit_limit,
    currentBalance: r.current_balance ?? 0,
    notes: r.notes ?? '',
    createdAt: new Date(r.created_at),
  }
}

function mapRowSimple(r: any): Client {
  return {
    id: r.id,
    name: r.name,
    dni: r.dni ?? '',
    cuit: r.cuit,
    email: r.email,
    phone: r.phone,
    address: r.address,
    taxCategory: r.tax_category ?? 'consumidor_final',
    creditLimit: r.credit_limit,
    currentBalance: r.current_balance ?? 0,
    notes: r.notes ?? '',
    createdAt: new Date(r.created_at),
  }
}

export const getClients = async (): Promise<Client[]> => {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, name, dni, cuit, email, phone, address, tax_category, credit_limit, current_balance, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  return (data || []).map(mapRowSimple)
}

export const getClientById = async (id: string): Promise<Client | undefined> => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*, cliente_direcciones(*)')
    .eq('id', id)
    .single()
  if (error || !data) return undefined
  return mapRow(data)
}

export const createClient = async (
  client: Omit<Client, 'id' | 'createdAt' | 'currentBalance'>
): Promise<Client> => {
  const id = await generateReadableId('clientes', 'cliente', client.name)
  const { error } = await supabase.from('clientes').insert({
    id,
    name: client.name,
    dni: client.dni || null,
    cuit: client.cuit,
    email: client.email,
    phone: client.phone,
    address: client.address,
    tax_category: client.taxCategory ?? 'consumidor_final',
    credit_limit: client.creditLimit,
    current_balance: 0,
    notes: client.notes ?? '',
  })
  if (error) throw error

  // Insertar direcciones si existen
  if (client.addresses && client.addresses.length > 0) {
    const dirs = client.addresses.map(a => ({
      client_id: id,
      city: a.city,
      address: a.address,
      lat: a.lat || null,
      lng: a.lng || null,
    }))
    await supabase.from('cliente_direcciones').insert(dirs)
  }

  return {
    ...client,
    taxCategory: client.taxCategory ?? 'consumidor_final',
    currentBalance: 0,
    notes: client.notes ?? '',
    id,
    createdAt: new Date(),
  }
}

export const updateClient = async (id: string, updates: Partial<Client>): Promise<Client> => {
  const row: any = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.dni !== undefined) row.dni = updates.dni
  if (updates.cuit !== undefined) row.cuit = updates.cuit
  if (updates.email !== undefined) row.email = updates.email
  if (updates.phone !== undefined) row.phone = updates.phone
  if (updates.address !== undefined) row.address = updates.address
  if (updates.taxCategory !== undefined) row.tax_category = updates.taxCategory
  if (updates.creditLimit !== undefined) row.credit_limit = updates.creditLimit
  if (updates.currentBalance !== undefined) row.current_balance = updates.currentBalance
  if (updates.notes !== undefined) row.notes = updates.notes

  const { error } = await supabase.from('clientes').update(row).eq('id', id)
  if (error) throw error

  // Actualizar direcciones si se pasan
  if (updates.addresses) {
    await supabase.from('cliente_direcciones').delete().eq('client_id', id)
    if (updates.addresses.length > 0) {
      const dirs = updates.addresses.map(a => ({
        client_id: id,
        city: a.city,
        address: a.address,
        lat: a.lat || null,
        lng: a.lng || null,
      }))
      await supabase.from('cliente_direcciones').insert(dirs)
    }
  }

  const updated = await getClientById(id)
  if (!updated) throw new Error('Client not found')
  return updated
}

export const deleteClient = async (id: string): Promise<void> => {
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) throw error
}

export interface ClientFilters {
  search?: string
  taxCategory?: string
  hasDebt?: 'all' | 'with' | 'without'
}

export const getClientsPaginated = async (
  pageSize: number = 10,
  page: number = 0,
  filters: ClientFilters = {},
): Promise<{ data: Client[]; count: number; page: number; pageSize: number; hasMore: boolean }> => {
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('clientes')
    .select('*, cliente_direcciones(*)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,dni.ilike.%${filters.search}%,cuit.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
  }
  if (filters.taxCategory && filters.taxCategory !== 'all') {
    query = query.eq('tax_category', filters.taxCategory)
  }
  if (filters.hasDebt === 'with') {
    query = query.gt('current_balance', 0)
  } else if (filters.hasDebt === 'without') {
    query = query.lte('current_balance', 0)
  }

  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error
  const rows = (data || []).map(mapRow)
  return { data: rows, count: count ?? 0, page, pageSize, hasMore: rows.length === pageSize }
}

export const getClientTransactions = async (clientId: string): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transacciones')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data || []).map(r => ({
    id: r.id,
    clientId: r.client_id,
    type: r.type,
    amount: r.amount,
    description: r.description,
    date: new Date(r.date),
    saleId: r.sale_id,
  }))
}

export interface TransactionWithSale extends Transaction {
  saleNumber?: string
  remitoNumber?: string
  saleTotal?: number
  saleItems?: { name: string; quantity: number; price: number }[]
  saleDate?: Date
  sellerName?: string
}

export const getClientTransactionsWithSales = async (clientId: string): Promise<TransactionWithSale[]> => {
  const { data, error } = await supabase
    .from('transacciones')
    .select('*, ventas(id, sale_number, remito_number, total, seller_name, created_at, venta_items(name, quantity, price))')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data || []).map((r: any) => ({
    id: r.id,
    clientId: r.client_id,
    type: r.type,
    amount: r.amount,
    description: r.description,
    date: new Date(r.date),
    saleId: r.sale_id,
    saleNumber: r.ventas?.sale_number,
    remitoNumber: r.ventas?.remito_number,
    saleTotal: r.ventas?.total,
    saleItems: r.ventas?.venta_items?.map((i: any) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    })),
    saleDate: r.ventas?.created_at ? new Date(r.ventas.created_at) : undefined,
    sellerName: r.ventas?.seller_name,
  }))
}
