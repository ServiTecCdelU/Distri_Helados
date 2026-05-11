'use client'

import { useEffect, useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTableSkeleton } from '@/components/ui/data-table-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getCommissionsBySeller } from '@/services/commissions-service'
import { useAuth } from '@/hooks/use-auth'
import type { SellerCommission } from '@/lib/types'
import { formatCurrency as formatPrice, formatDate } from '@/lib/utils/format'
import { TrendingUp, Clock, CheckCircle2, DollarSign } from 'lucide-react'

export default function ComisionesPage() {
  const { user } = useAuth()
  const [commissions, setCommissions] = useState<SellerCommission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const loadCommissions = async () => {
      if (!user?.sellerId) {
        if (mounted) setLoading(false)
        return
      }
      try {
        const data = await getCommissionsBySeller(user.sellerId)
        if (!mounted) return
        setCommissions(data)
      } catch {
        // silenciado
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadCommissions()
    return () => { mounted = false }
  }, [user?.sellerId])

  const total = commissions.reduce((acc, c) => acc + c.commissionAmount, 0)
  const pendingTotal = commissions.filter((c) => !c.isPaid).reduce((acc, c) => acc + c.commissionAmount, 0)
  const paidTotal = commissions.filter((c) => c.isPaid).reduce((acc, c) => acc + c.commissionAmount, 0)
  const pendingCount = commissions.filter((c) => !c.isPaid).length
  const avgRate = commissions.length > 0
    ? (commissions.reduce((acc, c) => acc + c.commissionRate, 0) / commissions.length).toFixed(0)
    : null

  return (
    <MainLayout title="Mis Comisiones" description="Resumen y detalle de tus comisiones">
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="h-7 w-20" /></CardContent>
              </Card>
            ))}
          </div>
          <DataTableSkeleton columns={6} rows={6} />
        </div>
      ) : (
        <>
          {/* ── Tarjetas resumen ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">Total acumulado</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <div className="text-xl font-bold truncate">{formatPrice(total)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{commissions.length} ventas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">Pendiente</CardTitle>
                <Clock className="h-4 w-4 text-orange-500 shrink-0" />
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <div className="text-xl font-bold text-orange-500 truncate">{formatPrice(pendingTotal)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{pendingCount} pendientes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">Ya cobrado</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <div className="text-xl font-bold text-green-600 truncate">{formatPrice(paidTotal)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{commissions.length - pendingCount} cobradas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">Tasa promedio</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <div className="text-xl font-bold">{avgRate ? `${avgRate}%` : '—'}</div>
                <p className="text-xs text-muted-foreground mt-0.5">por venta</p>
              </CardContent>
            </Card>
          </div>

          {commissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay comisiones registradas
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Vista mobile: cards ── */}
              <div className="flex flex-col gap-3 md:hidden">
                {commissions.map((c) => (
                  <Card key={c.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Cabecera de la card */}
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                        <div>
                          <p className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</p>
                          <p className="font-semibold text-sm mt-0.5 truncate max-w-[180px]">
                            {c.clientName || 'Sin cliente'}
                          </p>
                        </div>
                        {c.isPaid ? (
                          <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs shrink-0">Cobrada</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-orange-600 bg-orange-50 text-xs shrink-0">Pendiente</Badge>
                        )}
                      </div>
                      {/* Detalle */}
                      <div className="grid grid-cols-3 divide-x px-0">
                        <div className="px-4 py-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Venta</p>
                          <p className="text-sm font-medium">{formatPrice(c.saleTotal)}</p>
                          {c.saleNumber && (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">#{c.saleNumber}</p>
                          )}
                        </div>
                        <div className="px-4 py-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Tasa</p>
                          <Badge variant="outline" className="text-xs">{c.commissionRate}%</Badge>
                        </div>
                        <div className="px-4 py-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Comisión</p>
                          <p className="text-sm font-bold text-green-600">{formatPrice(c.commissionAmount)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* ── Vista desktop: tabla ── */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>N° Venta</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Total Venta</TableHead>
                        <TableHead className="text-center">Tasa</TableHead>
                        <TableHead className="text-right">Comisión</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissions.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm whitespace-nowrap">{formatDate(c.createdAt)}</TableCell>
                          <TableCell className="text-sm">
                            {c.saleNumber ? (
                              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">#{c.saleNumber}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-[160px] truncate">
                            {c.clientName || <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatPrice(c.saleTotal)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{c.commissionRate}%</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {formatPrice(c.commissionAmount)}
                          </TableCell>
                          <TableCell className="text-center">
                            {c.isPaid ? (
                              <Badge className="bg-green-500 hover:bg-green-600 text-white">Cobrada</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-orange-600 bg-orange-50">Pendiente</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </MainLayout>
  )
}
