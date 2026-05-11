"use client";

import React, { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Client, Order, OrderStatus, City } from "@/lib/types";
import { CITIES } from "@/lib/types";
import {
  Calendar,
  User,
  Store,
  Filter,
  Clock,
  Box,
  Truck,
  CheckCircle,
  X,
} from "lucide-react";
import { statusConfig, statusFlow } from "@/lib/order-constants";

interface OrdersFiltersProps {
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (value: string) => void;
  filterDateTo: string;
  setFilterDateTo: (value: string) => void;
  filterClient: string;
  setFilterClient: (value: string) => void;
  filterSeller: string;
  setFilterSeller: (value: string) => void;
  filterCity: string;
  setFilterCity: (value: string) => void;
  filterTransportista?: string;
  setFilterTransportista?: (value: string) => void;
  clients: Client[];
  sellers: { id: string; name: string }[];
  transportistas?: { id: string; name: string }[];
  orders: Order[];
  cities?: string[];
}

export function OrdersFilters({
  filterStatus,
  setFilterStatus,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  filterClient,
  setFilterClient,
  filterSeller,
  setFilterSeller,
  filterCity,
  setFilterCity,
  filterTransportista,
  setFilterTransportista,
  clients,
  sellers,
  transportistas,
  orders,
  cities,
}: OrdersFiltersProps) {
  const cityList = cities || CITIES;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tmp, setTmp] = useState({
    dateFrom: filterDateFrom,
    dateTo: filterDateTo,
    client: filterClient,
    seller: filterSeller,
    city: filterCity,
    transportista: filterTransportista || "",
    status: filterStatus || "all",
  });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const order of orders) {
      counts[order.status] = (counts[order.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const getStatusCount = (status: string) => statusCounts[status] || 0;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterDateFrom) count++;
    if (filterDateTo) count++;
    if (filterClient) count++;
    if (filterSeller) count++;
    if (filterCity) count++;
    if (filterTransportista && filterTransportista !== "all-transportistas") count++;
    return count;
  }, [filterDateFrom, filterDateTo, filterClient, filterSeller, filterCity, filterTransportista]);

  const handleOpenModal = () => {
    setTmp({
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
      client: filterClient,
      seller: filterSeller,
      city: filterCity,
      transportista: filterTransportista || "",
      status: filterStatus || "all",
    });
    setMobileOpen(true);
  };

  const handleApply = () => {
    setFilterDateFrom(tmp.dateFrom);
    setFilterDateTo(tmp.dateTo);
    setFilterClient(tmp.client);
    setFilterSeller(tmp.seller);
    setFilterCity(tmp.city);
    setFilterStatus(tmp.status || "all");
    if (setFilterTransportista) {
      setFilterTransportista(tmp.transportista === "all-transportistas" ? "" : tmp.transportista);
    }
    setMobileOpen(false);
  };

  const handleClearTmp = () => {
    setTmp({
      dateFrom: "",
      dateTo: "",
      client: "",
      seller: "",
      city: "",
      transportista: "",
      status: "all",
    });
  };

  return (
    <div className="space-y-3">
      {/* Status: desktop tabs, mobile select */}
      <div>
        <div className="hidden sm:flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setFilterStatus("all")}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all whitespace-nowrap min-w-fit ${
                filterStatus === "all"
                  ? "border-gray-900 bg-gray-900 text-white shadow-lg"
                  : "bg-white border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
          >
            <Filter className="h-4 w-4" />
            <span className="font-semibold">{getStatusCount("all")}</span>
            <span className="text-sm opacity-90">Todos</span>
          </button>

          {statusFlow.filter((s) => s !== "completed").map((status) => {
            const count = getStatusCount(status);
            const config = statusConfig[status];
            const isActive = filterStatus === status;

            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all whitespace-nowrap min-w-fit ${
                    isActive
                      ? `${config.bgColor} ${config.borderColor} ${config.color} shadow-md ring-2 ring-offset-1`
                      : "bg-white border-gray-200 hover:border-gray-300"
                  }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                <span className={`font-semibold ${isActive ? config.color : "text-gray-900"}`}>
                  {count}
                </span>
                <span className={`text-sm ${isActive ? "opacity-90" : "text-gray-500"}`}>
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="block sm:hidden">
          <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v)}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {statusFlow.filter((s) => s !== "completed").map((s) => (
                <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile: "Filtros" button */}
      <div className="md:hidden">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 relative"
          onClick={handleOpenModal}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Desktop: filter grid */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 p-4 bg-gray-50/80 rounded-xl border border-gray-200">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Desde
          </label>
          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="bg-white"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Hasta
          </label>
          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="bg-white"
          />
        </div>

        {/* Cliente removed from desktop filters - use search field above */}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Ciudad
          </label>
          <Select
            value={filterCity || "all-cities"}
            onValueChange={(value) =>
              setFilterCity(value === "all-cities" ? "" : value)
            }
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Todas las ciudades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-cities">Todas las ciudades</SelectItem>
              {cityList.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5" />
            Vendedor
          </label>
          <Select
            value={filterSeller || "all-sellers"}
            onValueChange={(value) =>
              setFilterSeller(value === "all-sellers" ? "" : value)
            }
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Todos los vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-sellers">Todos los vendedores</SelectItem>
              {sellers.map((seller) => (
                <SelectItem key={seller.id} value={seller.id}>
                  {seller.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {transportistas && setFilterTransportista && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" />
              Transportista
            </label>
            <Select
              value={filterTransportista || "all-transportistas"}
              onValueChange={(value) =>
                setFilterTransportista(value === "all-transportistas" ? "" : value)
              }
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-transportistas">Todos</SelectItem>
                <SelectItem value="unassigned">Sin asignar</SelectItem>
                {transportistas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Mobile filter modal */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-sm max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* Desde */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Desde
              </Label>
              <Input
                type="date"
                value={tmp.dateFrom}
                onChange={(e) => setTmp((p) => ({ ...p, dateFrom: e.target.value }))}
                className="bg-white"
              />
            </div>

            {/* Hasta */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Hasta
              </Label>
              <Input
                type="date"
                value={tmp.dateTo}
                onChange={(e) => setTmp((p) => ({ ...p, dateTo: e.target.value }))}
                className="bg-white"
              />
            </div>

            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Cliente
              </Label>
              <Select
                value={tmp.client || "all-clients"}
                onValueChange={(value) =>
                  setTmp((p) => ({ ...p, client: value === "all-clients" ? "" : value }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ciudad */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" />
                Ciudad
              </Label>
              <Select
                value={tmp.city || "all-cities"}
                onValueChange={(value) =>
                  setTmp((p) => ({ ...p, city: value === "all-cities" ? "" : value }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Todas las ciudades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-cities">Todas las ciudades</SelectItem>
                  {CITIES.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vendedor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5" />
                Vendedor
              </Label>
              <Select
                value={tmp.seller || "all-sellers"}
                onValueChange={(value) =>
                  setTmp((p) => ({ ...p, seller: value === "all-sellers" ? "" : value }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Todos los vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-sellers">Todos los vendedores</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transportista */}
            {transportistas && setFilterTransportista && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  Transportista
                </Label>
                <Select
                  value={tmp.transportista || "all-transportistas"}
                  onValueChange={(value) =>
                    setTmp((p) => ({
                      ...p,
                      transportista: value === "all-transportistas" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-transportistas">Todos</SelectItem>
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                    {transportistas.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            </div>

            {/* Estado (móvil dentro del modal) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Estados
              </Label>
              <Select value={tmp.status || "all"} onValueChange={(v) => setTmp((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {statusFlow.filter((s) => s !== "completed").map((s) => (
                    <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="px-4 py-3 border-t border-gray-100 shrink-0 flex flex-row gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-gray-500"
              onClick={handleClearTmp}
            >
              Limpiar todos
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleApply}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
