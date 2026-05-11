"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils/format";
import type { Order, OrderStatus, Seller } from "@/lib/types";
import {
  X,
  User,
  MapPin,
  Calendar,
  Box,
  CheckCircle,
  ChevronRight,
  ArrowRight,
  Clock,
  Truck,
  FileText,
  Download,
  Send,
  Loader2,
  UserCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { statusConfig, statusFlow } from "@/lib/order-constants";
import { descargarDocumento, enviarWhatsapp } from "@/lib/utils/doc-actions";
import { toast } from "sonner";

const generateOrderNumber = (createdAt: Date | string) => {
  const date = new Date(createdAt);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
};

const formatDateFull = (date: Date | string) => {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

const formatDateShort = (date: Date | string) => {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

const calculateOrderTotal = (order: Order) => {
  const itemsTotal = order.items.reduce((acc, item) => {
    const base = item.price * item.quantity;
    const dto = item.itemDiscount ? (base * item.itemDiscount) / 100 : 0;
    return acc + base - dto;
  }, 0);
  if (order.discount && order.discount > 0) {
    const discountAmt = order.discountType === "percent"
      ? (itemsTotal * order.discount) / 100
      : order.discount;
    return Math.max(0, itemsTotal - discountAmt);
  }
  return itemsTotal;
};

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  onGenerateRemito?: (order: Order) => Promise<void>;
  onGenerateInvoice?: (order: Order) => Promise<void>;
  onAssignTransportista?: (orderId: string, transportistaId: string, transportistaName: string) => void;
  onRemoveTransportista?: (orderId: string) => void;
  sellers?: Seller[];
  generatingDoc?: boolean;
  userRole?: string;
}

export function OrderDetailModal({
  isOpen,
  onClose,
  order,
  onStatusChange,
  onGenerateRemito,
  onGenerateInvoice,
  onAssignTransportista,
  onRemoveTransportista,
  sellers = [],
  userRole,
}: OrderDetailModalProps) {
  const router = useRouter();
  const [selectedTransportista, setSelectedTransportista] = useState<string>("");
  const [showTransportistaSelect, setShowTransportistaSelect] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [downloading, setDownloading] = useState<"invoice" | "remito" | null>(null);

  if (!order) return null;

  const config = statusConfig[order.status] || {
    label: order.status || "Desconocido",
    color: "text-gray-700",
    dotColor: "bg-gray-500",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  };

  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex < statusFlow.length - 1) return statusFlow[currentIndex + 1];
    return null;
  };

  const nextStatus = getNextStatus(order.status);
  const transportistas = sellers.filter(
    (s) => s.employeeType === "transportista" || s.employeeType === "ambos"
  );

  const handleAssign = () => {
    if (!selectedTransportista || !onAssignTransportista) return;
    const t = transportistas.find((s) => s.id === selectedTransportista);
    if (t) {
      onAssignTransportista(order.id, t.id, t.name);
      setShowTransportistaSelect(false);
      setSelectedTransportista("");
    }
  };

  const handleDescargar = (type: "invoice" | "remito") => {
    setDownloading(type);
    const base64 = type === "invoice" ? order.invoicePdfBase64 : order.remitoPdfBase64;
    const tipo = type === "invoice" ? "boleta" as const : "remito" as const;
    const numero = type === "invoice" ? order.invoiceNumber : order.remitoNumber;
    descargarDocumento(base64, tipo, numero, order.clientName);
    setDownloading(null);
  };

  const handleWhatsapp = async (type: "invoice" | "remito") => {
    const base64 = type === "invoice" ? order.invoicePdfBase64 : order.remitoPdfBase64;
    const tipo = type === "invoice" ? "boleta" as const : "remito" as const;
    const numero = type === "invoice" ? order.invoiceNumber : order.remitoNumber;
    await enviarWhatsapp(base64, tipo, numero, order.clientName);
  };

  const handleGenerarRemito = async () => {
    if (!onGenerateRemito) return;
    setGenerando(true);
    try {
      await onGenerateRemito(order);
    } finally {
      setGenerando(false);
    }
  };

  const handleGenerarFactura = async () => {
    if (!onGenerateInvoice) return;
    setGenerando(true);
    try {
      await onGenerateInvoice(order);
    } finally {
      setGenerando(false);
    }
  };

  const hasRemito = !!order.remitoNumber;
  const hasInvoice = !!order.invoiceNumber;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl w-[calc(100vw-1rem)] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base sm:text-xl min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 truncate">
                <span className="font-mono truncate">#{generateOrderNumber(order.createdAt)}</span>
                <span className="text-xs text-gray-500 mt-1 sm:mt-0">{formatDateShort(order.createdAt)}</span>
              </div>
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

            {/* Info en grid compacto: 4 columnas en desktop, 2 en sm, 1 en xs. Menos espacio vertical */}
            <div className="w-full bg-transparent">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {/* Row 1: Cliente | Vendedor */}
                <div className="flex flex-col">
                  <div className="text-xs text-gray-500 uppercase">Cliente</div>
                  <div className="font-semibold whitespace-normal sm:truncate">{order.clientName || 'Venta directa'}</div>
                </div>
                <div className="flex flex-col">
                  <div className="text-xs text-gray-500 uppercase">Vendedor</div>
                  <div className="whitespace-normal sm:truncate">{order.sellerName || 'Sin vendedor'}</div>
                </div>

                {/* Row 2: Transportista | Dirección */}
                <div className="flex flex-col">
                  <div className="text-xs text-gray-500 uppercase">Transportista</div>
                  <div className="whitespace-normal sm:truncate">{order.transportistaName || 'Sin asignar'}</div>
                </div>
                <div className="flex flex-col">
                  <div className="text-xs text-gray-500 uppercase">Dirección</div>
                  <div className="break-words sm:truncate">{order.address || '-'}</div>
                </div>
              </div>

            {/* transportista assignment handled elsewhere; controls removed per request */}
            </div>

            {/* Productos: mostrar como tabla compacta */}
            <div>
              <Label className="text-xs text-gray-500 uppercase flex items-center gap-1.5 mb-3">
                <Box className="h-3.5 w-3.5" />
                Productos ({order.items.length})
              </Label>
            <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
              {/* Desktop / tablet: tabla */}
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 bg-gray-100">
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-right">Cant.</th>
                      <th className="p-2 text-right">Precio</th>
                      <th className="p-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => {
                      const dto = item.itemDiscount ?? 0;
                      const precioConDto = item.price * (1 - dto / 100);
                      const subtotal = precioConDto * item.quantity;
                      return (
                        <tr key={index} className="border-b last:border-0">
                          <td className="p-2 max-w-[320px] truncate">{item.name}</td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2 text-right">{formatPrice(precioConDto)}</td>
                          <td className="p-2 text-right font-semibold">{formatPrice(subtotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Subtotales y descuentos (desktop) */}
                {(() => {
                  const subtotalBruto = order.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
                  const subtotalConItemDtos = order.items.reduce((acc, i) => {
                    const base = i.price * i.quantity;
                    const dto = i.itemDiscount ? (base * i.itemDiscount) / 100 : 0;
                    return acc + base - dto;
                  }, 0);
                  const hayItemDtos = subtotalBruto > subtotalConItemDtos;
                  const generalDiscount = (order as any).discount ?? 0;
                  const generalDiscountType = (order as any).discountType;
                  const generalDiscountAmt = generalDiscount > 0
                    ? (generalDiscountType === "percent" ? (subtotalConItemDtos * generalDiscount) / 100 : generalDiscount)
                    : 0;
                  const total = Math.max(0, subtotalConItemDtos - generalDiscountAmt);
                  return (
                    <div className="py-2 px-4 bg-gray-100/50 border-t space-y-1">
                      {(hayItemDtos || generalDiscountAmt > 0) && (
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>Subtotal</span>
                          <span>{formatPrice(subtotalBruto)}</span>
                        </div>
                      )}
                      {hayItemDtos && (
                        <div className="flex justify-between items-center text-xs text-emerald-600">
                          <span>Dto. por producto</span>
                          <span>-{formatPrice(subtotalBruto - subtotalConItemDtos)}</span>
                        </div>
                      )}
                      {generalDiscountAmt > 0 && (
                        <div className="flex justify-between items-center text-xs text-emerald-600">
                          <span>Dto. general {generalDiscountType === "percent" ? `(${generalDiscount}%)` : ""}</span>
                          <span>-{formatPrice(generalDiscountAmt)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-700">Total</span>
                        <span className="font-bold text-gray-900">{formatPrice(total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Mobile: lista compacta */}
              <div className="block sm:hidden">
                <div className="divide-y">
                  {order.items.map((item, index) => {
                    const dto = item.itemDiscount ?? 0;
                    const precioConDto = item.price * (1 - dto / 100);
                    return (
                      <div key={index} className="flex items-center justify-between px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{item.name}</div>
                        </div>
                        <div className="flex items-center gap-3 ml-3">
                          <div className="text-xs text-gray-500">x{item.quantity}</div>
                          <div className="text-sm font-semibold">{formatPrice(precioConDto)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Totales compactos (mobile) */}
                {(() => {
                  const subtotalBruto = order.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
                  const subtotalConItemDtos = order.items.reduce((acc, i) => {
                    const base = i.price * i.quantity;
                    const dto = i.itemDiscount ? (base * i.itemDiscount) / 100 : 0;
                    return acc + base - dto;
                  }, 0);
                  const hayItemDtos = subtotalBruto > subtotalConItemDtos;
                  const generalDiscount = (order as any).discount ?? 0;
                  const generalDiscountType = (order as any).discountType;
                  const generalDiscountAmt = generalDiscount > 0
                    ? (generalDiscountType === "percent" ? (subtotalConItemDtos * generalDiscount) / 100 : generalDiscount)
                    : 0;
                  const total = Math.max(0, subtotalConItemDtos - generalDiscountAmt);
                  return (
                    <div className="px-3 py-2 bg-gray-50 border-t text-sm space-y-1">
                      {(hayItemDtos || generalDiscountAmt > 0) && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Subtotal</span>
                          <span>{formatPrice(subtotalBruto)}</span>
                        </div>
                      )}
                      {hayItemDtos && (
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>Dto. por producto</span>
                          <span>-{formatPrice(subtotalBruto - subtotalConItemDtos)}</span>
                        </div>
                      )}
                      {generalDiscountAmt > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>Dto. general {generalDiscountType === "percent" ? `(${generalDiscount}%)` : ""}</span>
                          <span>-{formatPrice(generalDiscountAmt)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-700">Total</span>
                        <span className="font-bold text-gray-900">{formatPrice(total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            </div>

            {/* Progreso del pedido: mostrar todos los estados en una sola fila compacta */}
            <div>
              <Label className="text-xs text-gray-500 uppercase mb-3 block">Progreso del pedido</Label>
              {/* Mobile: show only current status (compact) */}
              <div className="block sm:hidden">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold bg-white">
                  <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                  <span className="text-xs text-gray-900">{config.label}</span>
                </div>
              </div>
              {/* Desktop: full flow */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <div className="flex items-center gap-3 whitespace-nowrap py-1">
                    {statusFlow.map((status) => {
                      const isCurrent = order.status === status;
                      const isCompleted = statusFlow.indexOf(order.status) >= statusFlow.indexOf(status);
                      const stepConfig = statusConfig[status];
                      return (
                        <div
                          key={status}
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${isCurrent ? 'ring-1 ring-offset-1' : 'bg-white'} ${stepConfig.bgColor} ${stepConfig.borderColor}`}
                          role="button"
                        >
                          <div className={`w-2 h-2 rounded-full ${isCompleted ? stepConfig.dotColor : 'bg-gray-300'}`} />
                          <span className={`${isCurrent ? 'text-gray-900' : 'text-gray-600'} text-xs`}>{stepConfig.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Botón avanzar */}
            {nextStatus && (
              <Button
                className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
                size="lg"
                onClick={() => onStatusChange(order.id, nextStatus)}
              >
                {nextStatus === "completed" ? (
                  <>Completar Pedido y Cobrar<ChevronRight className="h-5 w-5 ml-2" /></>
                ) : (
                  <>Avanzar a {statusConfig[nextStatus].label}<ChevronRight className="h-5 w-5 ml-2" /></>
                )}
              </Button>
            )}

            {/* ── Documentos — 2 boxes (mismo UX que ventas) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              {/* Boleta */}
              <div className={`p-4 rounded-xl border ${hasInvoice ? "bg-emerald-50/50 border-emerald-200" : "bg-muted/50 border-border"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className={`h-4 w-4 ${hasInvoice ? "text-emerald-600" : "text-muted-foreground"}`} />
                  <span className="text-xs font-medium text-muted-foreground">Boleta</span>
                  {hasInvoice && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 ml-auto" />}
                </div>
                <p className={`font-semibold text-sm ${hasInvoice ? "text-emerald-700" : "text-muted-foreground"}`}>
                  {hasInvoice ? order.invoiceNumber : "Sin boleta"}
                </p>

                {hasInvoice ? (
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs"
                      disabled={downloading === "invoice"} onClick={() => handleDescargar("invoice")}>
                      {downloading === "invoice" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      PDF
                    </Button>
                    <Button size="sm" className="flex-1 gap-1 text-xs bg-green-500 hover:bg-green-600 text-white"
                      onClick={() => handleWhatsapp("invoice")}>
                      <Send className="h-3 w-3" />
                      WhatsApp
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs mt-3"
                    onClick={handleGenerarFactura} disabled={generando || !onGenerateInvoice}>
                    {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    Generar Factura
                  </Button>
                )}
              </div>

              {/* Remito */}
              <div className={`p-4 rounded-xl border ${hasRemito ? "bg-blue-50/50 border-blue-200" : "bg-muted/50 border-border"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Truck className={`h-4 w-4 ${hasRemito ? "text-blue-600" : "text-muted-foreground"}`} />
                  <span className="text-xs font-medium text-muted-foreground">Remito</span>
                  {hasRemito && <CheckCircle className="h-3.5 w-3.5 text-blue-500 ml-auto" />}
                </div>
                <p className={`font-semibold text-sm ${hasRemito ? "text-blue-700" : "text-muted-foreground"}`}>
                  {hasRemito ? order.remitoNumber : "Sin remito"}
                </p>

                {hasRemito ? (
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs"
                      disabled={downloading === "remito"} onClick={() => handleDescargar("remito")}>
                      {downloading === "remito" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      PDF
                    </Button>
                    <Button size="sm" className="flex-1 gap-1 text-xs bg-green-500 hover:bg-green-600 text-white"
                      onClick={() => handleWhatsapp("remito")}>
                      <Send className="h-3 w-3" />
                      WhatsApp
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs mt-3"
                    onClick={handleGenerarRemito} disabled={generando || !onGenerateRemito}>
                    {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                    Generar Remito
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
