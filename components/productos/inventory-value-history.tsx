'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TrendingUp, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateTime as formatDate } from '@/lib/utils/format'

interface InventorySnapshot {
  id: string
  date: Date
  totalValue: number
  productCount: number
}

interface InventoryValueHistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  history: InventorySnapshot[]
}

export function InventoryValueHistory({ open, onOpenChange, history }: InventoryValueHistoryProps) {
  // Calcular tendencia
  const getTrend = (current: number, previous: number) => {
    if (!previous) return 'neutral'
    const diff = current - previous
    if (diff > 0) return 'up'
    if (diff < 0) return 'down'
    return 'neutral'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Historial de Valor de Inventario
          </DialogTitle>
        </DialogHeader>

        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay registros de inventario</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground">Valor actual</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(history[history.length - 1]?.totalValue || 0)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted border border-border">
                <p className="text-sm text-muted-foreground">Productos</p>
                <p className="text-2xl font-bold text-foreground">
                  {history[history.length - 1]?.productCount || 0}
                </p>
              </div>
            </div>

            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-2">
                {[...history].reverse().map((snapshot, index, arr) => {
                  const prevSnapshot = arr[index + 1]
                  const trend = getTrend(snapshot.totalValue, prevSnapshot?.totalValue || 0)
                  
                  return (
                    <div
                      key={snapshot.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          trend === 'up' && "bg-green-500",
                          trend === 'down' && "bg-red-500",
                          trend === 'neutral' && "bg-gray-400"
                        )} />
                        <div>
                          <p className="font-medium text-foreground">
                            {formatCurrency(snapshot.totalValue)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {snapshot.productCount} productos
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">
                          {formatDate(snapshot.date)}
                        </Badge>
                        {prevSnapshot && (
                          <p className={cn(
                            "text-xs mt-1",
                            trend === 'up' && "text-green-600",
                            trend === 'down' && "text-red-600",
                            trend === 'neutral' && "text-muted-foreground"
                          )}>
                            {trend === 'up' ? '+' : ''}
                            {formatCurrency(snapshot.totalValue - prevSnapshot.totalValue)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}