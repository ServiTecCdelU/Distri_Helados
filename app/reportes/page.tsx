"use client";

import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Download,
  FileSpreadsheet,
  Calendar,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Banknote,
  Users,
  Loader2,
} from "lucide-react";
import { salesApi, sellersApi } from "@/lib/api";
import type { Sale, Seller } from "@/lib/types";
import { toDate } from "@/services/firestore-helpers";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";

export default function ReportesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // primer dia del mes
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [sellerFilter, setSellerFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  useEffect(() => {
    let mounted = true;
    const doLoad = async () => {
      try {
        const [salesData, sellersData] = await Promise.all([
          salesApi.getAll(),
          sellersApi.getAll(),
        ]);
        if (!mounted) return;
        setSales(salesData);
        setSellers(sellersData);
      } catch (error) {
        if (!mounted) return;
        // Error silenciado
      } finally {
        if (mounted) setLoading(false);
      }
    };
    doLoad();
    return () => { mounted = false; };
  }, []);

  const filteredSales = useMemo(() => {
    const from = new Date(dateFrom + "T00:00:00");
    const to = new Date(dateTo + "T23:59:59");

    return sales.filter((sale) => {
      const saleDate = toDate(sale.createdAt);
      if (saleDate < from || saleDate > to) return false;
      if (sellerFilter !== "all" && sale.sellerId !== sellerFilter) return false;
      if (paymentFilter !== "all" && sale.paymentType !== paymentFilter)
        return false;
      return true;
    });
  }, [sales, dateFrom, dateTo, sellerFilter, paymentFilter]);

  const stats = useMemo(() => {
    const total = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const cashTotal = filteredSales
      .filter((s) => s.paymentType === "cash")
      .reduce((sum, s) => sum + (s.total || 0), 0);
    const creditTotal = filteredSales
      .filter((s) => s.paymentType === "credit")
      .reduce((sum, s) => sum + (s.total || 0), 0);
    const mixedTotal = filteredSales
      .filter((s) => s.paymentType === "mixed")
      .reduce((sum, s) => sum + (s.total || 0), 0);
    const avgTicket = filteredSales.length > 0 ? total / filteredSales.length : 0;

    // Top products
    const productCount: Record<string, { name: string; qty: number; revenue: number }> = {};
    filteredSales.forEach((sale) => {
      sale.items?.forEach((item) => {
        if (!productCount[item.productId]) {
          productCount[item.productId] = { name: item.name, qty: 0, revenue: 0 };
        }
        productCount[item.productId].qty += item.quantity;
        productCount[item.productId].revenue += item.price * item.quantity;
      });
    });
    const topProducts = Object.values(productCount)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // By seller
    const bySeller: Record<string, { name: string; count: number; total: number }> = {};
    filteredSales.forEach((sale) => {
      const key = sale.sellerId || "sin-vendedor";
      if (!bySeller[key]) {
        bySeller[key] = { name: sale.sellerName || "Sin vendedor", count: 0, total: 0 };
      }
      bySeller[key].count++;
      bySeller[key].total += sale.total || 0;
    });
    const sellerStats = Object.values(bySeller).sort((a, b) => b.total - a.total);

    return { total, cashTotal, creditTotal, mixedTotal, avgTicket, topProducts, sellerStats };
  }, [filteredSales]);

  const exportCSV = () => {
    const headers = [
      "Fecha",
      "N Venta",
      "Cliente",
      "Vendedor",
      "Productos",
      "Cantidad Items",
      "Pago",
      "Total",
    ];
    const rows = filteredSales.map((sale) => [
      formatDateTime(toDate(sale.createdAt)),
      sale.saleNumber || sale.id.slice(0, 8),
      sale.clientName || "Consumidor Final",
      sale.sellerName || "-",
      sale.items?.map((i) => `${i.name} x${i.quantity}`).join(" | ") || "-",
      sale.items?.reduce((sum, i) => sum + i.quantity, 0) || 0,
      sale.paymentType === "cash"
        ? ((sale as any).paymentMethod === "transferencia" ? "Transferencia" : "Efectivo")
        : sale.paymentType === "credit"
          ? "Cta. Cte."
          : "Mixto",
      sale.total || 0,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-ventas-${dateFrom}-a-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout title="Reportes" description="Analisis de ventas y exportacion">
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Reportes</h1>
            <p className="text-muted-foreground text-sm">
              Analisis de ventas por periodo
            </p>
          </div>
          <Button onClick={exportCSV} disabled={filteredSales.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Desde
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Hasta
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Vendedor
                </label>
                <Select value={sellerFilter} onValueChange={setSellerFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sellers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Medio de pago
                </label>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="credit">Cta. Corriente</SelectItem>
                    <SelectItem value="mixed">Mixto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">
                      Total ventas
                    </span>
                  </div>
                  <p className="text-xl font-bold">
                    {formatCurrency(stats.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {filteredSales.length} ventas
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">
                      Contado
                    </span>
                  </div>
                  <p className="text-xl font-bold">
                    {formatCurrency(stats.cashTotal)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">
                      Cta. Corriente
                    </span>
                  </div>
                  <p className="text-xl font-bold">
                    {formatCurrency(stats.creditTotal)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">
                      Ticket promedio
                    </span>
                  </div>
                  <p className="text-xl font-bold">
                    {formatCurrency(stats.avgTicket)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="h-4 w-4 text-orange-500" />
                    <span className="text-xs text-muted-foreground">
                      Mixto
                    </span>
                  </div>
                  <p className="text-xl font-bold">
                    {formatCurrency(stats.mixedTotal)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Productos mas vendidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.topProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Sin datos en el periodo
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {stats.topProducts.map((product, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-5">
                              #{i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium">
                                {product.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {product.qty} unidades
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold">
                            {formatCurrency(product.revenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* By Seller */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Ventas por vendedor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.sellerStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Sin datos en el periodo
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {stats.sellerStats.map((seller, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">
                                {seller.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {seller.count} ventas
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold">
                            {formatCurrency(seller.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sales Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Detalle de ventas ({filteredSales.length})</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportCSV}
                    disabled={filteredSales.length === 0}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    CSV
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-muted-foreground">
                          Fecha
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground">
                          Cliente
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground hidden sm:table-cell">
                          Vendedor
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground">
                          Pago
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.slice(0, 50).map((sale) => (
                        <tr key={sale.id} className="border-b border-border/50">
                          <td className="py-2 text-xs">
                            {formatDate(toDate(sale.createdAt))}
                          </td>
                          <td className="py-2 truncate max-w-[120px]">
                            {sale.clientName || "Cons. Final"}
                          </td>
                          <td className="py-2 hidden sm:table-cell text-muted-foreground">
                            {sale.sellerName || "-"}
                          </td>
                          <td className="py-2">
                            <Badge
                              variant={
                                sale.paymentType === "cash"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {sale.paymentType === "cash"
                                ? ((sale as any).paymentMethod === "transferencia" ? "Transferencia" : "Efectivo")
                                : sale.paymentType === "credit"
                                  ? "Cta.Cte."
                                  : "Mixto"}
                            </Badge>
                          </td>
                          <td className="py-2 text-right font-medium">
                            {formatCurrency(sale.total || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredSales.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      Mostrando 50 de {filteredSales.length} ventas. Exporta el
                      CSV para ver todas.
                    </p>
                  )}
                  {filteredSales.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No hay ventas en el periodo seleccionado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
