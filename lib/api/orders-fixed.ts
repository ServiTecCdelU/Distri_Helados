// lib/api/orders-fixed.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  setDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import type { Order, OrderStatus, CartItem } from '@/lib/types';
import { toDate } from '@/services/firestore-helpers';

const ORDERS_COLLECTION = 'pedidos';

export const generateOrderNumber = (date: Date, index: number) => {
  const d = new Date(date);
  const year = d.getFullYear().toString().slice(-2);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}-${String(index + 1).padStart(4, '0')}`;
};

export const getOrders = async (): Promise<Order[]> => {
  const ordersQuery = query(
    collection(firestore, ORDERS_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(ordersQuery);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      orderNumber: data.orderNumber,
      saleId: data.saleId,
      clientId: data.clientId ?? undefined,
      clientName: data.clientName ?? undefined,
      sellerId: data.sellerId ?? undefined,
      sellerName: data.sellerName ?? undefined,
      items: data.items ?? [],
      status: data.status,
      address: data.address ?? 'Retiro en local',
      source: data.source ?? 'direct_sale',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt ?? data.createdAt),
      completedAt: toDate(data.completedAt),
    };
  });
};

export const createOrder = async (data: {
  clientId: string;
  clientName: string;
  sellerId?: string;
  sellerName?: string;
  items: CartItem[];
  address: string;
  status: OrderStatus;
  source: string;
}): Promise<Order> => {
  const orderRef = doc(collection(firestore, ORDERS_COLLECTION));
  const orderNumber = generateOrderNumber(new Date(), 0);

  const orderData = {
    orderNumber,
    saleId: null,
    clientId: data.clientId,
    clientName: data.clientName,
    sellerId: data.sellerId || null,
    sellerName: data.sellerName || null,
    items: data.items.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
    })),
    status: data.status,
    address: data.address,
    source: data.source,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
  };

  await setDoc(orderRef, orderData);

  return {
    id: orderRef.id,
    ...orderData,
    saleId: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: undefined,
  };
};

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<Order> => {
  await updateDoc(doc(firestore, ORDERS_COLLECTION, id), {
    status,
    updatedAt: serverTimestamp(),
  });
  const snapshot = await getDoc(doc(firestore, ORDERS_COLLECTION, id));
  if (!snapshot.exists()) throw new Error('Order not found');
  const data = snapshot.data();
  return {
    id: snapshot.id,
    orderNumber: data.orderNumber,
    saleId: data.saleId,
    clientId: data.clientId ?? undefined,
    clientName: data.clientName ?? undefined,
    sellerId: data.sellerId ?? undefined,
    sellerName: data.sellerName ?? undefined,
    items: data.items ?? [],
    status: data.status,
    address: data.address ?? 'Retiro en local',
    source: data.source ?? 'direct_sale',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt ?? data.createdAt),
    completedAt: toDate(data.completedAt),
  };
};

export const completeOrder = async (orderId: string, saleId: string): Promise<Order> => {
  const orderRef = doc(firestore, ORDERS_COLLECTION, orderId);
  await updateDoc(orderRef, {
    status: 'completed',
    saleId,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snapshot = await getDoc(orderRef);
  if (!snapshot.exists()) throw new Error('Order not found');
  const data = snapshot.data();
  return {
    id: snapshot.id,
    orderNumber: data.orderNumber,
    saleId: data.saleId,
    clientId: data.clientId ?? undefined,
    clientName: data.clientName ?? undefined,
    sellerId: data.sellerId ?? undefined,
    sellerName: data.sellerName ?? undefined,
    items: data.items ?? [],
    status: data.status,
    address: data.address ?? 'Retiro en local',
    source: data.source ?? 'direct_sale',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt ?? data.createdAt),
    completedAt: toDate(data.completedAt),
  };
};

export const getOrderById = async (id: string): Promise<Order | null> => {
  const snapshot = await getDoc(doc(firestore, ORDERS_COLLECTION, id));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    orderNumber: data.orderNumber,
    saleId: data.saleId,
    clientId: data.clientId ?? undefined,
    clientName: data.clientName ?? undefined,
    sellerId: data.sellerId ?? undefined,
    sellerName: data.sellerName ?? undefined,
    items: data.items ?? [],
    status: data.status,
    address: data.address ?? 'Retiro en local',
    source: data.source ?? 'direct_sale',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt ?? data.createdAt),
    completedAt: toDate(data.completedAt),
  };
};

export const cancelOrder = async (id: string): Promise<void> => {
  await updateDoc(doc(firestore, ORDERS_COLLECTION, id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
};

// Exportación unificada para usar como import * as ordersApi
export const ordersApi = {
  generateOrderNumber,
  getOrders,
  createOrder,
  updateOrderStatus,
  completeOrder,
  getOrderById,
  cancelOrder,
};

export default ordersApi;