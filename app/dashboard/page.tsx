'use client'

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import dynamic from 'next/dynamic'

const Area = dynamic(() => import('recharts').then(mod => ({ default: mod.Area })), { ssr: false })
const AreaChart = dynamic(() => import('recharts').then(mod => ({ default: mod.AreaChart })), { ssr: false })
const Bar = dynamic(() => import('recharts').then(mod => ({ default: mod.Bar })), { ssr: false })
const BarChart = dynamic(() => import('recharts').then(mod => ({ default: mod.BarChart })), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => ({ default: mod.CartesianGrid })), { ssr: false })
const Cell = dynamic(() => import('recharts').then(mod => ({ default: mod.Cell })), { ssr: false })
const Line = dynamic(() => import('recharts').then(mod => ({ default: mod.Line })), { ssr: false })
const LineChart = dynamic(() => import('recharts').then(mod => ({ default: mod.LineChart })), { ssr: false })
const Pie = dynamic(() => import('recharts').then(mod => ({ default: mod.Pie })), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(mod => ({ default: mod.PieChart })), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => ({ default: mod.XAxis })), { ssr: false })
import { 
  AlertTriangle, 
  ArrowRight, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  IceCream as Helado, 
  Package as Paquete, 
  Search as Buscar, 
  ShoppingCart as CarritoDeCompras, 
  TrendingDown as TendenciaALaBaja, 
  TrendingUp as TendenciaAlAlza, 
  Truck as Camion, 
  Users as Usuarios, 
  ChevronRight, 
  Clock as Reloj, 
  AlertCircle, 
  CheckCircle2, 
  MapPin, 
  ChevronLeft, 
  ChevronRight as ChevronRightIcon,
  Loader2,
  Sliders,
  ArrowLeftRight
} from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { dashboardApi, ordersApi, transferApi } from '@/lib/api'
import type { TransferConfig } from '@/lib/api'
import { Label } from '@/components/ui/label'
import type { Product, Client, Order, OrderStatus } from '@/lib/types'
import { formatCurrency } from '@/lib/utils/format'

const statusMeta: Record<OrderStatus, { 
  label: string; 
  color: string; 
  bg: string; 
  icon: React.ElementType 
}> = {
  pending: { 
    label: 'Pendiente', 
    color: 'text-amber-700', 
    bg: 'bg-amber-50 border-amber-200', 
    icon: Reloj 
  },
  preparation: { 
    label: 'Preparando', 
    color: 'text-amber-700', 
    bg: 'bg-amber-50 border-amber-200', 
    icon: Reloj 
  },
  delivery: { 
    label: 'En camino', 
    color: 'text-sky-700', 
    bg: 'bg-sky-50 border-sky-200', 
    icon: MapPin 
  },
  completed: { 
    label: 'Completado', 
    color: 'text-emerald-700', 
    bg: 'bg-emerald-50 border-emerald-200', 
    icon: CheckCircle2 
  },
}

// Función para obtener la acción siguiente según el estado actual
const getNextAction = (currentStatus: OrderStatus): { label: string; nextStatus: OrderStatus } => {
  switch (currentStatus) {
    case 'pending':
      return { label: 'Comenzar preparación', nextStatus: 'preparation' }
    case 'preparation':
      return { label: 'Marcar para entrega', nextStatus: 'delivery' }
    case 'delivery':
      return { label: 'Marcar como entregado', nextStatus: 'completed' }
    default:
      return { label: 'Actualizar estado', nextStatus: 'completed' }
  }
}

export default function DashboardPage() {
  const [dateFilter, setDateFilter] = useState<'hoy' | 'semana' | 'mes' | 'custom'>('hoy')
  const [debtorQuery, setDebtorQuery] = useState('')
  const [debtorPage, setDebtorPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDateRangePicker, setShowDateRangePicker] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
  
  // Estados para datos reales
  const [dashboardStats, setDashboardStats] = useState({
    todaySales: 0,
    todayOrders: 0,
    lowStockProducts: 0,
    totalDebt: 0,
    pendingOrders: 0,
  })
  
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([])
  const [debtors, setDebtors] = useState<Client[]>([])
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [salesLastDays, setSalesLastDays] = useState<{day: string; total: number}[]>([])
  const [salesByHour, setSalesByHour] = useState<{hour: string; total: number}[]>([])
  const [monthlyComparison, setMonthlyComparison] = useState<{month: string; total: number}[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [productDistribution, setProductDistribution] = useState<{name: string; value: number; color: string}[]>([])

  // Transfer alias config
  const [aliasModalOpen, setAliasModalOpen] = useState(false)
  const [aliasConfig, setAliasConfig] = useState<TransferConfig>({ alias: '', titular: '', banco: '' })
  const [aliasSaving, setAliasSaving] = useState(false)

  // KPIs dinámicos memoizados — solo se recalculan cuando cambian los datos
  const kpis = useMemo(() => [
    { 
      id: 'ventas', 
      title: 'Ventas hoy', 
      value: formatCurrency(dashboardStats.todaySales), 
      change: dashboardStats.todaySales > 0 ? 12.4 : 0,
      positive: true, 
      detail: `${dashboardStats.todayOrders} órdenes procesadas`, 
      icon: DollarSign, 
      sparkline: [12, 18, 24, 22, 28, 30, 36], 
      color: 'sky' 
    },
    { 
      id: 'stock', 
      title: 'Stock bajo', 
      value: `${dashboardStats.lowStockProducts} productos`, 
      change: -8.2, 
      positive: false, 
      detail: `${lowStockProducts.filter(p => p.stock < 5).length} críticos`, 
      icon: AlertTriangle, 
      sparkline: [9, 11, 10, 8, 7, 6, 7], 
      color: 'rose' 
    },
    { 
      id: 'deuda', 
      title: 'Deudores', 
      value: formatCurrency(dashboardStats.totalDebt), 
      change: 4.1, 
      positive: false, 
      detail: `${debtors.length} clientes con saldo`, 
      icon: Usuarios, 
      sparkline: [6, 7, 8, 9, 10, 11, 12], 
      color: 'orange' 
    },
    { 
      id: 'pendientes', 
      title: 'Pedidos pendientes', 
      value: `${dashboardStats.pendingOrders}`, 
      change: 6.7, 
      positive: true, 
      detail: `${pendingOrders.filter(o => o.status === 'delivery').length} en camino`, 
      icon: Camion, 
      sparkline: [8, 9, 11, 10, 12, 13, 14], 
      color: 'emerald'
    },
  ], [dashboardStats, lowStockProducts, debtors, pendingOrders])

  // Cargar todos los datos del dashboard en una sola llamada batch
  const loadDashboardData = useCallback(async (isMounted?: () => boolean) => {
    setLoading(true)
    try {
      const [data, orders, transferCfg] = await Promise.all([
        dashboardApi.getDashboardData(),
        ordersApi.getAll(),
        transferApi.getConfig(),
      ])
      if (isMounted && !isMounted()) return
      setAliasConfig(transferCfg)

      setDashboardStats(data.stats)
      setLowStockProducts(data.lists.lowStockProducts)
      setDebtors(data.lists.debtors)
      setPendingOrders(orders.filter(o => o.status && o.status !== 'completed' && Array.isArray(o.items)))
      setSalesLastDays(data.charts.salesLastDays)
      setSalesByHour(data.charts.salesByHourToday)
      setMonthlyComparison(data.charts.salesLastMonths)
      setTopProducts(data.lists.topProducts || [])
      setProductDistribution(data.charts.productDistribution || [])
    } catch (error) {
      if (isMounted && !isMounted()) return
      // Error silenciado
    } finally {
      if (isMounted && !isMounted()) return
      setLoading(false)
    }
  }, [])

  // Cargar datos al montar y cuando cambie el filtro de fecha
  useEffect(() => {
    let mounted = true
    loadDashboardData(() => mounted)
    return () => { mounted = false }
  }, [loadDashboardData, dateFilter])

  // Formatear datos para gráficos — memoizado para evitar recálculo en cada render
  const salesWeekly = useMemo(() => salesLastDays.map((item, index, array) => ({
    day: item.day,
    current: item.total,
    previous: index > 0 ? array[index - 1].total * 0.85 : item.total * 0.85
  })), [salesLastDays])

  const filteredDebtors = useMemo(() => {
    return debtors.filter((debtor) => 
      debtor.name.toLowerCase().includes(debtorQuery.toLowerCase())
    )
  }, [debtorQuery, debtors])

  const pageSize = 4
  const pagedDebtors = filteredDebtors.slice((debtorPage - 1) * pageSize, debtorPage * pageSize)
  const totalPages = Math.max(1, Math.ceil(filteredDebtors.length / pageSize))

  // Handlers
  const handleNuevaVenta = () => {
    window.location.href = '/ventas/nueva'
  }

  const handleAjustarStock = () => {
    window.location.href = '/productos'
  }

  const handleVerPedidos = () => {
    window.location.href = '/pedidos'
  }

  const handleVerRanking = () => {
    window.location.href = '/productos?sort=ventas'
  }

  const handleVerTodosStock = () => {
    window.location.href = '/productos?filter=low-stock'
  }

  const handleReabastecer = (productId: string) => {
    window.location.href = `/productos?id=${productId}&action=edit`
  }

  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await ordersApi.updateStatus(orderId, newStatus)
      // Recargar datos
      loadDashboardData()
      setSelectedOrder(null)
    } catch (error) {
      // Error silenciado
    }
  }

  const handleSaveAlias = async () => {
    setAliasSaving(true)
    try {
      await transferApi.saveConfig(aliasConfig)
      setAliasModalOpen(false)
    } catch (error) {
      // Error silenciado
    } finally {
      setAliasSaving(false)
    }
  }

  const handleCustomDateRange = () => {
    setShowDateRangePicker(true)
  }

  const applyDateRange = () => {
    if (dateRange.start && dateRange.end) {
      setDateFilter('custom')
      setShowDateRangePicker(false)
      // Aquí iría la lógica para cargar datos con el rango personalizado
      // Rango de fechas aplicado
    }
  }

  if (loading) {
    return (
      <MainLayout title="Dashboard" description="Resumen ejecutivo y operación diaria">
        <div className="min-h-screen bg-slate-50/50">
          <div className="max-w-[1600px] mx-auto p-2 sm:p-3 lg:p-6 xl:p-8 space-y-3 sm:space-y-4 lg:space-y-6">
            {/* Header skeleton */}
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-9 w-56 rounded-lg" />
              </div>
              {/* Hero card skeleton */}
              <Skeleton className="h-28 sm:h-32 rounded-lg sm:rounded-xl" />
            </div>

            {/* KPI cards skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white/80 border border-border/40 rounded-2xl p-2 sm:p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-6 sm:h-7 sm:w-7 rounded" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>

            {/* Charts skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3">
              <div className="lg:col-span-2 bg-white border border-border/40 rounded-2xl p-3 sm:p-4 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-48 sm:h-56 rounded-2xl" />
              </div>
              <div className="bg-white border border-border/40 rounded-2xl p-3 sm:p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-48 sm:h-56 rounded-full mx-auto w-48 sm:w-56" />
              </div>
            </div>

            {/* Bottom sections skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white border border-border/40 rounded-2xl p-3 sm:p-4 space-y-3">
                  <Skeleton className="h-5 w-36" />
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-10 rounded-2xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  // Calcular porcentaje de cambio para el badge de ventas semanales
  const weeklyChange = salesLastDays.length >= 2 
    ? ((salesLastDays[salesLastDays.length - 1].total - salesLastDays[salesLastDays.length - 2].total) / salesLastDays[salesLastDays.length - 2].total) * 100
    : 0

  return (
    <MainLayout title="Dashboard" description="Resumen ejecutivo y operación diaria">
      <div className="min-h-screen bg-slate-50/50">
        <div className="max-w-[1600px] mx-auto p-2 sm:p-3 lg:p-6 xl:p-8 space-y-3 sm:space-y-4 lg:space-y-6">
          
          {/* Header Section - Más compacto en móvil */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <nav className="flex items-center gap-1 sm:gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <span className="hover:text-foreground cursor-pointer truncate">Inicio</span>
                  <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                  <span className="text-foreground font-medium truncate">Dashboard</span>
                </nav>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 text-violet-700 border-violet-200 hover:bg-violet-50"
                  onClick={() => setAliasModalOpen(true)}
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  {aliasConfig.alias ? aliasConfig.alias : "Alias"}
                </Button>
              </div>
              
              {/* Date Filter Pills - Más compactos */}
              <div className="flex items-center gap-1 sm:gap-1.5 bg-white p-0.5 sm:p-1 rounded-lg border border-border/60 shadow-sm overflow-x-auto">
                {(['hoy', 'semana', 'mes'] as const).map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={dateFilter === option ? 'default' : 'ghost'}
                    className={`rounded text-xs font-medium transition-all whitespace-nowrap px-2 py-1 ${
                      dateFilter === option
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setDateFilter(option)}
                  >
                    {option}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={dateFilter === 'custom' ? 'default' : 'ghost'}
                  className={`rounded text-xs font-medium transition-all whitespace-nowrap px-2 py-1 ${
                    dateFilter === 'custom'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={handleCustomDateRange}
                >
                  <span className="flex items-center gap-1">
                    <Sliders className="h-3 w-3" />
                    <span className="hidden xs:inline">Personalizado</span>
                    <span className="xs:hidden">Pers.</span>
                  </span>
                </Button>
              </div>
            </div>

            {/* Hero Card - Más compacto */}
            <div className="relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-br from-sky-500/5 via-white to-cyan-500/5 border border-sky-100/50 shadow-sm">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-100/40 via-transparent to-transparent" />
              <div className="relative p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
                  <div className="space-y-1 sm:space-y-1.5 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                        <Helado className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-sky-600" />
                      </div>
                      <span className="text-xs font-medium text-sky-700">Golloara</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-semibold text-foreground">Resumen ejecutivo</h2>
                    <p className="text-[10px] sm:text-xs text-muted-foreground max-w-lg">
                      Vista rápida del rendimiento, stock y pedidos críticos.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <Button 
                      className="rounded bg-sky-600 hover:bg-sky-700 text-white shadow-sm hover:shadow-md transition-all gap-1 sm:gap-1.5 text-xs h-8 sm:h-9"
                      onClick={handleNuevaVenta}
                    >
                      <CarritoDeCompras className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden sm:inline">Nueva venta</span>
                      <span className="sm:hidden">Venta</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="rounded border-slate-200 hover:bg-slate-50 gap-1 sm:gap-1.5 text-xs h-8 sm:h-9"
                      onClick={handleAjustarStock}
                    >
                      <Paquete className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden sm:inline">Stock</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="rounded border-slate-200 hover:bg-slate-50 gap-1 sm:gap-1.5 text-xs h-8 sm:h-9"
                      onClick={handleVerPedidos}
                    >
                      <Camion className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden sm:inline">Pedidos</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPIs Grid - Más compacto en móvil */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {kpis.map((kpi) => {
              const Icon = kpi.icon
              const isPositive = kpi.positive
              const colorClasses = {
                sky: 'bg-sky-50 text-sky-600 border-sky-100',
                rose: 'bg-rose-50 text-rose-600 border-rose-100',
                orange: 'bg-orange-50 text-orange-600 border-orange-100',
                emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
              }[kpi.color]

              return (
                <Card
                  key={kpi.id}
                  className="group border-border/40 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-2 sm:p-3">
                    <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate pr-1">
                      {kpi.title}
                    </CardTitle>
                    <div className={`h-6 w-6 sm:h-7 sm:w-7 rounded ${colorClasses} flex items-center justify-center border shrink-0`}>
                      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 sm:space-y-1.5 p-2 sm:p-3 pt-0">
                    <div className="flex items-baseline gap-1">
                      <div className="text-base sm:text-lg lg:text-xl font-bold text-foreground tracking-tight truncate">
                        {kpi.value}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium px-1 py-0.5 rounded-full ${
                          isPositive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isPositive ? (
                          <TendenciaAlAlza className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                        ) : (
                          <TendenciaALaBaja className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                        )}
                        {Math.abs(kpi.change)}%
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">vs período anterior</span>
                    </div>
                    
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{kpi.detail}</p>
                    
                    <div className="hidden sm:block h-6 sm:h-7 pt-0.5">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={kpi.sparkline.map((value, index) => ({ index, value }))}>
                          <defs>
                            <linearGradient id={`spark-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <Area
                            dataKey="value"
                            type="monotone"
                            stroke={isPositive ? '#10b981' : '#f43f5e'}
                            fill={`url(#spark-${kpi.id})`}
                            strokeWidth={1.5}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </section>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
            
            {/* Left Column - Charts */}
            <div className="xl:col-span-8 space-y-3 sm:space-y-4">
              
              {/* Weekly Sales Chart */}
              <Card className="border-border/40 bg-white shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 pb-1 sm:pb-2 p-2 sm:p-3">
                  <div>
                    <CardTitle className="text-sm sm:text-base font-semibold">Ventas y comparativa semanal</CardTitle>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Últimos 7 días</p>
                  </div>
                  <Badge variant="secondary" className="rounded-md sm:rounded-lg bg-emerald-50 text-emerald-700 border-emerald-200 font-medium text-[10px] sm:text-xs w-fit">
                    {weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(1)}% vs semana anterior
                  </Badge>
                </CardHeader>
                <CardContent className="p-2 sm:p-3 pt-0">
                  <ChartContainer
                    config={{
                      current: { label: 'Semana actual', color: '#0ea5e9' },
                      previous: { label: 'Semana anterior', color: '#cbd5e1' },
                    }}
                    className="h-40 sm:h-48 lg:h-56 w-full"
                  >
                    <LineChart data={salesWeekly} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        dy={8}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                      <Line
                        dataKey="previous"
                        stroke="#cbd5e1"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="4 4"
                      />
                      <Line
                        dataKey="current"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 3, stroke: '#fff' }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Bottom Charts Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Monthly Comparison */}
                <Card className="border-border/40 bg-white shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-1 p-2 sm:p-3">
                    <CardTitle className="text-sm sm:text-base font-semibold">Comparativa mensual</CardTitle>
                    <TendenciaAlAlza className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent className="p-2 sm:p-3 pt-0">
                    <ChartContainer
                      config={{ total: { label: 'Ventas', color: '#14b8a6' } }}
                      className="h-32 sm:h-36 lg:h-40 w-full"
                    >
                      <BarChart data={monthlyComparison} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          dy={8}
                        />
                        <ChartTooltip
                          content={<ChartTooltipContent />}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Bar dataKey="total" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Sales by Hour */}
                <Card className="border-border/40 bg-white shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-1 p-2 sm:p-3">
                    <CardTitle className="text-sm sm:text-base font-semibold">Ventas hoy (por hora)</CardTitle>
                    <Reloj className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-500" />
                  </CardHeader>
                  <CardContent className="p-2 sm:p-3 pt-0">
                    <ChartContainer
                      config={{ total: { label: 'Ventas', color: '#38bdf8' } }}
                      className="h-32 sm:h-36 lg:h-40 w-full"
                    >
                      <AreaChart data={salesByHour} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                        <defs>
                          <linearGradient id="fillToday" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="hour"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          dy={8}
                        />
                        <ChartTooltip
                          content={<ChartTooltipContent />}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Area dataKey="total" stroke="#0284c7" fill="url(#fillToday)" strokeWidth={2} />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right Column - Product Distribution & Lists */}
            <div className="xl:col-span-4 space-y-3 sm:space-y-4">
              
              {/* Product Distribution */}
              <Card className="border-border/40 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-1 p-2 sm:p-3">
                  <div>
                    <CardTitle className="text-sm sm:text-base font-semibold">Distribución de productos</CardTitle>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Por categoría</p>
                  </div>
                  <Paquete className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
                </CardHeader>
                <CardContent className="p-2 sm:p-3 pt-0">
                  <div className="h-28 sm:h-32 lg:h-36 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={productDistribution}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={35}
                          outerRadius={55}
                          paddingAngle={3}
                        >
                          {productDistribution.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} strokeWidth={0} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-lg sm:text-xl font-bold text-slate-700">
                          {productDistribution.length > 0 ? `${productDistribution[0].value}%` : '0%'}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-muted-foreground">
                          {productDistribution.length > 0 ? productDistribution[0].name : 'Sin datos'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2 sm:mt-3 space-y-1 sm:space-y-1.5">
                    {productDistribution.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-[10px] sm:text-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 sm:h-2 sm:w-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-medium text-foreground">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Products Mini List */}
              <Card className="border-border/40 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-1 p-2 sm:p-3">
                  <CardTitle className="text-sm sm:text-base font-semibold">Productos más vendidos</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 sm:h-7 text-xs gap-1 text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                    onClick={handleVerRanking}
                  >
                    <span className="hidden sm:inline">Ver ranking</span>
                    <span className="sm:hidden">Ver</span>
                    <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-1.5 sm:space-y-2 p-2 sm:p-3 pt-0">
                  {topProducts.slice(0, 3).map((product, index) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 hover:bg-slate-100/50 transition-colors group cursor-pointer"
                      onClick={() => window.location.href = `/productos?id=${product.id}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:text-sky-600 transition-colors shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground">{product.category}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-foreground">{product.units} uds</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Operational Sections Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            
            {/* Low Stock - Ahora con datos reales */}
            <Card className="border-border/40 bg-white shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 pb-2 p-2 sm:p-3">
                <div>
                  <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-500" />
                    Stock bajo
                  </CardTitle>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Productos que requieren atención inmediata</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 sm:h-7 text-xs gap-1 w-fit"
                  onClick={handleVerTodosStock}
                >
                  Ver todos <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 p-2 sm:p-3 pt-0">
                {lowStockProducts.slice(0, 3).map((product) => {
                  const percent = Math.min(100, Math.round((product.stock / 10) * 100)) // 10 como stock mínimo
                  const isCritical = product.stock < 5
                  
                  return (
                    <div
                      key={product.id}
                      className="group rounded-lg border border-slate-200 bg-white p-2.5 sm:p-3 hover:border-rose-200 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <img
                            src={product.imageUrl || '/placeholder.svg'}
                            alt={product.name}
                            className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-cover border border-slate-100 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground">{product.category}</p>
                          </div>
                        </div>
                        <Badge className={`${isCritical ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'} border text-[9px] sm:text-[10px] shrink-0`}>
                          {product.stock} uds
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 sm:space-y-1.5">
                        <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
                          <span className="text-muted-foreground">Stock actual</span>
                          <span className="font-medium text-foreground">{percent}% del mínimo</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isCritical ? 'bg-rose-500' : 'bg-amber-500'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between pt-0.5 sm:pt-1">
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground">Mínimo: 10 uds</span>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-5 sm:h-6 text-[9px] sm:text-[10px] rounded border-slate-200 hover:bg-slate-50"
                            onClick={() => handleReabastecer(product.id)}
                          >
                            Reabastecer
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Debtors - Ahora con datos reales */}
            <Card className="border-border/40 bg-white shadow-sm">
              <CardHeader className="flex flex-col gap-2 sm:gap-3 pb-2 p-2 sm:p-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
                  <div>
                    <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500" />
                      Deudores
                    </CardTitle>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Clientes con saldo pendiente</p>
                  </div>
                  <div className="relative w-full sm:w-48">
                    <Buscar className="absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente..."
                      className="pl-7 sm:pl-8 h-7 sm:h-8 rounded border-slate-200 focus:border-sky-300 focus:ring-sky-200 text-xs"
                      value={debtorQuery}
                      onChange={(event) => {
                        setDebtorQuery(event.target.value)
                        setDebtorPage(1)
                      }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 sm:space-y-2 p-2 sm:p-3 pt-0">
                {pagedDebtors.map((debtor) => (
                  <div
                    key={debtor.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50/30 hover:bg-slate-50 hover:border-slate-200 transition-all"
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                        {debtor.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{debtor.name}</p>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                          Saldo pendiente
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-foreground shrink-0">
                      {formatCurrency(debtor.currentBalance)}
                    </span>
                  </div>
                ))}
                
                <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-slate-100">
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                    Página {debtorPage} de {totalPages}
                  </span>
                  <div className="flex gap-1 sm:gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 sm:h-7 text-[9px] sm:text-[10px] rounded px-1.5 sm:px-2"
                      disabled={debtorPage === 1}
                      onClick={() => setDebtorPage((page) => Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="h-2.5 w-2.5 sm:hidden" />
                      <span className="hidden sm:inline">Anterior</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 sm:h-7 text-[9px] sm:text-[10px] rounded px-1.5 sm:px-2"
                      disabled={debtorPage === totalPages}
                      onClick={() => setDebtorPage((page) => Math.min(totalPages, page + 1))}
                    >
                      <ChevronRightIcon className="h-2.5 w-2.5 sm:hidden" />
                      <span className="hidden sm:inline">Siguiente</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Orders Section - Ahora con datos reales */}
          <Card className="border-border/40 bg-white shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 pb-2 p-2 sm:p-3">
              <div>
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-1.5">
                  <Camion className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-500" />
                  Pedidos pendientes
                </CardTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Seguimiento en tiempo real</p>
              </div>
              <Badge variant="secondary" className="rounded-md sm:rounded-lg bg-sky-50 text-sky-700 border-sky-200 font-medium text-[10px] sm:text-xs w-fit">
                {pendingOrders.length} en curso
              </Badge>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {pendingOrders.slice(0, 10000000000000000000000).map((order) => {
                  const meta = statusMeta[order.status] ?? statusMeta['pending']
                  const StatusIcon = meta.icon
                  const itemsCount = order.items.reduce((acc, item) => acc + item.quantity, 0)

                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="group text-left rounded-lg border border-slate-200 bg-white p-2.5 sm:p-3 hover:border-sky-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                        <div className="min-w-0 pr-1.5">
                          <p className="text-xs font-semibold text-foreground group-hover:text-sky-700 transition-colors truncate">
                            {order.clientName || 'Cliente no especificado'}
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground font-mono mt-0.5">{order.id.slice(0, 8)}</p>
                        </div>
                        <div className={`p-1 rounded ${meta.bg} shrink-0`}>
                          <StatusIcon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${meta.color}`} />
                        </div>
                      </div>

                      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium border ${meta.bg} ${meta.color} mb-1.5 sm:mb-2`}>
                        {meta.label}
                      </div>
                      
                      <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground pt-1.5 sm:pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-0.5">
                          <Paquete className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                          {itemsCount} productos
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Reloj className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                          {order.status === 'delivery' ? '30 min' : '45 min'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Detail Modal */}
      <Dialog open={Boolean(selectedOrder)} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-md rounded-xl sm:rounded-2xl border-slate-200 w-[calc(100vw-1rem)] sm:w-full">
          <DialogHeader className="pb-2 sm:pb-3">
            <DialogTitle className="text-sm sm:text-base font-semibold flex items-center gap-1.5 sm:gap-2">
              <Paquete className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-500" />
              Detalle del pedido
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-2 sm:space-y-3">
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 sm:p-3">
                <p className="text-xs sm:text-sm font-semibold text-foreground">{selectedOrder.clientName || 'Cliente no especificado'}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-0.5">{selectedOrder.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-0.5">Estado</p>
                  {(() => { const m = statusMeta[selectedOrder.status] ?? statusMeta['pending']; return (
                  <div className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] sm:text-[10px] font-medium border ${m.bg} ${m.color}`}>
                    {m.label}
                  </div>
                  ); })()}
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-0.5">Tiempo estimado</p>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Reloj className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-400" />
                    {selectedOrder.status === 'delivery' ? '30 min' : '45 min'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-0.5">Productos</p>
                  <p className="text-xs font-semibold text-foreground">
                    {selectedOrder.items.reduce((acc, item) => acc + item.quantity, 0)} unidades
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-0.5">Dirección</p>
                  <p className="text-xs font-semibold text-foreground truncate">{selectedOrder.address}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-1.5 sm:gap-2 pt-2 sm:pt-3">
            <Button 
              variant="outline" 
              className="rounded text-xs h-7 sm:h-8 px-2 sm:px-3" 
              onClick={() => setSelectedOrder(null)}
            >
              Cerrar
            </Button>
            {selectedOrder && selectedOrder.status !== 'completed' && (
              <Button 
                className="rounded bg-sky-600 hover:bg-sky-700 text-xs h-7 sm:h-8 px-2 sm:px-3"
                onClick={() => {
                  if (!selectedOrder) return
                  const nextAction = getNextAction(selectedOrder.status)
                  handleUpdateOrderStatus(selectedOrder.id, nextAction.nextStatus)
                }}
              >
                {getNextAction(selectedOrder.status).label}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Date Range Picker Modal */}
      <Dialog open={showDateRangePicker} onOpenChange={setShowDateRangePicker}>
        <DialogContent className="sm:max-w-md rounded-xl sm:rounded-2xl border-slate-200 w-[calc(100vw-1rem)] sm:w-full">
          <DialogHeader className="pb-2 sm:pb-3">
            <DialogTitle className="text-sm sm:text-base font-semibold flex items-center gap-1.5 sm:gap-2">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-500" />
              Rango de fechas personalizado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium">Fecha de inicio</label>
                <Input
                  type="date"
                  className="text-xs sm:text-sm h-8 sm:h-9"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium">Fecha de fin</label>
                <Input
                  type="date"
                  className="text-xs sm:text-sm h-8 sm:h-9"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-1.5 sm:gap-2 pt-2 sm:pt-3">
            <Button 
              variant="outline" 
              className="rounded text-xs h-7 sm:h-8 px-2 sm:px-3" 
              onClick={() => {
                setShowDateRangePicker(false)
                setDateRange({ start: '', end: '' })
              }}
            >
              Cancelar
            </Button>
            <Button 
              className="rounded bg-sky-600 hover:bg-sky-700 text-xs h-7 sm:h-8 px-2 sm:px-3"
              onClick={applyDateRange}
              disabled={!dateRange.start || !dateRange.end}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alias Transfer Config Modal */}
      <Dialog open={aliasModalOpen} onOpenChange={setAliasModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-violet-600" />
              Datos de Transferencia
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="alias">Alias</Label>
              <Input
                id="alias"
                placeholder="ej: helados.mio.mp"
                value={aliasConfig.alias}
                onChange={(e) => setAliasConfig(prev => ({ ...prev, alias: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="titular">Titular</Label>
              <Input
                id="titular"
                placeholder="ej: Juan Pérez"
                value={aliasConfig.titular}
                onChange={(e) => setAliasConfig(prev => ({ ...prev, titular: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banco">Banco</Label>
              <Input
                id="banco"
                placeholder="ej: Mercado Pago"
                value={aliasConfig.banco}
                onChange={(e) => setAliasConfig(prev => ({ ...prev, banco: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAliasModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={handleSaveAlias}
              disabled={aliasSaving}
            >
              {aliasSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}