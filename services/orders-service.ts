// services/orders-service-supabase.ts
import { supabase } from '@/lib/supabase'
import type { Order, OrderStatus, CartItem, City } from '@/lib/types'
import { generateReadableId } from '@/services/supabase-helpers'

function mapOrder(r: any): Order {
  const items = r.pedido_items
    ? r.pedido_items.map((i: any) => ({
        productId: i.product_id,
        quantity: i.quantity,
        name: i.name,
        price: i.price,
        ...(i.item_discount ? { itemDiscount: i.item_discount } : {}),
      }))
    : r.items || []

  return {
    id: r.id,
    saleId: r.sale_id ?? undefined,
    clientId: r.client_id ?? undefined,
    clientName: r.client_name ?? undefined,
    clientPhone: r.client_phone ?? undefined,
    clientEmail: r.client_email ?? undefined,
    sellerId: r.seller_id ?? undefined,
    sellerName: r.seller_name ?? undefined,
    transportistaId: r.transportista_id ?? undefined,
    transportistaName: r.transportista_name ?? undefined,
    items,
    status: r.status ?? 'pending',
    city: r.city ?? undefined,
    address: r.address ?? 'Retiro en local',
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    deliveryMethod: r.delivery_method ?? undefined,
    remitoNumber: r.remito_number ?? undefined,
    remitoPdfBase64: r.remito_pdf_base64 ?? undefined,
    invoiceNumber: r.invoice_number ?? undefined,
    invoicePdfBase64: r.invoice_pdf_base64 ?? undefined,
    checkedItems: r.checked_items ?? [],
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at ?? r.created_at),
  }
}

const SELECT_WITH_ITEMS = '*, pedido_items(*)'

export const getOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_WITH_ITEMS)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data || []).map(mapOrder)
}

export const getOrdersByTransportista = async (transportistaId: string): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_WITH_ITEMS)
    .eq('transportista_id', transportistaId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data || []).map(mapOrder)
}

async function getOrderById(id: string): Promise<Order> {
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_WITH_ITEMS)
    .eq('id', id)
    .single()
  if (error || !data) throw new Error('Order not found')
  return mapOrder(data)
}

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<Order> => {
  const { error } = await supabase.from('pedidos').update({ status }).eq('id', id)
  if (error) throw error
  return getOrderById(id)
}

export const completeOrder = async (id: string, saleId: string): Promise<Order> => {
  const { error } = await supabase.from('pedidos').update({
    status: 'completed',
    sale_id: saleId,
  }).eq('id', id)
  if (error) throw error
  return getOrderById(id)
}

export const assignTransportista = async (id: string, transportistaId: string, transportistaName: string): Promise<Order> => {
  const { error } = await supabase.from('pedidos').update({
    transportista_id: transportistaId,
    transportista_name: transportistaName,
    status: 'delivery',
  }).eq('id', id)
  if (error) throw error
  return getOrderById(id)
}

export const removeTransportista = async (id: string): Promise<Order> => {
  const { error } = await supabase.from('pedidos').update({
    transportista_id: null,
    transportista_name: null,
  }).eq('id', id)
  if (error) throw error
  return getOrderById(id)
}

export const saveRemitoToOrder = async (id: string, remitoNumber: string, remitoPdfBase64: string): Promise<Order> => {
  const { error } = await supabase.from('pedidos').update({
    remito_number: remitoNumber,
    remito_pdf_base64: remitoPdfBase64,
  }).eq('id', id)
  if (error) throw error
  return getOrderById(id)
}

export const saveBoletaToOrder = async (
  id: string,
  invoiceNumber: string,
  invoicePdfBase64: string,
  extra?: { invoiceEmitted?: boolean; afipData?: any; invoiceStatus?: string },
): Promise<Order> => {
  const updates: any = {
    invoice_number: invoiceNumber,
    invoice_pdf_base64: invoicePdfBase64,
  }
  // pedidos no tiene invoice_emitted/afipData/invoiceStatus columns directamente,
  // pero si se pasan, no rompen nada
  const { error } = await supabase.from('pedidos').update(updates).eq('id', id)
  if (error) throw error
  return getOrderById(id)
}

export const updateCheckedItems = async (id: string, checkedItems: string[]): Promise<void> => {
  const { error } = await supabase.from('pedidos').update({
    checked_items: checkedItems,
  }).eq('id', id)
  if (error) throw error
}

export const createOrder = async (data: {
  clientId?: string
  clientName: string
  clientPhone?: string
  clientEmail?: string
  sellerId?: string
  sellerName?: string
  items: CartItem[]
  city?: City
  address: string
  lat?: number
  lng?: number
  status: OrderStatus
  source?: string
  discount?: number
  discountType?: 'percent' | 'fixed'
}): Promise<Order> => {
  const id = await generateReadableId('pedidos', 'pedido', data.clientName)

  const { error } = await supabase.from('pedidos').insert({
    id,
    client_id: data.clientId ?? null,
    client_name: data.clientName,
    client_phone: data.clientPhone ?? null,
    client_email: data.clientEmail ?? null,
    seller_id: data.sellerId ?? null,
    seller_name: data.sellerName ?? null,
    city: data.city ?? null,
    address: data.address,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    status: data.status ?? 'pending',
    source: data.source ?? 'direct',
    discount: data.discount ?? null,
    discount_type: data.discountType ?? null,
    sale_id: null,
  })
  if (error) throw error

  // Insertar items normalizados
  const itemRows = data.items.map(item => ({
    order_id: id,
    product_id: item.product.id,
    name: item.product.name,
    quantity: item.quantity,
    price: item.product.price,
    item_discount: item.itemDiscount ?? null,
  }))
  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from('pedido_items').insert(itemRows)
    if (itemsError) throw itemsError
  }

  // Guardar dirección en la libreta del cliente
  if (data.clientId && data.address && data.city) {
    try {
      const { data: dirs } = await supabase
        .from('cliente_direcciones')
        .select('*')
        .eq('client_id', data.clientId)

      const normalized = data.address.trim().toLowerCase()
      const alreadySaved = (dirs || []).some(
        a => a.address.trim().toLowerCase() === normalized && a.city === data.city
      )
      if (!alreadySaved) {
        await supabase.from('cliente_direcciones').insert({
          client_id: data.clientId,
          city: data.city,
          address: data.address.trim(),
          lat: data.lat ?? null,
          lng: data.lng ?? null,
        })
      }
    } catch {
      // no bloquear la creación del pedido
    }
  }

  return getOrderById(id)
}

export const getOrdersPaginated = async (
  pageSize: number = 50,
  page: number = 0,
): Promise<{ data: Order[]; page: number; hasMore: boolean }> => {
  const from = page * pageSize
  const to = from + pageSize - 1
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_WITH_ITEMS)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  const rows = (data || []).map(mapOrder)
  return { data: rows, page, hasMore: rows.length === pageSize }
}
