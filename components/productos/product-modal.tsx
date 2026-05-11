"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/lib/types";
import { Loader2, Upload, ImageIcon, X, Plus, PackagePlus } from "lucide-react";

const DEFAULT_IMAGE = "/logo.png";

const DEFAULT_CATEGORIES = [
  "Helado individual",
  "Helado a granel",
  "Torta helada",
  "Congelado embutido",
  "Congelado cárnico",
  "Congelado papa",
  "Congelado verdura",
  "Congelado rebozado",
  "Bebida",
];

const DEFAULT_MARCAS = [
  "MIO",
  "YO HELADERIAS",
  "TARGET",
  "CARCARAÑA",
  "FRIAR",
  "MC CAIN",
  "RESTAURANT",
  "SIMPLOT",
  "Sin identificar",
];

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (product: Omit<Product, "id" | "createdAt">) => Promise<void>;
  availableCategories?: string[];
  availableMarcas?: string[];
}

export function ProductModal({
  open,
  onOpenChange,
  product,
  onSave,
  availableCategories,
  availableMarcas,
}: ProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [marcas, setMarcas] = useState<string[]>(DEFAULT_MARCAS);

  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showNewMarcaInput, setShowNewMarcaInput] = useState(false);
  const [newMarcaInput, setNewMarcaInput] = useState("");

  // Stock aditivo (solo en edición)
  const [stockToAdd, setStockToAdd] = useState(0);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    stock: 0,
    imageUrl: "",
    category: "",
    marca: "Sin identificar" as string,
    sinTacc: false,
  });

  useEffect(() => {
    const cats = availableCategories
      ? [...new Set([...DEFAULT_CATEGORIES, ...availableCategories])]
      : DEFAULT_CATEGORIES;
    const mrs = availableMarcas
      ? [...new Set([...DEFAULT_MARCAS, ...availableMarcas])]
      : DEFAULT_MARCAS;
    setCategories(cats);
    setMarcas(mrs);
  }, [availableCategories, availableMarcas]);

  useEffect(() => {
    if (!open) {
      setImagePreview(null);
      setShowNewCategoryInput(false);
      setShowNewMarcaInput(false);
      setNewCategoryInput("");
      setNewMarcaInput("");
      setStockToAdd(0);
    }
  }, [open]);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price,
        stock: product.stock,
        imageUrl: product.imageUrl || "",
        category: product.category,
        marca: (product as any).marca || "Sin identificar",
        sinTacc: (product as any).sinTacc || false,
      });
      setImagePreview(product.imageUrl || null);
      setStockToAdd(0);
    } else {
      setFormData({
        name: "",
        description: "",
        price: 0,
        stock: 0,
        imageUrl: "",
        category: "",
        marca: "Sin identificar",
        sinTacc: false,
      });
      setImagePreview(null);
      setStockToAdd(0);
    }
  }, [product, open]);

  const addNewCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    setCategories((prev) => [...new Set([...prev, trimmed])]);
    setFormData((prev) => ({ ...prev, category: trimmed }));
    setNewCategoryInput("");
    setShowNewCategoryInput(false);
  };

  const addNewMarca = () => {
    const trimmed = newMarcaInput.trim();
    if (!trimmed) return;
    setMarcas((prev) => [...new Set([...prev, trimmed])]);
    setFormData((prev) => ({ ...prev, marca: trimmed }));
    setNewMarcaInput("");
    setShowNewMarcaInput(false);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setImagePreview(base64);
    setFormData((prev) => ({ ...prev, imageUrl: base64 }));
  };

  const clearImage = () => {
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const finalStock = isEditing
        ? formData.stock + stockToAdd
        : formData.stock;
      await onSave({
        ...formData,
        description: formData.description || "",
        imageUrl: formData.imageUrl || "",
        stock: finalStock,
      });
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const isEditing = !!product;
  const isValid =
    formData.name.trim() && formData.category && formData.price > 0;

  const displayImage = imagePreview || DEFAULT_IMAGE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? "Editar Producto" : "Nuevo Producto"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEditing
              ? "Actualizá la información del producto"
              : "Completá la información básica para crear el producto"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          {/* Nombre + Descripción */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ej: Helado de Chocolate Suizo"
                className="h-10"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Descripción
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Breve descripción del sabor y características..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <Separator />

          {/* Clasificación: Categoría + Marca lado a lado en desktop */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Categoría */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Categoría <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => {
                    if (val === "__new_category__") {
                      setShowNewCategoryInput(true);
                    } else {
                      setFormData({ ...formData, category: val });
                      setShowNewCategoryInput(false);
                    }
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Seleccioná..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="__new_category__"
                      className="text-primary font-medium"
                    >
                      <span className="flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Nueva categoría
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {showNewCategoryInput && (
                  <div className="flex gap-1.5">
                    <Input
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      placeholder="Nueva categoría..."
                      className="h-9 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addNewCategory();
                        }
                        if (e.key === "Escape") {
                          setShowNewCategoryInput(false);
                          setNewCategoryInput("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 px-2.5"
                      onClick={addNewCategory}
                      disabled={!newCategoryInput.trim()}
                    >
                      OK
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategoryInput("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Marca */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Marca</Label>
                <Select
                  value={formData.marca}
                  onValueChange={(val) => {
                    if (val === "__new_marca__") {
                      setShowNewMarcaInput(true);
                    } else {
                      setFormData({ ...formData, marca: val });
                      setShowNewMarcaInput(false);
                    }
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Seleccioná..." />
                  </SelectTrigger>
                  <SelectContent>
                    {marcas.map((marca) => (
                      <SelectItem key={marca} value={marca}>
                        {marca}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="__new_marca__"
                      className="text-primary font-medium"
                    >
                      <span className="flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Nueva marca
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {showNewMarcaInput && (
                  <div className="flex gap-1.5">
                    <Input
                      value={newMarcaInput}
                      onChange={(e) => setNewMarcaInput(e.target.value)}
                      placeholder="Nueva marca..."
                      className="h-9 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addNewMarca();
                        }
                        if (e.key === "Escape") {
                          setShowNewMarcaInput(false);
                          setNewMarcaInput("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 px-2.5"
                      onClick={addNewMarca}
                      disabled={!newMarcaInput.trim()}
                    >
                      OK
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => {
                        setShowNewMarcaInput(false);
                        setNewMarcaInput("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Sin TACC */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div className="space-y-0.5">
                <Label
                  htmlFor="sin-tacc"
                  className="text-sm font-medium cursor-pointer"
                >
                  Producto Sin TACC
                </Label>
                <p className="text-xs text-muted-foreground">
                  Apto para celíacos
                </p>
              </div>
              <Switch
                id="sin-tacc"
                checked={formData.sinTacc}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, sinTacc: checked })
                }
              />
            </div>
          </div>

          <Separator />

          {/* Precio y Stock */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Precio y Stock</Label>
            <div className="grid grid-cols-2 gap-4">
              {/* Precio */}
              <div className="space-y-2">
                <Label htmlFor="price" className="text-xs text-muted-foreground">
                  Precio (ARS)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    $
                  </span>
                  <Input
                   id="price"
                   type="text"
                    min="0"
                    
                    value={
                      formData.price === 0
                        ? ''
                        : String(formData.price).replace('.', ',')
                    }
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      const cleanedValue = rawValue.replace(/[^0-9.,]/g, '').replace(',', '.');
                      const numValue = parseFloat(cleanedValue);
                      setFormData({
                        ...formData,
                        price: isNaN(numValue) ? 0 : numValue,
                      });
                    }}
                    className="pl-7 h-10"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-2">
                {isEditing ? (
                  <>
                    <Label className="text-xs text-muted-foreground">
                      Stock actual
                    </Label>
                    <div className="h-10 px-3 flex items-center rounded-md border border-border bg-muted/50 text-sm font-medium">
                      {formData.stock} uds
                    </div>
                  </>
                ) : (
                  <>
                    <Label htmlFor="stock" className="text-xs text-muted-foreground">
                      Stock inicial
                    </Label>
                    <Input
                      id="stock"
type="text"

                      value={formData.stock || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, stock: Number(e.target.value) })
                      }
                      className="h-10"
                      placeholder="0"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Agregar stock (solo en edición) */}
            {isEditing && (
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                  <PackagePlus className="h-3.5 w-3.5" />
                  Agregar más stock
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="0"
                    value={stockToAdd || ""}
                    onChange={(e) =>
                      setStockToAdd(Math.max(0, Number(e.target.value)))
                    }
                    className="h-9 w-28"
                    placeholder="0"
                  />
                  {stockToAdd > 0 && (
                    <span className="text-sm text-muted-foreground">
                      → Nuevo total:{" "}
                      <span className="font-semibold text-foreground">
                        {formData.stock + stockToAdd} uds
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Imagen compacta */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Imagen del producto</Label>

            <div className="flex items-center gap-3">
              {/* Miniatura */}
              <div className="h-14 w-14 rounded-lg border border-border overflow-hidden flex-shrink-0 bg-muted">
                <img
                  src={displayImage}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_IMAGE;
                  }}
                />
              </div>

              {/* Controles */}
              <div className="flex-1 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9 gap-2 text-xs justify-start"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 flex-shrink-0" />
                  {imagePreview && !imagePreview.startsWith("http")
                    ? "Cambiar archivo"
                    : "Subir imagen"}
                </Button>

                <div className="relative">
                  <ImageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="imageUrl"
                    value={
                      formData.imageUrl && !formData.imageUrl.startsWith("data:")
                        ? formData.imageUrl
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, imageUrl: val });
                      setImagePreview(val || null);
                    }}
                    placeholder="O pegá una URL..."
                    className="pl-8 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Limpiar */}
              {imagePreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={clearImage}
                  title="Quitar imagen"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !isValid}
              className="min-w-[120px]"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Guardar Cambios" : "Crear Producto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
