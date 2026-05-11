//components/pedidos/order-card.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice, formatDateTime as formatDate } from "@/lib/utils/format";
import type { Order } from "@/lib/types";
import { Eye, User, Box, CheckCircle, MapPin } from "lucide-react";
import { statusConfig, statusFlow } from "@/lib/order-constants"; //

const generateOrderNumber = (createdAt: Date | string, index: number) => {
  const date = new Date(createdAt);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const orderNum = (index + 1).toString().padStart(4, "0");
  return `${year}${month}${day}-${orderNum}`;
};

interface OrderCardProps {
  order: Order;
  index: number;
  totalOrders: number;
  variant: "table" | "card";
  onViewDetails: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function OrderCard({
  order,
  index,
  totalOrders,
  variant,
  onViewDetails,
  isSelected,
  onToggleSelect,
}: OrderCardProps) {
  const config = statusConfig[order.status] || {
    label: order.status || "Desconocido",
    color: "text-gray-700",
    dotColor: "bg-gray-500",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  };
  const isCompleted = order.status === "completed";
  const orderNumber = generateOrderNumber(
    order.createdAt,
    totalOrders - 1 - index,
  );

  if (variant === "table") {
    return (
      <tr className="hover:bg-muted/30 transition-colors">
        {onToggleSelect && (
          <td className="px-3 py-1.5 w-8 align-middle">
            <input type="checkbox" checked={!!isSelected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()} className="h-3.5 w-3.5 rounded border-gray-300 accent-teal-600 cursor-pointer" />
          </td>
        )}
        <td className="px-3 py-1.5 align-middle">
          <span className="font-mono text-xs font-medium">#{orderNumber}</span>
          <span className="text-[11px] text-muted-foreground ml-2">{formatDate(order.createdAt)}</span>
        </td>
        <td className="px-3 py-1.5 align-middle">
          <span className="text-xs font-medium">{order.clientName || <span className="text-muted-foreground italic">Directa</span>}</span>
        </td>
        <td className="px-3 py-1.5 align-middle">
          <span className="text-[11px] text-muted-foreground">{order.sellerName || '-'}</span>
        </td>
        <td className="px-3 py-1.5 align-middle">
          <span className="text-[11px] text-muted-foreground">{order.transportistaName || '-'}</span>
        </td>
        <td className="px-3 py-1.5 align-middle max-w-[200px]">
          <span className="text-[11px] text-muted-foreground truncate block">{order.address || 'Retiro en local'}</span>
        </td>
        <td className="px-3 py-1.5 align-middle">
          <span className="text-[11px] text-muted-foreground">{order.items.length} prod.</span>
        </td>
        <td className="px-3 py-1.5 align-middle">
          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${config.bgColor} border ${config.borderColor}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
            <span className={config.color}>{config.label}</span>
          </div>
        </td>
        <td className="px-3 py-1.5 text-right align-middle">
          <Button variant="ghost" size="icon" onClick={onViewDetails} className="h-6 w-6 text-blue-600">
            <Eye className="h-3 w-3" />
          </Button>
        </td>
      </tr>
    );
  }

  // Mobile compact card (vertical layout restored)
  return (
    <Card className="overflow-hidden border-gray-200 hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        {/* Top: code and date */}
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 font-mono text-sm truncate">#{orderNumber}</p>
            <div className="text-xs text-gray-500">{formatDate(order.createdAt)}</div>
          </div>
          <div className="text-right text-sm text-gray-700">{order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}</div>
        </div>

        {/* Middle: 2x2 grid for Cliente | Vendedor / Transportista | Dirección */}
        <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
          <div>
            <div className="text-xs text-gray-500 uppercase">Cliente</div>
            <div className="font-medium truncate">{order.clientName || 'Venta directa'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Vendedor</div>
            <div className="truncate">{order.sellerName || 'Sin vendedor'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Transportista</div>
            <div className="truncate">{order.transportistaName || 'Sin asignar'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Dirección</div>
            <div className="truncate">{order.address || '-'}</div>
          </div>
        </div>

        {/* Footer: status chip and actions */}
        <div className="flex items-center justify-between mt-3">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bgColor} border ${config.borderColor}`}>
            <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
            <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onViewDetails} className="text-blue-600">Ver detalles</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
