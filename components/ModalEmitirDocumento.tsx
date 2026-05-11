"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Truck, Loader2 } from "lucide-react";
import type { Venta } from "@/hooks/useVentas";

interface ModalEmitirDocumentoProps {
  abierto: boolean;
  venta: Venta | null;
  tipoDocumento: "boleta" | "remito";
  emitiendo: boolean;
  onCerrar: () => void;
  onConfirmar: () => void;
  onCambiarTipo: (tipo: "boleta" | "remito") => void;
  formatearMoneda: (monto: number) => string;
}

export function ModalEmitirDocumento({
  abierto,
  venta,
  tipoDocumento,
  emitiendo,
  onCerrar,
  onConfirmar,
  onCambiarTipo,
  formatearMoneda,
}: ModalEmitirDocumentoProps) {
  if (!venta) return null;

  return (
    <Dialog open={abierto} onOpenChange={onCerrar} key={tipoDocumento}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              {tipoDocumento === "boleta" ? (
                <FileText className="h-5 w-5 text-primary" />
              ) : (
                <Truck className="h-5 w-5 text-primary" />
              )}
            </div>
            {tipoDocumento === "boleta" ? "Emitir Boleta" : "Generar Remito"}
          </DialogTitle>
          <DialogDescription>
            {tipoDocumento === "boleta"
              ? "Emitir factura electrónica con AFIP"
              : "Generar comprobante de entrega"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-xl bg-muted/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Venta</span>
              <span className="font-medium">
                {venta.saleNumber || venta.id.slice(-6)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">
                {venta.clientName || "Cliente final"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-lg">
                {formatearMoneda(venta.total)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Tipo de documento:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onCambiarTipo("boleta")}
                disabled={venta.invoiceEmitted}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  tipoDocumento === "boleta"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                } ${venta.invoiceEmitted ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <FileText
                  className={`h-6 w-6 mb-2 ${tipoDocumento === "boleta" ? "text-primary" : "text-muted-foreground"}`}
                />
                <p
                  className={`font-semibold ${tipoDocumento === "boleta" ? "text-foreground" : "text-muted-foreground"}`}
                >
                  Boleta
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {venta.invoiceEmitted
                    ? "Ya emitida"
                    : "Factura fiscal digital"}
                </p>
              </button>

              <button
                onClick={() => onCambiarTipo("remito")}
                disabled={!!venta.remitoNumber}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  tipoDocumento === "remito"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                } ${venta.remitoNumber ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Truck
                  className={`h-6 w-6 mb-2 ${tipoDocumento === "remito" ? "text-primary" : "text-muted-foreground"}`}
                />
                <p
                  className={`font-semibold ${tipoDocumento === "remito" ? "text-foreground" : "text-muted-foreground"}`}
                >
                  Remito
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {venta.remitoNumber
                    ? "Ya generado"
                    : "Comprobante de entrega"}
                </p>
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={onConfirmar}
              disabled={
                emitiendo ||
                (tipoDocumento === "boleta" && venta.invoiceEmitted) ||
                (tipoDocumento === "remito" && venta.remitoNumber)
              }
            >
              {emitiendo && <Loader2 className="h-4 w-4 animate-spin" />}
              {tipoDocumento === "boleta" ? "Emitir Boleta" : "Generar Remito"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
