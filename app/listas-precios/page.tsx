"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Loader2,
  Tag,
  Percent,
} from "lucide-react";
import { priceListApi, auditApi, productsApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { PriceList, PriceListType, Product } from "@/lib/types";
import { calculatePrice } from "@/services/price-list-service";
import { formatCurrency } from "@/lib/utils/format";

const TYPE_LABELS: Record<PriceListType, string> = {
  general: "General",
  mayorista: "Mayorista",
  especial: "Especial",
};

export default function ListasPreciosPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PriceList | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [type, setType] = useState<PriceListType>("mayorista");
  const [description, setDescription] = useState("");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [isActive, setIsActive] = useState(true);

  // Preview
  const [previewList, setPreviewList] = useState<PriceList | null>(null);

  useEffect(() => {
    let mounted = true;
    const doLoad = async () => {
      try {
        const [listsData, productsData] = await Promise.all([
          priceListApi.getAll(),
          productsApi.getAll(),
        ]);
        if (!mounted) return;
        setLists(listsData);
        setProducts(productsData);
      } catch (error) {
        if (!mounted) return;
        // Error silenciado
      } finally {
        if (mounted) setLoading(false);
      }
    };
    doLoad();
    return () => { mounted = false; };
  }, []);

  const loadData = async () => {
    try {
      const [listsData, productsData] = await Promise.all([
        priceListApi.getAll(),
        productsApi.getAll(),
      ]);
      setLists(listsData);
      setProducts(productsData);
    } catch (error) {
      // Error silenciado
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setType("mayorista");
    setDescription("");
    setDiscountPercent("10");
    setIsActive(true);
    setShowModal(true);
  };

  const openEdit = (list: PriceList) => {
    setEditing(list);
    setName(list.name);
    setType(list.type);
    setDescription(list.description);
    const pct = Math.round((1 - list.multiplier) * 100);
    setDiscountPercent(String(pct));
    setIsActive(list.isActive);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);

    const multiplier = 1 - parseFloat(discountPercent) / 100;
    const data = {
      name: name.trim(),
      type,
      description: description.trim(),
      multiplier: Math.max(0.01, Math.min(2, multiplier)),
      isActive,
    };

    try {
      if (editing) {
        await priceListApi.update(editing.id, data);
        await auditApi.log({
          action: "price_list_updated",
          userId: user.id,
          userName: user.name,
          description: `Actualizo lista de precios "${name}" (${discountPercent}% dto)`,
          entityType: "price_list",
          entityId: editing.id,
        });
      } else {
        await priceListApi.create(data);
        await auditApi.log({
          action: "price_list_updated",
          userId: user.id,
          userName: user.name,
          description: `Creo lista de precios "${name}" (${discountPercent}% dto)`,
          entityType: "price_list",
        });
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      // Error silenciado
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (list: PriceList) => {
    if (!confirm(`Eliminar lista "${list.name}"?`) || !user) return;
    try {
      await priceListApi.delete(list.id);
      await auditApi.log({
        action: "price_list_updated",
        userId: user.id,
        userName: user.name,
        description: `Elimino lista de precios "${list.name}"`,
        entityType: "price_list",
        entityId: list.id,
      });
      loadData();
    } catch (error) {
      // Error silenciado
    }
  };

  return (
    <MainLayout title="Listas de Precios" description="Gestion de precios por tipo de cliente">
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Listas de Precios</h1>
            <p className="text-muted-foreground text-sm">
              Configura descuentos para distintos tipos de cliente
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Lista
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : lists.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Tag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">Sin listas de precios</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Crea listas con descuentos para mayoristas, clientes especiales, etc.
              </p>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera lista
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lists.map((list) => {
              const discPct = Math.round((1 - list.multiplier) * 100);
              return (
                <Card key={list.id} className={!list.isActive ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        {list.name}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setPreviewList(previewList?.id === list.id ? null : list)}
                        >
                          <Percent className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(list)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(list)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{TYPE_LABELS[list.type]}</Badge>
                      {!list.isActive && <Badge variant="outline">Inactiva</Badge>}
                    </div>
                    <p className="text-3xl font-bold text-primary">-{discPct}%</p>
                    {list.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {list.description}
                      </p>
                    )}

                    {/* Price preview */}
                    {previewList?.id === list.id && (
                      <div className="mt-3 border-t pt-3 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase">
                          Vista previa de precios
                        </p>
                        {products.slice(0, 5).map((p) => (
                          <div key={p.id} className="flex justify-between text-sm">
                            <span className="truncate max-w-[60%]">{p.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground line-through text-xs">
                                {formatCurrency(p.price)}
                              </span>
                              <span className="font-medium">
                                {formatCurrency(calculatePrice(p.price, list))}
                              </span>
                            </div>
                          </div>
                        ))}
                        {products.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            y {products.length - 5} productos mas...
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create/Edit Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar Lista" : "Nueva Lista de Precios"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input
                  placeholder="Ej: Mayorista, Kioscos, Especial..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as PriceListType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="mayorista">Mayorista</SelectItem>
                    <SelectItem value="especial">Especial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descuento (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="90"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Multiplicador: x{(1 - parseFloat(discountPercent || "0") / 100).toFixed(2)}
                  {products[0] && (
                    <> — Ej: {formatCurrency(products[0].price)} → {formatCurrency(Math.round(products[0].price * (1 - parseFloat(discountPercent || "0") / 100)))}</>
                  )}
                </p>
              </div>
              <div>
                <Label>Descripcion (opcional)</Label>
                <Input
                  placeholder="Para clientes que compran mas de 10 unidades..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={!name.trim() || saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
