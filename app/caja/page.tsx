"use client";

import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Banknote,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  LockKeyhole,
  Unlock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { salesApi, auditApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { Sale } from "@/lib/types";
import { toDate } from "@/services/firestore-helpers";
import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, getDoc } from "firebase/firestore";
import { generateReadableId } from "@/services/firestore-helpers";
import { firestore } from "@/lib/firebase";
import { formatCurrency, formatTime } from "@/lib/utils/format";

interface CashRegister {
  id: string;
  openedAt: Date;
  closedAt?: Date;
  openedBy: string;
  closedBy?: string;
  initialAmount: number;
  finalAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: "open" | "closed";
  notes?: string;
}

export default function CajaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);

  // Open register modal
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [initialAmount, setInitialAmount] = useState("");

  // Close register modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [finalAmount, setFinalAmount] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const doLoad = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const registerSnap = await getDocs(
          query(
            collection(firestore, "caja"),
            where("openedAt", ">=", today),
            orderBy("openedAt", "desc"),
            limit(1),
          ),
        );

        if (!mounted) return;

        if (!registerSnap.empty) {
          const d = registerSnap.docs[0];
          const data = d.data();
          setCurrentRegister({
            id: d.id,
            openedAt: toDate(data.openedAt),
            closedAt: data.closedAt ? toDate(data.closedAt) : undefined,
            openedBy: data.openedBy || "",
            closedBy: data.closedBy || undefined,
            initialAmount: data.initialAmount || 0,
            finalAmount: data.finalAmount,
            expectedAmount: data.expectedAmount,
            difference: data.difference,
            status: data.status || "open",
            notes: data.notes,
          });
        }

        const salesData = await salesApi.getAll();
        if (!mounted) return;
        const todaySales = salesData.filter((sale) => {
          const dt = toDate(sale.createdAt);
          return dt >= today;
        });
        setSales(todaySales);
      } catch (error) {
        if (!mounted) return;
        // Error silenciado
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    doLoad();
    return () => { mounted = false; };
  }, []);

  const loadData = async () => {
    try {
      // Get today's register
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const registerSnap = await getDocs(
        query(
          collection(firestore, "caja"),
          where("openedAt", ">=", today),
          orderBy("openedAt", "desc"),
          limit(1),
        ),
      );

      if (!registerSnap.empty) {
        const doc = registerSnap.docs[0];
        const data = doc.data();
        setCurrentRegister({
          id: doc.id,
          openedAt: toDate(data.openedAt),
          closedAt: data.closedAt ? toDate(data.closedAt) : undefined,
          openedBy: data.openedBy || "",
          closedBy: data.closedBy || undefined,
          initialAmount: data.initialAmount || 0,
          finalAmount: data.finalAmount,
          expectedAmount: data.expectedAmount,
          difference: data.difference,
          status: data.status || "open",
          notes: data.notes,
        });
      }

      // Get today's sales
      const salesData = await salesApi.getAll();
      const todaySales = salesData.filter((sale) => {
        const d = toDate(sale.createdAt);
        return d >= today;
      });
      setSales(todaySales);
    } catch (error) {
      // Error silenciado
    } finally {
      setLoading(false);
    }
  };

  const todayStats = useMemo(() => {
    const cashSales = sales.filter((s) => s.paymentType === "cash" || s.paymentType === "mixed");
    const cashTotal = sales.reduce((sum, s) => {
      if (s.paymentType === "cash") return sum + (s.total || 0);
      if (s.paymentType === "mixed") return sum + (s.cashAmount || 0);
      return sum;
    }, 0);
    const creditTotal = sales.reduce((sum, s) => {
      if (s.paymentType === "credit") return sum + (s.total || 0);
      if (s.paymentType === "mixed") return sum + (s.creditAmount || 0);
      return sum;
    }, 0);
    const total = sales.reduce((sum, s) => sum + (s.total || 0), 0);

    return { cashTotal, creditTotal, total, count: sales.length };
  }, [sales]);

  const expectedCash = (currentRegister?.initialAmount || 0) + todayStats.cashTotal;

  const handleOpenRegister = async () => {
    if (!initialAmount || !user) return;
    setSaving(true);
    try {
      const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, '');
      const id = await generateReadableId(firestore, "caja", "caja", dateStr);
      await setDoc(doc(firestore, "caja", id), {
        openedAt: new Date(),
        openedBy: user.name || user.email,
        initialAmount: parseFloat(initialAmount),
        status: "open",
      });
      setCurrentRegister({
        id,
        openedAt: new Date(),
        openedBy: user.name || user.email,
        initialAmount: parseFloat(initialAmount),
        status: "open",
      });
      await auditApi.log({
        action: "cash_register_opened",
        userId: user.id,
        userName: user.name || user.email,
        description: `Abrio caja con ${formatCurrency(parseFloat(initialAmount))}`,
        entityType: "caja",
        entityId: id,
      });
      setShowOpenModal(false);
      setInitialAmount("");
    } catch (error) {
      // Error silenciado
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRegister = async () => {
    if (!finalAmount || !currentRegister || !user) return;
    setSaving(true);
    try {
      const final = parseFloat(finalAmount);
      const diff = final - expectedCash;

      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(firestore, "caja", currentRegister.id), {
        closedAt: new Date(),
        closedBy: user.name || user.email,
        finalAmount: final,
        expectedAmount: expectedCash,
        difference: diff,
        status: "closed",
        notes: closeNotes || "",
        salesCount: todayStats.count,
        totalSales: todayStats.total,
        cashTotal: todayStats.cashTotal,
        creditTotal: todayStats.creditTotal,
      });

      setCurrentRegister({
        ...currentRegister,
        closedAt: new Date(),
        closedBy: user.name || user.email,
        finalAmount: final,
        expectedAmount: expectedCash,
        difference: diff,
        status: "closed",
        notes: closeNotes,
      });

      await auditApi.log({
        action: "cash_register_closed",
        userId: user.id,
        userName: user.name || user.email,
        description: `Cerro caja. Esperado: ${formatCurrency(expectedCash)}, Contado: ${formatCurrency(final)}, Diferencia: ${formatCurrency(diff)}`,
        entityType: "caja",
        entityId: currentRegister.id,
      });
      setShowCloseModal(false);
      setFinalAmount("");
      setCloseNotes("");
    } catch (error) {
      // Error silenciado
    } finally {
      setSaving(false);
    }
  };

  const isOpen = currentRegister?.status === "open";
  const isClosed = currentRegister?.status === "closed";

  return (
    <MainLayout title="Caja" description="Apertura y cierre de caja diaria">
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Caja Diaria</h1>
            <p className="text-muted-foreground text-sm">
              {new Intl.DateTimeFormat("es-AR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date())}
            </p>
          </div>
          <div>
            {!currentRegister && (
              <Button onClick={() => setShowOpenModal(true)}>
                <Unlock className="h-4 w-4 mr-2" />
                Abrir Caja
              </Button>
            )}
            {isOpen && (
              <Button
                variant="destructive"
                onClick={() => setShowCloseModal(true)}
              >
                <LockKeyhole className="h-4 w-4 mr-2" />
                Cerrar Caja
              </Button>
            )}
            {isClosed && (
              <Badge variant="secondary" className="text-sm px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Caja cerrada
              </Badge>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            {/* Register status skeleton */}
            <div className="border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <Skeleton className="h-3 w-20 ml-auto" />
                  <Skeleton className="h-5 w-24 ml-auto" />
                </div>
              </div>
            </div>

            {/* Stat cards skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>

            {/* Sales list skeleton */}
            <div className="border border-border rounded-2xl p-4 space-y-3">
              <Skeleton className="h-5 w-36" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3.5 w-3.5 rounded" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Skeleton className="h-4 w-20 ml-auto" />
                      <Skeleton className="h-4 w-16 ml-auto rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : !currentRegister ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Banknote className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">Caja no abierta</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Abri la caja para comenzar a registrar el dia
              </p>
              <Button onClick={() => setShowOpenModal(true)}>
                <Unlock className="h-4 w-4 mr-2" />
                Abrir Caja
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Register info */}
            <Card className={isOpen ? "border-emerald-500/30 bg-emerald-500/5" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isOpen ? "bg-emerald-500/10" : "bg-muted"}`}>
                      {isOpen ? (
                        <Unlock className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <LockKeyhole className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {isOpen ? "Caja abierta" : "Caja cerrada"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Abierta a las {formatTime(currentRegister.openedAt)} por{" "}
                        {currentRegister.openedBy}
                        {currentRegister.closedAt &&
                          ` | Cerrada a las ${formatTime(currentRegister.closedAt)} por ${currentRegister.closedBy}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Monto inicial</p>
                    <p className="font-bold">{formatCurrency(currentRegister.initialAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">Venta total</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(todayStats.total)}</p>
                  <p className="text-xs text-muted-foreground">{todayStats.count} ventas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Contado</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(todayStats.cashTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Cta. Corriente</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(todayStats.creditTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote className="h-4 w-4 text-amber-500" />
                    <span className="text-xs text-muted-foreground">Efectivo esperado</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(expectedCash)}</p>
                  <p className="text-xs text-muted-foreground">
                    Inicial + ventas efectivo
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Closed register summary */}
            {isClosed && currentRegister.difference !== undefined && (
              <Card className={currentRegister.difference === 0 ? "border-emerald-500/30" : currentRegister.difference > 0 ? "border-blue-500/30" : "border-red-500/30"}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Resultado del cierre</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Esperado</p>
                      <p className="font-bold">{formatCurrency(currentRegister.expectedAmount || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Contado</p>
                      <p className="font-bold">{formatCurrency(currentRegister.finalAmount || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Diferencia</p>
                      <p className={`font-bold flex items-center justify-center gap-1 ${currentRegister.difference === 0 ? "text-emerald-600" : currentRegister.difference > 0 ? "text-blue-600" : "text-red-600"}`}>
                        {currentRegister.difference === 0 ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : currentRegister.difference > 0 ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {formatCurrency(currentRegister.difference)}
                      </p>
                    </div>
                  </div>
                  {currentRegister.notes && (
                    <p className="text-sm text-muted-foreground mt-3 border-t pt-2">
                      {currentRegister.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Today's sales */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Ventas del dia ({sales.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sales.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay ventas hoy
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sales.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {sale.clientName || "Consumidor Final"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(toDate(sale.createdAt))}
                              {sale.sellerName && ` - ${sale.sellerName}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {formatCurrency(sale.total || 0)}
                          </p>
                          <Badge
                            variant={sale.paymentType === "cash" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {sale.paymentType === "cash"
                              ? ((sale as any).paymentMethod === "transferencia" ? "Transferencia" : "Efectivo")
                              : sale.paymentType === "credit"
                                ? "Cta.Cte."
                                : "Mixto"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Open Register Modal */}
        <Dialog open={showOpenModal} onOpenChange={setShowOpenModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Abrir Caja</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Monto inicial en caja
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ingresa el monto con el que arranca la caja hoy
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowOpenModal(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleOpenRegister}
                disabled={!initialAmount || saving}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Abrir Caja
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Close Register Modal */}
        <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cerrar Caja</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto inicial</span>
                  <span className="font-medium">{formatCurrency(currentRegister?.initialAmount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ventas efectivo</span>
                  <span className="font-medium">{formatCurrency(todayStats.cashTotal)}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5">
                  <span className="font-medium">Esperado en caja</span>
                  <span className="font-bold">{formatCurrency(expectedCash)}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Monto contado en caja
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={finalAmount}
                  onChange={(e) => setFinalAmount(e.target.value)}
                  autoFocus
                />
              </div>
              {finalAmount && (
                <div className={`p-3 rounded-lg text-sm font-medium ${parseFloat(finalAmount) - expectedCash === 0 ? "bg-emerald-500/10 text-emerald-700" : parseFloat(finalAmount) - expectedCash > 0 ? "bg-blue-500/10 text-blue-700" : "bg-red-500/10 text-red-700"}`}>
                  Diferencia: {formatCurrency(parseFloat(finalAmount) - expectedCash)}
                  {parseFloat(finalAmount) - expectedCash === 0 && " - Cuadra perfecto"}
                  {parseFloat(finalAmount) - expectedCash > 0 && " - Sobrante"}
                  {parseFloat(finalAmount) - expectedCash < 0 && " - Faltante"}
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Notas (opcional)
                </label>
                <Input
                  placeholder="Observaciones del cierre..."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCloseModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleCloseRegister}
                disabled={!finalAmount || saving}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cerrar Caja
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
