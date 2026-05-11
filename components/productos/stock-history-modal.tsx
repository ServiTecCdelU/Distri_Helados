'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { 
  ShoppingCart, 
  PlusCircle, 
  MinusCircle, 
  EyeOff,
  Package,
  User,
  Store,
  Calendar,
  DollarSign,
  Filter,
  TrendingUp,
  TrendingDown,
  Archive
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateTime as formatDate } from '@/lib/utils/format'
import type { StockMovement } from '@/app/productos/page'

type FilterType = 'all' | 'sale' | 'manual_add' | 'manual_remove' | 'deactivation'

interface StockHistoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: { id: string; name: string; price: number; stock: number } | null
  history: StockMovement[]
}

export function StockHistoryModal({ open, onOpenChange, product, history }: StockHistoryModalProps) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filteredHistory = useMemo(() => {
    if (filter === 'all') return history
    return history.filter(h => h.type === filter)
  }, [history, filter])

  // Calcular estadísticas
  const stats = useMemo(() => {
    const sales = history.filter(h => h.type === 'sale')
    const manualAdds = history.filter(h => h.type === 'manual_add')
    const manualRemoves = history.filter(h => h.type === 'manual_remove')
    const deactivations = history.filter(h => h.type === 'deactivation')

    const unitsSold = sales.reduce((sum, h) => sum + Math.abs(h.change), 0)
    const totalRevenue = sales.reduce((sum, h) => sum + (h.saleTotal || 0), 0)
    const unitsAdded = manualAdds.reduce((sum, h) => sum + h.change, 0)
    const unitsRemoved = manualRemoves.reduce((sum, h) => sum + Math.abs(h.change), 0)
    const unitsDeactivated = deactivations.reduce((sum, h) => sum + Math.abs(h.change), 0)
    
    // Stock histórico = stock actual + todo lo que salió
    const stockHistorico = (product?.stock || 0) + unitsSold + unitsRemoved + unitsDeactivated

    return {
      unitsSold,
      totalRevenue,
      adjustments: manualAdds.length + manualRemoves.length,
      currentStock: product?.stock || 0,
      stockHistorico,
      unitsDeactivated
    }
  }, [history, product])

  const formatDateShort = (date: Date) => {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  const getMovementIcon = (type: StockMovement['type']) => {
    switch (type) {
      case 'sale':
        return <ShoppingCart className="h-4 w-4" />
      case 'manual_add':
        return <PlusCircle className="h-4 w-4" />
      case 'manual_remove':
        return <MinusCircle className="h-4 w-4" />
      case 'deactivation':
        return <EyeOff className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const getMovementColor = (type: StockMovement['type']) => {
    switch (type) {
      case 'sale':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'manual_add':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'manual_remove':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'deactivation':
        return 'bg-rose-100 text-rose-700 border-rose-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getMovementLabel = (type: StockMovement['type']) => {
    switch (type) {
      case 'sale':
        return 'Venta'
      case 'manual_add':
        return 'Suma Inv.'
      case 'manual_remove':
        return 'Resta Inv.'
      case 'deactivation':
        return 'Sacado Stock'
      default:
        return 'Movimiento'
    }
  }

  const filterOptions: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'sale', label: 'Ventas' },
    { id: 'manual_add', label: 'Sumas' },
    { id: 'manual_remove', label: 'Restas' },
    { id: 'deactivation', label: 'Sacados' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[95vh] p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Archive className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm sm:text-base truncate">Historial de Movimientos</p>
              <p className="text-xs text-muted-foreground truncate">{product?.name}</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {/* Estadísticas */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-3 sm:p-4 bg-muted/30 border-b">
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <p className="text-lg sm:text-xl font-bold text-blue-600">{stats.unitsSold}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Unid. Vendidas</p>
          </div>
          <div className="text-center p-2 bg-emerald-50 rounded-lg">
            <p className="text-sm sm:text-lg font-bold text-emerald-600 truncate">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Ingresos</p>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded-lg">
            <p className="text-lg sm:text-xl font-bold text-amber-600">{stats.adjustments}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Ajustes</p>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <p className="text-lg sm:text-xl font-bold text-purple-600">{stats.currentStock}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Stock Actual</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-lg col-span-3 sm:col-span-1">
            <p className="text-lg sm:text-xl font-bold text-gray-600">{stats.stockHistorico}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Stock Histórico</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-1.5 sm:gap-2 p-3 sm:p-4 border-b overflow-x-auto">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          {filterOptions.map((opt) => (
            <Button
              key={opt.id}
              variant={filter === opt.id ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7 sm:h-8 px-2 sm:px-3 whitespace-nowrap"
              onClick={() => setFilter(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Lista de movimientos */}
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-muted-foreground">
            <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No hay movimientos registrados</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh] sm:max-h-[400px]">
            <div className="p-2 sm:p-4 space-y-2">
              {filteredHistory.map((movement) => (
                <div
                  key={movement.id}
                  className="rounded-lg border border-border bg-card p-2.5 sm:p-3 hover:bg-muted/30 transition-colors"
                >
                  {/* Fila principal */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Icono */}
                    <div className={cn(
                      "h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center border-2 shrink-0",
                      getMovementColor(movement.type)
                    )}>
                      {getMovementIcon(movement.type)}
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-xs sm:text-sm">
                          {formatDateShort(movement.date)}
                        </span>
                        <Badge variant="outline" className={cn("text-[10px] sm:text-xs px-1.5 py-0", getMovementColor(movement.type))}>
                          {getMovementLabel(movement.type)}
                        </Badge>
                      </div>
                      
                      {/* Detalles específicos por tipo */}
                      <div className="mt-1 space-y-0.5">
                        {movement.type === 'sale' && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 text-xs">
                            <span className="text-muted-foreground">
                              Venta #{movement.saleId?.slice(-6)}
                            </span>
                            {movement.sellerName && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <User className="h-3 w-3" />
                                {movement.sellerName}
                              </span>
                            )}
                            {movement.clientName && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Store className="h-3 w-3" />
                                {movement.clientName}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {movement.type === 'manual_add' && (
                          <span className="text-xs text-emerald-600 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Suma de inventario: +{movement.change} unid.
                          </span>
                        )}
                        
                        {movement.type === 'manual_remove' && (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            Resta de inventario: {movement.change} unid.
                          </span>
                        )}
                        
                        {movement.type === 'deactivation' && (
                          <span className="text-xs text-rose-600">
                            Sacado de stock: {Math.abs(movement.change)} unid.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cantidad y precio */}
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end text-sm sm:text-base font-bold">
                        {movement.change > 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600" />
                        )}
                        <span className={movement.change > 0 ? "text-emerald-600" : "text-rose-600"}>
                          {movement.change > 0 ? '+' : ''}{movement.change}
                        </span>
                      </div>
                      {movement.saleTotal && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(movement.saleTotal)}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {movement.previousStock} → {movement.newStock}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}