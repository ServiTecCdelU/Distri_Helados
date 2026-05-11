// services/dashboard-service.ts
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Client, Product, Sale } from '@/lib/types'
import { toDate } from '@/services/firestore-helpers'

const PRODUCTS_COLLECTION = 'productos'
const CLIENTS_COLLECTION = 'clientes'
const SALES_COLLECTION = 'ventas'
const ORDERS_COLLECTION = 'pedidos'

export const getDashboardStats = async () => {
  const [productsSnapshot, clientsSnapshot, salesSnapshot, ordersSnapshot] = await Promise.all([
    getDocs(collection(firestore, PRODUCTS_COLLECTION)),
    getDocs(collection(firestore, CLIENTS_COLLECTION)),
    getDocs(collection(firestore, SALES_COLLECTION)),
    getDocs(collection(firestore, ORDERS_COLLECTION)),
  ])

  const products = productsSnapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Product
  })

  const clients = clientsSnapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Client
  })

  const sales = salesSnapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Sale
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  const todaySales = sales.filter((sale) => {
    const saleDate = toDate(sale.createdAt)
    return saleDate >= today && saleDate <= todayEnd
  })

  const pendingOrders = ordersSnapshot.docs.filter(doc => {
    const data = doc.data()
    return data.status !== 'completed'
  })

  return {
    todaySales: todaySales.reduce((acc, sale) => acc + (sale.total ?? 0), 0),
    todayOrders: todaySales.length,
    lowStockProducts: products.filter((p) => p.stock < 10).length,
    totalDebt: clients.reduce((acc, c) => acc + (c.currentBalance ?? 0), 0),
    pendingOrders: pendingOrders.length,
  }
}

export const getSalesLastDays = async (days = 7) => {
  const snapshot = await getDocs(
    query(
      collection(firestore, SALES_COLLECTION),
      orderBy('createdAt', 'desc')
    )
  )
  
  const sales = snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Sale
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - 1 - index))
    date.setHours(0, 0, 0, 0)
    return {
      date,
      total: 0,
    }
  })

  sales.forEach((sale) => {
    const saleDate = toDate(sale.createdAt)
    saleDate.setHours(0, 0, 0, 0)
    
    const bucket = buckets.find(b => 
      b.date.getTime() === saleDate.getTime()
    )
    
    if (bucket) {
      bucket.total += sale.total ?? 0
    }
  })

  const formatter = new Intl.DateTimeFormat('es-AR', { weekday: 'short' })
  
  return buckets.map((bucket) => ({
    day: formatter.format(bucket.date),
    total: bucket.total,
  }))
}

export const getSalesByHourToday = async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  const snapshot = await getDocs(
    query(
      collection(firestore, SALES_COLLECTION),
      where('createdAt', '>=', today),
      where('createdAt', '<=', todayEnd)
    )
  )

  const sales = snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Sale
  })

  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour: hour.toString().padStart(2, '0'),
    total: 0,
  }))

  sales.forEach((sale) => {
    const saleDate = toDate(sale.createdAt)
    const hour = saleDate.getHours()
    if (hour >= 0 && hour < 24) {
      buckets[hour].total += sale.total ?? 0
    }
  })

  return buckets.filter(bucket => bucket.total > 0)
}

export const getSalesLastMonths = async (months = 6) => {
  const snapshot = await getDocs(
    query(
      collection(firestore, SALES_COLLECTION),
      orderBy('createdAt', 'desc')
    )
  )

  const sales = snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Sale
  })

  const today = new Date()
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (months - 1 - index), 1)
    return {
      date,
      total: 0,
    }
  })

  sales.forEach((sale) => {
    const saleDate = toDate(sale.createdAt)
    const saleMonth = new Date(saleDate.getFullYear(), saleDate.getMonth(), 1)
    
    const bucket = buckets.find(b => 
      b.date.getTime() === saleMonth.getTime()
    )
    
    if (bucket) {
      bucket.total += sale.total ?? 0
    }
  })

  const formatter = new Intl.DateTimeFormat('es-AR', { month: 'short' })
  
  return buckets.map((bucket) => ({
    month: formatter.format(bucket.date),
    total: bucket.total,
  }))
}

export const getTopProducts = async (limit = 5) => {
  const [productsSnapshot, salesSnapshot] = await Promise.all([
    getDocs(collection(firestore, PRODUCTS_COLLECTION)),
    getDocs(collection(firestore, SALES_COLLECTION)),
  ])

  const products = productsSnapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Product
  })

  const sales = salesSnapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Sale
  })

  const productSales: Record<string, { units: number; revenue: number }> = {}

  sales.forEach((sale) => {
    sale.items?.forEach((item) => {
      if (!productSales[item.productId]) {
        productSales[item.productId] = { units: 0, revenue: 0 }
      }
      productSales[item.productId].units += item.quantity
      productSales[item.productId].revenue += item.price * item.quantity
    })
  })

  const topProducts = Object.entries(productSales)
    .map(([productId, stats]) => {
      const product = products.find(p => p.id === productId)
      return product ? {
        id: product.id,
        name: product.name,
        category: product.category,
        units: stats.units,
        revenue: stats.revenue,
        imageUrl: product.imageUrl,
      } : null
    })
    .filter(Boolean)
    .sort((a, b) => b!.units - a!.units)
    .slice(0, limit)

  return topProducts
}

export const getProductDistribution = async () => {
  const snapshot = await getDocs(collection(firestore, PRODUCTS_COLLECTION))
  
  const products = snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Product
  })

  const categoryTotals: Record<string, number> = {}

  products.forEach((product) => {
    if (!categoryTotals[product.category]) {
      categoryTotals[product.category] = 0
    }
    categoryTotals[product.category]++
  })

  const totalProducts = products.length
  const colors = ['#0ea5e9', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#a855f7']

  const distribution = Object.entries(categoryTotals)
    .map(([category, count], index) => ({
      name: category,
      value: Math.round((count / totalProducts) * 100),
      color: colors[index % colors.length],
    }))
    .sort((a, b) => b.value - a.value)

  return distribution
}

export const getLowStockProducts = async (): Promise<Product[]> => {
  const snapshot = await getDocs(collection(firestore, PRODUCTS_COLLECTION))
  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        imageUrl: data.imageUrl,
        category: data.category,
        createdAt: toDate(data.createdAt),
      } as Product
    })
    .filter((product) => product.stock < 10)
    .sort((a, b) => a.stock - b.stock)
}

export const getDebtors = async (): Promise<Client[]> => {
  const snapshot = await getDocs(
    query(collection(firestore, CLIENTS_COLLECTION), 
    where('currentBalance', '>', 0))
  )
  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        name: data.name,
        cuit: data.cuit,
        email: data.email,
        phone: data.phone,
        address: data.address,
        taxCategory: data.taxCategory,
        creditLimit: data.creditLimit,
        currentBalance: data.currentBalance ?? 0,
        notes: data.notes ?? '',
        createdAt: toDate(data.createdAt),
      } as Client
    })
    .sort((a, b) => b.currentBalance - a.currentBalance)
}

// Nueva función para obtener datos completos del dashboard
export const getDashboardData = async () => {
  const [
    stats,
    salesLastDays,
    salesByHourToday,
    salesLastMonths,
    topProducts,
    productDistribution,
    lowStockProducts,
    debtors,
  ] = await Promise.all([
    getDashboardStats(),
    getSalesLastDays(7),
    getSalesByHourToday(),
    getSalesLastMonths(6),
    getTopProducts(5),
    getProductDistribution(),
    getLowStockProducts(),
    getDebtors(),
  ])

  return {
    stats,
    charts: {
      salesLastDays,
      salesByHourToday,
      salesLastMonths,
      productDistribution,
    },
    lists: {
      topProducts,
      lowStockProducts,
      debtors,
    },
  }
}