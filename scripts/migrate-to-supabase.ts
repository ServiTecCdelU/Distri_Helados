/**
 * Script de migración: Firebase/Firestore → Supabase
 *
 * Ejecutar con: npx tsx scripts/migrate-to-supabase.ts
 *
 * Requisitos:
 * - .env.local con credenciales de Firebase Y Supabase
 * - Schema SQL ya ejecutado en Supabase
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createClient } from '@supabase/supabase-js'

// ---- Firebase Admin init ----
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
const fbApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    })
const db = getFirestore(fbApp)

// ---- Supabase init ----
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ---- Helpers ----
function toISO(val: any): string | null {
  if (!val) return null
  if (val.toDate) return val.toDate().toISOString()
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'string') return new Date(val).toISOString()
  return null
}

async function getCollection(name: string) {
  const snap = await db.collection(name).get()
  console.log(`  📦 ${name}: ${snap.size} documentos`)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

async function insertBatch(table: string, rows: any[]) {
  if (rows.length === 0) return
  const batches = chunk(rows, 500)
  for (const batch of batches) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' })
    if (error) {
      console.error(`  ❌ Error en ${table}:`, error.message)
      // Intentar uno por uno para identificar el problemático
      for (const row of batch) {
        const { error: e2 } = await supabase.from(table).upsert(row, { onConflict: 'id' })
        if (e2) console.error(`    ❌ Fila ${row.id}: ${e2.message}`)
      }
    }
  }
}

async function insertBatchSerial(table: string, rows: any[]) {
  if (rows.length === 0) return
  const batches = chunk(rows, 500)
  for (const batch of batches) {
    const { error } = await supabase.from(table).insert(batch)
    if (error) {
      console.error(`  ❌ Error en ${table}:`, error.message)
      for (const row of batch) {
        const { error: e2 } = await supabase.from(table).insert(row)
        if (e2) console.error(`    ❌ Detalle: ${e2.message}`)
      }
    }
  }
}

// ---- Sets de IDs válidos (para limpiar FK huérfanas) ----
let validVendedores: Set<string>
let validClientes: Set<string>
let validPedidos: Set<string>
let validVentas: Set<string>

function cleanFK(val: any, validSet: Set<string>): string | null {
  if (!val) return null
  return validSet.has(val) ? val : null
}

// ---- Migraciones por colección ----

async function migrateVendedores() {
  console.log('\n🔄 Migrando vendedores...')
  const docs = await getCollection('vendedores')
  validVendedores = new Set(docs.map(d => d.id))
  const rows = docs.map(d => ({
    id: d.id,
    name: (d as any).name || '',
    email: (d as any).email || '',
    phone: (d as any).phone || null,
    employee_type: (d as any).employeeType || 'vendedor',
    commission_rate: (d as any).commissionRate || 0,
    transportista_commission_rate: (d as any).transportistaCommissionRate || null,
    is_active: (d as any).isActive !== false,
    total_sales: (d as any).totalSales || 0,
    total_commission: (d as any).totalCommission || 0,
    created_at: toISO((d as any).createdAt) || new Date().toISOString(),
  }))
  await insertBatch('vendedores', rows)
  console.log(`  ✅ ${rows.length} vendedores migrados`)
}

async function migrateProductos() {
  console.log('\n🔄 Migrando productos...')
  const docs = await getCollection('productos')
  const rows = docs.map(d => ({
    id: d.id,
    name: (d as any).name || '',
    description: (d as any).description || null,
    price: (d as any).price || 0,
    stock: (d as any).stock || 0,
    image_url: (d as any).imageUrl || null,
    category: (d as any).category || null,
    base: (d as any).base || 'crema',
    marca: (d as any).marca || 'Sin identificar',
    sin_tacc: (d as any).sinTacc || false,
    disabled: (d as any).disabled || false,
    created_at: toISO((d as any).createdAt) || new Date().toISOString(),
  }))
  await insertBatch('productos', rows)
  console.log(`  ✅ ${rows.length} productos migrados`)
}

async function migrateClientes() {
  console.log('\n🔄 Migrando clientes...')
  const docs = await getCollection('clientes')
  validClientes = new Set(docs.map(d => d.id))

  const clientRows = docs.map(d => ({
    id: d.id,
    name: (d as any).name || '',
    dni: (d as any).dni || null,
    cuit: (d as any).cuit || null,
    email: (d as any).email || null,
    phone: (d as any).phone || null,
    address: (d as any).address || null,
    tax_category: (d as any).taxCategory || 'consumidor_final',
    credit_limit: (d as any).creditLimit || 0,
    current_balance: (d as any).currentBalance || 0,
    notes: (d as any).notes || '',
    created_at: toISO((d as any).createdAt) || new Date().toISOString(),
  }))
  await insertBatch('clientes', clientRows)
  console.log(`  ✅ ${clientRows.length} clientes migrados`)

  // Direcciones
  const dirRows: any[] = []
  for (const d of docs) {
    const addresses = (d as any).addresses || []
    for (const addr of addresses) {
      dirRows.push({
        client_id: d.id,
        city: addr.city || '',
        address: addr.address || '',
        lat: addr.lat || null,
        lng: addr.lng || null,
      })
    }
  }
  if (dirRows.length > 0) {
    await insertBatchSerial('cliente_direcciones', dirRows)
    console.log(`  ✅ ${dirRows.length} direcciones migradas`)
  }
}

async function migrateUsuarios() {
  console.log('\n🔄 Migrando usuarios...')
  const docs = await getCollection('usuarios')
  const rows = docs.map(d => ({
    id: d.id,
    auth_uid: null, // Se vinculará cuando los usuarios se registren en Supabase Auth
    email: (d as any).email || '',
    name: (d as any).name || '',
    role: (d as any).role || 'customer',
    seller_id: cleanFK((d as any).sellerId, validVendedores),
    employee_type: (d as any).employeeType || null,
    is_active: (d as any).isActive !== false,
    created_at: toISO((d as any).createdAt) || new Date().toISOString(),
  }))
  const orphaned = docs.filter(d => (d as any).sellerId && !validVendedores.has((d as any).sellerId))
  if (orphaned.length) console.log(`  ⚠️ ${orphaned.length} usuarios con sellerId huérfano (seteado a null)`)
  await insertBatch('usuarios', rows)
  console.log(`  ✅ ${rows.length} usuarios migrados`)
}

async function migratePedidos() {
  console.log('\n🔄 Migrando pedidos...')
  const docs = await getCollection('pedidos')

  validPedidos = new Set(docs.map(d => d.id))

  const orderRows = docs.map(d => ({
    id: d.id,
    sale_id: null, // se actualiza después de migrar ventas
    client_id: cleanFK((d as any).clientId, validClientes),
    client_name: (d as any).clientName || null,
    client_phone: (d as any).clientPhone || null,
    client_email: (d as any).clientEmail || null,
    seller_id: cleanFK((d as any).sellerId, validVendedores),
    seller_name: (d as any).sellerName || null,
    transportista_id: cleanFK((d as any).transportistaId, validVendedores),
    transportista_name: (d as any).transportistaName || null,
    status: (d as any).status || 'pending',
    city: (d as any).city || null,
    address: (d as any).address || 'Retiro en local',
    lat: (d as any).lat || null,
    lng: (d as any).lng || null,
    delivery_method: (d as any).deliveryMethod || null,
    remito_number: (d as any).remitoNumber || null,
    remito_pdf_base64: (d as any).remitoPdfBase64 || null,
    invoice_number: (d as any).invoiceNumber || null,
    invoice_pdf_base64: (d as any).invoicePdfBase64 || null,
    checked_items: (d as any).checkedItems || [],
    source: (d as any).source || 'direct',
    discount: (d as any).discount || null,
    discount_type: (d as any).discountType || null,
    created_at: toISO((d as any).createdAt) || new Date().toISOString(),
    updated_at: toISO((d as any).updatedAt) || new Date().toISOString(),
  }))

  await insertBatch('pedidos', orderRows)
  console.log(`  ✅ ${orderRows.length} pedidos migrados`)

  // Items de pedido
  const itemRows: any[] = []
  for (const d of docs) {
    const items = (d as any).items || []
    for (const item of items) {
      itemRows.push({
        order_id: d.id,
        product_id: item.productId || null,
        name: item.name || '',
        quantity: item.quantity || 0,
        price: item.price || 0,
        item_discount: item.itemDiscount || null,
      })
    }
  }
  await insertBatchSerial('pedido_items', itemRows)
  console.log(`  ✅ ${itemRows.length} items de pedido migrados`)

  return orderRows // Para actualizar sale_id después
}

async function migrateVentas(orderRows: any[]) {
  console.log('\n🔄 Migrando ventas...')
  const docs = await getCollection('ventas')

  validVentas = new Set(docs.map(d => d.id))

  const saleRows = docs.map(d => ({
    id: d.id,
    sale_number: (d as any).saleNumber || null,
    client_id: cleanFK((d as any).clientId, validClientes),
    client_name: (d as any).clientName || null,
    client_phone: (d as any).clientPhone || null,
    client_cuit: (d as any).clientCuit || null,
    client_dni: (d as any).clientDni || null,
    client_email: (d as any).clientEmail || null,
    client_address: (d as any).clientAddress || null,
    client_tax_category: (d as any).clientTaxCategory || null,
    seller_id: cleanFK((d as any).sellerId, validVendedores),
    seller_name: (d as any).sellerName || null,
    source: (d as any).source || 'direct',
    total: (d as any).total || 0,
    payment_type: (d as any).paymentType || 'cash',
    payment_method: (d as any).paymentMethod || null,
    cash_amount: (d as any).cashAmount || null,
    credit_amount: (d as any).creditAmount || null,
    overpayment: (d as any).overpayment || null,
    status: (d as any).status || 'completed',
    discount: (d as any).discount || null,
    discount_type: (d as any).discountType || null,
    order_id: cleanFK((d as any).orderId, validPedidos),
    invoice_emitted: (d as any).invoiceEmitted || false,
    invoice_status: (d as any).invoiceStatus || null,
    invoice_number: (d as any).invoiceNumber || null,
    invoice_pdf_base64: (d as any).invoicePdfBase64 || null,
    invoice_pdf_url: (d as any).invoicePdfUrl || null,
    invoice_whatsapp_url: (d as any).invoiceWhatsappUrl || null,
    invoice_drive_url: (d as any).invoiceDriveUrl || null,
    invoice_drive_file_id: (d as any).invoiceDriveFileId || null,
    invoice_filename: (d as any).invoiceFilename || null,
    invoice_pdf_size: (d as any).invoicePdfSize || null,
    remito_number: (d as any).remitoNumber || null,
    remito_pdf_base64: (d as any).remitoPdfBase64 || null,
    remito_pdf_url: (d as any).remitoPdfUrl || null,
    remito_drive_url: (d as any).remitoDriveUrl || null,
    remito_drive_file_id: (d as any).remitoDriveFileId || null,
    remito_filename: (d as any).remitoFilename || null,
    delivery_method: (d as any).deliveryMethod || null,
    delivery_address: (d as any).deliveryAddress || null,
    created_at: toISO((d as any).createdAt) || new Date().toISOString(),
    invoice_emitted_at: toISO((d as any).invoiceEmittedAt),
    remito_generated_at: toISO((d as any).remitoGeneratedAt),
    invoice_generated_at: toISO((d as any).invoiceGeneratedAt),
  }))
  await insertBatch('ventas', saleRows)
  console.log(`  ✅ ${saleRows.length} ventas migradas`)

  // Actualizar pedidos.sale_id ahora que ventas existen (FK circular)
  for (const o of orderRows) {
    const origDoc = docs.find(() => false) // no necesitamos, usamos los orderRows originales
  }
  // Buscar saleId original de los pedidos en Firestore
  const pedidoSnap = await db.collection('pedidos').get()
  for (const d of pedidoSnap.docs) {
    const saleId = d.data().saleId
    if (saleId && validVentas.has(saleId)) {
      const { error } = await supabase.from('pedidos').update({ sale_id: saleId }).eq('id', d.id)
      if (error) console.error(`  ⚠️ pedido ${d.id} sale_id: ${error.message}`)
    }
  }

  // Items de venta
  const itemRows: any[] = []
  for (const d of docs) {
    const items = (d as any).items || []
    for (const item of items) {
      itemRows.push({
        sale_id: d.id,
        product_id: item.productId || null,
        name: item.name || '',
        quantity: item.quantity || 0,
        price: item.price || 0,
        item_discount: item.itemDiscount || null,
      })
    }
  }
  await insertBatchSerial('venta_items', itemRows)
  console.log(`  ✅ ${itemRows.length} items de venta migrados`)

  // AFIP data
  const afipRows: any[] = []
  for (const d of docs) {
    const afip = (d as any).afipData
    if (afip && afip.cae) {
      afipRows.push({
        sale_id: d.id,
        cae: afip.cae,
        cae_vencimiento: afip.caeVencimiento || '',
        tipo_comprobante: afip.tipoComprobante || 0,
        punto_venta: afip.puntoVenta || 0,
        numero_comprobante: afip.numeroComprobante || 0,
      })
    }
  }
  if (afipRows.length > 0) {
    const batches = chunk(afipRows, 500)
    for (const batch of batches) {
      const { error } = await supabase.from('venta_afip_data').upsert(batch, { onConflict: 'sale_id' })
      if (error) {
        console.error(`  ❌ Error en venta_afip_data:`, error.message)
        for (const row of batch) {
          const { error: e2 } = await supabase.from('venta_afip_data').upsert(row, { onConflict: 'sale_id' })
          if (e2) console.error(`    ❌ sale_id ${row.sale_id}: ${e2.message}`)
        }
      }
    }
    console.log(`  ✅ ${afipRows.length} registros AFIP migrados`)
  }
}

async function migrateTransacciones() {
  console.log('\n🔄 Migrando transacciones...')
  const docs = await getCollection('transacciones')
  const rows = docs
    .filter(d => validClientes.has((d as any).clientId)) // skip huérfanas
    .map(d => ({
      id: d.id,
      client_id: (d as any).clientId,
      type: (d as any).type || 'debt',
      amount: (d as any).amount || 0,
      description: (d as any).description || null,
      date: toISO((d as any).date) || new Date().toISOString(),
      sale_id: cleanFK((d as any).saleId, validVentas),
      sale_number: (d as any).saleNumber || null,
    }))
  const skipped = docs.length - rows.length
  if (skipped) console.log(`  ⚠️ ${skipped} transacciones con clientId huérfano (omitidas)`)
  await insertBatch('transacciones', rows)
  console.log(`  ✅ ${rows.length} transacciones migradas`)
}

async function migrateComisiones() {
  console.log('\n🔄 Migrando comisiones...')
  const docs = await getCollection('comisiones')
  const rows = docs
    .filter(d => validVendedores.has((d as any).sellerId) && validVentas.has((d as any).saleId))
    .map(d => ({
    id: d.id,
    seller_id: (d as any).sellerId,
    sale_id: (d as any).saleId,
    sale_number: (d as any).saleNumber || null,
    client_name: (d as any).clientName || null,
    sale_total: (d as any).saleTotal || 0,
    commission_rate: (d as any).commissionRate || 0,
    commission_amount: (d as any).commissionAmount || 0,
    is_paid: (d as any).isPaid || false,
    paid_at: toISO((d as any).paidAt),
    created_at: toISO((d as any).createdAt) || new Date().toISOString(),
  }))
  const skipped = docs.length - rows.length
  if (skipped) console.log(`  ⚠️ ${skipped} comisiones con FK huérfana (omitidas)`)
  await insertBatch('comisiones', rows)
  console.log(`  ✅ ${rows.length} comisiones migradas`)
}

async function migrateAuditoria() {
  console.log('\n🔄 Migrando auditoría...')
  const docs = await getCollection('auditoria')
  const validActions = [
    'sale_created', 'sale_invoiced', 'product_created', 'product_updated',
    'product_deleted', 'client_created', 'client_updated', 'client_deleted',
    'order_created', 'order_status_changed', 'cash_register_opened',
    'cash_register_closed', 'payment_registered', 'price_list_updated'
  ]
  const rows = docs
    .filter(d => validActions.includes((d as any).action))
    .map(d => ({
      id: d.id,
      action: (d as any).action,
      user_id: (d as any).userId || '',
      user_name: (d as any).userName || '',
      description: (d as any).description || null,
      entity_type: (d as any).entityType || null,
      entity_id: (d as any).entityId || null,
      metadata: (d as any).metadata || null,
      created_at: toISO((d as any).createdAt) || new Date().toISOString(),
    }))
  await insertBatch('auditoria', rows)
  console.log(`  ✅ ${rows.length} registros de auditoría migrados`)
}

async function migrateListasPrecios() {
  console.log('\n🔄 Migrando listas de precios...')
  const docs = await getCollection('listas_precios')
  const rows = docs.map(d => ({
    id: d.id,
    name: (d as any).name || '',
    type: (d as any).type || 'general',
    description: (d as any).description || null,
    multiplier: (d as any).multiplier || 1,
    is_active: (d as any).isActive !== false,
    created_at: toISO((d as any).createdAt) || new Date().toISOString(),
  }))
  await insertBatch('listas_precios', rows)
  console.log(`  ✅ ${rows.length} listas de precios migradas`)
}

async function migrateConfiguracion() {
  console.log('\n🔄 Migrando configuración...')
  try {
    const docSnap = await db.collection('configuracion').doc('transferencia').get()
    if (docSnap.exists) {
      const data = docSnap.data()
      const { error } = await supabase
        .from('configuracion')
        .upsert({
          key: 'transferencia',
          value: {
            alias: data?.alias || '',
            titular: data?.titular || '',
            banco: data?.banco || '',
          },
          updated_at: new Date().toISOString(),
        })
      if (error) console.error('  ❌ Error:', error.message)
      else console.log('  ✅ Configuración de transferencia migrada')
    } else {
      console.log('  ℹ️ No hay configuración de transferencia')
    }
  } catch (e: any) {
    console.error('  ❌ Error:', e.message)
  }
}

async function migrateCaja() {
  console.log('\n🔄 Migrando caja...')
  const docs = await getCollection('caja')
  const rows = docs.map(d => ({
    id: d.id,
    opened_at: toISO((d as any).openedAt) || new Date().toISOString(),
    closed_at: toISO((d as any).closedAt),
    opened_by: (d as any).openedBy || '',
    closed_by: (d as any).closedBy || null,
    initial_amount: (d as any).initialAmount || 0,
    final_amount: (d as any).finalAmount ?? null,
    expected_amount: (d as any).expectedAmount ?? null,
    difference: (d as any).difference ?? null,
    status: (d as any).status || 'closed',
    notes: (d as any).notes || null,
    sales_count: (d as any).salesCount ?? null,
    total_sales: (d as any).totalSales ?? null,
    cash_total: (d as any).cashTotal ?? null,
    credit_total: (d as any).creditTotal ?? null,
  }))
  await insertBatch('caja', rows)
  console.log(`  ✅ ${rows.length} registros de caja migrados`)
}

// ---- Ejecución principal ----

async function main() {
  console.log('🚀 Iniciando migración Firebase → Supabase')
  console.log('=' .repeat(50))

  try {
    // Orden por dependencias FK
    await migrateVendedores()       // 1. Sin FK
    await migrateProductos()        // 2. Sin FK
    await migrateClientes()         // 3. Sin FK + direcciones
    await migrateUsuarios()         // 4. FK → vendedores
    const orderRows = await migratePedidos()  // 5. FK → clientes, vendedores
    await migrateVentas(orderRows)  // 6. FK → clientes, vendedores, pedidos + items + afip
    await migrateTransacciones()    // 7. FK → clientes, ventas
    await migrateComisiones()       // 8. FK → vendedores, ventas
    await migrateAuditoria()        // 9. Sin FK estricta
    await migrateListasPrecios()    // 10. Sin FK
    await migrateConfiguracion()    // 11. Key/value
    await migrateCaja()             // 12. Sin FK

    console.log('\n' + '=' .repeat(50))
    console.log('✅ Migración completada exitosamente')
  } catch (error: any) {
    console.error('\n❌ Error fatal:', error.message)
    process.exit(1)
  }
}

main()
