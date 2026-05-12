// services/dashboard-service-supabase.ts
import { supabase } from '@/lib/supabase'
import type { Client, Product, Sale } from '@/lib/types'

export const getDashboardStats = async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  const [productsRes, clientsRes, todaySalesRes, pendingOrdersRes, debtRes] = await Promise.all([
    supabase.from('productos').select('stock', { count: 'exact' }).lt('stock', 10),
    supabase.from('clientes').select('id', { count: 'exact' }),
    supabase.from('ventas').select('total').gte('created_at', today.toISOString()).lte('created_at', todayEnd.toISOString()),
    supabase.from('pedidos').select('id', { count: 'exact' }).neq('status', 'completed'),
    supabase.from('clientes').select('current_balance').gt('current_balance', 0),
  ])

  const todaySales = todaySalesRes.data || []
  const totalDebt = (debtRes.data || []).reduce((acc, c) => acc + (c.current_balance ?? 0), 0)

  return {
    todaySales: todaySales.reduce((acc, s) => acc + (s.total ?? 0), 0),
    todayOrders: todaySales.length,
    lowStockProducts: productsRes.count ?? 0,
    totalDebt,
    pendingOrders: pendingOrdersRes.count ?? 0,
  }
}

export const getSalesLastDays = async (days = 7) => {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days + 1)
  startDate.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('ventas')
    .select('total, created_at')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const buckets = Array.from({ length: days }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - 1 - i))
    date.setHours(0, 0, 0, 0)
    return { date, total: 0 }
  })

  ;(data || []).forEach(sale => {
    const saleDate = new Date(sale.created_at)
    saleDate.setHours(0, 0, 0, 0)
    const bucket = buckets.find(b => b.date.getTime() === saleDate.getTime())
    if (bucket) bucket.total += sale.total ?? 0
  })

  const formatter = new Intl.DateTimeFormat('es-AR', { weekday: 'short' })
  return buckets.map(b => ({ day: formatter.format(b.date), total: b.total }))
}

export const getSalesByHourToday = async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  const { data } = await supabase
    .from('ventas')
    .select('total, created_at')
    .gte('created_at', today.toISOString())
    .lte('created_at', todayEnd.toISOString())

  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour: hour.toString().padStart(2, '0'),
    total: 0,
  }))

  ;(data || []).forEach(sale => {
    const hour = new Date(sale.created_at).getHours()
    if (hour >= 0 && hour < 24) buckets[hour].total += sale.total ?? 0
  })

  return buckets.filter(b => b.total > 0)
}

export const getSalesLastMonths = async (months = 6) => {
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months + 1)
  startDate.setDate(1)
  startDate.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('ventas')
    .select('total, created_at')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true })

  const today = new Date()
  const buckets = Array.from({ length: months }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1)
    return { date, total: 0 }
  })

  ;(data || []).forEach(sale => {
    const saleDate = new Date(sale.created_at)
    const saleMonth = new Date(saleDate.getFullYear(), saleDate.getMonth(), 1)
    const bucket = buckets.find(b => b.date.getTime() === saleMonth.getTime())
    if (bucket) bucket.total += sale.total ?? 0
  })

  const formatter = new Intl.DateTimeFormat('es-AR', { month: 'short' })
  return buckets.map(b => ({ month: formatter.format(b.date), total: b.total }))
}

export const getTopProducts = async (topN = 5) => {
  // Usar venta_items con JOIN a productos — mucho más eficiente que Firestore
  const { data } = await supabase
    .from('venta_items')
    .select('product_id, name, quantity, price, productos(id, name, category, image_url)')

  const productSales: Record<string, { name: string; category: string; imageUrl: string; units: number; revenue: number }> = {}

  ;(data || []).forEach(item => {
    const pid = item.product_id
    if (!pid) return
    if (!productSales[pid]) {
      const prod = item.productos as any
      productSales[pid] = {
        name: prod?.name || item.name,
        category: prod?.category || '',
        imageUrl: prod?.image_url || '',
        units: 0,
        revenue: 0,
      }
    }
    productSales[pid].units += item.quantity
    productSales[pid].revenue += item.price * item.quantity
  })

  return Object.entries(productSales)
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.units - a.units)
    .slice(0, topN)
}

export const getProductDistribution = async () => {
  const { data } = await supabase.from('productos').select('category')
  const categoryTotals: Record<string, number> = {}
  ;(data || []).forEach(p => {
    const cat = p.category || 'Sin categoría'
    categoryTotals[cat] = (categoryTotals[cat] || 0) + 1
  })

  const total = (data || []).length
  const colors = ['#0ea5e9', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#a855f7']

  return Object.entries(categoryTotals)
    .map(([name, count], i) => ({
      name,
      value: Math.round((count / total) * 100),
      color: colors[i % colors.length],
    }))
    .sort((a, b) => b.value - a.value)
}

export const getLowStockProducts = async (): Promise<Product[]> => {
  const { data } = await supabase
    .from('productos')
    .select('id, name, description, price, stock, image_url, category, created_at')
    .lt('stock', 10)
    .order('stock', { ascending: true })
    .limit(20)

  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    price: r.price,
    stock: r.stock,
    imageUrl: r.image_url,
    category: r.category,
    createdAt: new Date(r.created_at),
  }))
}

export const getDebtors = async (): Promise<Client[]> => {
  const { data } = await supabase
    .from('clientes')
    .select('id, name, dni, cuit, email, phone, address, tax_category, credit_limit, current_balance, notes, created_at')
    .gt('current_balance', 0)
    .order('current_balance', { ascending: false })
    .limit(50)

  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    dni: r.dni ?? '',
    cuit: r.cuit,
    email: r.email,
    phone: r.phone,
    address: r.address,
    taxCategory: r.tax_category,
    creditLimit: r.credit_limit,
    currentBalance: r.current_balance ?? 0,
    notes: r.notes ?? '',
    createdAt: new Date(r.created_at),
  }))
}

export const getDashboardData = async () => {
  const [stats, salesLastDays, salesByHourToday, salesLastMonths, topProducts, productDistribution, lowStockProducts, debtors] =
    await Promise.all([
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
    charts: { salesLastDays, salesByHourToday, salesLastMonths, productDistribution },
    lists: { topProducts, lowStockProducts, debtors },
  }
}
