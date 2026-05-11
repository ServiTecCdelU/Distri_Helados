import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Order, OrderStatus, CartItem, City } from '@/lib/types'
import { toDate, generateReadableId } from '@/services/firestore-helpers'

const ORDERS_COLLECTION = 'pedidos'

const mapOrder = (docSnap: { id: string; data: () => Record<string, any> }): Order => {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    saleId: data.saleId ?? undefined,
    clientId: data.clientId ?? undefined,
    clientName: data.clientName ?? undefined,
    sellerId: data.sellerId ?? undefined,
    sellerName: data.sellerName ?? undefined,
    transportistaId: data.transportistaId ?? undefined,
    transportistaName: data.transportistaName ?? undefined,
    items: data.items ?? [],
    status: data.status ?? 'pending',
    city: data.city ?? undefined,
    address: data.address ?? 'Retiro en local',
    lat: data.lat ?? undefined,
    lng: data.lng ?? undefined,
    remitoNumber: data.remitoNumber ?? undefined,
    remitoPdfBase64: data.remitoPdfBase64 ?? undefined,
    invoiceNumber: data.invoiceNumber ?? undefined,
    invoicePdfBase64: data.invoicePdfBase64 ?? undefined,
    checkedItems: data.checkedItems ?? [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt ?? data.createdAt),
  }
}

export const getOrders = async (): Promise<Order[]> => {
  const snapshot = await getDocs(collection(firestore, ORDERS_COLLECTION))
  return snapshot.docs.map(mapOrder)
}

export const getOrdersByTransportista = async (transportistaId: string): Promise<Order[]> => {
  const q = query(collection(firestore, ORDERS_COLLECTION), where('transportistaId', '==', transportistaId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(mapOrder)
}

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<Order> => {
  await updateDoc(doc(firestore, ORDERS_COLLECTION, id), {
    status,
    updatedAt: serverTimestamp(),
  })
  const snapshot = await getDoc(doc(firestore, ORDERS_COLLECTION, id))
  if (!snapshot.exists()) throw new Error('Order not found')
  return mapOrder(snapshot)
}

export const completeOrder = async (id: string, saleId: string): Promise<Order> => {
  await updateDoc(doc(firestore, ORDERS_COLLECTION, id), {
    status: 'completed',
    saleId: saleId,
    updatedAt: serverTimestamp(),
  })
  const snapshot = await getDoc(doc(firestore, ORDERS_COLLECTION, id))
  if (!snapshot.exists()) throw new Error('Order not found')
  return mapOrder(snapshot)
}

export const assignTransportista = async (id: string, transportistaId: string, transportistaName: string): Promise<Order> => {
  await updateDoc(doc(firestore, ORDERS_COLLECTION, id), {
    transportistaId,
    transportistaName,
    status: "delivery",
    updatedAt: serverTimestamp(),
  })
  const snapshot = await getDoc(doc(firestore, ORDERS_COLLECTION, id))
  if (!snapshot.exists()) throw new Error('Order not found')
  return mapOrder(snapshot)
}

export const removeTransportista = async (id: string): Promise<Order> => {
  await updateDoc(doc(firestore, ORDERS_COLLECTION, id), {
    transportistaId: null,
    transportistaName: null,
    updatedAt: serverTimestamp(),
  })
  const snapshot = await getDoc(doc(firestore, ORDERS_COLLECTION, id))
  if (!snapshot.exists()) throw new Error('Order not found')
  return mapOrder(snapshot)
}

export const saveRemitoToOrder = async (id: string, remitoNumber: string, remitoPdfBase64: string): Promise<Order> => {
  await updateDoc(doc(firestore, ORDERS_COLLECTION, id), {
    remitoNumber,
    remitoPdfBase64,
    updatedAt: serverTimestamp(),
  })
  const snapshot = await getDoc(doc(firestore, ORDERS_COLLECTION, id))
  if (!snapshot.exists()) throw new Error('Order not found')
  return mapOrder(snapshot)
}

export const saveBoletaToOrder = async (
  id: string,
  invoiceNumber: string,
  invoicePdfBase64: string,
  extra?: { invoiceEmitted?: boolean; afipData?: any; invoiceStatus?: string },
): Promise<Order> => {
  await updateDoc(doc(firestore, ORDERS_COLLECTION, id), {
    invoiceNumber,
    invoicePdfBase64,
    ...(extra?.invoiceEmitted != null && { invoiceEmitted: extra.invoiceEmitted }),
    ...(extra?.afipData && { afipData: extra.afipData }),
    ...(extra?.invoiceStatus && { invoiceStatus: extra.invoiceStatus }),
    updatedAt: serverTimestamp(),
  })
  const snapshot = await getDoc(doc(firestore, ORDERS_COLLECTION, id))
  if (!snapshot.exists()) throw new Error('Order not found')
  return mapOrder(snapshot)
}

export const updateCheckedItems = async (id: string, checkedItems: string[]): Promise<void> => {
  await updateDoc(doc(firestore, ORDERS_COLLECTION, id), {
    checkedItems,
    updatedAt: serverTimestamp(),
  })
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
  const docId = await generateReadableId(firestore, ORDERS_COLLECTION, 'pedido', data.clientName)
  const orderRef = doc(firestore, ORDERS_COLLECTION, docId)
  await setDoc(orderRef, {
    clientId: data.clientId ?? null,
    clientName: data.clientName,
    clientPhone: data.clientPhone ?? null,
    clientEmail: data.clientEmail ?? null,
    sellerId: data.sellerId ?? null,
    sellerName: data.sellerName ?? null,
    items: data.items.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
      itemDiscount: item.itemDiscount ?? null,
    })),
    city: data.city ?? null,
    address: data.address,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    status: data.status ?? 'pending',
    source: data.source ?? 'direct',
    discount: data.discount ?? null,
    discountType: data.discountType ?? null,
    saleId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Guardar la direccion en la libreta del cliente (por ciudad) si no existe
  if (data.clientId && data.address && data.city) {
    try {
      const clientRef = doc(firestore, 'clientes', data.clientId)
      const clientSnap = await getDoc(clientRef)
      if (clientSnap.exists()) {
        const clientData = clientSnap.data()
        const existing: Array<{ city: string; address: string; lat?: number; lng?: number }> =
          Array.isArray(clientData.addresses)
            ? clientData.addresses.filter((a: any) => a && typeof a.address === 'string')
            : []
        const normalized = data.address.trim().toLowerCase()
        const cityKey = data.city.trim()
        const alreadySaved =
          existing.some((a) => a.address.trim().toLowerCase() === normalized && a.city === cityKey) ||
          (clientData.address && clientData.address.trim().toLowerCase() === normalized)
        if (!alreadySaved) {
          const newEntry: Record<string, any> = { city: cityKey, address: data.address.trim() }
          if (data.lat != null) newEntry.lat = data.lat
          if (data.lng != null) newEntry.lng = data.lng
          const updates: Record<string, any> = { addresses: [...existing, newEntry] }
          if (!clientData.address) updates.address = data.address.trim()
          await updateDoc(clientRef, updates)
        }
      }
    } catch {
      // no bloquear la creacion del pedido si falla guardar la direccion
    }
  }

  const snapshot = await getDoc(orderRef)
  if (!snapshot.exists()) throw new Error('Failed to create order')
  return mapOrder(snapshot)
}

export const getOrdersPaginated = async (
  pageSize: number = 50,
  lastDoc?: QueryDocumentSnapshot,
): Promise<{ data: Order[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> => {
  let q = query(
    collection(firestore, ORDERS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  )

  if (lastDoc) {
    q = query(
      collection(firestore, ORDERS_COLLECTION),
      orderBy('createdAt', 'desc'),
      startAfter(lastDoc),
      limit(pageSize),
    )
  }

  const snapshot = await getDocs(q)
  const data = snapshot.docs.map(mapOrder)
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null

  return {
    data,
    lastDoc: lastVisible,
    hasMore: snapshot.docs.length === pageSize,
  }
}