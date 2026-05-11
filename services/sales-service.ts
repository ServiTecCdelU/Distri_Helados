// services/sales-service.ts
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { CartItem, Sale } from "@/lib/types";
import { generateReadableId, slugify } from "@/services/firestore-helpers";

const SALES_PATH = "ventas";
const PRODUCTS_PATH = "productos";
const CLIENTS_PATH = "clientes";
const TRANSACTIONS_PATH = "transacciones";
const SELLERS_PATH = "vendedores";
const COMMISSIONS_PATH = "comisiones";

const COMMISSION_RATE = 0.1;

export const getSales = async (): Promise<Sale[]> => {
  const salesRef = collection(firestore, SALES_PATH);
  const snapshot = await getDocs(query(salesRef, orderBy("createdAt", "desc")));

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    } as Sale;
  });
};

export const getSalesBySeller = async (sellerId: string): Promise<Sale[]> => {
  const salesRef = collection(firestore, SALES_PATH);
  const q = query(
    salesRef,
    where("sellerId", "==", sellerId),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    } as Sale;
  });
};

export const getSalesByClient = async (clientId: string): Promise<Sale[]> => {
  const salesRef = collection(firestore, SALES_PATH);
  const q = query(
    salesRef,
    where("clientId", "==", clientId),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    } as Sale;
  });
};

export const getSaleById = async (id: string): Promise<Sale | null> => {
  const saleRef = doc(firestore, SALES_PATH, id);
  const snapshot = await getDoc(saleRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
  } as Sale;
};

export const generateSaleNumber = (date: Date, index: number) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `N°${index + 1}-${day}-${month}-${year}`;
};

export const processSale = async (data: {
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  sellerId?: string;
  sellerName?: string;
  items: CartItem[];
  paymentType: "cash" | "credit" | "mixed";
  paymentMethod?: "efectivo" | "transferencia";
  cashAmount?: number;
  creditAmount?: number;
  overpayment?: number;
  discount?: number;
  discountType?: "percent" | "fixed";
  source: "direct" | "order";
  createOrder: boolean;
  orderId?: string;
  deliveryMethod: "pickup" | "delivery";
  deliveryAddress: string;
}): Promise<Sale> => {
  const subtotalBruto = data.items.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0,
  );
  // Subtotal con descuentos por item aplicados
  const subtotal = data.items.reduce((acc, item) => {
    const base = item.product.price * item.quantity;
    const disc = item.itemDiscount ? (base * item.itemDiscount) / 100 : 0;
    return acc + base - disc;
  }, 0);
  const discountAmount =
    data.discount && data.discount > 0
      ? data.discountType === "percent"
        ? (subtotal * data.discount) / 100
        : data.discount
      : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const sales = await getSales();
  const saleNumber = generateSaleNumber(new Date(), sales.length);

  let resolvedClientName = data.clientName ?? "Venta directa";
  let resolvedTaxCategory: any;
  let resolvedClientPhone = data.clientPhone ?? null;
  let resolvedClientCuit: string | null = null;
  let resolvedClientAddress: string | null = null;
  let resolvedClientEmail: string | null = null;
  let resolvedClientDni: string | null = null;
  let clientAddress = data.deliveryAddress;

  // ✅ Tomar TODOS los datos del cliente desde Firestore
  if (data.clientId) {
    const clientRef = doc(firestore, CLIENTS_PATH, data.clientId);
    const clientSnap = await getDoc(clientRef);
    if (clientSnap.exists()) {
      const clientData = clientSnap.data();
      resolvedClientName = clientData.name ?? resolvedClientName;
      resolvedTaxCategory = clientData.taxCategory ?? null;
      resolvedClientPhone = clientData.phone ?? resolvedClientPhone ?? null;
      resolvedClientCuit = clientData.cuit ?? null;
      resolvedClientAddress = clientData.address ?? null;
      resolvedClientEmail = clientData.email ?? null;
      resolvedClientDni = clientData.dni ?? null;

      if (data.deliveryMethod === "delivery" && !data.deliveryAddress) {
        clientAddress = clientData.address ?? data.deliveryAddress;
      }
    }
  }

  const saleId = await generateReadableId(firestore, SALES_PATH, 'venta', resolvedClientName);
  const saleRef = doc(firestore, SALES_PATH, saleId);

  const salePayload = {
    saleNumber,
    clientId: data.clientId ?? null,
    clientName: resolvedClientName ?? null,
    clientPhone: resolvedClientPhone ?? null,
    clientCuit: resolvedClientCuit ?? null,
    clientDni: resolvedClientDni ?? null,
    clientEmail: resolvedClientEmail ?? null,
    clientAddress: resolvedClientAddress ?? null,
    clientTaxCategory: resolvedTaxCategory ?? null,
    sellerId: data.sellerId ?? null,
    sellerName: data.sellerName ?? null,
    source: data.source ?? "direct",
    items: data.items.map((item) => ({
      productId: item.product.id ?? null,
      quantity: item.quantity,
      price: item.product.price ?? null,
      name: item.product.name ?? null,
      ...(item.itemDiscount ? { itemDiscount: item.itemDiscount } : {}),
    })),
    total,
    paymentType: data.paymentType,
    paymentMethod: data.paymentMethod ?? "efectivo",
    cashAmount: data.cashAmount ?? null,
    creditAmount: data.creditAmount ?? null,
    overpayment: data.overpayment ?? null,
    discount: data.discount || null,
    discountType: data.discount ? (data.discountType ?? null) : null,
    orderId: data.orderId ?? null,
    status: "completed",
    invoiceEmitted: false,
    invoiceStatus: "pending",
    deliveryMethod: data.deliveryMethod ?? "pickup",
    deliveryAddress: clientAddress ?? null,
    createdAt: serverTimestamp(),
  };

  await setDoc(saleRef, salePayload);

  // Actualizar stock
  for (const item of data.items) {
    const productRef = doc(firestore, PRODUCTS_PATH, item.product.id);
    const productSnap = await getDoc(productRef);
    if (productSnap.exists()) {
      const currentStock = productSnap.data().stock || 0;
      await updateDoc(productRef, {
        stock: currentStock - item.quantity,
      });
    }
  }

  // Procesar crédito
  const amountToCredit =
    data.paymentType === "credit"
      ? total
      : data.paymentType === "mixed"
        ? (data.creditAmount ?? 0)
        : 0;

  if (amountToCredit > 0 && data.clientId) {
    const clientRef = doc(firestore, CLIENTS_PATH, data.clientId);
    const clientSnap = await getDoc(clientRef);
    if (clientSnap.exists()) {
      const currentBalance = clientSnap.data().currentBalance || 0;
      await updateDoc(clientRef, {
        currentBalance: currentBalance + amountToCredit,
      });
    }

    const transactionId = await generateReadableId(firestore, TRANSACTIONS_PATH, 'transaccion', resolvedClientName);
    const transactionRef = doc(firestore, TRANSACTIONS_PATH, transactionId);
    await setDoc(transactionRef, {
      clientId: data.clientId,
      type: "debt",
      amount: amountToCredit,
      description: `Venta #${saleNumber}`,
      date: serverTimestamp(),
      saleId: saleId,
      saleNumber,
    });
  }

  // Saldo a favor (pago en efectivo mayor al total) -> reduce el saldo del cliente
  const overpaymentAmount = data.overpayment ?? 0;
  if (overpaymentAmount > 0 && data.clientId) {
    const clientRef = doc(firestore, CLIENTS_PATH, data.clientId);
    const clientSnap = await getDoc(clientRef);
    if (clientSnap.exists()) {
      const currentBalance = clientSnap.data().currentBalance || 0;
      await updateDoc(clientRef, {
        currentBalance: currentBalance - overpaymentAmount,
      });
    }

    const transactionId = await generateReadableId(firestore, TRANSACTIONS_PATH, 'transaccion', resolvedClientName);
    const transactionRef = doc(firestore, TRANSACTIONS_PATH, transactionId);
    await setDoc(transactionRef, {
      clientId: data.clientId,
      type: "payment",
      amount: overpaymentAmount,
      description: `Saldo a favor (Venta #${saleNumber})`,
      date: serverTimestamp(),
      saleId: saleId,
      saleNumber,
    });
  }

  // Comisión para vendedor
  if (data.sellerId) {
    const commissionAmount = total * COMMISSION_RATE;
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const commissionId = await generateReadableId(firestore, COMMISSIONS_PATH, 'comision', `${data.sellerName || 'vendedor'}_${yyyymm}`);
    const commissionRef = doc(firestore, COMMISSIONS_PATH, commissionId);
    await setDoc(commissionRef, {
      sellerId: data.sellerId,
      saleId: saleId,
      saleNumber,
      clientName: data.clientName || null,
      saleTotal: total,
      commissionRate: COMMISSION_RATE * 100,
      commissionAmount,
      isPaid: false,
      createdAt: serverTimestamp(),
    });

    const sellerRef = doc(firestore, SELLERS_PATH, data.sellerId);
    const sellerSnap = await getDoc(sellerRef);
    if (sellerSnap.exists()) {
      const sellerData = sellerSnap.data();
      await updateDoc(sellerRef, {
        totalSales: (sellerData.totalSales || 0) + total,
        totalCommission: (sellerData.totalCommission || 0) + commissionAmount,
      });
    }
  }

  return {
    id: saleId,
    saleNumber,
    clientId: data.clientId,
    clientName: resolvedClientName,
    clientPhone: resolvedClientPhone ?? undefined,
    clientCuit: resolvedClientCuit ?? undefined,
    clientDni: resolvedClientDni ?? undefined,
    clientEmail: resolvedClientEmail ?? undefined,
    clientAddress: resolvedClientAddress ?? undefined,
    clientTaxCategory: resolvedTaxCategory,
    sellerId: data.sellerId,
    sellerName: data.sellerName,
    source: data.source,
    items: salePayload.items,
    total,
    paymentType: data.paymentType,
    paymentMethod: data.paymentMethod ?? "efectivo",
    cashAmount: data.cashAmount,
    creditAmount: data.creditAmount,
    discount: data.discount,
    discountType: data.discountType,
    orderId: data.orderId,
    status: "completed",
    invoiceEmitted: false,
    invoiceStatus: "pending",
    deliveryMethod: data.deliveryMethod,
    deliveryAddress: clientAddress,
    createdAt: new Date(),
  };
};

export const saveBoletaToSale = async (
  saleId: string,
  invoiceNumber: string,
  invoicePdfBase64: string,
  extra?: { afipData?: any },
): Promise<void> => {
  const saleRef = doc(firestore, SALES_PATH, saleId);
  await updateDoc(saleRef, {
    invoiceNumber,
    invoicePdfBase64,
    invoiceEmitted: true,
    invoiceStatus: "emitted",
    ...(extra?.afipData ? { afipData: extra.afipData } : {}),
    invoiceEmittedAt: serverTimestamp(),
  });
};

export const saveRemitoToSale = async (
  saleId: string,
  remitoNumber: string,
  remitoPdfBase64: string,
): Promise<void> => {
  const saleRef = doc(firestore, SALES_PATH, saleId);
  await updateDoc(saleRef, {
    remitoNumber,
    remitoPdfBase64,
  });
};

export const updateSaleInvoice = async (
  saleId: string,
  invoiceData: {
    invoiceNumber: string;
    invoicePdfUrl: string;
    invoiceWhatsappUrl?: string;
    afipData?: any;
  },
) => {
  const saleRef = doc(firestore, SALES_PATH, saleId);
  await updateDoc(saleRef, {
    invoiceEmitted: true,
    invoiceNumber: invoiceData.invoiceNumber,
    invoicePdfUrl: invoiceData.invoicePdfUrl,
    invoiceWhatsappUrl: invoiceData.invoiceWhatsappUrl || null,
    invoiceStatus: "emitted",
    afipData: invoiceData.afipData || null,
    invoiceEmittedAt: serverTimestamp(),
  });
};

export const updateSaleRemito = async (
  saleId: string,
  remitoData: {
    remitoNumber: string;
    remitoPdfUrl: string;
  },
) => {
  const saleRef = doc(firestore, SALES_PATH, saleId);
  await updateDoc(saleRef, {
    remitoNumber: remitoData.remitoNumber,
    remitoPdfUrl: remitoData.remitoPdfUrl,
    remitoGeneratedAt: serverTimestamp(),
  });
};

export const emitInvoice = async (saleId: string, clientData: any) => {
  const response = await fetch("/api/facturacion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ saleId, client: clientData }),
  });
  if (!response.ok) throw new Error("Error emitiendo factura");
  return response.json();
};

export const getSalesPaginated = async (
  pageSize: number = 50,
  lastDoc?: QueryDocumentSnapshot,
): Promise<{ data: Sale[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> => {
  const salesRef = collection(firestore, SALES_PATH);
  let q = query(salesRef, orderBy("createdAt", "desc"), limit(pageSize));

  if (lastDoc) {
    q = query(salesRef, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(pageSize));
  }

  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      ...d,
      createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(),
    } as Sale;
  });
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

  return {
    data,
    lastDoc: lastVisible,
    hasMore: snapshot.docs.length === pageSize,
  };
};

export const getSalesByDateRange = async (
  startDate: Date,
  endDate: Date,
): Promise<Sale[]> => {
  const salesRef = collection(firestore, SALES_PATH);
  const q = query(
    salesRef,
    where("createdAt", ">=", startDate),
    where("createdAt", "<=", endDate),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      ...d,
      createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(),
    } as Sale;
  });
};
