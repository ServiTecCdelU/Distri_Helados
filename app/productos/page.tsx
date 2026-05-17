"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getCached, setCache, invalidateCache } from "@/lib/query-cache";
import { MainLayout } from "@/components/layout/main-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProductModal } from "@/components/productos/product-modal";
import { StockHistoryModal } from "@/components/productos/stock-history-modal";
import { InventoryValueHistory } from "@/components/productos/inventory-value-history";
import { RemitoImportModal } from "@/components/productos/remito-import-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productsApi } from "@/lib/api";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format";
import {
  Plus,
  Search,
  Pencil,
  Filter,
  X,
  Grid3x3,
  List,
  Package,
  Tag,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  History,
  TrendingUp,
  WheatOff,
  EyeOff,
  FileUp,
  FileDown,
  Upload,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Tipos para los filtros
type PriceFilter = "all" | "0-2800" | "2801-3000" | "3001-3200" | "3201+";
type MarcaFilter =
  | "all"
  | "MIO"
  | "YO HELADERIAS"
  | "TARGET"
  | "CARCARAÑA"
  | "FRIAR"
  | "MC CAIN"
  | "RESTAURANT"
  | "SIMPLOT"
  | "Sin identificar";
type StockFilter = "all" | "available" | "low" | "out";
type CategoryFilter =
  | "all"
  | "Helado individual"
  | "Helado a granel"
  | "Torta helada"
  | "Congelado embutido"
  | "Congelado cárnico"
  | "Congelado papa"
  | "Congelado verdura"
  | "Congelado rebozado"
  | "Bebida";
type SinTaccFilter = "all" | "sin-tacc" | "con-tacc";
type ViewMode = "grid" | "list";

// Tipos para historiales
export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type:
    | "sale"
    | "manual_add"
    | "manual_remove"
    | "deactivation"
    | "creation"
    | "bulk_operation";
  previousStock: number;
  newStock: number;
  change: number;
  date: Date;
  reason?: string;
  saleId?: string;
  saleTotal?: number;
  sellerId?: string;
  sellerName?: string;
  clientId?: string;
  clientName?: string;
  userId?: string;
  userName?: string;
  details?: string;
}

export interface InventorySnapshot {
  id: string;
  date: Date;
  totalValue: number;
  productCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Cache de todos los productos para CSV/remito (carga lazy)
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const allProductsLoadedRef = useRef(false);
  const loadAllProducts = useCallback(async () => {
    if (allProductsLoadedRef.current && allProducts.length > 0) return allProducts;
    const data = await productsApi.getAll();
    setAllProducts(data);
    allProductsLoadedRef.current = true;
    return data;
  }, [allProducts]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value), 400);
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [productToDeactivate, setProductToDeactivate] =
    useState<Product | null>(null);
  const [bulkDeactivateDialogOpen, setBulkDeactivateDialogOpen] =
    useState(false);

  // Estados para filtros
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [marcaFilter, setMarcaFilter] = useState<MarcaFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sinTaccFilter, setSinTaccFilter] = useState<SinTaccFilter>("all");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [remitoImportOpen, setRemitoImportOpen] = useState(false);

  // Estados para historiales
  const [stockHistory, setStockHistory] = useState<StockMovement[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventorySnapshot[]>(
    [],
  );
  const [showStockHistory, setShowStockHistory] = useState(false);
  const [selectedProductHistory, setSelectedProductHistory] =
    useState<Product | null>(null);
  const [showInventoryHistory, setShowInventoryHistory] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch paginado con filtros server-side (con cache)
  const fetchProducts = useCallback(async (skipCache = false) => {
    const cacheKey = `productos:${pageSize}:${currentPage}:${searchQuery}:${categoryFilter}:${marcaFilter}:${stockFilter}:${sinTaccFilter}`;
    if (!skipCache) {
      const cached = getCached<{ data: any[]; count: number }>(cacheKey);
      if (cached) {
        setProducts(cached.data);
        setTotalCount(cached.count);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    try {
      const result = await productsApi.getPaginated(pageSize, currentPage - 1, {
        search: searchQuery || undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        marca: marcaFilter !== "all" ? marcaFilter : undefined,
        stockFilter: stockFilter !== "all" ? stockFilter : undefined,
        sinTacc: sinTaccFilter === "sin-tacc" ? true : sinTaccFilter === "con-tacc" ? false : null,
        disabled: null,
      });
      setProducts(result.data);
      setTotalCount(result.count);
      setCache(cacheKey, { data: result.data, count: result.count });
    } catch {
      // Error silenciado
    } finally {
      setLoading(false);
    }
  }, [pageSize, currentPage, searchQuery, categoryFilter, marcaFilter, stockFilter, sinTaccFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    loadStockHistory();
    loadInventoryHistory();
  }, []);

  // Invalidar cache de allProducts cuando se modifica algo
  const invalidateAllProducts = () => {
    allProductsLoadedRef.current = false;
  };

  const loadProducts = async () => {
    invalidateCache('productos');
    await fetchProducts(true);
    invalidateAllProducts();
  };

  // --- CSV: Descargar planilla ---
  const descargarPlanilla = async () => {
    const all = await loadAllProducts();
    if (all.length === 0) { toast.error("No hay productos"); return; }
    const SEP = ";";
    const header = ["ID", "Nombre", "Precio", "Stock"].join(SEP);
    const rows = all
      .filter((p) => !(p as any).disabled)
      .map((p) => {
        const name = p.name.replace(/"/g, "'");
        return [p.id, `"${name}"`, p.price, p.stock].join(SEP);
      });
    const csv = "\uFEFF" + "sep=;\n" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `productos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Planilla descargada con ${rows.length} productos`);
  };

  // --- CSV: Subir planilla ---
  const [importando, setImportando] = useState(false);

  const subirPlanilla = async (file: File) => {
    setImportando(true);
    const toastId = "import-csv";
    toast.loading("Procesando planilla...", { id: toastId });
    try {
      const all = await loadAllProducts();
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("sep="));
      if (lines.length < 2) throw new Error("El archivo está vacío");

      // Detectar separador (;  o ,)
      const headerLine = lines[0];
      const sep = headerLine.includes(";") ? ";" : ",";

      // Saltar header
      const dataLines = lines.slice(1);
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const line of dataLines) {
        // Parsear CSV respetando comillas
        const parts: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === sep && !inQuotes) { parts.push(current.trim()); current = ""; continue; }
          current += ch;
        }
        parts.push(current.trim());

        const [id, , newPriceStr, newStockStr] = parts;
        if (!id) continue;

        const product = all.find((p) => p.id === id);
        if (!product) { errors.push(`ID "${id}" no encontrado`); continue; }

        const newPrice = newPriceStr ? parseFloat(newPriceStr.replace(",", ".")) : NaN;
        const newStock = newStockStr ? parseInt(newStockStr, 10) : NaN;

        if (isNaN(newPrice) && isNaN(newStock)) { skipped++; continue; }

        const updates: Partial<Product> = {};
        if (!isNaN(newPrice) && newPrice >= 0 && newPrice !== product.price) updates.price = newPrice;
        if (!isNaN(newStock) && newStock >= 0 && newStock !== product.stock) updates.stock = newStock;

        if (Object.keys(updates).length === 0) { skipped++; continue; }

        await productsApi.update(product.id, updates);
        updated++;
      }

      await loadProducts();

      let msg = `${updated} producto${updated !== 1 ? "s" : ""} actualizado${updated !== 1 ? "s" : ""}`;
      if (skipped > 0) msg += `, ${skipped} sin cambios`;
      if (errors.length > 0) msg += `. Errores: ${errors.slice(0, 3).join(", ")}`;

      toast.success(msg, { id: toastId, duration: 5000 });
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setImportando(false);
    }
  };

  const loadStockHistory = () => {
    const saved = localStorage.getItem("stockHistory");
    if (saved) {
      const parsed = JSON.parse(saved);
      setStockHistory(
        parsed.map((h: any) => ({
          ...h,
          date: new Date(h.date),
        })),
      );
    }
  };

  const saveStockHistory = (history: StockMovement[]) => {
    localStorage.setItem("stockHistory", JSON.stringify(history));
    setStockHistory(history);
  };

  const loadInventoryHistory = () => {
    const saved = localStorage.getItem("inventoryHistory");
    if (saved) {
      const parsed = JSON.parse(saved);
      setInventoryHistory(
        parsed.map((h: any) => ({
          ...h,
          date: new Date(h.date),
        })),
      );
    }
  };

  const saveInventorySnapshot = async () => {
    const all = await loadAllProducts();
    const totalValue = all.reduce((sum, p) => sum + p.price * p.stock, 0);
    const lowStockCount = all.filter(
      (p) => p.stock > 0 && p.stock < 10,
    ).length;
    const outOfStockCount = all.filter((p) => p.stock === 0).length;

    const newSnapshot: InventorySnapshot = {
      id: Date.now().toString(),
      date: new Date(),
      totalValue,
      productCount: all.length,
      lowStockCount,
      outOfStockCount,
    };

    const updated = [...inventoryHistory, newSnapshot].slice(-30);
    localStorage.setItem("inventoryHistory", JSON.stringify(updated));
    setInventoryHistory(updated);
  };

  const logStockMovement = (movement: Omit<StockMovement, "id" | "date">) => {
    const newMovement: StockMovement = {
      ...movement,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: new Date(),
    };
    const updated = [newMovement, ...stockHistory].slice(0, 200);
    saveStockHistory(updated);
    return newMovement;
  };

  const logSaleMovement = (
    product: Product,
    quantity: number,
    saleId: string,
    saleTotal: number,
    sellerName?: string,
    clientName?: string,
  ) => {
    return logStockMovement({
      productId: product.id,
      productName: product.name,
      type: "sale",
      previousStock: product.stock + quantity,
      newStock: product.stock,
      change: -quantity,
      reason: `Venta realizada${sellerName ? ` por ${sellerName}` : ""}`,
      saleId,
      saleTotal,
      sellerName,
      clientName,
      details: `Se vendieron ${quantity} unidad(es) por ${formatCurrency(product.price * quantity)}`,
    });
  };

  // NUEVO: Deshabilitar (en lugar de eliminar)
  const logDisableMovement = (product: Product, reason?: string) => {
    return logStockMovement({
      productId: product.id,
      productName: product.name,
      type: "deactivation",
      previousStock: product.stock,
      newStock: product.stock,
      change: 0,
      reason: reason || "Producto deshabilitado",
      details: `Se deshabilitó "${product.name}". Stock conservado: ${product.stock}`,
    });
  };
  const logEnableMovement = (product: Product, reason?: string) => {
    return logStockMovement({
      productId: product.id,
      productName: product.name,
      type: "manual_add",
      previousStock: product.stock,
      newStock: product.stock,
      change: 0,
      reason: reason || "Producto habilitado",
      details: `Se volvió a habilitar "${product.name}"`,
    });
  };

  const logManualAdd = (
    product: Product,
    quantity: number,
    userName?: string,
    reason?: string,
  ) => {
    return logStockMovement({
      productId: product.id,
      productName: product.name,
      type: "manual_add",
      previousStock: product.stock - quantity,
      newStock: product.stock,
      change: quantity,
      reason: reason || "Suma de inventario",
      userName,
      details: `Se agregaron ${quantity} unidad(es) al stock`,
    });
  };

  const logManualRemove = (
    product: Product,
    quantity: number,
    userName?: string,
    reason?: string,
  ) => {
    return logStockMovement({
      productId: product.id,
      productName: product.name,
      type: "manual_remove",
      previousStock: product.stock + quantity,
      newStock: product.stock,
      change: -quantity,
      reason: reason || "Resta de inventario",
      userName,
      details: `Se quitaron ${quantity} unidad(es) del stock`,
    });
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleRemitoConfirm = async (
    updates: { productId: string; newStock: number; productName: string }[],
  ) => {
    for (const update of updates) {
      const product = allProducts.find((p) => p.id === update.productId);
      if (!product) continue;

      await productsApi.update(update.productId, { stock: update.newStock } as any);

      const change = update.newStock - product.stock;
      logStockMovement({
        productId: product.id,
        productName: product.name,
        type: "manual_add",
        previousStock: product.stock,
        newStock: update.newStock,
        change,
        reason: "Importación de remito proveedor",
        details: `Stock actualizado via remito: ${product.stock} → ${update.newStock}`,
      });
    }

    // Recargar productos
    await loadProducts();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  // NUEVO: Abrir diálogo de Deshabilitar
  const handleDeactivate = (product: Product) => {
    setProductToDeactivate(product);
    setDeactivateDialogOpen(true);
  };
  const handleEnable = async (product: Product) => {
    try {
      logEnableMovement(product, "Habilitado manualmente");

      await productsApi.update(product.id, {
        disabled: false,
      } as any);

      invalidateCache('productos');
      await fetchProducts(true);
      invalidateAllProducts();
      toast.success(`"${product.name}" habilitado`);
    } catch (error) {
      // Error silenciado
      toast.error("Error al habilitar producto");
    }
  };

  // Confirmar deshabilitar producto
  const confirmDeactivate = async () => {
    if (!productToDeactivate) return;

    try {
      logDisableMovement(productToDeactivate, "Deshabilitado manualmente");

      await productsApi.update(productToDeactivate.id, {
        disabled: true,
      } as any);

      invalidateCache('productos');
      await fetchProducts(true);
      invalidateAllProducts();
      toast.success(`"${productToDeactivate.name}" deshabilitado`);
    } catch (error) {
      // Error silenciado
      toast.error("Error al deshabilitar producto");
    } finally {
      setDeactivateDialogOpen(false);
      setProductToDeactivate(null);
    }
  };

  const handleBulkDeactivate = () => {
    setBulkDeactivateDialogOpen(true);
  };

  const confirmBulkDeactivate = async () => {
    try {
      const productsToDisable = products.filter((p) =>
        selectedProducts.includes(p.id),
      );

      productsToDisable.forEach((product) => {
        logDisableMovement(
          product,
          `Deshabilitado masivo (${selectedProducts.length} productos)`,
        );
      });

      await Promise.all(
        selectedProducts.map((id) =>
          productsApi.update(id, { disabled: true } as any),
        ),
      );

      setSelectedProducts([]);
      invalidateCache('productos');
      await fetchProducts(true);
      invalidateAllProducts();
      toast.success(`${productsToDisable.length} productos deshabilitados`);
    } catch (error) {
      // Error silenciado
      toast.error("Error al deshabilitar productos");
    } finally {
      setBulkDeactivateDialogOpen(false);
    }
  };

  const handleSave = async (productData: Omit<Product, "id" | "createdAt">) => {
    try {
      if (editingProduct) {
        // Detectar cambio de stock
        if (productData.stock !== editingProduct.stock) {
          const change = productData.stock - editingProduct.stock;
          if (change > 0) {
            logManualAdd(
              editingProduct,
              change,
              undefined,
              "Edición desde modal",
            );
          } else if (change < 0) {
            logManualRemove(
              editingProduct,
              Math.abs(change),
              undefined,
              "Edición desde modal",
            );
          }
        }

        await productsApi.update(editingProduct.id, productData);
      } else {
        const newProduct = await productsApi.create(productData);

        logStockMovement({
          productId: newProduct.id,
          productName: newProduct.name,
          type: "creation",
          previousStock: 0,
          newStock: newProduct.stock,
          change: newProduct.stock,
          reason: "Creación de nuevo producto",
          details: `Stock inicial: ${newProduct.stock} unidades`,
        });
      }
      setModalOpen(false);
      await loadProducts();
    } catch (error) {
      // Error silenciado
    }
  };

  const handleViewHistory = (product: Product) => {
    setSelectedProductHistory(product);
    setShowStockHistory(true);
  };

  // Los productos ya vienen filtrados y paginados del server
  const paginatedProducts = products;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Stats basadas en el count del server (total matcheado por filtros)
  const stats = {
    totalProducts: totalCount,
    totalInventoryValue: products.reduce((sum, p) => sum + p.price * p.stock, 0),
    lowStockCount: products.filter((p) => p.stock > 0 && p.stock < 10).length,
    outOfStockCount: products.filter((p) => p.stock === 0).length,
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, priceFilter, marcaFilter, stockFilter, sinTaccFilter]);

  // Listas dinámicas para filtros y modal
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableMarcas, setAvailableMarcas] = useState<string[]>([]);

  useEffect(() => {
    // Cargar categorías y marcas únicas para los filtros (query ligera)
    const loadFilterOptions = async () => {
      try {
        const { data } = await (await import('@/lib/supabase')).supabase
          .from('productos')
          .select('category, marca')
        if (data) {
          setAvailableCategories([...new Set(data.map((r: any) => r.category).filter(Boolean))]);
          setAvailableMarcas([...new Set(data.map((r: any) => r.marca).filter(Boolean))]);
        }
      } catch {}
    };
    loadFilterOptions();
  }, []);

  const activeFilterCount = [
    categoryFilter !== "all",
    priceFilter !== "all",
    marcaFilter !== "all",
    stockFilter !== "all",
    sinTaccFilter !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setCategoryFilter("all");
    setPriceFilter("all");
    setMarcaFilter("all");
    setStockFilter("all");
    setSinTaccFilter("all");
    setSearchInput("");
    setSearchQuery("");
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map((p) => p.id));
    }
  };

  const handleDuplicate = async (product: Product) => {
    try {
      const { id: _, createdAt: __, ...productData } = product;
      const newProduct = await productsApi.create({
        ...productData,
        name: `${product.name} (copia)`,
      });

      logStockMovement({
        productId: newProduct.id,
        productName: newProduct.name,
        type: "creation",
        previousStock: 0,
        newStock: newProduct.stock,
        change: newProduct.stock,
        reason: `Duplicación`,
        details: `Copia de "${product.name}"`,
      });

      await loadProducts();
    } catch (error) {
      // Error silenciado
    }
  };

  const getStockColor = (stock: number) => {
    if (stock === 0) return "destructive";
    if (stock < 10) return "warning";
    return "success";
  };

  const getStockText = (stock: number) => {
    if (stock === 0) return "Sin stock";
    if (stock < 10) return "Bajo stock";
    return "Disponible";
  };

  const GridSkeleton = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-2 sm:gap-4">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
          <Skeleton className="h-32 sm:h-48 w-full" />
          <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
            <Skeleton className="h-3 sm:h-4 w-3/4" />
            <Skeleton className="h-2 sm:h-3 w-1/4" />
            <div className="flex justify-between">
              <Skeleton className="h-2 sm:h-4 w-1/3" />
              <Skeleton className="h-2 sm:h-4 w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const ListSkeleton = () => (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card"
        >
          <Skeleton className="h-16 w-16 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <MainLayout title="Productos" description="Gestiona tu catálogo de helados">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <PageHeader
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={descargarPlanilla}
                className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
              >
                <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Descargar Planilla</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={importando}
                className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 relative"
                onClick={() => document.getElementById("csv-upload")?.click()}
              >
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Subir Planilla</span>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) subirPlanilla(file);
                    e.target.value = "";
                  }}
                />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => { loadAllProducts(); setRemitoImportOpen(true); }}
                className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
              >
                <FileUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Importar Remito</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInventoryHistory(true)}
                className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
              >
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Valor Inventario</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
              >
                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Filtros</span>
                {activeFilterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center text-[10px] sm:text-xs"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              <div className="flex border border-border rounded-lg">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-r-none border-0 h-9"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-l-none border-0 h-9"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <Button
                onClick={handleCreate}
                className="gap-1 sm:gap-2 bg-primary hover:bg-primary/90 h-8 sm:h-9 px-2 sm:px-3"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Nuevo</span>
                <span className="sm:hidden text-xs">Nuevo</span>
              </Button>
            </>
          }
        />

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-10 h-10 sm:h-11 text-sm"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => { setSearchInput(""); setSearchQuery(""); }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">Filtros</h3>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-1 h-7 text-xs"
                >
                  <X className="h-3 w-3" />
                  Limpiar
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowFilters(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            {/* Categoría */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Categoría
              </label>
              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {[...new Set(availableCategories)].sort().map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Marca */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Marca
              </label>
              <Select
                value={marcaFilter}
                onValueChange={(v) => setMarcaFilter(v as MarcaFilter)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {[...new Set(availableMarcas)].sort().map((marca) => (
                    <SelectItem key={marca} value={marca}>
                      {marca}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Precio */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Precio
              </label>
              <Select
                value={priceFilter}
                onValueChange={(v) => setPriceFilter(v as PriceFilter)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="0-2800">Hasta $2.800</SelectItem>
                  <SelectItem value="2801-3000">$2.800 – $3.000</SelectItem>
                  <SelectItem value="3001-3200">$3.000 – $3.200</SelectItem>
                  <SelectItem value="3201+">Más de $3.200</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sin TACC */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Contenido
              </label>
              <Select
                value={sinTaccFilter}
                onValueChange={(v) => setSinTaccFilter(v as SinTaccFilter)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sin-tacc">Sin TACC</SelectItem>
                  <SelectItem value="con-tacc">Con TACC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stock */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Stock
              </label>
              <Select
                value={stockFilter}
                onValueChange={(v) => setStockFilter(v as StockFilter)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="low">Bajo stock</SelectItem>
                  <SelectItem value="out">Sin stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas - Responsive */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">
                Total
              </p>
              <p className="text-lg sm:text-2xl font-bold text-foreground">
                {stats.totalProducts}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">
                Valor
              </p>
              <p className="text-lg sm:text-2xl font-bold text-foreground truncate">
                {new Intl.NumberFormat("es-AR", {
                  notation: "compact",
                  compactDisplay: "short",
                  maximumFractionDigits: 1,
                }).format(stats.totalInventoryValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">
                Bajo
              </p>
              <p className="text-lg sm:text-2xl font-bold text-foreground">
                {stats.lowStockCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-rose-100 flex items-center justify-center">
              <X className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">
                Sin stock
              </p>
              <p className="text-lg sm:text-2xl font-bold text-foreground">
                {stats.outOfStockCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de selección masiva - AHORA CON "Deshabilitar" */}
      {selectedProducts.length > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-border bg-card/80 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <span className="font-medium text-sm">
              {selectedProducts.length} seleccionados
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleBulkDeactivate}
            >
              <EyeOff className="h-4 w-4" />
              <span className="hidden sm:inline">Deshabilitar</span>
              <span className="sm:hidden">Sacar</span>
            </Button>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      {loading ? (
        viewMode === "grid" ? (
          <GridSkeleton />
        ) : (
          <ListSkeleton />
        )
      ) : (
        <>
          {totalCount === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-card/50 p-8 sm:p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    No se encontraron productos
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    {searchQuery || activeFilterCount > 0
                      ? "Prueba ajustando tus filtros"
                      : "Comienza agregando tu primer producto"}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={handleCreate} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Agregar
                    </Button>
                    {(searchQuery || activeFilterCount > 0) && (
                      <Button variant="outline" onClick={clearFilters}>
                        Limpiar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Vista Grid - SIEMPRE 2 COLUMNAS EN MÓVIL */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-2">
                  {paginatedProducts.map((product) => {
                    const isSelected = selectedProducts.includes(product.id);
                    const stockColor = getStockColor(product.stock);
                    const fallbackImg = "/logo.png";
                    const imageSrc =
                      product.imageUrl && typeof product.imageUrl === "string"
                        ? product.imageUrl.startsWith("blob:")
                          ? fallbackImg
                          : product.imageUrl
                        : fallbackImg;

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          "group relative rounded-xl border-2 bg-card overflow-hidden transition-all duration-300 hover:shadow-lg",
                          isSelected
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        {/* Checkbox */}
                        <div className="absolute top-2 left-2 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProductSelection(product.id);
                            }}
                            className={cn(
                              "h-4 w-4 sm:h-5 sm:w-5 rounded border flex items-center justify-center transition-colors bg-background/80 backdrop-blur",
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-border hover:border-primary",
                            )}
                          >
                            {isSelected && (
                              <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                            )}
                          </button>
                        </div>

                        {/* Badge Sin TACC */}
                        {(product as any).sinTacc && (
                          <div className="absolute top-2 right-2 z-10">
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] sm:text-xs px-1.5 py-0">
                              <WheatOff className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
                              <span className="hidden sm:inline">Sin TACC</span>
                              <span className="sm:hidden">S/T</span>
                            </Badge>
                          </div>
                        )}
                        {(product as any).disabled && (
                          <div className="absolute top-8 left-2 z-10">
                            <Badge
                              variant="destructive"
                              className="text-[10px] sm:text-xs px-1.5 py-0 flex items-center gap-1"
                            >
                              <EyeOff className="h-3 w-3" />
                              Deshabilitado
                            </Badge>
                          </div>
                        )}

                        {/* Badge Base */}
                        {(product as any).marca && (
                          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                            <Badge
                              variant="secondary"
                              className="text-[10px] sm:text-xs px-1.5 py-0 capitalize bg-background/80 backdrop-blur"
                            >
                              {(product as any).marca}
                            </Badge>
                          </div>
                        )}


                        {/* Contenido */}
                        <div className="p-1.5">
                          <div className="mb-1">
                            <h3 className="font-semibold text-foreground text-[10px] sm:text-xs line-clamp-1">
                              {product.name}
                            </h3>
                          </div>

                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] sm:text-xs font-bold text-primary">
                              {formatCurrency(product.price)}
                            </span>
                            <Badge
                              variant={
                                stockColor === "destructive"
                                  ? "destructive"
                                  : stockColor === "warning"
                                    ? "secondary"
                                    : "outline"
                              }
                              className={cn(
                                "font-medium text-[10px] px-1 py-0",
                                stockColor === "warning" &&
                                  "bg-amber-100 text-amber-800 border-amber-200",
                                stockColor === "success" &&
                                  "bg-green-100 text-green-800 border-green-200",
                              )}
                            >
                              {product.stock}
                            </Badge>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleViewHistory(product)}
                              title="Historial"
                            >
                              <History className="h-3 w-3" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleDuplicate(product)}
                              title="Duplicar"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEdit(product)}
                              title="Editar"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>

                            {(product as any).disabled ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-green-600 hover:text-green-700"
                                onClick={() => handleEnable(product)}
                                title="Habilitar producto"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-amber-600 hover:text-amber-700"
                                onClick={() => handleDeactivate(product)}
                                title="Deshabilitar"
                              >
                                <EyeOff className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Vista Lista - Tabla de gestión */
                <div className="rounded-lg border border-border overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border text-[11px] font-medium text-muted-foreground">
                    <button
                      onClick={toggleSelectAll}
                      className={cn(
                        "h-3.5 w-3.5 flex-shrink-0 rounded border flex items-center justify-center transition-colors",
                        selectedProducts.length === products.length && products.length > 0
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background border-border hover:border-primary",
                      )}
                    >
                      {selectedProducts.length === products.length && products.length > 0 && (
                        <Check className="h-2 w-2" />
                      )}
                    </button>
                    <span className="flex-1">Producto</span>
                    <span className="hidden md:block w-36">Categoría</span>
                    <span className="w-20 text-right">Precio</span>
                    <span className="w-14 text-right">Stock</span>
                    <span className="w-24 text-right">Acciones</span>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-border">
                  {paginatedProducts.map((product) => {
                    const isSelected = selectedProducts.includes(product.id);
                    const stockColor = getStockColor(product.stock);

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors",
                          isSelected && "bg-primary/5",
                        )}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleProductSelection(product.id)}
                          className={cn(
                            "h-3.5 w-3.5 flex-shrink-0 rounded border flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "bg-background border-border hover:border-primary",
                          )}
                        >
                          {isSelected && <Check className="h-2 w-2" />}
                        </button>

                        {/* Nombre */}
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className={cn("text-xs font-medium truncate", (product as any).disabled && "text-muted-foreground line-through")}>
                            {product.name}
                          </span>
                          {(product as any).sinTacc && <WheatOff className="h-3 w-3 text-green-600 flex-shrink-0" title="Sin TACC" />}
                          {(product as any).disabled && <EyeOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                        </div>

                        {/* Categoría */}
                        <span className="hidden md:block w-36 text-[11px] text-muted-foreground truncate">{product.category}</span>

                        {/* Precio */}
                        <span className="w-20 text-xs font-semibold text-primary text-right flex-shrink-0">
                          {formatCurrency(product.price)}
                        </span>

                        {/* Stock */}
                        <span className={cn(
                          "w-14 text-xs text-right flex-shrink-0 font-medium",
                          stockColor === "destructive" && "text-destructive",
                          stockColor === "warning" && "text-amber-600",
                          stockColor === "success" && "text-green-600",
                        )}>
                          {product.stock}
                        </span>

                        {/* Acciones */}
                        <div className="flex items-center justify-end gap-0.5 w-24 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewHistory(product)} title="Historial">
                            <History className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDuplicate(product)} title="Duplicar">
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(product)} title="Editar">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {(product as any).disabled ? (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={() => handleEnable(product)} title="Habilitar">
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600" onClick={() => handleDeactivate(product)} title="Deshabilitar">
                              <EyeOff className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Paginación */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Mostrar:</span>
                {[10, 20, 50, 100].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      pageSize === size
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {Math.min((currentPage - 1) * pageSize + 1, totalCount)}–
                  {Math.min(currentPage * pageSize, totalCount)} de{" "}
                  {totalCount}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-border hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-medium min-w-[2rem] text-center">
                  {currentPage}/{totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-border hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modales */}
      <ProductModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        product={editingProduct}
        onSave={handleSave}
        availableCategories={availableCategories}
        availableMarcas={availableMarcas}
      />

      <StockHistoryModal
        open={showStockHistory}
        onOpenChange={setShowStockHistory}
        product={selectedProductHistory}
        history={stockHistory.filter(
          (h) => h.productId === selectedProductHistory?.id,
        )}
      />

      <InventoryValueHistory
        open={showInventoryHistory}
        onOpenChange={setShowInventoryHistory}
        history={inventoryHistory}
      />

      {/* Diálogo Deshabilitar Individual */}
      <ConfirmDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        title="Deshabilitar"
        description={`¿Está seguro que desea deshabilitar "${productToDeactivate?.name}"? El producto dejará de mostrarse pero conservará su stock.`}
        confirmText="Deshabilitar"
        onConfirm={confirmDeactivate}
        variant="destructive"
      />

      {/* Diálogo Deshabilitar Masivo */}
      <ConfirmDialog
        open={bulkDeactivateDialogOpen}
        onOpenChange={setBulkDeactivateDialogOpen}
        title="Sacar Productos de Stock"
        description={`¿Está seguro que desea deshabilitar ${selectedProducts.length} productos? Dejarán de mostrarse pero conservarán su stock.`}
        confirmText="Deshabilitar"
        onConfirm={confirmBulkDeactivate}
        variant="destructive"
      />

      {/* Modal importar remito proveedor */}
      <RemitoImportModal
        open={remitoImportOpen}
        onClose={() => setRemitoImportOpen(false)}
        products={allProducts.filter((p) => !(p as any).disabled)}
        onConfirm={handleRemitoConfirm}
      />
    </MainLayout>
  );
}
