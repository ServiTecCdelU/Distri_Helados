"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Product } from "@/lib/types";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Package,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ParsedItem {
  rawName: string;
  quantity: number;
  lineIndex: number;
}

interface MatchedItem {
  parsedItem: ParsedItem;
  matchedProduct: Product | null;
  /** Cantidad editable */
  quantity: number;
  /** Acción: sumar al stock existente o reemplazar */
  action: "add" | "set";
}

interface RemitoImportModalProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onConfirm: (updates: { productId: string; newStock: number; productName: string }[]) => Promise<void>;
}

// Normaliza texto para comparación fuzzy
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Score de similitud simple entre dos strings normalizados
function similarityScore(a: string, b: string): number {
  const wordsA = normalize(a).split(" ").filter(Boolean);
  const wordsB = normalize(b).split(" ").filter(Boolean);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  let matches = 0;
  for (const wa of wordsA) {
    if (wa.length < 3) continue;
    if (wordsB.some((wb) => wb.includes(wa) || wa.includes(wb))) matches++;
  }
  return matches / Math.max(wordsA.length, wordsB.length);
}

// Busca el mejor producto que matchea con el nombre del remito
function findBestMatch(rawName: string, products: Product[]): Product | null {
  let bestScore = 0;
  let bestProduct: Product | null = null;

  for (const product of products) {
    const score = similarityScore(rawName, product.name);
    if (score > bestScore) {
      bestScore = score;
      bestProduct = product;
    }
  }

  // Umbral mínimo de similitud
  return bestScore >= 0.35 ? bestProduct : null;
}

export function RemitoImportModal({
  open,
  onClose,
  products,
  onConfirm,
}: RemitoImportModalProps) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [fileName, setFileName] = useState("");
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [showUnmatched, setShowUnmatched] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep("upload");
    setFileName("");
    setItems([]);
    setParsing(false);
    setConfirming(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      toast.error("Solo se aceptan archivos PDF");
      return;
    }

    setFileName(file.name);
    setParsing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-remito", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Error al procesar el PDF");
        setParsing(false);
        return;
      }

      const parsedItems: ParsedItem[] = data.items;

      if (parsedItems.length === 0) {
        toast.warning(
          "No se encontraron productos en el PDF. Verificá que sea un remito del proveedor."
        );
        setParsing(false);
        return;
      }

      // Matchear con productos de la DB
      const matched: MatchedItem[] = parsedItems.map((item) => ({
        parsedItem: item,
        matchedProduct: findBestMatch(item.rawName, products),
        quantity: item.quantity,
        action: "add" as const,
      }));

      setItems(matched);
      setStep("review");
    } catch (err) {
      toast.error("Error de conexión al procesar el PDF");
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [products]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const updateQuantity = (index: number, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: num } : item))
    );
  };

  const updateAction = (index: number, action: "add" | "set") => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, action } : item))
    );
  };

  const updateMatch = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId) || null;
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, matchedProduct: product } : item
      )
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    const toUpdate = items.filter((item) => item.matchedProduct !== null);

    if (toUpdate.length === 0) {
      toast.error("No hay productos para actualizar");
      return;
    }

    setConfirming(true);
    try {
      const updates = toUpdate.map((item) => {
        const product = item.matchedProduct!;
        const newStock =
          item.action === "add"
            ? product.stock + item.quantity
            : item.quantity;
        return {
          productId: product.id,
          newStock,
          productName: product.name,
        };
      });

      await onConfirm(updates);
      toast.success(`Stock actualizado para ${updates.length} producto(s)`);
      handleClose();
    } catch (err) {
      toast.error("Error al actualizar el stock");
    } finally {
      setConfirming(false);
    }
  };

  const matchedCount = items.filter((i) => i.matchedProduct !== null).length;
  const unmatchedCount = items.filter((i) => i.matchedProduct === null).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importar Remito del Proveedor
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center py-6 gap-4">
            {parsing ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm">Procesando {fileName}...</p>
              </div>
            ) : (
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={cn(
                    "w-full border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
                    dragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  <div className="rounded-full bg-primary/10 p-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">
                      Subí el remito del proveedor
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Arrastrá el PDF acá o hacé click para seleccionarlo
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Solo archivos PDF
                  </Badge>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </>
            )}
          </div>
        )}

        {/* STEP 2: Review */}
        {step === "review" && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Resumen */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                {fileName}
              </Badge>
              <Badge className="gap-1.5 text-xs bg-green-500/15 text-green-700 border-green-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {matchedCount} coincidencias
              </Badge>
              {unmatchedCount > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1.5 text-xs text-amber-600 border-amber-200"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {unmatchedCount} sin coincidencia
                </Badge>
              )}
            </div>

            {/* Lista scrolleable */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {/* Items con match */}
              {items
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.matchedProduct !== null)
                .map(({ item, index }) => (
                  <div
                    key={index}
                    className="border border-border rounded-xl p-3 bg-card flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">
                          Remito: {item.parsedItem.rawName}
                        </p>
                        <p className="font-medium text-sm truncate">
                          {item.matchedProduct!.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Stock actual: {item.matchedProduct!.stock} unidades
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="text-muted-foreground hover:text-destructive transition-colors mt-0.5"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Selector acción */}
                      <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                        <button
                          onClick={() => updateAction(index, "add")}
                          className={cn(
                            "px-2.5 py-1 transition-colors",
                            item.action === "add"
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          )}
                        >
                          + Sumar
                        </button>
                        <button
                          onClick={() => updateAction(index, "set")}
                          className={cn(
                            "px-2.5 py-1 transition-colors border-l border-border",
                            item.action === "set"
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          )}
                        >
                          = Fijar
                        </button>
                      </div>

                      {/* Cantidad */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">
                          Cantidad:
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(index, e.target.value)}
                          className="h-7 w-20 text-xs"
                        />
                      </div>

                      {/* Preview del resultado */}
                      <div className="ml-auto text-xs text-muted-foreground">
                        →{" "}
                        <span className="font-semibold text-foreground">
                          {item.action === "add"
                            ? item.matchedProduct!.stock + item.quantity
                            : item.quantity}
                        </span>{" "}
                        unidades
                      </div>
                    </div>

                    {/* Cambiar producto manualmente */}
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">
                        Producto:
                      </label>
                      <select
                        value={item.matchedProduct!.id}
                        onChange={(e) => updateMatch(index, e.target.value)}
                        className="flex-1 text-xs border border-border rounded-md px-2 py-1 bg-background"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

              {/* Items sin match */}
              {unmatchedCount > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowUnmatched(!showUnmatched)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 text-amber-700 text-xs font-medium"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {unmatchedCount} item(s) del remito sin coincidencia
                    </span>
                    {showUnmatched ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {showUnmatched && (
                    <div className="divide-y divide-border">
                      {items
                        .map((item, index) => ({ item, index }))
                        .filter(({ item }) => item.matchedProduct === null)
                        .map(({ item, index }) => (
                          <div
                            key={index}
                            className="px-3 py-2.5 flex items-center gap-2 bg-card"
                          >
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {item.parsedItem.rawName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Cantidad: {item.parsedItem.quantity}
                              </p>
                            </div>
                            {/* Asignar producto manualmente */}
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) updateMatch(index, e.target.value);
                              }}
                              className="text-xs border border-border rounded-md px-2 py-1 bg-background max-w-[160px]"
                            >
                              <option value="">Asignar...</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeItem(index)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "review" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStep("upload");
                setItems([]);
                setFileName("");
              }}
              disabled={confirming}
            >
              Volver
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} disabled={confirming}>
            Cancelar
          </Button>
          {step === "review" && (
            <Button
              onClick={handleConfirm}
              disabled={matchedCount === 0 || confirming}
              className="bg-primary hover:bg-primary/90"
            >
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar ({matchedCount} producto
                  {matchedCount !== 1 ? "s" : ""})
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
