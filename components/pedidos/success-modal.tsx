// components/pedidos/success-modal.tsx
"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils/format";
import type { Client } from "@/lib/types";
import { CheckCircle, ArrowRight, X, Receipt, User } from "lucide-react";

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleResult: {
    paymentType: string;
    paymentMethod?: string;
    total: number;
    originalTotal?: number;
    discountLabel?: string;
    saleId: string;
    client?: Client;
  } | null;
  onGoToSale: () => void;
}

export function SuccessModal({
  isOpen,
  onClose,
  saleResult,
  onGoToSale,
}: SuccessModalProps) {
  if (!saleResult) return null;

  const getPaymentLabel = (type: string, method?: string) => {
    switch (type) {
      case "cash":
        return method === "transferencia" ? "Transferencia" : "Efectivo";
      case "credit":
        return "Cuenta Corriente";
      case "split":
        return "Pago Parcial";
      default:
        return type;
    }
  };

  const getPaymentColor = (type: string) => {
    switch (type) {
      case "cash":
        return "bg-green-100 text-green-700 border-green-200";
      case "credit":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "split":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Pedido Completado Exitosamente</DialogTitle>
        </DialogHeader>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto h-20 w-20 rounded-full bg-white/20 flex items-center justify-center mb-4 backdrop-blur-sm">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>

          <h2 className="text-2xl font-bold mb-1">¡Pedido Completado!</h2>
          <p className="text-green-100">
            El pedido se convirtió en una venta exitosamente
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-3">
            {saleResult.originalTotal && (
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-500 line-through">{formatPrice(saleResult.originalTotal)}</span>
              </div>
            )}
            {saleResult.discountLabel && (
              <div className="flex justify-between items-center px-3 py-2 bg-emerald-50 rounded-lg text-sm border border-emerald-100">
                <span className="text-emerald-700 font-medium">Descuento</span>
                <span className="text-emerald-700 font-semibold">{saleResult.discountLabel}</span>
              </div>
            )}
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Total
              </span>
              <span className="text-2xl font-bold text-gray-900">
                {formatPrice(saleResult.total)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Método de pago</span>
              <Badge
                variant="outline"
                className={`${getPaymentColor(saleResult.paymentType)} font-semibold`}
              >
                {getPaymentLabel(saleResult.paymentType, saleResult.paymentMethod)}
              </Badge>
            </div>

            {saleResult.client && (
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Cliente
                </span>
                <span className="font-medium text-gray-900 text-right">
                  {saleResult.client.name}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <Button
              onClick={onGoToSale}
              className="w-full h-12 text-base font-semibold bg-gray-900 hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all"
            >
              <ArrowRight className="h-5 w-5 mr-2" />
              Ver Venta y Emitir Documentos
            </Button>

            <Button variant="outline" onClick={onClose} className="w-full h-11">
              Cerrar y seguir trabajando
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
