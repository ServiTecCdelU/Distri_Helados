// components/ListaVentas.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import {
  Search,
  ShoppingBag,
  User,
  X,
  Calendar,
  Banknote,
  CreditCard,
  Sparkles,
  ArrowLeftRight,
  Receipt,
  Eye,
  Plus,
  Store,
  MapPin,
  Truck,
  Download,
  FileSpreadsheet,
  Filter,
  Tag,
  FileText,
} from "lucide-react";
import Link from "next/link";
import type { ListaVentasProps } from "../types";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils/format";
import { useMemo, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// ─── helpers ─────────────────────────────────────────────────────────────────

const payIcon = (pt: string, pm?: string) => {
  if (pt === "cash" && pm === "transferencia") return <ArrowLeftRight className="h-3.5 w-3.5" />;
  if (pt === "cash") return <Banknote className="h-3.5 w-3.5" />;
  if (pt === "credit") return <CreditCard className="h-3.5 w-3.5" />;
  if (pt === "mixed") return <Sparkles className="h-3.5 w-3.5" />;
  return null;
};

const payLabel = (pt: string, pm?: string) => {
  if (pt === "cash" && pm === "transferencia") return "Transferencia";
  if (pt === "cash") return "Efectivo";
  if (pt === "credit") return "Cta. Corriente";
  if (pt === "mixed") return "Mixto";
  return pt;
};

const payBadgeCls = (pt: string) => {
  if (pt === "cash") return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
  if (pt === "credit") return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
  if (pt === "mixed") return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
  return "";
};

const periodLabels: Record<string, string> = {
  all: "Todas",
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  year: "Este año",
  custom: "Personalizado",
};

const safeGetDate = (date: any): Date | null => {
  if (!date) return null;
  try {
    let d: Date;
    if (date?.toDate) d = date.toDate();
    else if (typeof date === "string") d = new Date(date);
    else if (typeof date === "number") d = new Date(date);
    else if (date instanceof Date) d = date;
    else if (date?.seconds) d = new Date(date.seconds * 1000);
    else return null;
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
};

const EMPTY_FILTROS = {
  searchQuery: "",
  paymentFilter: "all",
  invoiceFilter: "all",
  remitoFilter: "all",
  discountFilter: "all",
  periodFilter: "all",
  dateFrom: "",
  dateTo: "",
  clientId: "",
  sellerId: "",
  city: "",
  deliveryFilter: "all",
} as const;

// ─── componente principal ─────────────────────────────────────────────────────

export function ListaVentas({
  ventas,
  cargando,
  filtros,
  onCambiarFiltros,
  onVerDetalle,
  onEmitirDocumento,
  clients = [],
  sellers = [],
  isAdmin = false,
  totalCount: totalCountProp,
  currentPage: currentPageProp,
  onPageChange,
  pageSize: pageSizeProp,
  onPageSizeChange,
  onLoadAllForExport,
}: ListaVentasProps) {
  const {
    searchQuery, invoiceFilter, paymentFilter, periodFilter, dateFrom, dateTo,
    clientId, sellerId, city,
  } = filtros;
  const deliveryFilter = (filtros as any).deliveryFilter || "all";
  const remitoFilter = (filtros as any).remitoFilter || "all";
  const discountFilter = (filtros as any).discountFilter || "all";

  const fmt = formatCurrency;
  const fmtDate = formatDate;
  const fmtTime = formatTime;

  const uniqueCities = useMemo(() => {
    const cities = clients.map((c) => c.city).filter((c): c is string => !!c);
    return [...new Set(cities)].sort();
  }, [clients]);

  // ─── conteo de filtros activos ─────────────────────────────���───────────────
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (paymentFilter !== "all") n++;
    if (invoiceFilter !== "all") n++;
    if (remitoFilter !== "all") n++;
    if (discountFilter !== "all") n++;
    if (periodFilter !== "all") n++;
    if (dateFrom) n++;
    if (dateTo) n++;
    if (sellerId) n++;
    if (city) n++;
    if (deliveryFilter !== "all") n++;
    return n;
  }, [paymentFilter, invoiceFilter, remitoFilter, discountFilter, periodFilter, dateFrom, dateTo, sellerId, city, deliveryFilter]);

  const hayFiltrosActivos = !!(searchQuery || activeFilterCount > 0);

  // ─── paginación (server-side si hay props, fallback client-side) ─────────
  const serverPagination = totalCountProp !== undefined && onPageChange;
  const [localPageSize, setLocalPageSize] = useState(20);
  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const pageSize = serverPagination ? (pageSizeProp ?? 10) : localPageSize;
  const currentPage = serverPagination ? (currentPageProp ?? 1) : localCurrentPage;
  const setCurrentPage = serverPagination ? onPageChange! : setLocalCurrentPage;
  const setPageSize = serverPagination
    ? (n: number) => { onPageSizeChange?.(n); onPageChange!(1); }
    : (n: number) => { setLocalPageSize(n); setLocalCurrentPage(1); };
  const totalRecords = serverPagination ? totalCountProp! : ventas.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const ventasPaginadas = serverPagination
    ? ventas
    : ventas.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);

  // ─── modal filtros mobile ─────────────────────────────────────────────────
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  // estado temporal para el modal (se aplica al cerrar con "Aplicar")
  const [tmpFiltros, setTmpFiltros] = useState<typeof filtros>(filtros);
  const openFilterModal = () => { setTmpFiltros(filtros); setFilterModalOpen(true); };
  const applyFilters = () => { onCambiarFiltros(tmpFiltros as any); setFilterModalOpen(false); };
  const clearTmpFilters = () => setTmpFiltros({ ...EMPTY_FILTROS } as any);

  // ─── export Excel ─────────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState("all");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  const exportCSV = useCallback(async () => {
    let ventasToExport = serverPagination && onLoadAllForExport
      ? await onLoadAllForExport()
      : [...ventas];
    if (exportPeriod !== "all" && exportPeriod !== "custom") {
      const now = new Date();
      ventasToExport = ventasToExport.filter((v) => {
        const d = safeGetDate(v.createdAt);
        if (!d) return false;
        if (exportPeriod === "today") { const t = new Date(now); t.setHours(0,0,0,0); return d >= t; }
        if (exportPeriod === "week") { const w = new Date(now); w.setDate(w.getDate()-7); w.setHours(0,0,0,0); return d >= w; }
        if (exportPeriod === "month") return d >= new Date(now.getFullYear(), now.getMonth(), 1);
        if (exportPeriod === "year") return d >= new Date(now.getFullYear(), 0, 1);
        return true;
      });
    }
    if (exportFrom) { const f = new Date(exportFrom); f.setHours(0,0,0,0); ventasToExport = ventasToExport.filter(v => { const d = safeGetDate(v.createdAt); return d && d >= f; }); }
    if (exportTo) { const t = new Date(exportTo); t.setHours(23,59,59,999); ventasToExport = ventasToExport.filter(v => { const d = safeGetDate(v.createdAt); return d && d <= t; }); }

    const SEP = ";";
    const headers = ["Fecha","Hora","Cliente","CUIT","DNI","Email","Telefono","Direccion Cliente","Vendedor","Productos","Cant. Items","Subtotal","Descuento","Tipo Descuento","Total","Metodo de Pago","Monto Efectivo","Monto Cta. Cte.","Metodo Entrega","Direccion Entrega","Transportista"];
    const rows = ventasToExport.map((v: any) => {
      const d = safeGetDate(v.createdAt);
      const fecha = d ? `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()}` : "";
      const hora = d ? `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}` : "";
      const productos = v.items?.map((i: any) => `${i.name} x${i.quantity} ($${i.price})`).join(" | ") || "";
      const cantItems = v.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;
      const subtotal = v.discount ? v.total + (v.discountType === "percent" ? v.total * v.discount / (100 - v.discount) : v.discount) : v.total;
      const metodoPago = v.paymentType === "cash" ? (v.paymentMethod === "transferencia" ? "Transferencia" : "Efectivo") : v.paymentType === "credit" ? "Cta. Corriente" : "Mixto";
      const metodoEntrega = v.deliveryMethod === "delivery" ? "A domicilio" : v.deliveryMethod === "pickup" ? "Retira en local" : "";
      return [fecha,hora,v.clientName||"Consumidor Final",v.clientCuit||"",v.clientDni||"",v.clientEmail||"",v.clientPhone||"",v.clientAddress||"",v.sellerName||"",productos,cantItems,subtotal,v.discount||"",v.discountType||"",v.total,metodoPago,v.cashAmount||"",v.creditAmount||"",metodoEntrega,v.deliveryMethod==="pickup"?"":(v.deliveryAddress||""),v.transportistaName||v.transportistaId||""];
    });
    const csv = [headers.join(SEP), ...rows.map(r => r.map(c => `"${String(c??"").replace(/"/g,'""')}"`).join(SEP))].join("\n");
    const blob = new Blob(["\uFEFF"+"sep=;\n"+csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas_${exportPeriod === "custom" ? `${exportFrom||"inicio"}_a_${exportTo||"hoy"}` : exportPeriod}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }, [ventas, exportPeriod, exportFrom, exportTo]);

  if (cargando) return <DataTableSkeleton columns={5} rows={8} />;

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Historial de Ventas</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {ventas.length} {ventas.length === 1 ? "venta registrada" : "ventas registradas"}
            {periodFilter === "today" && " hoy"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setExportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </Button>
          <Button asChild className="gap-2 shadow-lg shadow-primary/20">
            <Link href="/ventas/nueva">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva Venta</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* ── BARRA DE FILTROS ─────────────────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-3 md:p-4">
          <div className="flex gap-2">
            {/* Búsqueda — siempre visible */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, vendedor o N°..."
                value={searchQuery}
                onChange={(e) => onCambiarFiltros({ searchQuery: e.target.value })}
                className="pl-10 h-10 bg-background"
              />
              {searchQuery && (
                <button onClick={() => onCambiarFiltros({ searchQuery: "" })} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Botón Filtros mobile */}
            <Button
              variant="outline"
              className="md:hidden h-10 gap-2 shrink-0 relative"
              onClick={openFilterModal}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Filtros inline — solo desktop */}
            <div className="hidden md:flex flex-wrap gap-2">
              <Select value={periodFilter} onValueChange={(v) => onCambiarFiltros({ periodFilter: v as any, ...(v !== "custom" ? { dateFrom: "", dateTo: "" } : {}) })}>
                <SelectTrigger className="h-10 w-[140px]">
                  <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                  <SelectItem value="year">Este año</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={paymentFilter} onValueChange={(v) => onCambiarFiltros({ paymentFilter: v as any })}>
                <SelectTrigger className="h-10 w-[150px]"><SelectValue placeholder="Método de pago" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Método de pago</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="credit">Cta. Corriente</SelectItem>
                  <SelectItem value="mixed">Mixto</SelectItem>
                </SelectContent>
              </Select>

              <Select value={invoiceFilter} onValueChange={(v) => onCambiarFiltros({ invoiceFilter: v as any })}>
                <SelectTrigger className="h-10 w-[130px]"><SelectValue placeholder="Boletas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Boletas</SelectItem>
                  <SelectItem value="emitted">Emitidas</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                </SelectContent>
              </Select>

              <Select value={remitoFilter} onValueChange={(v) => onCambiarFiltros({ remitoFilter: v } as any)}>
                <SelectTrigger className="h-10 w-[130px]"><SelectValue placeholder="Remitos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Remitos</SelectItem>
                  <SelectItem value="emitted">Emitidos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                </SelectContent>
              </Select>

              <Select value={discountFilter} onValueChange={(v) => onCambiarFiltros({ discountFilter: v } as any)}>
                <SelectTrigger className="h-10 w-[140px]">
                  <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Descuento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Descuento</SelectItem>
                  <SelectItem value="with">Con descuento</SelectItem>
                  <SelectItem value="without">Sin descuento</SelectItem>
                </SelectContent>
              </Select>

              <Select value={deliveryFilter} onValueChange={(v) => onCambiarFiltros({ deliveryFilter: v } as any)}>
                <SelectTrigger className="h-10 w-[155px]"><SelectValue placeholder="Entrega" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Método entrega</SelectItem>
                  <SelectItem value="delivery">A domicilio</SelectItem>
                  <SelectItem value="pickup">Retira en local</SelectItem>
                </SelectContent>
              </Select>

              {isAdmin && sellers.length > 0 && (
                <Select value={sellerId || "all-sellers"} onValueChange={(v) => onCambiarFiltros({ sellerId: v === "all-sellers" ? "" : v })}>
                  <SelectTrigger className="h-10 w-[150px]">
                    <Store className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-sellers">Vendedor</SelectItem>
                    {sellers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {uniqueCities.length > 0 && (
                <Select value={city || "all-cities"} onValueChange={(v) => onCambiarFiltros({ city: v === "all-cities" ? "" : v })}>
                  <SelectTrigger className="h-10 w-[140px]">
                    <MapPin className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Ciudad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-cities">Ciudad</SelectItem>
                    {uniqueCities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Rango personalizado desktop */}
          {periodFilter === "custom" && (
            <div className="hidden md:flex flex-wrap items-center gap-3 mt-3 p-3 bg-muted/30 rounded-xl border border-border/50">
              <span className="text-xs font-medium text-muted-foreground">Desde</span>
              <Input type="date" value={dateFrom} onChange={(e) => onCambiarFiltros({ dateFrom: e.target.value })} className="bg-background h-9 w-[160px]" />
              <span className="text-xs font-medium text-muted-foreground">Hasta</span>
              <Input type="date" value={dateTo} onChange={(e) => onCambiarFiltros({ dateTo: e.target.value })} className="bg-background h-9 w-[160px]" />
            </div>
          )}

          {/* Chips de filtros activos */}
          {hayFiltrosActivos && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Filtros activos:</span>
              {searchQuery && <FilterChip label={`"${searchQuery}"`} onRemove={() => onCambiarFiltros({ searchQuery: "" })} />}
              {periodFilter !== "all" && periodFilter !== "custom" && <FilterChip label={periodLabels[periodFilter]} onRemove={() => onCambiarFiltros({ periodFilter: "all", dateFrom: "", dateTo: "" })} />}
              {dateFrom && <FilterChip label={`Desde: ${dateFrom}`} onRemove={() => onCambiarFiltros({ dateFrom: "" })} />}
              {dateTo && <FilterChip label={`Hasta: ${dateTo}`} onRemove={() => onCambiarFiltros({ dateTo: "" })} />}
              {sellerId && <FilterChip label={sellers.find(s => s.id === sellerId)?.name || "Vendedor"} onRemove={() => onCambiarFiltros({ sellerId: "" })} />}
              {city && <FilterChip label={city} onRemove={() => onCambiarFiltros({ city: "" })} />}
              {paymentFilter !== "all" && <FilterChip label={payLabel(paymentFilter)} onRemove={() => onCambiarFiltros({ paymentFilter: "all" })} />}
              {invoiceFilter !== "all" && <FilterChip label={invoiceFilter === "emitted" ? "Boletas emitidas" : "Boletas pendientes"} onRemove={() => onCambiarFiltros({ invoiceFilter: "all" })} />}
              {remitoFilter !== "all" && <FilterChip label={remitoFilter === "emitted" ? "Remitos emitidos" : "Remitos pendientes"} onRemove={() => onCambiarFiltros({ remitoFilter: "all" } as any)} />}
              {discountFilter !== "all" && <FilterChip label={discountFilter === "with" ? "Con descuento" : "Sin descuento"} onRemove={() => onCambiarFiltros({ discountFilter: "all" } as any)} />}
              {deliveryFilter !== "all" && <FilterChip label={deliveryFilter === "delivery" ? "A domicilio" : "Retira en local"} onRemove={() => onCambiarFiltros({ deliveryFilter: "all" } as any)} />}
              <button onClick={() => onCambiarFiltros({ ...EMPTY_FILTROS } as any)} className="text-xs text-primary hover:underline">
                Limpiar todos
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── LISTA DE VENTAS ──────────────────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        {ventas.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No se encontraron ventas</h3>
            <p className="text-muted-foreground text-sm">Intenta ajustar los filtros o busca con otros términos</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {/* Header desktop */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted/50 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <span className="w-24 shrink-0">Nº Venta</span>
              <span className="flex-1">Cliente</span>
              <span className="w-28 shrink-0">Vendedor</span>
              <span className="w-32 shrink-0">Fecha</span>
              <span className="w-20 text-right shrink-0">Total</span>
              <span className="w-24 text-center shrink-0">Pago</span>
              <span className="w-8 shrink-0"></span>
            </div>

            {ventasPaginadas.map((venta, index) => (
              <div key={venta.id}>
                {/* Mobile */}
                <div className="flex md:hidden items-start justify-between p-3 gap-3">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{venta.saleNumber || `Venta ${ventas.length - index}`}</p>
                    <p className="text-xs text-muted-foreground">{venta.clientName || "Venta directa"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(venta.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground">{fmt(venta.total)}</p>
                    <Badge variant="outline" className={`text-[10px] mt-1 ${payBadgeCls(venta.paymentType)}`}>
                      {payLabel(venta.paymentType, (venta as any).paymentMethod)}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-7 mt-1 text-blue-600 px-2" onClick={() => onVerDetalle(venta)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Desktop */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors">
                  <span className="w-24 shrink-0 text-xs font-medium text-foreground truncate">{venta.saleNumber || `N° ${ventas.length - index}`}</span>
                  <span className="flex-1 text-xs text-foreground truncate">{venta.clientName || "Venta directa"}</span>
                  <span className="w-28 shrink-0 text-[11px] text-muted-foreground truncate">{venta.sellerName || '-'}</span>
                  <span className="w-32 shrink-0 text-[11px] text-muted-foreground">{fmtDate(venta.createdAt)} {fmtTime(venta.createdAt)}</span>
                  <span className="w-20 shrink-0 text-xs font-semibold text-foreground text-right">{fmt(venta.total)}</span>
                  <div className="w-24 shrink-0 flex justify-center">
                    <Badge variant="outline" className={`gap-1 px-1.5 py-0 text-[10px] ${payBadgeCls(venta.paymentType)}`}>
                      {payIcon(venta.paymentType, (venta as any).paymentMethod)}
                      {payLabel(venta.paymentType, (venta as any).paymentMethod)}
                    </Badge>
                  </div>
                  <div className="w-8 shrink-0 flex justify-center">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600" onClick={() => onVerDetalle(venta)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Paginación */}
      {totalRecords > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-2 pt-3 border-t border-border px-2">
          <p className="text-xs text-muted-foreground">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalRecords)} de {totalRecords}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Mostrar:</span>
              {[10, 20, 50, 100].map(n => (
                <button
                  key={n}
                  onClick={() => setPageSize(n)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${pageSize === n ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"}`}
                >{n}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Ant.</Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | string)[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                  acc.push(p); return acc;
                }, [])
                .map((p, i) => typeof p === "string"
                  ? <span key={`dot-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                  : <Button key={p} variant={p === currentPage ? "default" : "outline"} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setCurrentPage(p)}>{p}</Button>
                )}
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Sig.</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FILTROS MOBILE ─────────────────────────────────────────── */}
      <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-sm max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden sm:max-w-md">
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Filtros
              </DialogTitle>
              <button onClick={() => setFilterModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
            {/* Período */}
            <FilterSection icon={<Calendar className="h-4 w-4" />} label="Período">
              <div className="grid grid-cols-3 gap-2">
                {["all","today","week","month","year","custom"].map(v => (
                  <button key={v}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${(tmpFiltros as any).periodFilter === v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}
                    onClick={() => setTmpFiltros(f => ({ ...f, periodFilter: v as any, ...(v !== "custom" ? { dateFrom: "", dateTo: "" } : {}) }))}
                  >{periodLabels[v]}</button>
                ))}
              </div>
              {(tmpFiltros as any).periodFilter === "custom" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Desde</Label><Input type="date" value={(tmpFiltros as any).dateFrom} onChange={e => setTmpFiltros(f => ({ ...f, dateFrom: e.target.value }))} className="h-9 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Hasta</Label><Input type="date" value={(tmpFiltros as any).dateTo} onChange={e => setTmpFiltros(f => ({ ...f, dateTo: e.target.value }))} className="h-9 text-sm" /></div>
                </div>
              )}
            </FilterSection>

            {/* Pago */}
            <FilterSection icon={<Banknote className="h-4 w-4" />} label="Método de pago">
              <div className="grid grid-cols-2 gap-2">
                {[["all","Todos"],["cash","Efectivo"],["credit","Cta. Corriente"],["mixed","Mixto"]].map(([v, l]) => (
                  <OptionBtn key={v} active={(tmpFiltros as any).paymentFilter === v} onClick={() => setTmpFiltros(f => ({ ...f, paymentFilter: v as any }))}>{l}</OptionBtn>
                ))}
              </div>
            </FilterSection>

            {/* Boletas */}
            <FilterSection icon={<Receipt className="h-4 w-4" />} label="Boletas">
              <div className="grid grid-cols-3 gap-2">
                {[["all","Todas"],["emitted","Emitidas"],["pending","Pendientes"]].map(([v, l]) => (
                  <OptionBtn key={v} active={(tmpFiltros as any).invoiceFilter === v} onClick={() => setTmpFiltros(f => ({ ...f, invoiceFilter: v as any }))}>{l}</OptionBtn>
                ))}
              </div>
            </FilterSection>

            {/* Remitos */}
            <FilterSection icon={<Truck className="h-4 w-4" />} label="Remitos">
              <div className="grid grid-cols-3 gap-2">
                {[["all","Todos"],["emitted","Emitidos"],["pending","Pendientes"]].map(([v, l]) => (
                  <OptionBtn key={v} active={(tmpFiltros as any).remitoFilter === v} onClick={() => setTmpFiltros(f => ({ ...f, remitoFilter: v as any }))}>{l}</OptionBtn>
                ))}
              </div>
            </FilterSection>

            {/* Descuento */}
            <FilterSection icon={<Tag className="h-4 w-4" />} label="Descuento">
              <div className="grid grid-cols-3 gap-2">
                {[["all","Todos"],["with","Con descuento"],["without","Sin descuento"]].map(([v, l]) => (
                  <OptionBtn key={v} active={(tmpFiltros as any).discountFilter === v} onClick={() => setTmpFiltros(f => ({ ...f, discountFilter: v as any }))}>{l}</OptionBtn>
                ))}
              </div>
            </FilterSection>

            {/* Entrega */}
            <FilterSection icon={<MapPin className="h-4 w-4" />} label="Método de entrega">
              <div className="grid grid-cols-3 gap-2">
                {[["all","Todos"],["delivery","A domicilio"],["pickup","Retira en local"]].map(([v, l]) => (
                  <OptionBtn key={v} active={(tmpFiltros as any).deliveryFilter === v} onClick={() => setTmpFiltros(f => ({ ...f, deliveryFilter: v as any }))}>{l}</OptionBtn>
                ))}
              </div>
            </FilterSection>

            {/* Vendedor — solo admin */}
            {isAdmin && sellers.length > 0 && (
              <FilterSection icon={<Store className="h-4 w-4" />} label="Vendedor">
                <Select value={(tmpFiltros as any).sellerId || "all-sellers"} onValueChange={v => setTmpFiltros(f => ({ ...f, sellerId: v === "all-sellers" ? "" : v }))}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Todos los vendedores" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-sellers">Todos los vendedores</SelectItem>
                    {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterSection>
            )}

            {/* Ciudad */}
            {uniqueCities.length > 0 && (
              <FilterSection icon={<MapPin className="h-4 w-4" />} label="Ciudad">
                <Select value={(tmpFiltros as any).city || "all-cities"} onValueChange={v => setTmpFiltros(f => ({ ...f, city: v === "all-cities" ? "" : v }))}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Todas las ciudades" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-cities">Todas las ciudades</SelectItem>
                    {uniqueCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterSection>
            )}
          </div>

          <DialogFooter className="px-5 py-4 border-t shrink-0 flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={clearTmpFilters}>Limpiar</Button>
            <Button className="flex-1" onClick={applyFilters}>Aplicar filtros</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EXPORT EXCEL ─────────────────────────────────────────────────── */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Exportar ventas a Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={exportPeriod} onValueChange={v => { setExportPeriod(v); if (v !== "custom") { setExportFrom(""); setExportTo(""); } }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ventas</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                  <SelectItem value="year">Este año</SelectItem>
                  <SelectItem value="custom">Elegir fechas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {exportPeriod === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Desde</label><Input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Hasta</label><Input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} /></div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Se exportarán todas las columnas: N° venta, cliente, CUIT, vendedor, productos, pagos, factura, remito, entrega, transportista, etc.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Cancelar</Button>
            <Button onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" />Descargar CSV</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FAB mobile */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <Button asChild className="h-14 w-14 rounded-full shadow-xl" size="icon">
          <Link href="/ventas/nueva"><Plus className="h-6 w-6" /></Link>
        </Button>
      </div>
    </div>
  );
}

// ─── helpers de UI ─────────────────────────────────────────────���──────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="text-xs gap-1">
      {label}
      <button onClick={onRemove}><X className="h-3 w-3" /></button>
    </Badge>
  );
}

function FilterSection({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
        {icon}{label}
      </p>
      {children}
    </div>
  );
}

function OptionBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors text-center ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
