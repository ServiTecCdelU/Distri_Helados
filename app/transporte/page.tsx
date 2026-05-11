//app/transporte/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ordersApi, sellersApi } from "@/lib/api";
import type { Order, Seller } from "@/lib/types";
import {
  Truck,
  MapPin,
  Package,
  CheckCircle2,
  Circle,
  Search,
  User,
  X,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Route,
  CheckCheck,
  LayoutGrid,
  Hash,
  Navigation,
  ClipboardList,
  Printer,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { statusConfig } from "@/lib/order-constants";
import { cn } from "@/lib/utils";
import { RouteMapModal } from "@/components/pedidos/route-map-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { formatCurrency as formatPrice } from "@/lib/utils/format";

const calcTotal = (order: Order) =>
  order.items.reduce((s, i) => s + i.price * i.quantity, 0);

// ─────────────────────────────────────────────────────────────────────────────
// Transportista view: big mobile-friendly checklist card
// ─────────────────────────────────────────────────────────────────────────────
function TransportistaOrderCard({
  order,
  onCheckItem,
  onMarkDelivery,
  onAssignSelf,
  expanded,
  onToggle,
}: {
  order: Order;
  onCheckItem: (orderId: string, itemKey: string) => void;
  onMarkDelivery: (orderId: string) => void;
  onAssignSelf?: (orderId: string) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const checkedItems = order.checkedItems || [];
  const total = order.items.length;
  const checked = checkedItems.length;
  const allChecked = total > 0 && checked === total;
  const progress = total > 0 ? checked / total : 0;

  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden transition-all",
        allChecked
          ? "border-green-200 bg-green-50/40"
          : order.transportistaId
          ? "border-blue-200 bg-white"
          : "border-amber-200 bg-amber-50/30"
      )}
    >
      {/* Header - tap to expand */}
      <button
        className="w-full text-left p-4 flex items-start gap-3 active:bg-gray-100 transition-colors"
        onClick={onToggle}
      >
        {/* Progress circle */}
        <div className="relative h-14 w-14 flex-shrink-0">
          <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" strokeWidth="4" />
            <circle
              cx="28"
              cy="28"
              r="22"
              fill="none"
              stroke={allChecked ? "#22c55e" : "#3b82f6"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 138.2} 138.2`}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-gray-800 leading-none">{checked}</span>
            <span className="text-[10px] text-gray-400 leading-none">/{total}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900 text-base leading-tight truncate">
                {order.clientName || "Sin cliente"}
              </p>
              <div className="flex items-center gap-1 mt-0.5 text-sm text-gray-500">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">{order.address}</span>
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {allChecked ? (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0.5">
                <CheckCheck className="h-3 w-3 mr-1" />
                Completado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs px-2 py-0.5 text-gray-500">
                {total - checked} pendientes
              </Badge>
            )}
            {!order.transportistaId && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs px-2 py-0.5">
                Sin asignar
              </Badge>
            )}
            <span className="text-xs text-gray-500 font-medium ml-auto">
              {formatPrice(calcTotal(order))}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded: item checklist */}
      {expanded && (
        <div className="border-t border-gray-100">
          <div className="p-4 space-y-2">
            {order.items.map((item, idx) => {
              const key = String(idx);
              const isChecked = checkedItems.includes(key);
              return (
                <button
                  key={idx}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.99]",
                    isChecked
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200 active:bg-gray-100"
                  )}
                  onClick={() => onCheckItem(order.id, key)}
                >
                  <div className="flex-shrink-0">
                    {isChecked ? (
                      <CheckCircle2 className="h-7 w-7 text-green-500" />
                    ) : (
                      <Circle className="h-7 w-7 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p
                      className={cn(
                        "font-semibold text-base leading-tight",
                        isChecked ? "line-through text-gray-400" : "text-gray-800"
                      )}
                    >
                      {item.name}
                    </p>
                    {item.price > 0 && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    )}
                  </div>
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0",
                      isChecked ? "bg-green-200 text-green-700" : "bg-gray-200 text-gray-700"
                    )}
                  >
                    {item.quantity}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 pt-0 flex flex-col gap-2">
            {order.status !== "delivery" && order.status !== "completed" && (
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 h-12"
                onClick={() => onMarkDelivery(order.id)}
              >
                <Truck className="h-5 w-5" />
                Marcar "En Reparto"
              </Button>
            )}
            {!order.transportistaId && onAssignSelf && (
              <Button
                size="lg"
                className="w-full gap-2 h-12 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => onAssignSelf(order.id)}
              >
                <User className="h-5 w-5" />
                Tomar este pedido
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: "Armar Reparto" tab
// ─────────────────────────────────────────────────────────────────────────────
function ArmarRepartoTab({
  orders,
  transportistas,
  onAssign,
}: {
  orders: Order[];
  transportistas: Seller[];
  onAssign: (orderIds: string[], transportistaId: string, transportistaName: string) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTransportista, setSelectedTransportista] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState("");

  // Only unassigned delivery orders (exclude pickup)
  const unassigned = useMemo(
    () => orders.filter((o) => !o.transportistaId && o.deliveryMethod !== "pickup"),
    [orders]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return unassigned;
    const q = search.toLowerCase();
    return unassigned.filter(
      (o) =>
        o.clientName?.toLowerCase().includes(q) ||
        o.address?.toLowerCase().includes(q) ||
        o.city?.toLowerCase().includes(q)
    );
  }, [unassigned, search]);

  const cities = useMemo(() => {
    const set = new Set(unassigned.filter((o) => o.city).map((o) => o.city as string));
    return Array.from(set).sort();
  }, [unassigned]);

  const selectedTotal = useMemo(
    () =>
      filtered
        .filter((o) => selectedIds.has(o.id))
        .reduce((s, o) => s + calcTotal(o), 0),
    [filtered, selectedIds]
  );

  const toggleOrder = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectCity = (city: string) => {
    const cityOrders = filtered.filter((o) => o.city === city);
    const allSelected = cityOrders.every((o) => selectedIds.has(o.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        cityOrders.forEach((o) => next.delete(o.id));
      } else {
        cityOrders.forEach((o) => next.add(o.id));
      }
      return next;
    });
  };

  const selectFirst = (n: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.slice(0, n).forEach((o) => next.add(o.id));
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map((o) => o.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleAssign = async () => {
    if (!selectedTransportista || selectedIds.size === 0) return;
    const t = transportistas.find((t) => t.id === selectedTransportista);
    if (!t) return;
    setAssigning(true);
    try {
      await onAssign(Array.from(selectedIds), t.id, t.name);
      setSelectedIds(new Set());
      setSelectedTransportista("");
    } finally {
      setAssigning(false);
    }
  };

  // Group filtered orders by city
  const groupedByCityFiltered = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    filtered.forEach((o) => {
      const city = o.city || "Sin ciudad";
      if (!groups[city]) groups[city] = [];
      groups[city].push(o);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Sin ciudad") return 1;
      if (b === "Sin ciudad") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  if (unassigned.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCheck className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold mb-1">Todos los pedidos están asignados</p>
          <p className="text-gray-400 text-sm">No hay pedidos sin transportista.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-32">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente, dirección, ciudad..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Quick select pills */}
      <div className="space-y-2">
        {/* By city */}
        {cities.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Ciudad:
            </span>
            {cities.map((city) => {
              const cityOrders = filtered.filter((o) => o.city === city);
              const allSel = cityOrders.length > 0 && cityOrders.every((o) => selectedIds.has(o.id));
              const someSel = cityOrders.some((o) => selectedIds.has(o.id));
              return (
                <button
                  key={city}
                  onClick={() => selectCity(city)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                    allSel
                      ? "bg-primary text-primary-foreground border-primary"
                      : someSel
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "bg-background text-gray-600 border-gray-200 hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {city}
                  <span
                    className={cn(
                      "ml-1 inline-flex items-center justify-center h-4.5 w-4.5 rounded-full text-xs font-bold",
                      allSel ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {cityOrders.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Quick N select */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" />
              Primeros:
            </span>
            {[5, 10, 15, 20].filter((n) => n <= filtered.length).map((n) => (
              <button
                key={n}
                onClick={() => selectFirst(n)}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border border-gray-200 bg-background text-gray-600 hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                {n} pedidos
              </button>
            ))}
            <button
              onClick={selectAll}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border border-gray-200 bg-background text-gray-600 hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Todos ({filtered.length})
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={clearSelection}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-all"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Orders grouped by city */}
      <div className="space-y-6">
        {groupedByCityFiltered.map(([city, cityOrders]) => (
          <div key={city}>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{city}</h3>
              <Badge variant="secondary" className="text-xs">{cityOrders.length}</Badge>
            </div>
            <div className="space-y-2">
              {cityOrders.map((order) => {
                const isSelected = selectedIds.has(order.id);
                const cfg = statusConfig[order.status] || { label: order.status, bgColor: "bg-gray-50", borderColor: "border-gray-200", dotColor: "bg-gray-400", color: "text-gray-700" };
                return (
                  <button
                    key={order.id}
                    onClick={() => toggleOrder(order.id)}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-3 flex items-center gap-3 transition-all",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div
                      className={cn(
                        "h-6 w-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
                        isSelected ? "bg-primary border-primary" : "border-gray-300"
                      )}
                    >
                      {isSelected && <CheckCheck className="h-4 w-4 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate text-sm">
                          {order.clientName || "Sin cliente"}
                        </span>
                        <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cfg.bgColor, cfg.borderColor)}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dotColor)} />
                          <span className={cfg.color}>{cfg.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <span className="truncate">{order.address}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-700">{formatPrice(calcTotal(order))}</p>
                      <p className="text-xs text-gray-400">{order.items.length} items</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky bottom assignment bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-sm border-t border-border shadow-2xl">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">
                {selectedIds.size} pedido{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Total: {formatPrice(selectedTotal)}
              </p>
            </div>
            <Select value={selectedTransportista} onValueChange={setSelectedTransportista}>
              <SelectTrigger className="sm:w-52 bg-background">
                <SelectValue placeholder="Elegir transportista..." />
              </SelectTrigger>
              <SelectContent>
                {transportistas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssign}
              disabled={!selectedTransportista || assigning}
              className="gap-2 sm:w-auto"
              size="lg"
            >
              {assigning ? (
                <>Asignando...</>
              ) : (
                <>
                  <Truck className="h-4 w-4" />
                  Asignar reparto
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: "Repartos en Curso" tab
// ─────────────────────────────────────────────────────────────────────────────
function RepartosEnCursoTab({
  orders,
  transportistas,
  onUnassign,
}: {
  orders: Order[];
  transportistas: Seller[];
  onUnassign: (orderId: string) => Promise<void>;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const assignedOrders = useMemo(
    () => orders.filter((o) => o.transportistaId),
    [orders]
  );

  // Group by transportista
  const grouped = useMemo(() => {
    const groups: Record<string, { name: string; orders: Order[] }> = {};
    assignedOrders.forEach((o) => {
      const key = o.transportistaId!;
      if (!groups[key]) groups[key] = { name: o.transportistaName || key, orders: [] };
      groups[key].orders.push(o);
    });
    return Object.entries(groups)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .map(([id, data]) => ({ id, ...data }));
  }, [assignedOrders]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOrder = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (assignedOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Route className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">No hay repartos en curso</p>
          <p className="text-gray-400 text-sm">Asigná pedidos en la pestaña "Armar Reparto".</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(({ id, name, orders: groupOrders }) => {
        const isOpen = expandedGroups.has(id);
        const totalItems = groupOrders.reduce((s, o) => s + o.items.length, 0);
        const checkedItemsCount = groupOrders.reduce(
          (s, o) => s + (o.checkedItems?.length || 0),
          0
        );
        const completedOrders = groupOrders.filter(
          (o) => o.items.length > 0 && (o.checkedItems?.length || 0) === o.items.length
        ).length;
        const overallProgress = totalItems > 0 ? checkedItemsCount / totalItems : 0;
        const totalAmount = groupOrders.reduce((s, o) => s + calcTotal(o), 0);

        return (
          <Card key={id} className="overflow-hidden border-2 border-gray-100">
            {/* Transportista header */}
            <button
              className="w-full text-left p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              onClick={() => toggleGroup(id)}
            >
              {/* Avatar */}
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900 text-base">{name}</p>
                  <Badge variant="secondary" className="text-xs">
                    {groupOrders.length} pedido{groupOrders.length !== 1 ? "s" : ""}
                  </Badge>
                  {completedOrders === groupOrders.length && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                      <CheckCheck className="h-3 w-3 mr-1" />
                      Completado
                    </Badge>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        overallProgress === 1 ? "bg-green-500" : "bg-primary"
                      )}
                      style={{ width: `${overallProgress * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {checkedItemsCount}/{totalItems} ítems · {completedOrders}/{groupOrders.length} pedidos
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Total: {formatPrice(totalAmount)}
                </p>
              </div>

              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
              )}
            </button>

            {/* Expanded order list */}
            {isOpen && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {groupOrders.map((order) => {
                  const isOrderOpen = expandedOrders.has(order.id);
                  const checkedCount = order.checkedItems?.length || 0;
                  const orderTotal = order.items.length;
                  const allDone = orderTotal > 0 && checkedCount === orderTotal;
                  const cfg = statusConfig[order.status] || { label: order.status, bgColor: "bg-gray-50", borderColor: "border-gray-200", dotColor: "bg-gray-400", color: "text-gray-700" };

                  return (
                    <div key={order.id} className={cn(allDone && "bg-green-50/30")}>
                      <button
                        className="w-full text-left p-3 pl-5 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                        onClick={() => toggleOrder(order.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-800 text-sm truncate">
                              {order.clientName || "Sin cliente"}
                            </span>
                            <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cfg.bgColor, cfg.borderColor)}>
                              <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dotColor)} />
                              <span className={cfg.color}>{cfg.label}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{order.address}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn("text-xs font-medium", allDone ? "text-green-600" : "text-gray-500")}>
                            {checkedCount}/{orderTotal}
                          </span>
                          <div className="relative h-7 w-7">
                            <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
                              <circle cx="14" cy="14" r="10" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                              <circle
                                cx="14" cy="14" r="10" fill="none"
                                stroke={allDone ? "#22c55e" : "#3b82f6"}
                                strokeWidth="3"
                                strokeDasharray={`${(orderTotal > 0 ? checkedCount / orderTotal : 0) * 62.8} 62.8`}
                              />
                            </svg>
                          </div>
                          {isOrderOpen ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {isOrderOpen && (
                        <div className="bg-gray-50/50 px-5 pb-3 space-y-1.5">
                          {order.items.map((item, idx) => {
                            const isChecked = order.checkedItems?.includes(String(idx));
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  "flex items-center gap-3 py-1.5 text-sm",
                                  isChecked ? "text-gray-400 line-through" : "text-gray-700"
                                )}
                              >
                                {isChecked ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                ) : (
                                  <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                                )}
                                <span className="flex-1">{item.name}</span>
                                <span className="text-xs text-gray-500 font-medium">x{item.quantity}</span>
                              </div>
                            );
                          })}
                          <div className="pt-2 flex justify-end">
                            <button
                              onClick={() => onUnassign(order.id)}
                              className="text-xs text-red-500 hover:text-red-700 underline"
                            >
                              Quitar del reparto
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function TransportePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [cargoModalOpen, setCargoModalOpen] = useState(false);
  const [routeModalOpen, setRouteModalOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isTransportista =
    user?.employeeType === "transportista" || user?.employeeType === "ambos";

  const loadData = useCallback(async (isMounted?: () => boolean) => {
    try {
      const [ordersData, sellersData] = await Promise.all([
        ordersApi.getAll(),
        sellersApi.getAll(),
      ]);
      if (isMounted && !isMounted()) return;
      setOrders(
        ordersData.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
      setSellers(sellersData);
    } catch (err) {
      if (isMounted && !isMounted()) return;
      // Error silenciado
    } finally {
      if (isMounted && !isMounted()) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setMounted(true);
    loadData(() => active);
    return () => { active = false; };
  }, [loadData]);

  const transportistas = useMemo(
    () =>
      sellers.filter(
        (s) => s.employeeType === "transportista" || s.employeeType === "ambos"
      ),
    [sellers]
  );

  // Active orders (not pending, not completed)
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "completed" && o.status !== "pending"),
    [orders]
  );

  // For transportista: their orders + unassigned
  const transportistaOrders = useMemo(() => {
    if (isAdmin || !user?.sellerId) return [];
    return activeOrders.filter(
      (o) => o.transportistaId === user.sellerId || !o.transportistaId
    );
  }, [activeOrders, isAdmin, user]);

  // Grouping for transportista view (by city)
  const transportistaGrouped = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    transportistaOrders.forEach((o) => {
      const city = o.city || "Sin ciudad";
      if (!groups[city]) groups[city] = [];
      groups[city].push(o);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Sin ciudad") return 1;
      if (b === "Sin ciudad") return -1;
      return a.localeCompare(b);
    });
  }, [transportistaOrders]);

  const handleCheckItem = useCallback(
    async (orderId: string, itemKey: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      const current = order.checkedItems || [];
      const next = current.includes(itemKey)
        ? current.filter((k) => k !== itemKey)
        : [...current, itemKey];
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, checkedItems: next } : o))
      );
      try {
        await ordersApi.updateCheckedItems(orderId, next);
      } catch {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, checkedItems: current } : o))
        );
      }
    },
    [orders]
  );

  const handleMarkDelivery = useCallback(async (orderId: string) => {
    try {
      const updated = await ordersApi.updateStatus(orderId, "delivery");
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (err) {
      // Error silenciado
    }
  }, []);

  const handleAssignSelf = useCallback(
    async (orderId: string) => {
      if (!user?.sellerId || !user?.name) return;
      try {
        const updated = await ordersApi.assignTransportista(
          orderId,
          user.sellerId,
          user.name
        );
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      } catch (err) {
        // Error silenciado
      }
    },
    [user]
  );

  const handleBulkAssign = useCallback(
    async (orderIds: string[], transportistaId: string, transportistaName: string) => {
      const updates = await Promise.all(
        orderIds.map((id) =>
          ordersApi.assignTransportista(id, transportistaId, transportistaName)
        )
      );
      setOrders((prev) =>
        prev.map((o) => {
          const updated = updates.find((u) => u.id === o.id);
          return updated || o;
        })
      );
    },
    []
  );

  const handleUnassign = useCallback(async (orderId: string) => {
    try {
      const updated = await ordersApi.removeTransportista(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (err) {
      // Error silenciado
    }
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!mounted) {
    return (
      <MainLayout title="Transporte" description="Gestión de entregas">
        <DataTableSkeleton columns={3} rows={4} />
      </MainLayout>
    );
  }

  // ── Transportista view ──────────────────────────────────────────────────────
  if (!isAdmin) {
    const myOrders = transportistaOrders.filter((o) => o.transportistaId === user?.sellerId);
    const available = transportistaOrders.filter((o) => !o.transportistaId);
    const checkedAll = myOrders.reduce((s, o) => s + (o.checkedItems?.length || 0), 0);
    const totalItems = myOrders.reduce((s, o) => s + o.items.length, 0);

    const cargoList = (() => {
      const productMap = new Map<string, { name: string; quantity: number }>();
      myOrders.forEach(order => {
        order.items.forEach(item => {
          const existing = productMap.get(item.name);
          if (existing) existing.quantity += item.quantity;
          else productMap.set(item.name, { name: item.name, quantity: item.quantity });
        });
      });
      return Array.from(productMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    })();
    const myGrouped = (() => {
      const groups: Record<string, Order[]> = {};
      myOrders.forEach(o => {
        const city = o.city || "Sin ciudad";
        if (!groups[city]) groups[city] = [];
        groups[city].push(o);
      });
      return Object.entries(groups).sort(([a], [b]) => a === "Sin ciudad" ? 1 : b === "Sin ciudad" ? -1 : a.localeCompare(b));
    })();

    return (
      <MainLayout title="Mis Entregas" description="Pedidos asignados para entregar">
        {/* Personal stats bar */}
        {myOrders.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center gap-4">
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">
                {myOrders.length} pedido{myOrders.length !== 1 ? "s" : ""} asignado{myOrders.length !== 1 ? "s" : ""}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${totalItems > 0 ? (checkedAll / totalItems) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {checkedAll}/{totalItems} ítems
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!loading && myOrders.length > 0 && (
          <div className="flex gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setCargoModalOpen(true)}
            >
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Listado de Carga</span>
              <span className="sm:hidden">Carga</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setRouteModalOpen(true)}
              disabled={myOrders.filter(o => o.address && o.city).length === 0}
            >
              <Navigation className="h-4 w-4" />
              <span className="hidden sm:inline">Iniciar Recorrido</span>
              <span className="sm:hidden">Ruta</span>
            </Button>
          </div>
        )}

        {loading ? (
          <DataTableSkeleton columns={2} rows={3} />
        ) : transportistaOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium mb-1">No tenés pedidos asignados</p>
              <p className="text-gray-400 text-sm">Los pedidos disponibles aparecerán aquí.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* My orders grouped by city */}
            {myOrders.length > 0 && (
              <div className="space-y-6">
                {transportistaGrouped
                  .filter(([, groupOrders]) => groupOrders.some((o) => o.transportistaId === user?.sellerId))
                  .map(([city, groupOrders]) => {
                    const mine = groupOrders.filter((o) => o.transportistaId === user?.sellerId);
                    if (mine.length === 0) return null;
                    return (
                      <div key={city}>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="h-5 w-5 text-primary" />
                          <h2 className="font-bold text-gray-900 text-lg">{city}</h2>
                          <Badge variant="secondary">{mine.length}</Badge>
                        </div>
                        <div className="space-y-3">
                          {mine.map((order) => (
                            <TransportistaOrderCard
                              key={order.id}
                              order={order}
                              onCheckItem={handleCheckItem}
                              onMarkDelivery={handleMarkDelivery}
                              expanded={expandedIds.has(order.id)}
                              onToggle={() => toggleExpanded(order.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Available (unassigned) orders */}
            {available.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-5 w-5 text-amber-500" />
                  <h2 className="font-bold text-gray-900 text-lg">Disponibles para tomar</h2>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">{available.length}</Badge>
                </div>
                <div className="space-y-3">
                  {available.map((order) => (
                    <TransportistaOrderCard
                      key={order.id}
                      order={order}
                      onCheckItem={handleCheckItem}
                      onMarkDelivery={handleMarkDelivery}
                      onAssignSelf={handleAssignSelf}
                      expanded={expandedIds.has(order.id)}
                      onToggle={() => toggleExpanded(order.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <RouteMapModal
          open={routeModalOpen}
          onOpenChange={setRouteModalOpen}
          orders={myOrders}
        />

        {/* Cargo / Listado de Carga Modal */}
        <Dialog open={cargoModalOpen} onOpenChange={setCargoModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Listado de Carga</DialogTitle>
            </DialogHeader>
            <div>
              {/* Product table */}
              <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
                <div className="bg-gray-100 px-3 py-2 border-b border-gray-300">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Mercadería a Cargar</p>
                </div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 w-10">N°</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Producto</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600 w-20">Cant.</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-600 w-14">OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargoList.map((item, index) => (
                      <tr key={item.name} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="py-2 px-3 text-gray-400 text-xs">{index + 1}</td>
                        <td className="py-2 px-3 font-medium text-gray-900">{item.name}</td>
                        <td className="py-2 px-3 text-right font-bold text-base text-gray-900">{item.quantity}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-block w-4 h-4 border-2 border-gray-400 rounded-sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-100">
                      <td className="py-2 px-3" />
                      <td className="py-2 px-3 font-bold text-gray-700 text-xs uppercase">{cargoList.length} productos</td>
                      <td className="py-2 px-3 text-right font-black text-base text-gray-900">{cargoList.reduce((acc, i) => acc + i.quantity, 0)}</td>
                      <td className="py-2 px-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Route by city */}
              <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
                <div className="bg-gray-100 px-3 py-2 border-b border-gray-300">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Ruta de Entrega</p>
                </div>
                {myGrouped.map(([city, cityOrders]) => (
                  <div key={city}>
                    <div className="bg-gray-800 px-3 py-1.5 border-b border-gray-300">
                      <p className="text-xs font-bold text-white uppercase tracking-wide">{city} — {cityOrders.length} {cityOrders.length === 1 ? "entrega" : "entregas"}</p>
                    </div>
                    {cityOrders.map((order, idx) => (
                      <div key={order.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                        <div className="flex items-start gap-3 px-3 py-2">
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold mt-0.5">{idx + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="font-semibold text-gray-900 text-sm">{order.clientName || "Sin cliente"}</p>
                              <span className="inline-block w-4 h-4 border-2 border-gray-400 rounded-sm flex-shrink-0" />
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5">{order.address || "Sin dirección"}</p>
                            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
                              {order.items.map((item, i) => (
                                <span key={i} className="text-xs text-gray-700">
                                  <span className="font-bold text-gray-900">{item.quantity}</span>
                                  <span className="text-gray-400 mx-0.5">×</span>
                                  {item.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setCargoModalOpen(false)}>Cerrar</Button>
              <Button onClick={() => {
                const now = new Date();
                const dateStr = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(now);
                const remitoNum = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*9000)+1000)}`;
                const stampStr = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(now);
                const win = window.open("", "_blank");
                if (!win) return;
                let html = `<!DOCTYPE html><html><head><title>Listado de Carga</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;padding:24px;font-size:13px}table{width:100%;border-collapse:collapse}th,td{padding:7px 12px;border-bottom:1px solid #f3f4f6}th{font-size:11px;font-weight:600;color:#4b5563;background:#f9fafb;border-bottom:1px solid #e5e7eb}td.right{text-align:right}th.right{text-align:right}th.center,td.center{text-align:center}.checkbox{display:inline-block;width:14px;height:14px;border:2px solid #9ca3af;border-radius:2px}.city-header{background:#1f2937;color:white;padding:6px 12px;font-size:11px;font-weight:700;text-transform:uppercase}.section{border:1px solid #d1d5db;border-radius:8px;overflow:hidden;margin-bottom:16px}.section-title{background:#f3f4f6;padding:8px 12px;border-bottom:1px solid #d1d5db;font-size:10px;font-weight:700;text-transform:uppercase;color:#374151}.tfoot td{border-top:2px solid #d1d5db;background:#f3f4f6;font-weight:700}.stop{display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-bottom:1px solid #e5e7eb}.stop-num{flex-shrink:0;width:26px;height:26px;border-radius:50%;background:#1f2937;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}.footer{margin-top:16px;text-align:center;font-size:10px;color:#9ca3af}@media print{body{padding:16px}}</style></head><body>`;
                html += `<h2 style="margin-bottom:16px;font-size:18px">Listado de Carga — ${dateStr}</h2>`;
                html += `<div class="section"><div class="section-title">Mercadería</div><table><thead><tr><th style="width:40px">N°</th><th>Producto</th><th class="right" style="width:70px">Cant.</th><th class="center" style="width:50px">OK</th></tr></thead><tbody>`;
                cargoList.forEach((item, i) => {
                  html += `<tr style="${i%2?"background:#f9fafb":""}"><td style="color:#9ca3af;font-size:11px">${i+1}</td><td style="font-weight:500">${item.name}</td><td class="right" style="font-weight:700;font-size:15px">${item.quantity}</td><td class="center"><span class="checkbox"></span></td></tr>`;
                });
                html += `</tbody><tr class="tfoot"><td></td><td>${cargoList.length} productos</td><td class="right">${cargoList.reduce((a,i)=>a+i.quantity,0)}</td><td></td></tr></table></div>`;
                html += `<div class="section"><div class="section-title">Ruta de Entrega</div>`;
                myGrouped.forEach(([city, cityOrders]) => {
                  html += `<div class="city-header">${city} — ${cityOrders.length} entregas</div>`;
                  cityOrders.forEach((order, idx) => {
                    html += `<div class="stop"><div class="stop-num">${idx+1}</div><div style="flex:1"><div style="display:flex;justify-content:space-between"><strong>${order.clientName||"Sin cliente"}</strong><span class="checkbox"></span></div><div style="font-size:11px;color:#4b5563;margin-top:2px">${order.address||""}</div><div style="margin-top:4px;font-size:11px">${order.items.map(it=>`<strong>${it.quantity}</strong>×${it.name}`).join(" | ")}</div></div></div>`;
                  });
                });
                html += `</div><div class="footer">Generado el ${stampStr}</div></body></html>`;
                win.document.write(html);
                win.document.close();
                win.onload = () => { win.print(); };
              }} className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </MainLayout>
    );
  }

  // ── Admin view ──────────────────────────────────────────────────────────────
  const unassignedCount = activeOrders.filter((o) => !o.transportistaId).length;
  const assignedCount = activeOrders.filter((o) => o.transportistaId).length;

  return (
    <MainLayout
      title="Gestión de Transporte"
      description="Armá repartos y monitoreá las entregas"
    >
      {loading ? (
        <DataTableSkeleton columns={3} rows={4} />
      ) : activeOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium mb-1">No hay pedidos activos en transporte</p>
            <p className="text-gray-400 text-sm mb-4">
              Los pedidos en preparación y delivery aparecerán aquí.
            </p>
            <Button variant="outline" onClick={() => router.push("/pedidos")}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Ir a Pedidos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="armar">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="armar" className="flex items-center gap-2 flex-1 sm:flex-none">
                <LayoutGrid className="h-4 w-4" />
                Armar Reparto
                {unassignedCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs ml-1">
                    {unassignedCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="activos" className="flex items-center gap-2 flex-1 sm:flex-none">
                <Route className="h-4 w-4" />
                Repartos en Curso
                {assignedCount > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">{assignedCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="armar">
            <ArmarRepartoTab
              orders={activeOrders}
              transportistas={transportistas}
              onAssign={handleBulkAssign}
            />
          </TabsContent>

          <TabsContent value="activos">
            <RepartosEnCursoTab
              orders={activeOrders}
              transportistas={transportistas}
              onUnassign={handleUnassign}
            />
          </TabsContent>
        </Tabs>
      )}
    </MainLayout>
  );
}
