//components/pedidos/payment-modal.tsx
"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils/format";
import type { Order, Client } from "@/lib/types";
import { Banknote, CreditCard, UserPlus, Loader2, Wallet, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

const generateOrderNumber = (createdAt: Date | string, index: number) => {
  const date = new Date(createdAt);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const orderNum = (index + 1).toString().padStart(4, "0");
  return `${year}${month}${day}-${orderNum}`;
};

const calculateOrderTotal = (order: Order) => {
  const itemsTotal = order.items.reduce((acc, item) => {
    const base = item.price * item.quantity;
    const dto = item.itemDiscount ? (base * item.itemDiscount) / 100 : 0;
    return acc + base - dto;
  }, 0);
  const disc = (order as any).discount ?? 0;
  if (disc > 0) {
    const discAmt = (order as any).discountType === "percent"
      ? (itemsTotal * disc) / 100
      : disc;
    return Math.max(0, itemsTotal - discAmt);
  }
  return itemsTotal;
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  clients: Client[];
  clientSearch: string;
  setClientSearch: (value: string) => void;
  selectedClientId: string;
  setSelectedClientId: (value: string) => void;
  paymentType: "cash" | "credit" | "split";
  setPaymentType: (value: "cash" | "credit" | "split") => void;
  paymentMethod: "efectivo" | "transferencia";
  setPaymentMethod: (value: "efectivo" | "transferencia") => void;
  cashAmount: string;
  setCashAmount: (value: string) => void;
  onComplete: () => void;
  processing: boolean;
  onNewClient: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  order,
  clients,
  clientSearch,
  setClientSearch,
  selectedClientId,
  setSelectedClientId,
  paymentType,
  setPaymentType,
  paymentMethod,
  setPaymentMethod,
  cashAmount,
  setCashAmount,
  onComplete,
  processing,
  onNewClient,
}: PaymentModalProps) {
  if (!order) return null;

  const total = calculateOrderTotal(order);
  const cashAmountNum = Number(cashAmount || 0);
  const remainingAmount = Math.max(total - cashAmountNum, 0);

  const filteredClients = clients.filter((client) => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      (client.dni?.toLowerCase().includes(query) ?? false) ||
      client.name.toLowerCase().includes(query)
    );
  });

  const isValid = () => {
    if (paymentType === "cash") return true;
    if (
      (paymentType === "credit" || paymentType === "split") &&
      !selectedClientId
    )
      return false;
    if (paymentType === "split") {
      return cashAmountNum > 0 && cashAmountNum < total;
    }
    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Completar Pedido</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-5">
          <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">
              Pedido
            </p>
            <p className="font-mono text-sm text-gray-700 mb-2">
              #{generateOrderNumber(order.createdAt, 0)}
            </p>
            <p className="font-semibold text-gray-900 text-lg">
              {order.clientName || "Venta directa"}
            </p>
          </div>

          <RadioGroup
            value={paymentType}
            onValueChange={(v) =>
              setPaymentType(v as "cash" | "credit" | "split")
            }
            className="space-y-3"
          >
            <label
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                paymentType === "cash"
                  ? "border-green-500 bg-green-50/50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <RadioGroupItem value="cash" id="cash" className="sr-only" />
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  paymentType === "cash" ? "bg-green-100" : "bg-gray-100"
                }`}
              >
                <Banknote
                  className={`h-6 w-6 ${paymentType === "cash" ? "text-green-600" : "text-gray-500"}`}
                />
              </div>
              <div className="flex-1">
                <p
                  className={`font-semibold ${paymentType === "cash" ? "text-green-900" : "text-gray-900"}`}
                >
                  Efectivo
                </p>
                <p className="text-sm text-gray-500">
                  Se registra en caja inmediatamente
                </p>
              </div>
              {paymentType === "cash" && (
                <div className="w-2 h-2 rounded-full bg-green-500" />
              )}
            </label>

            <label
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                paymentType === "credit"
                  ? "border-blue-500 bg-blue-50/50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <RadioGroupItem value="credit" id="credit" className="sr-only" />
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  paymentType === "credit" ? "bg-blue-100" : "bg-gray-100"
                }`}
              >
                <CreditCard
                  className={`h-6 w-6 ${paymentType === "credit" ? "text-blue-600" : "text-gray-500"}`}
                />
              </div>
              <div className="flex-1">
                <p
                  className={`font-semibold ${paymentType === "credit" ? "text-blue-900" : "text-gray-900"}`}
                >
                  Cuenta Corriente
                </p>
                <p className="text-sm text-gray-500">
                  Se suma al saldo del cliente
                </p>
              </div>
              {paymentType === "credit" && (
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </label>

            <label
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                paymentType === "split"
                  ? "border-amber-500 bg-amber-50/50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <RadioGroupItem value="split" id="split" className="sr-only" />
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  paymentType === "split" ? "bg-amber-100" : "bg-gray-100"
                }`}
              >
                <Wallet
                  className={`h-6 w-6 ${paymentType === "split" ? "text-amber-600" : "text-gray-500"}`}
                />
              </div>
              <div className="flex-1">
                <p
                  className={`font-semibold ${paymentType === "split" ? "text-amber-900" : "text-gray-900"}`}
                >
                  Pago Parcial
                </p>
                <p className="text-sm text-gray-500">
                  Parte en efectivo, resto a cuenta
                </p>
              </div>
              {paymentType === "split" && (
                <div className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </label>
          </RadioGroup>

          {(paymentType === "cash" || paymentType === "split") && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button" size="sm"
                variant={paymentMethod === "efectivo" ? "default" : "outline"}
                className={cn("h-9 text-sm gap-2", paymentMethod === "efectivo" && "bg-emerald-600 hover:bg-emerald-700")}
                onClick={() => setPaymentMethod("efectivo")}
              >
                <Banknote className="h-4 w-4" /> Efectivo
              </Button>
              <Button
                type="button" size="sm"
                variant={paymentMethod === "transferencia" ? "default" : "outline"}
                className={cn("h-9 text-sm gap-2", paymentMethod === "transferencia" && "bg-violet-600 hover:bg-violet-700")}
                onClick={() => setPaymentMethod("transferencia")}
              >
                <ArrowLeftRight className="h-4 w-4" /> Transferencia
              </Button>
            </div>
          )}

          {(paymentType === "credit" || paymentType === "split") && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Cliente
              </Label>
              {order.clientId ? (
                // Cliente ya conocido desde el pedido — solo mostrar nombre
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                  <CreditCard className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium text-blue-900">
                    {order.clientName || clients.find(c => c.id === order.clientId)?.name || "Cliente del pedido"}
                  </span>
                </div>
              ) : (
                // Sin cliente en el pedido — permitir buscar
                <>
                  <Input
                    placeholder="Buscar por DNI o nombre..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="bg-white"
                  />
                  <div className="flex gap-2">
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="flex-1 bg-white">
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredClients.length === 0 ? (
                          <SelectItem value="" disabled>No se encontraron clientes</SelectItem>
                        ) : (
                          filteredClients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name} {client.dni ? `(${client.dni})` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={onNewClient} className="flex-shrink-0">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Nuevo
                    </Button>
                  </div>
                  {!selectedClientId && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      ⚠️ Seleccioná un cliente para continuar
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {paymentType === "split" && (
            <div className="space-y-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <Label
                htmlFor="cashAmount"
                className="text-sm font-semibold text-amber-900"
              >
                Monto en efectivo
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                  $
                </span>
                <Input
                  id="cashAmount"
                  type="number"
                  min="1"
                  max={total - 1}
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0"
                  className="pl-8 bg-white border-amber-300 focus:border-amber-500"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-amber-700">Efectivo:</span>
                <span className="font-semibold text-amber-900">
                  {formatPrice(cashAmountNum)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-amber-700">A cuenta:</span>
                <span className="font-semibold text-amber-900">
                  {formatPrice(remainingAmount)}
                </span>
              </div>
            </div>
          )}

          <div className="p-5 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl text-white">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300">Total del pedido</span>
              <span className="text-3xl font-bold">{formatPrice(total)}</span>
            </div>
            <p className="text-xs text-gray-400">
              {order.items.reduce((acc, item) => acc + item.quantity, 0)} unidades
              {order.items.length > 0 && ` · ${order.items.length} ${order.items.length === 1 ? "producto" : "productos"}`}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={onClose}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 h-11 font-semibold"
              onClick={onComplete}
              disabled={processing || !isValid()}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Confirmar Pago"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
