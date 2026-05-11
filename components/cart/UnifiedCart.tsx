// components/cart/UnifiedCart.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { transferApi, clientsApi } from "@/lib/api";
import type { TransferConfig } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientModal } from "@/components/clientes/client-modal";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  UserPlus,
  Sparkles,
  Home,
  Truck,
  MapPin,
  Copy,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UserRole, CartState, CartActions } from "@/hooks/useCart";
import { CITIES } from "@/lib/types";
import type { City } from "@/lib/types";
import dynamic from "next/dynamic";

const MapPinPickerLazy = dynamic(() => import("@/components/cart/map-pin-picker"), { ssr: false });

interface UnifiedCartProps {
  role: UserRole;
  state: CartState;
  actions: CartActions;
  onConfirmSale: () => void;
  allowDiscount?: boolean;
}

export function UnifiedCart({ role, state, actions, onConfirmSale, allowDiscount }: UnifiedCartProps) {
  const {
    cart, cartTotal, cartSubtotal, finalTotal, discountAmount,
    selectedClient, selectedClientData, clients, sellers,
    dniLookup, dniLoading, dniFound,
    clientName, clientEmail, clientPhone, clientAddress, clientCuit, clientTaxCategory,
    selectedSeller, sellerMatchName,
    paymentType, paymentMethod, cashAmount, creditAmountInput,
    deliveryMethod, deliveryAddress, newAddress, deliveryLat, deliveryLng,
    discountType, discountValue, discountOpen,
  } = state;

  // Validation messages
  const getMissingRequirements = (): string[] => {
    const missing: string[] = [];
    if (role === "admin") {
      if ((paymentType === "credit" || paymentType === "mixed") && !selectedClientData) missing.push("Seleccioná un cliente para pago a cuenta");
      if (deliveryMethod === "delivery") {
        if (!state.selectedCity) missing.push("Seleccioná una ciudad");
        if (deliveryAddress === "saved" && selectedClientData && !state.selectedSavedAddress?.address && !selectedClientData.address) missing.push("El cliente no tiene dirección guardada");
        if (deliveryAddress === "new" && !newAddress.trim()) missing.push("Ingresá una dirección de entrega");
      }
      if (paymentType === "mixed" && (cashAmount <= 0 || cashAmount >= finalTotal)) missing.push("Ajustá los montos del pago mixto");
      if ((paymentType === "credit" || paymentType === "mixed") && selectedClientData) {
        const amountToCredit = paymentType === "credit" ? finalTotal : creditAmountInput;
        if (selectedClientData.currentBalance + amountToCredit > selectedClientData.creditLimit) {
          missing.push("El cliente excede su límite de crédito");
        }
      }
    } else if (role === "seller") {
      if (deliveryMethod === "delivery" && !state.selectedCity) missing.push("Seleccioná una ciudad");
      if (deliveryMethod === "delivery" && deliveryAddress === "new" && !newAddress.trim()) missing.push("Ingresá una dirección de entrega");
    } else {
      // Public user
      if (!clientName.trim()) missing.push("Ingresá tu nombre");
      if (!clientEmail) missing.push("Ingresá tu email");
      if (!clientPhone) missing.push("Ingresá tu teléfono");
      if (deliveryMethod === "delivery" && !state.selectedCity) missing.push("Seleccioná una ciudad");
      if (deliveryMethod === "delivery" && deliveryAddress === "new" && !newAddress.trim()) missing.push("Ingresá una dirección de entrega");
    }
    return missing;
  };

  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [editClientModalOpen, setEditClientModalOpen] = useState(false);
  const [transferConfig, setTransferConfig] = useState<TransferConfig>({ alias: '', titular: '', banco: '' });
  const [cartStep, setCartStep] = useState<"products" | "client" | "checkout">("products");

  useEffect(() => {
    transferApi.getConfig().then(setTransferConfig).catch(() => {});
  }, []);

  // Detectar datos faltantes del cliente encontrado
  const clientMissingData = useMemo(() => {
    if (!dniFound) return null;
    const missing: string[] = [];
    if (!clientEmail) missing.push("email");
    if (!clientPhone) missing.push("teléfono");
    return missing.length > 0 ? missing : null;
  }, [dniFound, clientEmail, clientPhone]);

  // Cliente para edición (construir objeto parcial con datos actuales)
  const editClientData = useMemo(() => {
    if (!dniFound) return null;
    const clientId = role === "admin" ? selectedClient : state.dniClientId;
    if (!clientId) return null;
    return {
      id: clientId,
      name: clientName,
      dni: state.dniLookup || "",
      cuit: clientCuit,
      email: clientEmail,
      phone: clientPhone,
      address: clientAddress,
      taxCategory: clientTaxCategory || "consumidor_final",
      creditLimit: selectedClientData?.creditLimit ?? 50000,
      currentBalance: selectedClientData?.currentBalance ?? 0,
      createdAt: new Date(),
    } as any;
  }, [dniFound, role, selectedClient, state.dniClientId, clientName, state.dniLookup, clientCuit, clientEmail, clientPhone, clientAddress, clientTaxCategory, selectedClientData]);

  const handleSaveNewClient = async (clientData: any) => {
    if (role === "admin") {
      await actions.createNewClient(clientData);
    } else {
      await actions.registerClientFromModal(clientData);
    }
    setNewClientModalOpen(false);
  };

  const handleUpdateClient = async (clientData: any) => {
    const clientId = role === "admin" ? selectedClient : state.dniClientId;
    if (!clientId) return;
    await clientsApi.update(clientId, clientData);
    // Actualizar estado local
    actions.setClientEmail(clientData.email || "");
    actions.setClientPhone(clientData.phone || "");
    actions.setClientAddress(clientData.address || "");
    actions.setClientName(clientData.name || "");
    setEditClientModalOpen(false);
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="h-20 w-20 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
          <ShoppingCart className="h-10 w-10 text-primary/30" />
        </div>
        <p className="text-base font-semibold text-muted-foreground">Tu carrito esta vacio</p>
        <p className="text-sm text-muted-foreground/60 mt-1 max-w-[220px]">
          Agrega productos desde el catalogo para comenzar tu pedido
        </p>
      </div>
    );
  }

  // ¿Hay algún descuento por ítem activo?
  const hasItemDiscounts = cart.some((item) => (item.itemDiscount ?? 0) > 0);
  // ¿Hay descuento general activo?
  const hasGeneralDiscount = discountValue > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator — solo admin/seller */}
      {role !== null && (
        <div className="flex items-center gap-1 mb-3 pb-3 border-b border-border">
          {([
            { key: "products", label: "Productos" },
            { key: "client", label: "Cliente" },
            { key: "checkout", label: "Pago" },
          ] as const).map((step, i) => (
            <React.Fragment key={step.key}>
              <button
                type="button"
                onClick={() => step.key !== "checkout" || cartStep !== "products" ? setCartStep(step.key) : undefined}
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded-md transition-colors",
                  cartStep === step.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  step.key === "checkout" && cartStep === "products" && "pointer-events-none opacity-50"
                )}
              >
                {i + 1}. {step.label}
              </button>
              {i < 2 && <span className="text-muted-foreground text-xs">›</span>}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Cart items — step 1 for admin/seller, always visible for public */}
      {(role === null || cartStep === "products") && (
      <div className="flex-1 overflow-y-auto pb-2 max-h-[35vh]">
        {/* Header */}
        <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 border-b border-border text-[11px] font-medium text-muted-foreground sticky top-0">
          <span className="flex-1">Producto</span>
          <span className="w-16 text-center shrink-0">Cant.</span>
          <span className="w-16 text-right shrink-0">Total</span>
          <span className="w-6 shrink-0" />
        </div>
        {cart.map((item) => {
          const remaining = item.product.stock - item.quantity;
          return (
            <div key={item.product.id} className="flex items-center gap-2 px-2 py-1.5 border-b border-border/50 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.product.name}</p>
                <p className="text-[11px] text-muted-foreground">{actions.formatCurrency(item.product.price)} c/u</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => actions.updateQuantity(item.product.id, -1)} disabled={item.quantity <= 1}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-xs font-semibold w-6 text-center">{item.quantity}</span>
                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => actions.updateQuantity(item.product.id, 1)} disabled={item.quantity >= item.product.stock}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-xs font-bold w-16 text-right shrink-0">
                {actions.formatCurrency(item.product.price * item.quantity)}
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => actions.removeFromCart(item.product.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
      )}

      {/* Checkout section */}
      <div className="border-t border-border pt-3 mt-auto space-y-3">
        {/* Discount - admin/seller siempre; público solo si allowDiscount (vendedor logueado) */}
        {(role === null || cartStep === "products") && (role !== null || allowDiscount) && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => !hasItemDiscounts && actions.setDiscountOpen(!discountOpen)}
            disabled={hasItemDiscounts}
            className={cn(
              "flex items-center justify-between w-full text-xs font-medium px-1",
              hasItemDiscounts
                ? "text-muted-foreground cursor-not-allowed opacity-60"
                : "text-primary hover:text-primary/80"
            )}
            title={hasItemDiscounts ? "Quitá los descuentos por producto para aplicar uno general" : ""}
          >
            <span>Descuento general {hasItemDiscounts ? "(deshabilitado: hay dto. por producto)" : ""}</span>
            <span className="text-muted-foreground">{discountOpen ? "▲" : "▼"}</span>
          </button>
          {discountOpen && !hasItemDiscounts && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
              <Input
                type="number" min="0" max="30"
                value={discountValue || ""}
                onChange={(e) => {
                  actions.setDiscountType("percent");
                  const val = Number(e.target.value) || 0;
                  actions.setDiscountValue(Math.min(30, val));
                }}
                placeholder="Ej: 10 (% máx 30)"
                className="h-8 text-sm"
              />
            </div>
          )}
        </div>
        )}

        {/* Summary */}
        {(role === null || cartStep === "products") && (
        <div className="px-1 space-y-1">
          {/* Subtotal bruto si hay algún descuento */}
          {(cartSubtotal !== finalTotal) && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Subtotal</span>
              <span className="text-sm text-foreground">{actions.formatCurrency(cartSubtotal)}</span>
            </div>
          )}
          {/* Descuentos por item */}
          {cartSubtotal > cartTotal && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-emerald-600">Dto. por producto</span>
              <span className="text-sm text-emerald-600">-{actions.formatCurrency(cartSubtotal - cartTotal)}</span>
            </div>
          )}
          {/* Descuento general de venta */}
          {discountAmount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-emerald-600">
                Dto. venta {discountType === "percent" ? `(${discountValue}%)` : ""}
              </span>
              <span className="text-sm text-emerald-600">-{actions.formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 border-t border-border/40">
            <span className="text-sm font-medium text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-foreground">
              {actions.formatCurrency(finalTotal)}
            </span>
          </div>
        </div>
        )}

        {/* "Siguiente → Cliente" button — step 1 admin/seller only */}
        {role !== null && cartStep === "products" && (
          <Button className="w-full h-10 text-sm" onClick={() => setCartStep("client")}>
            Siguiente → Cliente
          </Button>
        )}

        {/* Mini total reminder for step 2 */}
        {role !== null && cartStep === "client" && (
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/30 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold">{actions.formatCurrency(finalTotal)}</span>
          </div>
        )}

        {/* Mini reminder for step 3 */}
        {role !== null && cartStep === "checkout" && (
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/30 text-sm">
            <span className="text-muted-foreground truncate">{clientName || selectedClientData?.name || "Sin cliente"}</span>
            <span className="font-bold">{actions.formatCurrency(finalTotal)}</span>
          </div>
        )}

        {/* Client section - unified lookup (step 2 for admin/seller, always for public) */}
        {(role === null || cartStep === "client") && (
        <ClientLookupSection
          role={role}
          lookupType={state.lookupType}
          dniLookup={dniLookup}
          dniLoading={state.dniLoading}
          dniFound={dniFound}
          dniNotFound={state.dniNotFound}
          clientName={clientName}
          clientEmail={clientEmail}
          clientPhone={clientPhone}
          clientAddress={clientAddress}
          selectedClientData={selectedClientData}
          formatCurrency={actions.formatCurrency}
          onLookupTypeChange={actions.setLookupType}
          onLookupChange={actions.setDniLookup}
          onOpenNewClient={() => setNewClientModalOpen(true)}
          clientMissingData={clientMissingData}
          onEditClient={() => setEditClientModalOpen(true)}
          onClientNameChange={actions.setClientName}
          onClientEmailChange={actions.setClientEmail}
          onClientPhoneChange={actions.setClientPhone}
          clientSearchResults={state.clientSearchResults}
          onSelectSearchResult={(c) => actions.selectSearchedClient(c)}
        />
        )}

        {/* Seller section (step 2 for admin/seller) */}
        {(role === null || cartStep === "client") && role === "admin" && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">Vendedor (opcional)</Label>
            <Select value={selectedSeller} onValueChange={actions.setSelectedSeller}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Sin vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm">Sin vendedor</SelectItem>
                {sellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id} className="text-sm">
                    {seller.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {(role === null || cartStep === "client") && role === "seller" && (
          <div className="space-y-1">
            <Label className="text-xs font-medium text-foreground">Vendedor</Label>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm font-semibold text-primary">
                {sellerMatchName || "Cargando..."}
              </span>
            </div>
          </div>
        )}

        {/* Navigation buttons for step 2 */}
        {role !== null && cartStep === "client" && (
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-10 text-sm" onClick={() => setCartStep("products")}>← Productos</Button>
            <Button className="flex-1 h-10 text-sm" onClick={() => setCartStep("checkout")}>Siguiente →</Button>
          </div>
        )}

        {/* Delivery (step 3 for admin/seller, always for public) */}
        {(role === null || cartStep === "checkout") && (
          <React.Fragment>
          <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">Metodo de Entrega</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={deliveryMethod === "pickup" ? "default" : "outline"}
              className={cn(
                "h-auto py-2 flex-col gap-1 text-xs font-medium transition-all",
                deliveryMethod === "pickup" && "bg-primary hover:bg-primary/90 shadow-md",
              )}
              onClick={() => actions.setDeliveryMethod("pickup")}
            >
              <Home className="h-4 w-4" />
              Retiro en local
            </Button>
            <Button
              type="button"
              variant={deliveryMethod === "delivery" ? "default" : "outline"}
              className={cn(
                "h-auto py-2 flex-col gap-1 text-xs font-medium transition-all",
                deliveryMethod === "delivery" && "bg-primary hover:bg-primary/90 shadow-md",
              )}
              onClick={() => actions.setDeliveryMethod("delivery")}
            >
              <Truck className="h-4 w-4" />
              A domicilio
            </Button>
          </div>
        </div>

        {deliveryMethod === "delivery" && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">Ciudad <span className="text-destructive">*</span></Label>
            <Select value={state.selectedCity || "none"} onValueChange={(v) => actions.setSelectedCity(v === "none" ? "" : v as City)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Seleccionar ciudad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm">Seleccionar ciudad</SelectItem>
                {CITIES.map((city) => (
                  <SelectItem key={city} value={city} className="text-sm">{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {deliveryMethod === "delivery" && (
          <DeliveryAddressSection
            deliveryAddress={deliveryAddress}
            clientAddressBook={selectedClientData?.addresses || []}
            legacyMainAddress={role === "admin" ? selectedClientData?.address : clientAddress}
            selectedSavedAddress={state.selectedSavedAddress}
            newAddress={newAddress}
            onSelectType={actions.setDeliveryAddress}
            onNewAddressChange={actions.setNewAddress}
            onSelectSavedAddress={actions.selectSavedAddress}
            onEditSavedAddress={actions.updateClientAddress}
            onDeleteSavedAddress={actions.deleteClientAddress}
            city={state.selectedCity}
            lat={deliveryLat}
            lng={deliveryLng}
            onCoordsChange={actions.setDeliveryCoords}
          />
        )}

        {/* Payment */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">Forma de Pago</Label>
          {role === "admin" ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <PaymentButton type="cash" current={paymentType} onClick={actions.setPaymentType} label="Contado" icon={Banknote} color="emerald" />
                <PaymentButton type="credit" current={paymentType} onClick={actions.setPaymentType} label="A Cuenta" icon={CreditCard} color="blue" />
                <PaymentButton type="mixed" current={paymentType} onClick={actions.setPaymentType} label="Mixto" icon={Sparkles} color="amber" />
              </div>
              {(paymentType === "cash" || paymentType === "mixed") && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button" size="sm"
                    variant={paymentMethod === "efectivo" ? "default" : "outline"}
                    className={cn("h-8 text-xs gap-1.5", paymentMethod === "efectivo" && "bg-emerald-600 hover:bg-emerald-700")}
                    onClick={() => actions.setPaymentMethod("efectivo")}
                  >
                    <Banknote className="h-3.5 w-3.5" /> Efectivo
                  </Button>
                  <Button
                    type="button" size="sm"
                    variant={paymentMethod === "transferencia" ? "default" : "outline"}
                    className={cn("h-8 text-xs gap-1.5", paymentMethod === "transferencia" && "bg-violet-600 hover:bg-violet-700")}
                    onClick={() => actions.setPaymentMethod("transferencia")}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Transferencia
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentMethod === "efectivo" ? "default" : "outline"}
                className={cn(
                  "h-auto py-2 flex-col gap-1 text-xs font-medium transition-all",
                  paymentMethod === "efectivo" && "bg-emerald-600 hover:bg-emerald-700 shadow-md",
                )}
                onClick={() => actions.setPaymentMethod("efectivo")}
              >
                <Banknote className="h-4 w-4" />
                Efectivo
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "transferencia" ? "default" : "outline"}
                className={cn(
                  "h-auto py-2 flex-col gap-1 text-xs font-medium transition-all",
                  paymentMethod === "transferencia" && "bg-violet-600 hover:bg-violet-700 shadow-md",
                )}
                onClick={() => actions.setPaymentMethod("transferencia")}
              >
                <ArrowLeftRight className="h-4 w-4" />
                Transferencia
              </Button>
            </div>
          )}

          {/* Transfer info */}
          {paymentMethod === "transferencia" && transferConfig.alias && (
            <div className="p-3 rounded-lg bg-violet-50 border border-violet-200 space-y-1.5">
              <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Datos para transferencia
              </p>
              <div className="space-y-0.5 text-xs text-violet-700">
                <p className="flex items-center gap-1">
                  <span className="font-medium">Alias:</span> {transferConfig.alias}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-violet-600 hover:text-violet-800 hover:bg-violet-100"
                    onClick={() => {
                      navigator.clipboard.writeText(transferConfig.alias);
                      toast.success("Alias copiado");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </p>
                {transferConfig.titular && <p><span className="font-medium">Titular:</span> {transferConfig.titular}</p>}
                {transferConfig.banco && <p><span className="font-medium">Banco:</span> {transferConfig.banco}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Payment amounts (admin only) */}
        {role === "admin" && paymentType === "cash" && (
          <PaymentAmountBox
            label="Monto en Efectivo"
            value={cashAmount}
            max={finalTotal}
            onChange={actions.handleCashAmountChange}
            color="emerald"
            allowOverpay={!!selectedClient}
            overpayLabel="Queda a favor del cliente:"
            formatCurrency={actions.formatCurrency}
          />
        )}
        {role === "admin" && paymentType === "credit" && (
          <PaymentAmountBox label="Monto A Cuenta" value={creditAmountInput} max={finalTotal} onChange={actions.handleCreditAmountChange} color="blue" />
        )}
        {role === "admin" && paymentType === "mixed" && (
          <div className="space-y-2 p-3 rounded-lg bg-amber-50/50 border border-amber-200/50">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-amber-900">Monto en Efectivo</Label>
              <Input
                type="number" min="0" max={finalTotal} value={cashAmount}
                onChange={(e) => actions.handleCashAmountChange(Number(e.target.value) || 0)}
                className="h-9 text-sm border-amber-200 focus-visible:ring-amber-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-amber-900">Monto A Cuenta</Label>
              <Input
                type="number" min="0" max={finalTotal} value={creditAmountInput}
                onChange={(e) => actions.handleCreditAmountChange(Number(e.target.value) || 0)}
                className="h-9 text-sm border-amber-200 focus-visible:ring-amber-500"
              />
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-amber-200/50">
              <span className="text-amber-800 font-medium">Total:</span>
              <span className="font-bold text-amber-900">
                {actions.formatCurrency(cashAmount + creditAmountInput)}
              </span>
            </div>
          </div>
        )}

        {/* Phone override (admin) */}
        {role === "admin" && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">Telefono (opcional)</Label>
            <Input
              type="tel" inputMode="tel" placeholder="11 1234 5678"
              value={state.clientPhone} onChange={(e) => actions.setClientPhone(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        )}

        {/* Validation messages */}
        {(() => {
          const missingReqs = getMissingRequirements();
          return missingReqs.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-1">
              <p className="text-xs font-medium text-amber-800">Para continuar:</p>
              {missingReqs.map((msg, i) => (
                <p key={i} className="text-xs text-amber-700">• {msg}</p>
              ))}
            </div>
          ) : null;
        })()}

        {/* Back to step 2 button — only admin/seller step 3 */}
        {role !== null && cartStep === "checkout" && (
          <Button variant="outline" className="w-full h-9 text-sm" onClick={() => setCartStep("client")}>← Cliente</Button>
        )}

        {/* Submit */}
        <Button
          className="w-full h-10 text-sm font-semibold shadow-md"
          disabled={!actions.canProcessSale()}
          onClick={onConfirmSale}
        >
          {(role === null || deliveryMethod === "delivery") ? "Crear Pedido" : "Procesar Venta"}
        </Button>
          </React.Fragment>
        )}
      </div>

      {/* New client modal (shared) */}
      <ClientModal
        open={newClientModalOpen}
        onOpenChange={setNewClientModalOpen}
        client={null}
        showCreditLimit={role === "admin"}
        showNotes={role === "admin"}
        defaultValues={role !== "admin" && dniLookup ? { dni: dniLookup } : undefined}
        onSave={handleSaveNewClient}
      />

      {/* Edit client modal (datos faltantes) */}
      {editClientData && (
        <ClientModal
          open={editClientModalOpen}
          onOpenChange={setEditClientModalOpen}
          client={editClientData}
          showCreditLimit={role === "admin"}
          showNotes={role === "admin"}
          onSave={handleUpdateClient}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function ClientLookupSection({
  role, lookupType, dniLookup, dniLoading, dniFound, dniNotFound,
  clientName, clientEmail, clientPhone, clientAddress,
  selectedClientData, formatCurrency,
  onLookupTypeChange, onLookupChange, onOpenNewClient,
  clientMissingData, onEditClient,
  onClientNameChange, onClientEmailChange, onClientPhoneChange,
  clientSearchResults, onSelectSearchResult,
}: {
  role: UserRole;
  lookupType: "dni" | "cuit";
  dniLookup: string; dniLoading: boolean; dniFound: boolean; dniNotFound: boolean;
  clientName: string; clientEmail: string; clientPhone: string; clientAddress: string;
  selectedClientData: CartState["selectedClientData"];
  formatCurrency: (n: number) => string;
  onLookupTypeChange: (type: "dni" | "cuit") => void;
  onLookupChange: (v: string) => void;
  onOpenNewClient: () => void;
  clientMissingData: string[] | null;
  onEditClient: () => void;
  onClientNameChange?: (v: string) => void;
  onClientEmailChange?: (v: string) => void;
  onClientPhoneChange?: (v: string) => void;
  clientSearchResults?: Array<any>;
  onSelectSearchResult?: (client: any) => void;
}) {
  const handleToggle = (type: "dni" | "cuit") => {
    if (type !== lookupType) {
      onLookupChange("");
      onLookupTypeChange(type);
    }
  };

  // Public users (role === null): full contact form with visible DNI/CUIT lookup
  if (role === null) {
    return (
      <div className="space-y-3">
        <Label className="text-xs font-medium text-foreground">
          Tus datos <span className="text-destructive">*</span>
        </Label>

            {/* Búsqueda unificada — siempre visible */}
        {!dniFound && (
          <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
            <p className="text-xs font-medium text-primary">¿Ya sos cliente? Buscá por nombre, teléfono, email, DNI/CUIT o dirección</p>
            <Input
              placeholder={"Ej: nombre, teléfono, email, DNI/CUIT o dirección"}
              value={dniLookup}
              onChange={(e) => onLookupChange(e.target.value)}
              className="h-9 text-sm"
            />
            {dniLoading && <p className="text-xs text-muted-foreground">Buscando...</p>}
            {/* Lista de coincidencias */}
            {clientSearchResults && clientSearchResults.length > 0 && (
              <div className="mt-2 border rounded-lg p-2 bg-background">
                {clientSearchResults.slice(0,10).map((c) => (
                  <button key={c.id} type="button" className="w-full text-left p-2 hover:bg-primary/5 rounded" onClick={() => onSelectSearchResult?.(c)}>
                    <div className="flex justify-between">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.dni || c.cuit || ''}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{c.phone || c.email || c.address || ''}</div>
                  </button>
                ))}
              </div>
            )}
            {dniNotFound && !dniFound && (
              <p className="text-xs text-amber-600 font-medium">No encontrado. Completá tus datos abajo.</p>
            )}
          </div>
        )}

        {/* Contact fields — visible always (pre-filled when client found) */}
        {!dniFound && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Nombre <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Tu nombre completo"
                value={clientName}
                onChange={(e) => onClientNameChange?.(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Telefono <span className="text-destructive">*</span></Label>
              <Input
                type="tel"
                inputMode="tel"
                placeholder="Ej: 11 1234 5678"
                value={clientPhone}
                onChange={(e) => onClientPhoneChange?.(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={clientEmail}
                onChange={(e) => onClientEmailChange?.(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        )}

        {/* Found client info */}
        {dniFound && (
          <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200/50 space-y-1">
            <p className="text-xs text-emerald-600 font-medium flex items-center justify-between gap-2">
              Cliente encontrado
              <span className="flex items-center gap-1">
                <Button
                  type="button" variant="ghost" size="sm"
                  className="h-5 text-[10px] text-primary px-1.5 hover:bg-primary/5"
                  onClick={onEditClient}
                >
                  Editar
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="h-5 text-[10px] text-muted-foreground px-1.5 hover:text-destructive"
                  onClick={() => onLookupChange("")}
                >
                  Cambiar
                </Button>
              </span>
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Nombre:</span>
              <span className="font-medium">{clientName}</span>
            </div>
            {clientEmail && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{clientEmail}</span>
              </div>
            )}
            {clientPhone && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Telefono:</span>
                <span className="font-medium">{clientPhone}</span>
              </div>
            )}
            {clientMissingData && (
              <div className="pt-2 mt-1 border-t border-amber-200/50">
                <p className="text-xs text-amber-800 mb-2">
                  Faltan datos obligatorios: {clientMissingData.join(", ")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={onEditClient}
                >
                  Completar datos del cliente
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Admin/Seller: existing DNI/CUIT lookup flow
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-foreground">
          Cliente <span className="text-destructive">*</span>
        </Label>
        <Button
          type="button" variant="ghost" size="sm"
          className="h-6 text-xs gap-1 text-primary px-2 hover:bg-primary/5"
          onClick={onOpenNewClient}
        >
          <UserPlus className="h-3 w-3" /> Nuevo
        </Button>
      </div>

      {/* Búsqueda unificada */}
      <div className="space-y-2">
        <Input
          placeholder={"Buscar por nombre, teléfono, email, DNI/CUIT o dirección"}
          value={dniLookup}
          onChange={(e) => onLookupChange(e.target.value)}
          className="h-9 text-sm"
          disabled={dniFound}
        />
        {dniLoading && <p className="text-xs text-muted-foreground">Buscando cliente...</p>}
        {clientSearchResults && clientSearchResults.length > 0 && (
          <div className="mt-2 border rounded-lg p-2 bg-background">
            {clientSearchResults.slice(0,10).map((c) => (
              <button key={c.id} type="button" className="w-full text-left p-2 hover:bg-primary/5 rounded" onClick={() => onSelectSearchResult?.(c)}>
                <div className="flex justify-between">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.dni || c.cuit || ''}</span>
                </div>
                <div className="text-xs text-muted-foreground">{c.phone || c.email || c.address || ''}</div>
              </button>
            ))}
          </div>
        )}
        {dniFound && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-emerald-600 font-medium truncate">Cliente encontrado: {clientName}</p>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button" variant="ghost" size="sm"
                className="h-5 text-[10px] text-primary px-1.5 hover:bg-primary/5"
                onClick={onEditClient}
              >
                Editar
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                className="h-5 text-[10px] text-muted-foreground px-1.5 hover:text-destructive"
                onClick={() => onLookupChange("")}
              >
                Cambiar
              </Button>
            </div>
          </div>
        )}
        {dniNotFound && !dniFound && (
          <p className="text-xs text-amber-600 font-medium">Cliente no encontrado.</p>
        )}
      </div>

      {/* Client info */}
      {dniFound ? (
        <div className={`p-3 rounded-lg space-y-1 ${clientMissingData ? "bg-amber-50/50 border border-amber-200/50" : "bg-emerald-50/50 border border-emerald-200/50"}`}>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Nombre:</span>
            <span className="font-medium">{clientName}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Email:</span>
            <span className={`font-medium ${!clientEmail ? "text-destructive" : ""}`}>
              {clientEmail || "Falta"}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Telefono:</span>
            <span className={`font-medium ${!clientPhone ? "text-destructive" : ""}`}>
              {clientPhone || "Falta"}
            </span>
          </div>
          {clientAddress && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Direccion:</span>
              <span className="font-medium truncate ml-2">{clientAddress}</span>
            </div>
          )}
          {role === "admin" && selectedClientData && (
            <div className="pt-1 mt-1 border-t border-emerald-200/50 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Saldo actual:</span>
                <span className="font-medium">{formatCurrency(selectedClientData.currentBalance)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Limite:</span>
                <span className="font-medium">{formatCurrency(selectedClientData.creditLimit)}</span>
              </div>
            </div>
          )}
          {clientMissingData && (
            <div className="pt-2 mt-1 border-t border-amber-200/50">
              <p className="text-xs text-amber-800 mb-2">
                Faltan datos obligatorios: {clientMissingData.join(", ")}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={onEditClient}
              >
                Completar datos del cliente
              </Button>
            </div>
          )}
        </div>
      ) : dniNotFound ? (
        <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/50">
          <p className="text-xs text-amber-800 mb-3">Registra al cliente para continuar.</p>
          <Button
            className="w-full h-9 text-sm font-semibold"
            onClick={onOpenNewClient}
          >
            <UserPlus className="h-4 w-4 mr-2" /> Registrar Cliente
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DeliveryAddressSection({
  deliveryAddress, clientAddressBook, legacyMainAddress, selectedSavedAddress, newAddress,
  onSelectType, onNewAddressChange, onSelectSavedAddress, onEditSavedAddress, onDeleteSavedAddress,
  city, lat, lng, onCoordsChange,
}: {
  deliveryAddress: string;
  clientAddressBook: Array<{ city: string; address: string; lat?: number; lng?: number }>;
  legacyMainAddress?: string;
  selectedSavedAddress: { address: string; lat?: number; lng?: number } | null;
  newAddress: string;
  onSelectType: (v: "saved" | "new") => void;
  onNewAddressChange: (v: string) => void;
  onSelectSavedAddress: (addr: { address: string; lat?: number; lng?: number } | null) => void;
  onEditSavedAddress: (index: number, updated: { city: string; address: string; lat?: number; lng?: number }) => Promise<void>;
  onDeleteSavedAddress: (index: number) => Promise<void>;
  city: string;
  lat: number | null;
  lng: number | null;
  onCoordsChange: (lat: number | null, lng: number | null) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  // Reverse geocoding: cuando se coloca un pin, buscar dirección con Nominatim
  const handleCoordsChange = async (newLat: number | null, newLng: number | null) => {
    onCoordsChange(newLat, newLng);
    if (newLat == null || newLng == null) return;
    // Solo auto-rellenar si el campo está vacío o es la coordenada anterior
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${newLat}&lon=${newLng}&format=json&addressdetails=1`,
        { headers: { "Accept-Language": "es" } }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const parts = [
          addr.road || addr.pedestrian || addr.footway,
          addr.house_number,
          addr.suburb || addr.neighbourhood,
        ].filter(Boolean);
        if (parts.length > 0) {
          onNewAddressChange(parts.join(" "));
        }
      }
    } catch {
      // silencio si falla la geocodificación
    } finally {
      setGeocoding(false);
    }
  };

  // Filtrar libreta por ciudad seleccionada; si no hay ciudad, mostrar todas
  const filteredBook = city
    ? clientAddressBook
        .map((entry, idx) => ({ entry, idx }))
        .filter(({ entry }) => entry.city === city)
    : clientAddressBook.map((entry, idx) => ({ entry, idx }));

  const hasSavedList = filteredBook.length > 0;
  const showLegacyMain = !hasSavedList && !!legacyMainAddress;

  const handleStartEdit = (idx: number, currentAddress: string) => {
    setEditingIndex(idx);
    setEditingValue(currentAddress);
  };

  const handleConfirmEdit = async (idx: number) => {
    const entry = clientAddressBook[idx];
    if (!entry || !editingValue.trim()) {
      setEditingIndex(null);
      return;
    }
    await onEditSavedAddress(idx, { ...entry, address: editingValue.trim() });
    setEditingIndex(null);
  };

  return (
    <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
      <Label className="text-xs font-medium text-foreground">Direccion de Entrega</Label>
      <div className="space-y-2">
        {hasSavedList && (
          <div className="space-y-1.5">
            {filteredBook.map(({ entry, idx }) => {
              const isSelected = deliveryAddress === "saved" && selectedSavedAddress?.address === entry.address;
              const isEditing = editingIndex === idx;
              return (
                <div key={`${idx}-${entry.address}`} className="space-y-1">
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <Textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="min-h-[50px] text-sm resize-none"
                      />
                      <div className="flex gap-1">
                        <Button type="button" size="sm" className="h-7 text-[11px] flex-1" onClick={() => handleConfirmEdit(idx)}>
                          Guardar
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] flex-1" onClick={() => setEditingIndex(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className="flex-1 h-auto py-2 px-3 text-xs font-medium justify-start"
                        onClick={() => onSelectSavedAddress(entry)}
                      >
                        <MapPin className="h-3.5 w-3.5 mr-2 shrink-0" />
                        <span className="truncate text-left">
                          {entry.address}
                          {!city && <span className="text-[10px] text-muted-foreground ml-1">({entry.city})</span>}
                        </span>
                      </Button>
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                        title="Editar"
                        onClick={() => handleStartEdit(idx, entry.address)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        title="Eliminar"
                        onClick={() => onDeleteSavedAddress(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {showLegacyMain && (
          <Button
            type="button"
            variant={deliveryAddress === "saved" ? "default" : "outline"}
            className="w-full h-auto py-2 px-3 text-xs font-medium justify-start"
            onClick={() => { onSelectSavedAddress({ address: legacyMainAddress! }); }}
          >
            <MapPin className="h-3.5 w-3.5 mr-2 shrink-0" />
            <span className="truncate text-left">{legacyMainAddress}</span>
          </Button>
        )}
        <Button
          type="button"
          variant={deliveryAddress === "new" ? "default" : "outline"}
          className="w-full h-auto py-2 flex-col gap-1 text-xs font-medium"
          onClick={() => { onSelectSavedAddress(null); onSelectType("new"); }}
        >
          <MapPin className="h-3.5 w-3.5" /> Nueva Direccion
        </Button>
        {deliveryAddress === "new" && (
          <Textarea
            placeholder="Ingresa la direccion de entrega..."
            value={newAddress}
            onChange={(e) => onNewAddressChange(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
          />
        )}
        {city && <MapPinPickerLazy lat={lat} lng={lng} city={city} onCoordsChange={handleCoordsChange} />}
        {geocoding && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            Buscando dirección...
          </p>
        )}
        {!geocoding && lat != null && lng != null && (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Ubicacion marcada
          </p>
        )}
      </div>
    </div>
  );
}

function PaymentButton({
  type, current, onClick, label, icon: Icon, color,
}: {
  type: "cash" | "credit" | "mixed";
  current: string;
  onClick: (t: any) => void;
  label: string;
  icon: React.ElementType;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    blue: "bg-blue-600 hover:bg-blue-700",
    amber: "bg-amber-600 hover:bg-amber-700",
  };
  return (
    <Button
      type="button"
      variant={current === type ? "default" : "outline"}
      className={cn(
        "h-auto py-2 flex-col gap-1 text-xs font-medium transition-all",
        current === type && `${colorMap[color]} shadow-md`,
      )}
      onClick={() => onClick(type)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}

function PaymentAmountBox({
  label, value, max, onChange, color, allowOverpay, overpayLabel, formatCurrency,
}: {
  label: string; value: number; max: number; onChange: (v: number) => void; color: string;
  allowOverpay?: boolean;
  overpayLabel?: string;
  formatCurrency?: (n: number) => string;
}) {
  const colorMap: Record<string, { bg: string; border: string; label: string; ring: string }> = {
    emerald: { bg: "bg-emerald-50/50", border: "border-emerald-200/50", label: "text-emerald-900", ring: "focus-visible:ring-emerald-500" },
    blue: { bg: "bg-blue-50/50", border: "border-blue-200/50", label: "text-blue-900", ring: "focus-visible:ring-blue-500" },
  };
  const c = colorMap[color] || colorMap.emerald;
  const overpayment = allowOverpay && value > max ? value - max : 0;
  return (
    <div className={`space-y-2 p-3 rounded-lg ${c.bg} ${c.border} border`}>
      <Label className={`text-xs font-medium ${c.label}`}>{label}</Label>
      <Input
        type="number" min="0" {...(!allowOverpay ? { max } : {})} value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`h-9 text-sm ${c.border} ${c.ring}`}
      />
      {allowOverpay && overpayment > 0 && (
        <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60">
          <span className="text-[11px] font-medium text-emerald-800">
            {overpayLabel || "A favor del cliente:"}
          </span>
          <span className="text-xs font-bold text-emerald-700">
            {formatCurrency ? formatCurrency(overpayment) : overpayment}
          </span>
        </div>
      )}
    </div>
  );
}
