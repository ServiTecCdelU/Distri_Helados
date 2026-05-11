"use client";

import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Search,
  Shield,
  Loader2,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Banknote,
  Truck,
  DollarSign,
} from "lucide-react";
import { auditApi } from "@/lib/api";
import type { AuditEntry, AuditAction } from "@/lib/types";

const ACTION_META: Record<
  AuditAction,
  { label: string; color: string; icon: React.ElementType }
> = {
  sale_created: { label: "Venta", color: "bg-emerald-500", icon: ShoppingCart },
  sale_invoiced: { label: "Factura", color: "bg-blue-500", icon: FileText },
  product_created: { label: "Producto creado", color: "bg-violet-500", icon: Package },
  product_updated: { label: "Producto editado", color: "bg-amber-500", icon: Package },
  product_deleted: { label: "Producto eliminado", color: "bg-red-500", icon: Package },
  client_created: { label: "Cliente creado", color: "bg-cyan-500", icon: Users },
  client_updated: { label: "Cliente editado", color: "bg-amber-500", icon: Users },
  client_deleted: { label: "Cliente eliminado", color: "bg-red-500", icon: Users },
  order_created: { label: "Pedido creado", color: "bg-sky-500", icon: Truck },
  order_status_changed: { label: "Pedido actualizado", color: "bg-amber-500", icon: Truck },
  cash_register_opened: { label: "Caja abierta", color: "bg-emerald-500", icon: Banknote },
  cash_register_closed: { label: "Caja cerrada", color: "bg-red-500", icon: Banknote },
  payment_registered: { label: "Pago registrado", color: "bg-green-500", icon: DollarSign },
  price_list_updated: { label: "Lista precios", color: "bg-purple-500", icon: DollarSign },
};

import { formatDateTime } from "@/lib/utils/format";

export default function AuditoriaPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const data = await auditApi.getAll(200);
        if (!mounted) return;
        setEntries(data);
      } catch (error) {
        if (!mounted) return;
        // Error silenciado
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          e.description.toLowerCase().includes(s) ||
          e.userName.toLowerCase().includes(s) ||
          (e.entityId && e.entityId.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [entries, search, actionFilter]);

  const uniqueActions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))).sort(),
    [entries],
  );

  return (
    <MainLayout title="Auditoria" description="Registro de acciones del sistema">
      <div className="p-4 lg:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Auditoria
          </h1>
          <p className="text-muted-foreground text-sm">
            Registro de todas las acciones realizadas en el sistema
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descripcion, usuario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Todas las acciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {ACTION_META[action]?.label || action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">Sin registros</h3>
              <p className="text-muted-foreground text-sm">
                {entries.length === 0
                  ? "El log de auditoria se ira llenando a medida que se usen las funciones del sistema"
                  : "No hay registros que coincidan con el filtro"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filtered.map((entry) => {
                  const meta = ACTION_META[entry.action] || {
                    label: entry.action,
                    color: "bg-gray-500",
                    icon: Shield,
                  };
                  const Icon = meta.icon;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div
                        className={`h-8 w-8 rounded-full ${meta.color}/10 flex items-center justify-center shrink-0 mt-0.5`}
                      >
                        <Icon className={`h-4 w-4 ${meta.color.replace("bg-", "text-")}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">
                            {meta.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(entry.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">
                          por {entry.userName}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
