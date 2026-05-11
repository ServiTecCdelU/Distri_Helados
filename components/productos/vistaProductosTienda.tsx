"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search,
  Plus,
  Minus,
  IceCream,
  Filter,
  ChevronDown,
  Star,
  TrendingUp,
  Clock,
  DollarSign,
  Grid2X2,
  List,
  X,
} from "lucide-react"
import Image from "next/image"
import type { Product, CartItem } from "@/lib/types"
import { useState, useEffect } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"

interface VistaProductosTiendaProps {
  products: Product[]
  cart: CartItem[]
  onAddToCart: (product: Product) => void
  onUpdateQuantity: (productId: string, delta: number) => void
  formatPrice: (price: number) => string
  showHeader?: boolean
  initialSearch?: string
  onSearchChange?: (value: string) => void
}

type SortOption = "default" | "price-asc" | "price-desc" | "name-asc" | "name-desc" | "stock"
type ViewMode = "grid" | "list"

export function VistaProductosTienda({
  products,
  cart,
  onAddToCart,
  onUpdateQuantity,
  formatPrice,
  showHeader = true,
  initialSearch = "",
  onSearchChange,
}: VistaProductosTiendaProps) {
  const [search, setSearch] = useState(initialSearch)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortOption>("default")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000])
  const [showFilters, setShowFilters] = useState(false)
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "low-stock">("all")

  // Obtener todas las categorías únicas
  const categories = Array.from(new Set(products.map(p => p.category)))

  // Filtrar productos
  const filteredProducts = products.filter(product => {
    // Filtro por búsqueda
    const matchesSearch = 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.description.toLowerCase().includes(search.toLowerCase()) ||
      product.category.toLowerCase().includes(search.toLowerCase())

    // Filtro por categoría
    const matchesCategory = 
      selectedCategories.length === 0 || 
      selectedCategories.includes(product.category)

    // Filtro por precio
    const matchesPrice = 
      product.price >= priceRange[0] && 
      product.price <= priceRange[1]

    // Filtro por stock
    const matchesStock = 
      stockFilter === "all" ||
      (stockFilter === "in-stock" && product.stock > 0) ||
      (stockFilter === "low-stock" && product.stock > 0 && product.stock < 10)

    return matchesSearch && matchesCategory && matchesPrice && matchesStock
  })

  // Ordenar productos
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price-asc":
        return a.price - b.price
      case "price-desc":
        return b.price - a.price
      case "name-asc":
        return a.name.localeCompare(b.name)
      case "name-desc":
        return b.name.localeCompare(a.name)
      case "stock":
        return b.stock - a.stock
      default:
        return 0
    }
  })

  // Actualizar rango de precio máximo
  const maxPrice = Math.max(...products.map(p => p.price), 10000)

  // Manejar cambio en búsqueda
  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (onSearchChange) {
      onSearchChange(value)
    }
  }

  // Limpiar todos los filtros
  const clearFilters = () => {
    setSearch("")
    setSelectedCategories([])
    setSortBy("default")
    setPriceRange([0, maxPrice])
    setStockFilter("all")
    if (onSearchChange) {
      onSearchChange("")
    }
  }

  // Toggle categoría
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  // Contador de filtros activos
  const activeFilterCount = [
    search ? 1 : 0,
    selectedCategories.length,
    priceRange[0] > 0 || priceRange[1] < maxPrice ? 1 : 0,
    stockFilter !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* Barra de búsqueda y filtros */}
      <div className="space-y-4">
        {/* Barra de búsqueda */}
        {!showHeader && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar helados por nombre, categoría o descripción..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-10"
            />
            {search && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        {/* Barra de controles */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            
            <div className="hidden sm:flex items-center gap-2">
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid2X2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {sortedProducts.length} productos
            </span>
            <Separator orientation="vertical" className="h-6" />
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Destacados</SelectItem>
                <SelectItem value="price-asc">Precio: Menor a Mayor</SelectItem>
                <SelectItem value="price-desc">Precio: Mayor a Menor</SelectItem>
                <SelectItem value="name-asc">Nombre: A-Z</SelectItem>
                <SelectItem value="name-desc">Nombre: Z-A</SelectItem>
                <SelectItem value="stock">Stock: Mayor primero</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Panel de filtros desplegable */}
        {showFilters && (
          <div className="border rounded-lg p-4 space-y-4 bg-card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Filtros</h3>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar todos
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filtro por categorías */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Categorías</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {categories.map(category => (
                    <label key={category} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-sm">{category}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filtro por precio */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Rango de precio</h4>
                <div className="space-y-2">
                  <Slider
                    value={[priceRange[0], priceRange[1]]}
                    min={0}
                    max={maxPrice}
                    step={100}
                    onValueChange={(value) => setPriceRange([value[0], value[1]])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm">
                    <span>{formatPrice(priceRange[0])}</span>
                    <span>{formatPrice(priceRange[1])}</span>
                  </div>
                </div>
              </div>

              {/* Filtro por stock */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Disponibilidad</h4>
                <div className="space-y-1">
                  {[
                    { value: "all", label: "Todos los productos" },
                    { value: "in-stock", label: "En stock" },
                    { value: "low-stock", label: "Pocas unidades" },
                  ].map(option => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={stockFilter === option.value}
                        onChange={() => setStockFilter(option.value as any)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Etiquetas de filtros activos */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {search && (
                  <Badge variant="secondary" className="gap-1">
                    Buscando: "{search}"
                    <button onClick={() => handleSearchChange("")}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {selectedCategories.map(cat => (
                  <Badge key={cat} variant="secondary" className="gap-1">
                    {cat}
                    <button onClick={() => toggleCategory(cat)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
                  <Badge variant="secondary" className="gap-1">
                    Precio: {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                    <button onClick={() => setPriceRange([0, maxPrice])}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {stockFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    {stockFilter === "in-stock" ? "En stock" : "Pocas unidades"}
                    <button onClick={() => setStockFilter("all")}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Indicadores de ordenamiento */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {sortBy !== "default" && (
            <Badge variant="outline" className="gap-1">
              {sortBy === "price-asc" && <TrendingUp className="h-3 w-3" />}
              {sortBy === "price-desc" && <TrendingUp className="h-3 w-3 rotate-180" />}
              {sortBy === "name-asc" && "A-Z"}
              {sortBy === "name-desc" && "Z-A"}
              {sortBy === "stock" && "Stock"}
            </Badge>
          )}
          {selectedCategories.length > 0 && (
            <Badge variant="outline">
              {selectedCategories.length} categoría{selectedCategories.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Grid de productos */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedProducts.map((product) => {
            const inCart = cart.find((item) => item.product.id === product.id)
            const isOutOfStock = product.stock === 0

            return (
              <Card
                key={product.id}
                className={`overflow-hidden ${isOutOfStock ? "opacity-60" : ""} rounded-xl transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-border/50 hover:border-primary/20`}
              >
                <div className="relative aspect-square bg-gradient-to-br from-muted/50 to-muted">
                  <Image
                    src={product.imageUrl || "/placeholder.svg"}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-300 hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                  />
                  <div className="absolute top-2 left-2 right-2 flex justify-between">
                    <Badge 
                      className={`text-xs ${product.stock < 10 && product.stock > 0 ? 'bg-warning text-warning-foreground animate-pulse' : 'bg-secondary'}`}
                    >
                      {product.category}
                    </Badge>
                    {product.stock < 10 && product.stock > 0 && (
                      <Badge className="bg-destructive/90 text-destructive-foreground text-xs">
                        {product.stock} unidades
                      </Badge>
                    )}
                  </div>
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-background/90 flex items-center justify-center backdrop-blur-sm">
                      <Badge variant="destructive" className="text-sm px-3 py-1">
                        Agotado
                      </Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                      {product.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <div className="space-y-1">
                      <span className="text-lg font-bold text-foreground">
                        {formatPrice(product.price)}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Stock: {product.stock}</span>
                      </div>
                    </div>
                    
                    {inCart ? (
                      <div className="flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full"
                          onClick={() => onUpdateQuantity(product.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-bold">
                          {inCart.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full"
                          onClick={() => onUpdateQuantity(product.id, 1)}
                          disabled={inCart.quantity >= product.stock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onAddToCart(product)}
                        disabled={isOutOfStock}
                        className="gap-2 rounded-full px-4 hover:scale-105 transition-transform"
                      >
                        <Plus className="h-4 w-4" />
                        Agregar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* Vista de lista */
        <div className="space-y-4">
          {sortedProducts.map((product) => {
            const inCart = cart.find((item) => item.product.id === product.id)
            const isOutOfStock = product.stock === 0

            return (
              <Card key={product.id} className="overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-4 p-4">
                  <div className="relative w-full sm:w-32 aspect-square rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <Image
                      src={product.imageUrl || "/placeholder.svg"}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg text-foreground">
                            {product.name}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {product.category}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {product.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold text-foreground">
                          {formatPrice(product.price)}
                        </span>
                        <div className="text-sm text-muted-foreground">
                          Stock: {product.stock}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {product.stock < 10 && product.stock > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            ¡Solo {product.stock} disponibles!
                          </Badge>
                        )}
                        {isOutOfStock && (
                          <Badge variant="destructive">Agotado</Badge>
                        )}
                      </div>
                      
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onUpdateQuantity(product.id, -1)}
                            className="h-8 w-8"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">
                            {inCart.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onUpdateQuantity(product.id, 1)}
                            disabled={inCart.quantity >= product.stock}
                            className="h-8 w-8"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => onAddToCart(product)}
                          disabled={isOutOfStock}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Agregar al carrito
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Mensaje sin resultados */}
      {sortedProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="relative">
            <IceCream className="h-20 w-20 text-muted-foreground" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 blur-xl rounded-full" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-foreground">
              No se encontraron productos
            </h3>
            <p className="text-muted-foreground max-w-md">
              Intenta con otros términos de búsqueda o ajusta los filtros para ver más opciones
            </p>
          </div>
          <Button
            variant="outline"
            onClick={clearFilters}
            className="mt-4"
          >
            Limpiar todos los filtros
          </Button>
        </div>
      )}
    </div>
  )
}