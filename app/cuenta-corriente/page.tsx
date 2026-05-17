"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { clientsApi, paymentsApi } from "@/lib/api";
import type { Client } from "@/lib/types";
import type { TransactionWithSale } from "@/services/clients-service";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  DollarSign,
  FileText,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 10;

export default function CuentaCorrientePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debtFilter, setDebtFilter] = useState<"all" | "with" | "without">("with");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Detalle de transacciones
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithSale[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  // Modal de pago
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);

  // Stats
  const [totalDebt, setTotalDebt] = useState(0);
  const [clientsWithDebt, setClientsWithDebt] = useState(0);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const result = await clientsApi.getPaginated(PAGE_SIZE, currentPage, {
        search: searchQuery || undefined,
        hasDebt: debtFilter,
      });
      setClients(result.data);
      setTotalCount(result.count);
    } catch {
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, debtFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const result = await clientsApi.getPaginated(1, 0, { hasDebt: "with" });
      setClientsWithDebt(result.count);
      // Para el total de deuda, traemos todos los que deben
      const all = await clientsApi.getPaginated(500, 0, { hasDebt: "with" });
      const total = all.data.reduce((sum, c) => sum + (c.currentBalance || 0), 0);
      setTotalDebt(total);
    } catch {
      // silenciado
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, debtFilter]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 400);
  };

  const handleViewTransactions = async (client: Client) => {
    setSelectedClient(client);
    setExpandedTx(null);
    setLoadingTransactions(true);
    try {
      const txs = await clientsApi.getTransactionsWithSales(client.id);
      setTransactions(txs);
    } catch {
      toast.error("Error al cargar movimientos");
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedClient(null);
    setTransactions([]);
    setExpandedTx(null);
  };

  const handleOpenPayment = (client: Client) => {
    setPaymentClient(client);
    setPaymentAmount("");
    setPaymentDescription("");
    setPaymentModalOpen(true);
  };

  const handleRegisterPayment = async () => {
    if (!paymentClient || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Monto inválido");
      return;
    }
    setProcessingPayment(true);
    try {
      await paymentsApi.registerCashPayment({
        clientId: paymentClient.id,
        amount,
        description: paymentDescription || "Pago registrado",
      });
      toast.success(`Pago de ${formatCurrency(amount)} registrado`);
      setPaymentModalOpen(false);
      fetchClients();
      fetchStats();
      // Si estamos viendo el detalle de este cliente, refrescar
      if (selectedClient?.id === paymentClient.id) {
        handleViewTransactions(paymentClient);
      }
    } catch {
      toast.error("Error al registrar pago");
    } finally {
      setProcessingPayment(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Cuenta Corriente</h1>
            <p className="text-sm text-muted-foreground">
              Gestión de deudas y pagos de clientes
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-100 text-red-600">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deuda Total</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(totalDebt)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clientes con deuda</p>
                <p className="text-lg font-bold">{clientsWithDebt}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, CUIT, DNI..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={debtFilter}
            onValueChange={(v) => setDebtFilter(v as "all" | "with" | "without")}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="with">Con deuda</SelectItem>
              <SelectItem value="without">Sin deuda</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla o detalle */}
        {selectedClient ? (
          <ClientDetailPanel
            client={selectedClient}
            transactions={transactions}
            loading={loadingTransactions}
            expandedTx={expandedTx}
            onToggleTx={(id) => setExpandedTx(expandedTx === id ? null : id)}
            onClose={handleCloseDetail}
            onPayment={() => handleOpenPayment(selectedClient)}
          />
        ) : loading ? (
          <DataTableSkeleton />
        ) : clients.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {searchQuery
                ? "No se encontraron clientes con esa búsqueda"
                : debtFilter === "with"
                ? "No hay clientes con deuda"
                : "No hay clientes"}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Lista de clientes */}
            <div className="space-y-1">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                    {client.cuit && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        CUIT: {client.cuit}
                      </span>
                    )}
                    {client.phone && (
                      <span className="text-xs text-muted-foreground hidden md:inline">
                        Tel: {client.phone}
                      </span>
                    )}
                    {client.currentBalance > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                        Debe
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p
                      className={`text-sm font-bold ${
                        client.currentBalance > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {formatCurrency(client.currentBalance)}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleViewTransactions(client)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleOpenPayment(client)}
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Mostrando {currentPage * PAGE_SIZE + 1}-
                  {Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} de{" "}
                  {totalCount}
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal de Pago */}
        <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Pago</DialogTitle>
            </DialogHeader>
            {paymentClient && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-muted">
                  <p className="font-medium">{paymentClient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Deuda actual:{" "}
                    <span className="text-red-600 font-medium">
                      {formatCurrency(paymentClient.currentBalance)}
                    </span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descripción (opcional)</Label>
                  <Input
                    placeholder="Ej: Pago en efectivo"
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleRegisterPayment}
                  disabled={processingPayment || !paymentAmount}
                >
                  {processingPayment && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Registrar Pago
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

// ─── Panel de detalle de un cliente ───────────────────────────────────────────

interface ClientDetailPanelProps {
  client: Client;
  transactions: TransactionWithSale[];
  loading: boolean;
  expandedTx: string | null;
  onToggleTx: (id: string) => void;
  onClose: () => void;
  onPayment: () => void;
}

function ClientDetailPanel({
  client,
  transactions,
  loading,
  expandedTx,
  onToggleTx,
  onClose,
  onPayment,
}: ClientDetailPanelProps) {
  // Calcular saldo acumulado
  const txsWithBalance = (() => {
    const sorted = [...transactions].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    let balance = 0;
    const mapped = sorted.map((tx) => {
      if (tx.type === "debt") balance += tx.amount;
      else balance -= tx.amount;
      return { ...tx, runningBalance: balance };
    });
    return mapped.reverse();
  })();

  const debtTransactions = transactions.filter((t) => t.type === "debt");

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header del detalle */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{client.name}</h2>
            <p className="text-sm text-muted-foreground">
              {client.cuit || client.phone || ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onPayment}>
              <DollarSign className="h-4 w-4 mr-1" />
              Registrar Pago
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-red-50 border border-red-100">
            <p className="text-xs text-muted-foreground">Deuda actual</p>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(client.currentBalance)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-xs text-muted-foreground">Límite crédito</p>
            <p className="text-lg font-bold text-blue-600">
              {formatCurrency(client.creditLimit)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-xs text-muted-foreground">Remitos pendientes</p>
            <p className="text-lg font-bold text-amber-600">
              {debtTransactions.filter((t) => t.remitoNumber).length}
            </p>
          </div>
        </div>

        {/* Lista de movimientos */}
        <div>
          <h3 className="font-medium mb-2">Movimientos</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : txsWithBalance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sin movimientos
            </p>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {txsWithBalance.map((tx) => (
                <div
                  key={tx.id}
                  className="border rounded-xl overflow-hidden"
                >
                  {/* Fila principal */}
                  <div
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      tx.type === "debt" ? "bg-red-50/50" : "bg-green-50/50"
                    }`}
                    onClick={() => tx.type === "debt" && tx.saleId && onToggleTx(tx.id)}
                  >
                    <div className="shrink-0">
                      {tx.type === "debt" ? (
                        <ArrowUpCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <ArrowDownCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {tx.description || (tx.type === "debt" ? "Cargo" : "Pago")}
                        </p>
                        {tx.remitoNumber && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <FileText className="h-3 w-3 mr-1" />
                            {tx.remitoNumber}
                          </Badge>
                        )}
                        {tx.saleNumber && !tx.remitoNumber && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            V-{tx.saleNumber}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.date)}
                        {tx.sellerName && ` · ${tx.sellerName}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`font-medium ${
                          tx.type === "debt" ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {tx.type === "debt" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo: {formatCurrency(tx.runningBalance)}
                      </p>
                    </div>
                  </div>

                  {/* Detalle expandido (items del remito/venta) */}
                  {expandedTx === tx.id && tx.saleItems && tx.saleItems.length > 0 && (
                    <div className="border-t bg-muted/30 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Detalle de la venta
                          {tx.remitoNumber && ` (Remito ${tx.remitoNumber})`}
                        </p>
                        {tx.sellerName && (
                          <span className="text-xs text-muted-foreground">
                            Vendedor: <span className="font-medium">{tx.sellerName}</span>
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {tx.saleItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Package className="h-3 w-3 text-muted-foreground" />
                              <span>{item.name}</span>
                              <span className="text-muted-foreground">
                                x{item.quantity}
                              </span>
                            </div>
                            <span className="font-medium">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {tx.saleTotal && (
                        <div className="flex justify-between mt-2 pt-2 border-t text-sm font-bold">
                          <span>Total</span>
                          <span>{formatCurrency(tx.saleTotal)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
