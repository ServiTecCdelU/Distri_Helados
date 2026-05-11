"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Package,
  FileText,
  Truck,
  Banknote,
  CreditCard,
  Clock,
  Download,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { descargarDocumento, enviarWhatsapp } from "@/lib/utils/doc-actions";
import type { Venta } from "../types";
import { Scissors } from "lucide-react";

interface ModalDetalleVentaProps {
  abierto: boolean;
  venta: Venta | null;
  onCerrar: () => void;
  onGenerarDoc: (venta: Venta, tipo: "boleta" | "remito") => Promise<void>;
  formatearMoneda: (monto: number) => string;
  formatearFechaHora: (fecha: any) => string;
  etiquetaPago: (tipo: string, metodo?: string) => string;
  claseBadgePago: (tipo: string) => string;
  resolverTelefono?: (venta: Venta) => Promise<string>;
}

export function ModalDetalleVenta({
  abierto,
  venta,
  onCerrar,
  onGenerarDoc,
  formatearMoneda,
  formatearFechaHora,
  etiquetaPago,
  claseBadgePago,
  resolverTelefono,
}: ModalDetalleVentaProps) {
  const [generando, setGenerando] = useState<"boleta" | "remito" | null>(null);
  const [downloading, setDownloading] = useState<"invoice" | "remito" | null>(null);
  const [generandoDoble, setGenerandoDoble] = useState(false);

  const handleBoletaDoble = async () => {
    if (!venta) return;
    setGenerandoDoble(true);
    try {
      const { generarBoletaDoble } = await import("@/hooks/useGenerarPdf");
      const base64 = await generarBoletaDoble(venta as any, (venta as any).afipData);
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = `boleta-media-hoja-${venta.invoiceNumber || venta.id}.pdf`;
      link.click();
    } catch (e: any) {
      toast.error("Error generando media hoja");
    } finally {
      setGenerandoDoble(false);
    }
  };

  if (!venta) return null;

  const handleDescargar = (type: "invoice" | "remito") => {
    setDownloading(type);
    const base64 = type === "invoice" ? (venta as any).invoicePdfBase64 : (venta as any).remitoPdfBase64;
    const tipo = type === "invoice" ? "boleta" as const : "remito" as const;
    const numero = type === "invoice" ? venta.invoiceNumber : venta.remitoNumber;
    descargarDocumento(base64, tipo, numero, venta.clientName);
    setDownloading(null);
  };

  const handleWhatsapp = async (type: "invoice" | "remito") => {
    const base64 = type === "invoice" ? (venta as any).invoicePdfBase64 : (venta as any).remitoPdfBase64;
    const tipo = type === "invoice" ? "boleta" as const : "remito" as const;
    const numero = type === "invoice" ? venta.invoiceNumber : venta.remitoNumber;
    await enviarWhatsapp(
      base64,
      tipo,
      numero,
      venta.clientName,
      venta.clientPhone,
      resolverTelefono ? () => resolverTelefono(venta) : undefined,
    );
  };

  const handleGenerar = async (tipo: "boleta" | "remito") => {
    setGenerando(tipo);
    try {
      await onGenerarDoc(venta, tipo);
    } finally {
      setGenerando(null);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white dark:bg-background shadow-sm flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  Venta {venta.saleNumber || "?"}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatearFechaHora(venta.createdAt)}
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`${claseBadgePago(venta.paymentType)} px-3 py-1`}
            >
              {etiquetaPago(venta.paymentType, (venta as any).paymentMethod)}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Cliente y Vendedor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</p>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {(venta.clientName || "C").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="font-medium text-foreground">{venta.clientName || "Cliente final"}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendedor</p>
              <p className={`font-medium ${venta.sellerName ? "text-foreground" : "text-muted-foreground italic"}`}>
                {venta.sellerName || "Sin vendedor"}
              </p>
            </div>
          </div>

          {/* Documentos — 2 boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Boleta */}
            <div className={`p-4 rounded-xl border ${venta.invoiceEmitted ? "bg-emerald-50/50 border-emerald-200" : "bg-amber-50/50 border-amber-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                <FileText className={`h-4 w-4 ${venta.invoiceEmitted ? "text-emerald-600" : "text-amber-600"}`} />
                <span className="text-xs font-medium text-muted-foreground">Boleta</span>
                {venta.invoiceEmitted && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 ml-auto" />}
              </div>
              <p className={`font-semibold text-sm ${venta.invoiceEmitted ? "text-emerald-700" : "text-amber-700"}`}>
                {venta.invoiceEmitted ? (venta.invoiceNumber || "Emitida") : "Pendiente"}
              </p>

              {venta.invoiceEmitted ? (
                <div className="flex flex-col gap-1.5 mt-3">
                  <div className="flex gap-2">
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
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs"
                    onClick={handleBoletaDoble} disabled={generandoDoble}>
                    {generandoDoble ? <Loader2 className="h-3 w-3 animate-spin" /> : <Scissors className="h-3 w-3" />}
                    Imprimir media hoja (A5)
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs mt-3 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => handleGenerar("boleta")} disabled={generando !== null}>
                  {generando === "boleta" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-3.5 w-3.5" />
                      Generar Boleta
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Remito */}
            <div className={`p-4 rounded-xl border ${venta.remitoNumber ? "bg-blue-50/50 border-blue-200" : "bg-muted/50 border-border"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Truck className={`h-4 w-4 ${venta.remitoNumber ? "text-blue-600" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-muted-foreground">Remito</span>
                {venta.remitoNumber && <CheckCircle className="h-3.5 w-3.5 text-blue-500 ml-auto" />}
              </div>
              <p className={`font-semibold text-sm ${venta.remitoNumber ? "text-blue-700" : "text-muted-foreground"}`}>
                {venta.remitoNumber || "Sin remito"}
              </p>

              {venta.remitoNumber ? (
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
                  onClick={() => handleGenerar("remito")} disabled={generando !== null}>
                  {generando === "remito" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Truck className="h-3.5 w-3.5" />
                      Generar Remito
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Productos */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Productos ({venta.items.length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {venta.items.map((item, i) => {
                const dto = (item as any).itemDiscount || 0;
                const precioConDto = item.price * (1 - dto / 100);
                const subtotalItem = precioConDto * item.quantity;
                return (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-background border border-border/50 flex items-center justify-center text-xs font-medium text-muted-foreground">
                        x{item.quantity}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{item.name}</p>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs ${dto > 0 ? "line-through text-muted-foreground/60" : "text-muted-foreground"}`}>{formatearMoneda(item.price)} c/u</p>
                          {dto > 0 && (
                            <>
                              <p className="text-xs text-emerald-600">{formatearMoneda(precioConDto)} c/u</p>
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-1 rounded font-medium">-{dto}%</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="font-semibold text-foreground">{formatearMoneda(subtotalItem)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pago mixto */}
          {venta.paymentType === "mixed" && (
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
              <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">Detalle de Pago Mixto</p>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Banknote className="h-4 w-4" />
                  {(venta as any).paymentMethod === "transferencia" ? "Transferencia" : "Efectivo"}
                </div>
                <span className="font-semibold text-amber-800">{formatearMoneda(venta.cashAmount || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <CreditCard className="h-4 w-4" />
                  Cuenta Corriente
                </div>
                <span className="font-semibold text-amber-800">{formatearMoneda(venta.creditAmount || 0)}</span>
              </div>
            </div>
          )}

          {/* Descuentos */}
          {(() => {
            const hayItemDtos = venta.items.some((i) => (i as any).itemDiscount > 0);
            const saleDiscount = (venta as any).discount || 0;
            const subtotalBruto = venta.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
            const subtotalConItemDtos = venta.items.reduce((acc, i) => {
              const dto = (i as any).itemDiscount || 0;
              return acc + i.price * (1 - dto / 100) * i.quantity;
            }, 0);
            if (!hayItemDtos && saleDiscount <= 0) return null;
            return (
              <div className="space-y-1.5 px-1">
                {(hayItemDtos || saleDiscount > 0) && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Subtotal bruto</span>
                    <span>{formatearMoneda(subtotalBruto)}</span>
                  </div>
                )}
                {hayItemDtos && (
                  <div className="flex items-center justify-between text-sm text-emerald-600">
                    <span>Dto. por producto</span>
                    <span>-{formatearMoneda(subtotalBruto - subtotalConItemDtos)}</span>
                  </div>
                )}
                {saleDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm text-emerald-600">
                    <span>Dto. venta{(venta as any).discountType === "percent" ? ` (${saleDiscount}%)` : ""}</span>
                    <span>-{formatearMoneda(
                      (venta as any).discountType === "percent"
                        ? (subtotalConItemDtos * saleDiscount) / 100
                        : saleDiscount,
                    )}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Total */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-foreground text-background">
            <span className="font-medium">Total</span>
            <span className="text-2xl font-bold">{formatearMoneda(venta.total)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
