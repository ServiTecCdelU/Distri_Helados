"use client";

import Image from "next/image";
import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus, ChevronRight, Star, TrendingUp } from "lucide-react";
import type { Product, CartItem } from "@/lib/types";

interface TopProductsProps {
  products: Product[];
  cart: CartItem[];
  formatPrice: (price: number) => string;
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, delta: number) => void;
}

interface TopProductCardProps {
  product: Product;
  idx: number;
  inCart: CartItem | undefined;
  isOut: boolean;
  formatPrice: (price: number) => string;
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, delta: number) => void;
}

const TopProductCard = memo(function TopProductCard({ product, idx, inCart, isOut, formatPrice, addToCart, updateQuantity }: TopProductCardProps) {
  const [imgSrc, setImgSrc] = useState(product.imageUrl || "/logo.png");

  return (
    <Card className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/90 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      {idx === 0 && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 flex items-center gap-1 bg-amber-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow">
          <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-white" />
          #1
        </div>
      )}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Image
          src={imgSrc}
          alt={product.name}
          fill
          priority={idx === 0}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImgSrc("/logo.png")}
        />
        {isOut && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <span className="text-xs font-semibold text-muted-foreground bg-background/80 px-2.5 py-1 rounded-full">Sin stock</span>
          </div>
        )}
      </div>
      <CardContent className="p-3 sm:p-4">
        <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center justify-between mt-2.5 sm:mt-3">
          <span className="text-sm sm:text-lg font-bold text-foreground">{formatPrice(product.price)}</span>
          {inCart ? (
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="outline" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-transparent" onClick={() => updateQuantity(product.id, -1)}>
                <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Button>
              <span className="w-5 text-center text-xs sm:text-sm font-semibold">{inCart.quantity}</span>
              <Button size="icon" variant="outline" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-transparent" onClick={() => updateQuantity(product.id, 1)} disabled={inCart.quantity >= product.stock}>
                <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-full text-xs" onClick={() => addToCart(product)} disabled={isOut}>
              <Plus className="h-3.5 w-3.5 mr-0.5" />
              <span className="hidden sm:inline">Agregar</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export function TopProducts({ products, cart, formatPrice, addToCart, updateQuantity }: TopProductsProps) {
  if (products.length === 0) return null;

  const scrollToCatalog = () =>
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section className="container mx-auto px-4 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">Mas Vendidos</h2>
        </div>
        <button
          onClick={scrollToCatalog}
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Ver todos
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
        {products.slice(0, 4).map((product, idx) => {
          const inCart = cart.find((i) => i.product.id === product.id);
          const isOut = product.stock <= 0;
          return (
            <TopProductCard
              key={product.id}
              product={product}
              idx={idx}
              inCart={inCart}
              isOut={isOut}
              formatPrice={formatPrice}
              addToCart={addToCart}
              updateQuantity={updateQuantity}
            />
          );
        })}
      </div>
    </section>
  );
}
