import type { Client, Product, Sale, Seller, SellerCommission, Transaction, CartItem, Order, OrderStatus } from './types'
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  getProductsPaginated,
  updateProduct,
} from '@/services/products-service'
import {
  createClient,
  deleteClient,
  getClientById,
  getClientTransactions,
  getClients,
  getClientsPaginated,
  updateClient,
} from '@/services/clients-service'
import {
  getSales,
  getSalesPaginated,
  getSalesByDateRange,
  getSalesBySeller,
  getSaleById,
  processSale,
  saveBoletaToSale,
  saveRemitoToSale,
} from '@/services/sales-service'
import { registerCashPayment } from '@/services/payments-service'
import {
  createSeller,
  deleteSeller,
  getAllCommissions,
  getSellerById,
  getSellerCommissions,
  getSellers,
  payAllCommissions,
  payCommission,
  updateSeller,
} from '@/services/sellers-service'
import { createInvoice, createRemito } from '@/services/invoice-service'
import {
  getOrders,
  getOrdersPaginated,
  getOrdersByTransportista,
  updateOrderStatus,
  completeOrder,
  createOrder,
  assignTransportista,
  removeTransportista,
  saveRemitoToOrder,
  saveBoletaToOrder,
  updateCheckedItems,
} from '@/services/orders-service'
import { doc, updateDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import {
  getDashboardStats,
  getSalesLastDays,
  getLowStockProducts,
  getDebtors,
  getSalesByHourToday,
  getSalesLastMonths,
  getTopProducts,
  getProductDistribution,
  getDashboardData,
} from '@/services/dashboard-service'
import { logAudit, getAuditLog } from '@/services/audit-service'
import {
  getPriceLists,
  createPriceList,
  updatePriceList,
  deletePriceList,
} from '@/services/price-list-service'
import {
  getTransferConfig,
  saveTransferConfig,
} from '@/services/transfer-config-service'
import type { TransferConfig } from '@/services/transfer-config-service'

export const productsApi = {
  async getAll(): Promise<Product[]> {
    return getProducts()
  },
  async getPaginated(pageSize?: number, lastDoc?: any) {
    return getProductsPaginated(pageSize, lastDoc)
  },
  async getById(id: string): Promise<Product | undefined> {
    return getProductById(id)
  },
  async create(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
    return createProduct(product)
  },
  async update(id: string, updates: Partial<Product>): Promise<Product> {
    return updateProduct(id, updates)
  },
  async delete(id: string): Promise<void> {
    return deleteProduct(id)
  },
}

export const clientsApi = {
  async getAll(): Promise<Client[]> {
    return getClients()
  },
  async getPaginated(pageSize?: number, lastDoc?: any) {
    return getClientsPaginated(pageSize, lastDoc)
  },
  async getById(id: string): Promise<Client | undefined> {
    return getClientById(id)
  },
  async create(client: Omit<Client, 'id' | 'createdAt' | 'currentBalance'>): Promise<Client> {
    return createClient(client)
  },
  async update(id: string, updates: Partial<Client>): Promise<Client> {
    return updateClient(id, updates)
  },
  async delete(id: string): Promise<void> {
    return deleteClient(id)
  },
  async getTransactions(clientId: string): Promise<Transaction[]> {
    return getClientTransactions(clientId)
  },
}

export const salesApi = {
  async getAll(): Promise<Sale[]> {
    return getSales()
  },
  async getPaginated(pageSize?: number, lastDoc?: any) {
    return getSalesPaginated(pageSize, lastDoc)
  },
  async getByDateRange(startDate: Date, endDate: Date) {
    return getSalesByDateRange(startDate, endDate)
  },
  async getById(id: string): Promise<Sale | null> {
    return getSaleById(id)
  },
  async getBySeller(sellerId: string): Promise<Sale[]> {
    return getSalesBySeller(sellerId)
  },
  async processSale(data: {
    clientId?: string
    clientName?: string
    clientPhone?: string
    sellerId?: string
    sellerName?: string
    items: CartItem[]
    paymentType: 'cash' | 'credit' | 'mixed'
    cashAmount?: number
    creditAmount?: number
    source?: 'direct' | 'order'
    createOrder: boolean
    orderId?: string
    deliveryMethod: 'pickup' | 'delivery'
    deliveryAddress: string
  }): Promise<Sale> {
    return processSale(data)
  },
  async emitInvoice(saleId: string, client?: { name?: string; phone?: string; email?: string }) {
    const invoice = await createInvoice({ saleId, client })
    await updateDoc(doc(firestore, 'ventas', saleId), {
      invoiceEmitted: true,
      invoiceNumber: invoice.invoiceNumber,
      invoiceStatus: 'generated',
      invoicePdfUrl: invoice.pdfUrl,
      invoiceWhatsappUrl: invoice.whatsappUrl ?? null,
    })
    return invoice
  },
  async saveBoletaToSale(saleId: string, invoiceNumber: string, invoicePdfBase64: string, extra?: { afipData?: any }): Promise<void> {
    return saveBoletaToSale(saleId, invoiceNumber, invoicePdfBase64, extra)
  },
  async saveRemitoToSale(saleId: string, remitoNumber: string, remitoPdfBase64: string): Promise<void> {
    return saveRemitoToSale(saleId, remitoNumber, remitoPdfBase64)
  },
}

export const paymentsApi = {
  async registerCashPayment(data: {
    clientId: string
    amount: number
    description?: string
  }): Promise<Transaction> {
    return registerCashPayment(data)
  },
}

export const invoiceApi = {
  async createInvoice(saleId: string, client?: { name?: string; phone?: string; email?: string }) {
    return salesApi.emitInvoice(saleId, client)
  },
}

export const remitoApi = {
  async createRemito(saleId: string) {
    const remito = await createRemito({ saleId })
    await updateDoc(doc(firestore, 'ventas', saleId), {
      remitoNumber: remito.remitoNumber,
      remitoPdfUrl: remito.pdfUrl,
    })
    return remito
  },
}

export const ordersApi = {
  async getAll(): Promise<Order[]> {
    return getOrders()
  },
  async getPaginated(pageSize?: number, lastDoc?: any) {
    return getOrdersPaginated(pageSize, lastDoc)
  },
  async getByTransportista(transportistaId: string): Promise<Order[]> {
    return getOrdersByTransportista(transportistaId)
  },
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return updateOrderStatus(id, status)
  },
  async completeOrder(id: string, saleId: string): Promise<Order> {
    return completeOrder(id, saleId)
  },
  async assignTransportista(id: string, transportistaId: string, transportistaName: string): Promise<Order> {
    return assignTransportista(id, transportistaId, transportistaName)
  },
  async removeTransportista(id: string): Promise<Order> {
    return removeTransportista(id)
  },
  async saveRemitoToOrder(id: string, remitoNumber: string, remitoPdfBase64: string): Promise<Order> {
    return saveRemitoToOrder(id, remitoNumber, remitoPdfBase64)
  },
  async saveBoletaToOrder(id: string, invoiceNumber: string, invoicePdfBase64: string): Promise<Order> {
    return saveBoletaToOrder(id, invoiceNumber, invoicePdfBase64)
  },
  async updateCheckedItems(id: string, checkedItems: string[]): Promise<void> {
    return updateCheckedItems(id, checkedItems)
  },
  async createOrder(data: {
    clientId: string
    clientName: string
    sellerId?: string
    sellerName?: string
    items: CartItem[]
    address: string
    lat?: number
    lng?: number
    status: OrderStatus
    source?: string
  }): Promise<Order> {
    return createOrder(data)
  },
}

export const sellersApi = {
  async getAll(): Promise<Seller[]> {
    return getSellers()
  },
  async getById(id: string): Promise<Seller | undefined> {
    return getSellerById(id)
  },
  async create(seller: Omit<Seller, 'id' | 'createdAt' | 'totalSales' | 'totalCommission'>): Promise<Seller> {
    return createSeller(seller)
  },
  async update(id: string, updates: Partial<Seller>): Promise<Seller> {
    return updateSeller(id, updates)
  },
  async delete(id: string): Promise<void> {
    return deleteSeller(id)
  },
  async getCommissions(sellerId: string): Promise<SellerCommission[]> {
    return getSellerCommissions(sellerId)
  },
  async getAllCommissions(): Promise<SellerCommission[]> {
    return getAllCommissions()
  },
  async payCommission(commissionId: string): Promise<SellerCommission> {
    return payCommission(commissionId)
  },
  async payAllCommissions(sellerId: string): Promise<void> {
    return payAllCommissions(sellerId)
  },
}

export const dashboardApi = {
  async getStats() {
    return getDashboardStats()
  },
  async getSalesLastDays(days = 7) {
    return getSalesLastDays(days)
  },
  async getLowStockProducts() {
    return getLowStockProducts()
  },
  async getDebtors() {
    return getDebtors()
  },
  async getSalesByHourToday() {
    return getSalesByHourToday()
  },
  async getSalesLastMonths(months = 6) {
    return getSalesLastMonths(months)
  },
  async getTopProducts(limit = 5) {
    return getTopProducts(limit)
  },
  async getProductDistribution() {
    return getProductDistribution()
  },
  async getDashboardData() {
    return getDashboardData()
  },
}

export const auditApi = {
  log: logAudit,
  getAll: getAuditLog,
}

export const priceListApi = {
  getAll: getPriceLists,
  create: createPriceList,
  update: updatePriceList,
  delete: deletePriceList,
}

export const transferApi = {
  getConfig: getTransferConfig,
  saveConfig: saveTransferConfig,
}
export type { TransferConfig }