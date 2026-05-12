// services/sales-service-supabase.ts
import { supabase } from '@/lib/supabase'
import type { CartItem, Sale } from '@/lib/types'
import { generateReadableId } from '@/services/supabase-helpers'

const COMMISSION_RATE = 0.1

function mapSale(r: any): Sale {
  // Reconstruir items desde venta_items si están disponibles
  const items = r.venta_items
    ? r.venta_items.map((i: any) => ({
        productId: i.product_id,
        quantity: i.quantity,
        price: i.price,
        name: i.name,
        ...(i.item_discount ? { itemDiscount: i.item_discount } : {}),
      }))
    : r.items || []

  return {
    id: r.id,
    saleNumber: r.sale_number,
    clientId: r.client_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    clientCuit: r.client_cuit,
    clientDni: r.client_dni,
    clientEmail: r.client_email,
    clientAddress: r.client_address,
    clientTaxCategory: r.client_tax_category,
    sellerId: r.seller_id,
    sellerName: r.seller_name,
    source: r.source,
    items,
    total: r.total,
    paymentType: r.payment_type,
    paymentMethod: r.payment_method,
    cashAmount: r.cash_amount,
    creditAmount: r.credit_amount,
    status: r.status,
    invoiceNumber: r.invoice_number,
    remitoNumber: r.remito_number,
    invoiceEmitted: r.invoice_emitted,
    invoiceStatus: r.invoice_status,
    invoicePdfUrl: r.invoice_pdf_url,
    invoiceWhatsappUrl: r.invoice_whatsapp_url,
    remitoPdfUrl: r.remito_pdf_url,
    discount: r.discount,
    discountType: r.discount_type,
    orderId: r.order_id,
    deliveryMethod: r.delivery_method,
    deliveryAddress: r.delivery_address,
    createdAt: new Date(r.created_at),
    invoiceDriveUrl: r.invoice_drive_url,
    invoiceDriveFileId: r.invoice_drive_file_id,
    remitoDriveUrl: r.remito_drive_url,
    remitoDriveFileId: r.remito_drive_file_id,
  }
}

export const getSales = async (): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('ventas')
    .select('*, venta_items(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapSale)
}

export const getSalesBySeller = async (sellerId: string): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('ventas')
    .select('*, venta_items(*)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapSale)
}

export const getSalesByClient = async (clientId: string): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('ventas')
    .select('*, venta_items(*)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapSale)
}

export const getSaleById = async (id: string): Promise<Sale | null> => {
  const { data, error } = await supabase
    .from('ventas')
    .select('*, venta_items(*)')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return mapSale(data)
}

export const generateSaleNumber = (date: Date, index: number) => {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `N°${index + 1}-${day}-${month}-${year}`
}

export const processSale = async (data: {
  clientId?: string
  clientName?: string
  clientPhone?: string
  sellerId?: string
  sellerName?: string
  items: CartItem[]
  paymentType: 'cash' | 'credit' | 'mixed'
  paymentMethod?: 'efectivo' | 'transferencia'
  cashAmount?: number
  creditAmount?: number
  overpayment?: number
  discount?: number
  discountType?: 'percent' | 'fixed'
  source: 'direct' | 'order'
  createOrder: boolean
  orderId?: string
  deliveryMethod: 'pickup' | 'delivery'
  deliveryAddress: string
}): Promise<Sale> => {
  const subtotal = data.items.reduce((acc, item) => {
    const base = item.product.price * item.quantity
    const disc = item.itemDiscount ? (base * item.itemDiscount) / 100 : 0
    return acc + base - disc
  }, 0)
  const discountAmount =
    data.discount && data.discount > 0
      ? data.discountType === 'percent'
        ? (subtotal * data.discount) / 100
        : data.discount
      : 0
  const total = Math.max(0, subtotal - discountAmount)

  // Contar ventas para generar saleNumber
  const { count } = await supabase.from('ventas').select('id', { count: 'exact', head: true })
  const saleNumber = generateSaleNumber(new Date(), count || 0)

  // Resolver datos del cliente
  let clientName = data.clientName ?? 'Venta directa'
  let clientTaxCategory: any = null
  let clientPhone = data.clientPhone ?? null
  let clientCuit: string | null = null
  let clientAddress: string | null = null
  let clientEmail: string | null = null
  let clientDni: string | null = null
  let deliveryAddr = data.deliveryAddress

  if (data.clientId) {
    const { data: client } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', data.clientId)
      .single()
    if (client) {
      clientName = client.name ?? clientName
      clientTaxCategory = client.tax_category ?? null
      clientPhone = client.phone ?? clientPhone
      clientCuit = client.cuit ?? null
      clientAddress = client.address ?? null
      clientEmail = client.email ?? null
      clientDni = client.dni ?? null
      if (data.deliveryMethod === 'delivery' && !data.deliveryAddress) {
        deliveryAddr = client.address ?? data.deliveryAddress
      }
    }
  }

  const saleId = await generateReadableId('ventas', 'venta', clientName)

  // Insertar venta
  const { error: saleError } = await supabase.from('ventas').insert({
    id: saleId,
    sale_number: saleNumber,
    client_id: data.clientId ?? null,
    client_name: clientName,
    client_phone: clientPhone,
    client_cuit: clientCuit,
    client_dni: clientDni,
    client_email: clientEmail,
    client_address: clientAddress,
    client_tax_category: clientTaxCategory,
    seller_id: data.sellerId ?? null,
    seller_name: data.sellerName ?? null,
    source: data.source ?? 'direct',
    total,
    payment_type: data.paymentType,
    payment_method: data.paymentMethod ?? 'efectivo',
    cash_amount: data.cashAmount ?? null,
    credit_amount: data.creditAmount ?? null,
    overpayment: data.overpayment ?? null,
    discount: data.discount || null,
    discount_type: data.discount ? (data.discountType ?? null) : null,
    order_id: data.orderId ?? null,
    status: 'completed',
    invoice_emitted: false,
    invoice_status: 'pending',
    delivery_method: data.deliveryMethod ?? 'pickup',
    delivery_address: deliveryAddr ?? null,
  })
  if (saleError) throw saleError

  // Insertar items normalizados
  const itemRows = data.items.map(item => ({
    sale_id: saleId,
    product_id: item.product.id,
    name: item.product.name,
    quantity: item.quantity,
    price: item.product.price,
    item_discount: item.itemDiscount ?? null,
  }))
  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from('venta_items').insert(itemRows)
    if (itemsError) throw itemsError
  }

  // Actualizar stock
  for (const item of data.items) {
    const { data: prod } = await supabase
      .from('productos')
      .select('stock')
      .eq('id', item.product.id)
      .single()
    if (prod) {
      await supabase
        .from('productos')
        .update({ stock: prod.stock - item.quantity })
        .eq('id', item.product.id)
    }
  }

  // Procesar crédito
  const amountToCredit =
    data.paymentType === 'credit' ? total : data.paymentType === 'mixed' ? (data.creditAmount ?? 0) : 0

  if (amountToCredit > 0 && data.clientId) {
    await supabase.rpc('adjust_client_balance', {
      p_client_id: data.clientId,
      p_amount: amountToCredit,
    })

    const txId = await generateReadableId('transacciones', 'transaccion', clientName)
    await supabase.from('transacciones').insert({
      id: txId,
      client_id: data.clientId,
      type: 'debt',
      amount: amountToCredit,
      description: `Venta #${saleNumber}`,
      date: new Date().toISOString(),
      sale_id: saleId,
      sale_number: saleNumber,
    })
  }

  // Saldo a favor
  const overpaymentAmount = data.overpayment ?? 0
  if (overpaymentAmount > 0 && data.clientId) {
    await supabase.rpc('adjust_client_balance', {
      p_client_id: data.clientId,
      p_amount: -overpaymentAmount,
    })

    const txId = await generateReadableId('transacciones', 'transaccion', clientName)
    await supabase.from('transacciones').insert({
      id: txId,
      client_id: data.clientId,
      type: 'payment',
      amount: overpaymentAmount,
      description: `Saldo a favor (Venta #${saleNumber})`,
      date: new Date().toISOString(),
      sale_id: saleId,
      sale_number: saleNumber,
    })
  }

  // Comisión para vendedor
  if (data.sellerId) {
    const commissionAmount = total * COMMISSION_RATE
    const now = new Date()
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const commissionId = await generateReadableId(
      'comisiones', 'comision', `${data.sellerName || 'vendedor'}_${yyyymm}`
    )
    await supabase.from('comisiones').insert({
      id: commissionId,
      seller_id: data.sellerId,
      sale_id: saleId,
      sale_number: saleNumber,
      client_name: clientName || null,
      sale_total: total,
      commission_rate: COMMISSION_RATE * 100,
      commission_amount: commissionAmount,
      is_paid: false,
    })

    // Actualizar totales del vendedor
    const { data: seller } = await supabase
      .from('vendedores')
      .select('total_sales, total_commission')
      .eq('id', data.sellerId)
      .single()
    if (seller) {
      await supabase
        .from('vendedores')
        .update({
          total_sales: (seller.total_sales || 0) + total,
          total_commission: (seller.total_commission || 0) + commissionAmount,
        })
        .eq('id', data.sellerId)
    }
  }

  return {
    id: saleId,
    saleNumber,
    clientId: data.clientId,
    clientName,
    clientPhone: clientPhone ?? undefined,
    clientCuit: clientCuit ?? undefined,
    clientDni: clientDni ?? undefined,
    clientEmail: clientEmail ?? undefined,
    clientAddress: clientAddress ?? undefined,
    clientTaxCategory: clientTaxCategory,
    sellerId: data.sellerId,
    sellerName: data.sellerName,
    source: data.source,
    items: itemRows.map(i => ({ productId: i.product_id, quantity: i.quantity, price: i.price, name: i.name, itemDiscount: i.item_discount ?? undefined })),
    total,
    paymentType: data.paymentType,
    paymentMethod: data.paymentMethod ?? 'efectivo',
    cashAmount: data.cashAmount,
    creditAmount: data.creditAmount,
    discount: data.discount,
    discountType: data.discountType,
    orderId: data.orderId,
    status: 'completed',
    invoiceEmitted: false,
    invoiceStatus: 'pending',
    deliveryMethod: data.deliveryMethod,
    deliveryAddress: deliveryAddr,
    createdAt: new Date(),
  }
}

export const saveBoletaToSale = async (
  saleId: string,
  invoiceNumber: string,
  invoicePdfBase64: string,
  extra?: { afipData?: any },
): Promise<void> => {
  const { error } = await supabase.from('ventas').update({
    invoice_number: invoiceNumber,
    invoice_pdf_base64: invoicePdfBase64,
    invoice_emitted: true,
    invoice_status: 'emitted',
    invoice_emitted_at: new Date().toISOString(),
  }).eq('id', saleId)
  if (error) throw error

  if (extra?.afipData) {
    await supabase.from('venta_afip_data').upsert({
      sale_id: saleId,
      cae: extra.afipData.cae,
      cae_vencimiento: extra.afipData.caeVencimiento,
      tipo_comprobante: extra.afipData.tipoComprobante,
      punto_venta: extra.afipData.puntoVenta,
      numero_comprobante: extra.afipData.numeroComprobante,
    }, { onConflict: 'sale_id' })
  }
}

export const saveRemitoToSale = async (
  saleId: string,
  remitoNumber: string,
  remitoPdfBase64: string,
): Promise<void> => {
  const { error } = await supabase.from('ventas').update({
    remito_number: remitoNumber,
    remito_pdf_base64: remitoPdfBase64,
  }).eq('id', saleId)
  if (error) throw error
}

export const updateSaleInvoice = async (
  saleId: string,
  invoiceData: {
    invoiceNumber: string
    invoicePdfUrl: string
    invoiceWhatsappUrl?: string
    afipData?: any
  },
) => {
  const { error } = await supabase.from('ventas').update({
    invoice_emitted: true,
    invoice_number: invoiceData.invoiceNumber,
    invoice_pdf_url: invoiceData.invoicePdfUrl,
    invoice_whatsapp_url: invoiceData.invoiceWhatsappUrl || null,
    invoice_status: 'emitted',
    invoice_emitted_at: new Date().toISOString(),
  }).eq('id', saleId)
  if (error) throw error

  if (invoiceData.afipData) {
    await supabase.from('venta_afip_data').upsert({
      sale_id: saleId,
      cae: invoiceData.afipData.cae,
      cae_vencimiento: invoiceData.afipData.caeVencimiento,
      tipo_comprobante: invoiceData.afipData.tipoComprobante,
      punto_venta: invoiceData.afipData.puntoVenta,
      numero_comprobante: invoiceData.afipData.numeroComprobante,
    }, { onConflict: 'sale_id' })
  }
}

export const updateSaleRemito = async (
  saleId: string,
  remitoData: { remitoNumber: string; remitoPdfUrl: string },
) => {
  const { error } = await supabase.from('ventas').update({
    remito_number: remitoData.remitoNumber,
    remito_pdf_url: remitoData.remitoPdfUrl,
    remito_generated_at: new Date().toISOString(),
  }).eq('id', saleId)
  if (error) throw error
}

export const emitInvoice = async (saleId: string, clientData: any) => {
  const response = await fetch('/api/facturacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saleId, client: clientData }),
  })
  if (!response.ok) throw new Error('Error emitiendo factura')
  return response.json()
}

export const getSalesPaginated = async (
  pageSize: number = 50,
  page: number = 0,
): Promise<{ data: Sale[]; page: number; hasMore: boolean }> => {
  const from = page * pageSize
  const to = from + pageSize - 1
  const { data, error } = await supabase
    .from('ventas')
    .select('*, venta_items(*)')
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  const rows = (data || []).map(mapSale)
  return { data: rows, page, hasMore: rows.length === pageSize }
}

export const getSalesByDateRange = async (startDate: Date, endDate: Date): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('ventas')
    .select('*, venta_items(*)')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapSale)
}
