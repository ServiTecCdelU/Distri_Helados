// app/tienda/page.tsx
"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Product, CartItem } from "@/lib/types";
import { CITIES } from "@/lib/types";
import { useCart } from "@/hooks/useCart";
import type { UserRole } from "@/hooks/useCart";
import { Label } from "@/components/ui/label";
import { DeliveryAddressSection } from "@/components/cart/UnifiedCart";
import {
  ShoppingCart,
  Plus,
  Minus,
  Search,
  IceCream,
  CheckCircle,
  ArrowLeft,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  SlidersHorizontal,
  WheatOff,
  ArrowUpDown,
  X,
  Home,
  Truck,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/services/auth-service";
import { BackgroundImage } from "@/components/ui/background-image";
import { HeroCarousel } from "@/components/tienda/hero-carousel";
import { TopProducts } from "@/components/tienda/top-products";

type StoreFrontProps = {
  showHeader?: boolean;
  showBackButton?: boolean;
  headerAction?: React.ReactNode;
  publicMode?: boolean;
};

const getInitials = (value?: string) => {
  if (!value) return "U";
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const getFirstName = (value?: string) => {
  if (!value) return "Usuario";
  return value.split(" ").filter(Boolean)[0] || "Usuario";
};

function ProductImage({ imageUrl, name, priority }: { imageUrl?: string; name: string; priority?: boolean }) {
  const [src, setSrc] = useState(imageUrl || "/logo.png");
  return (
    <Image
      src={src}
      alt={name}
      fill
      priority={priority}
      className="object-cover transition-transform duration-300 group-hover:scale-105"
      onError={() => setSrc("/logo.png")}
    />
  );
}

function LogoImage() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full overflow-hidden shrink-0 bg-primary/10 ring-1 ring-primary/20">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-primary/20 rounded-full" />}
      <Image
        src="/logo.png"
        alt="Helados Mio"
        fill
        priority
        className={`object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

// Configuración de fondo - FÁCIL DE MODIFICAR
const BACKGROUND_CONFIG = {
  image: "/fondo.jpg",
  mobileImage: "/fondocel.jpg",
  opacity: 20,
  overlayOpacity: 0.88,
  fallback: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=1200&q=60",
};

export function StoreFront({
  showHeader = true,
  showBackButton = true,
  headerAction,
  publicMode = false,
}: StoreFrontProps) {
  const router = useRouter();
  const isPublicStore = publicMode;
  const { user, loading: authLoading } = useAuth();

  // Role para el carrito (null = público/cliente)
  const cartRole: UserRole = isPublicStore ? null : (user?.role === "admin" ? "admin" : user?.role === "seller" ? "seller" : null);
  const { state: cartState, actions: cartActions } = useCart(cartRole, user?.email);

  // Aliases for cart state used throughout the page
  const products = cartState.products;
  const cart = cartState.cart;
  const loading = cartState.loading;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 300);
  }, []);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [marcaFilter, setMarcaFilter] = useState("all");
  const [sinTaccFilter, setSinTaccFilter] = useState<
    "all" | "sin-tacc" | "con-tacc"
  >("all");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [sortOption, setSortOption] = useState<string>("default");

  // Top products state
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [publicStep, setPublicStep] = useState<"identify" | "delivery">("identify");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    const controller = new AbortController();
    const loadTopProducts = async () => {
      try {
        const res = await fetch("/api/public/mas-vendidos", { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        setTopProducts(data.products || []);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        // silently fail
      }
    };
    loadTopProducts();
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => Array.from(
    new Set(products.map((p) => p.category)),
  ).sort(), [products]);
  const priceRanges = [
    { id: "all", label: "Todos" },
    { id: "up-2800", label: "Hasta $2.800", min: 0, max: 2800 },
    { id: "2801-3000", label: "$2.801 - $3.000", min: 2801, max: 3000 },
    { id: "3001-3200", label: "$3.001 - $3.200", min: 3001, max: 3200 },
    { id: "3201-plus", label: "Más de $3.200", min: 3201, max: Infinity },
  ] as const;

  const marcas = useMemo(() => [
    "all",
    ...Array.from(new Set(
      products
        .map((p) => (p as any).marca as string)
        .filter(Boolean)
    )).sort((a, b) => {
      if (a.toUpperCase() === "MIO") return -1;
      if (b.toUpperCase() === "MIO") return 1;
      return a.localeCompare(b);
    }),
  ], [products]);

  const activeFiltersCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (priceFilter !== "all" ? 1 : 0) +
    (marcaFilter !== "all" ? 1 : 0) +
    (sinTaccFilter !== "all" ? 1 : 0) +
    (onlyInStock ? 1 : 0) +
    (onlyLowStock ? 1 : 0);

  const filteredProducts = useMemo(() => products.filter((p) => {
    // NUEVO: Excluir productos deshabilitados
    if ((p as any).disabled === true) return false;

    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    const matchesBase = marcaFilter === "all" || (p as any).marca === marcaFilter;
    const matchesSinTacc =
      sinTaccFilter === "all" ||
      (sinTaccFilter === "sin-tacc" && (p as any).sinTacc === true) ||
      (sinTaccFilter === "con-tacc" && (p as any).sinTacc !== true);
    const matchesStock = !onlyInStock || p.stock > 0;
    const matchesLowStock = !onlyLowStock || (p.stock > 0 && p.stock < 10);
    const range = priceRanges.find((item) => item.id === priceFilter);
    const matchesPrice =
      !range || range.id === "all"
        ? true
        : p.price >= (range.min ?? 0) && p.price <= (range.max ?? Infinity);
    return (
      matchesSearch &&
      matchesCategory &&
      matchesBase &&
      matchesSinTacc &&
      matchesStock &&
      matchesLowStock &&
      matchesPrice
    );
  }).sort((a, b) => {
    if (sortOption === "price-asc") return a.price - b.price;
    if (sortOption === "price-desc") return b.price - a.price;
    if (sortOption === "name-asc") return a.name.localeCompare(b.name);
    if (sortOption === "name-desc") return b.name.localeCompare(a.name);
    // default: con stock primero, luego Marca Mio
    const aInStock = (a.stock ?? 0) > 0 ? 0 : 1;
    const bInStock = (b.stock ?? 0) > 0 ? 0 : 1;
    if (aInStock !== bInStock) return aInStock - bInStock;
    const marcaA = ((a as any).marca || "").toUpperCase();
    const marcaB = ((b as any).marca || "").toUpperCase();
    if (marcaA === "MIO" && marcaB !== "MIO") return -1;
    if (marcaB === "MIO" && marcaA !== "MIO") return 1;
    return 0;
  }), [products, search, categoryFilter, marcaFilter, sinTaccFilter, onlyInStock, onlyLowStock, priceFilter, sortOption]);
  // Reset page when filters, search or sort change
  useEffect(() => { setPage(1); }, [search, categoryFilter, priceFilter, marcaFilter, sinTaccFilter, onlyInStock, onlyLowStock, sortOption]);

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const pagedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Aliases for cart actions used throughout the page
  const addToCart = cartActions.addToCart;
  const updateQuantity = cartActions.updateQuantity;
  const removeFromCart = cartActions.removeFromCart;
  const cartTotal = cartState.cartTotal;
  const cartCount = cartState.cartCount;
  const formatPrice = cartActions.formatCurrency;

  const handleProcessSale = useCallback(async () => {
    await cartActions.processSale();
    setIsCartOpen(false);
  }, [cartActions]);

  // Admin/seller → redirect a /ventas/nueva con carrito abierto (persiste en localStorage)
  // Público/cliente → modal paso a paso
  const openCart = useCallback(() => {
    if (user?.role === "admin" || user?.role === "seller") {
      router.push("/ventas/nueva?openCart=true");
    } else {
      setPublicStep("identify");
      setIsCartOpen(true);
    }
  }, [user?.role, router]);

  const canProceedFromIdentify = useCallback(() => {
    if (cartState.dniFound) return true;
    return (
      cartState.clientName.trim().length > 0 &&
      cartState.clientPhone.trim().length > 0 &&
      cartState.clientEmail.trim().length > 0
    );
  }, [cartState.dniFound, cartState.clientName, cartState.clientPhone, cartState.clientEmail]);

  // Pre-llenar DNI/CUIT cuando la búsqueda falla
  useEffect(() => {
    if (cartState.dniNotFound) {
      if (cartState.lookupType === "dni" && !cartState.clientDni) cartActions.setClientDni(cartState.dniLookup);
      if (cartState.lookupType === "cuit" && !cartState.clientCuit) cartActions.setClientCuit(cartState.dniLookup);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartState.dniNotFound]);

  // Al avanzar desde "identificación": ir directamente a entrega
  // El cliente se crea server-side al confirmar el pedido
  const handleIdentifyNext = useCallback(async () => {
    setPublicStep("delivery");
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.refresh();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <BackgroundImage
          src={BACKGROUND_CONFIG.image}
          mobileSrc={BACKGROUND_CONFIG.mobileImage}
          fallback={BACKGROUND_CONFIG.fallback}
          opacity={BACKGROUND_CONFIG.opacity}
          overlayOpacity={BACKGROUND_CONFIG.overlayOpacity}
        />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <IceCream className="h-12 w-12 text-primary animate-bounce" />
            <p className="text-muted-foreground">Cargando productos...</p>
          </div>
        </div>
      </div>
    );
  }

  const userInitials = getInitials(user?.name || user?.email);
  const displayName = getFirstName(user?.name || user?.email);
  const showAdminLink = user?.role === "admin" || user?.role === "seller";

  return (
    <div className="min-h-screen relative">
      {/* FONDO CON OPACIDAD CONFIGURABLE */}
      <BackgroundImage
        src={BACKGROUND_CONFIG.image}
        mobileSrc={BACKGROUND_CONFIG.mobileImage}
        fallback={BACKGROUND_CONFIG.fallback}
        opacity={BACKGROUND_CONFIG.opacity}
        overlayOpacity={BACKGROUND_CONFIG.overlayOpacity}
      />
      {/* CONTENIDO PRINCIPAL */}
      <div className="relative z-10">
        {/* Header */}
        {showHeader && (
          <header className="sticky top-0 z-50 border-b border-border/60 bg-card/90 backdrop-blur-lg supports-[backdrop-filter]:bg-card/80 shadow-sm">
            <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
              <div className="flex items-center justify-between gap-2">
                {/* Izquierda: back button + Logo */}
                <div className="flex items-center gap-2">
                  {showBackButton && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.back()}
                      aria-label="Volver"
                      className="h-9 w-9"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="flex items-center gap-2.5">
                    <LogoImage />
                    <div>
                      <h1 className="text-base sm:text-xl font-bold text-foreground leading-tight">
                        Helados Mio
                      </h1>
                      <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                        Tienda Online
                      </p>
                    </div>
                  </div>
                </div>

                {/* Derecha: acciones */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {headerAction}
                  <div className="sm:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full h-9 w-9"
                        >
                          <Menu className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {user ? (
                          <>
                            <DropdownMenuLabel className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage
                                  src={user.photoURL || ""}
                                  alt={displayName}
                                />
                                <AvatarFallback className="text-xs font-semibold">
                                  {userInitials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium truncate">
                                {displayName}
                              </span>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {showAdminLink && (
                              <DropdownMenuItem asChild>
                                <Link
                                  href="/dashboard"
                                  className="flex items-center gap-2"
                                >
                                  <LayoutDashboard className="h-4 w-4" />
                                  Panel Admin
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={handleSignOut}
                            >
                              <LogOut className="h-4 w-4" />
                              Cerrar sesión
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem asChild>
                            <Link href="/login">Ingresar</Link>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="hidden sm:block">
                    {user ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-10 px-2 rounded-full border border-transparent hover:border-border/60"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={user.photoURL || ""}
                                alt={displayName}
                              />
                              <AvatarFallback className="text-xs font-semibold">
                                {userInitials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex items-center ml-2 mr-1 text-left">
                              <span className="text-sm font-medium leading-none truncate max-w-[8rem]">
                                {displayName}
                              </span>
                            </span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={user.photoURL || ""}
                                alt={displayName}
                              />
                              <AvatarFallback className="text-xs font-semibold">
                                {userInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {displayName}
                              </p>
                            </div>
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {showAdminLink && (
                            <DropdownMenuItem asChild>
                              <Link
                                href="/dashboard"
                                className="flex items-center gap-2"
                              >
                                <LayoutDashboard className="h-4 w-4" />
                                Panel Admin
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={handleSignOut}
                          >
                            <LogOut className="h-4 w-4" />
                            Cerrar sesión
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button asChild size="sm" className="rounded-full px-4">
                        <Link href="/login">Ingresar</Link>
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="relative bg-transparent rounded-full h-9 w-9 sm:h-10 sm:w-auto sm:px-3"
                    onClick={openCart}
                  >
                    <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                    {cartCount > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold">
                        {cartCount}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>

              {/* Search - all sizes */}
              <div className="mt-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar helados..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-9 sm:h-10 rounded-full bg-muted/50 focus-visible:bg-background transition-colors text-sm"
                  />
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Hero Carousel */}
        {showHeader && (
          <div className="container mx-auto px-3 sm:px-4 mt-4 sm:mt-6">
            <HeroCarousel />
          </div>
        )}

        {/* Most Sold Products - comentado temporalmente para probar sin esta seccion
        {showHeader && (
          <TopProducts
            products={topProducts}
            cart={cart}
            formatPrice={formatPrice}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
          />
        )}
        */}

        {/* Products Grid */}
        {!showHeader && (
          <Button
            variant="outline"
            className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 h-14 w-14 rounded-full p-0 bg-card shadow-lg border-primary/20"
            onClick={openCart}
            aria-label="Abrir carrito"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <Badge className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold">
                {cartCount}
              </Badge>
            )}
          </Button>
        )}

        {/* Carrito público — solo usuarios no admin/seller */}
        <Dialog open={isCartOpen} onOpenChange={(open) => { if (!open) setIsCartOpen(false); }}>
          <DialogContent className="sm:max-w-md w-[calc(100vw-1rem)] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-lg border border-border/60 shadow-xl rounded-t-2xl sm:rounded-2xl">
            {/* Header */}
            <DialogHeader className="px-4 pt-4 pb-3 border-b bg-muted/30 shrink-0">
              <DialogTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Tu Pedido
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {cartCount} {cartCount === 1 ? "producto" : "productos"} · {formatPrice(cartState.finalTotal)}
                </span>
              </DialogTitle>
              {/* Step indicators */}
              <div className="flex items-center gap-2 mt-2">
                <div className={`flex-1 h-1 rounded-full transition-colors ${publicStep === "identify" ? "bg-primary" : "bg-primary/30"}`} />
                <div className={`flex-1 h-1 rounded-full transition-colors ${publicStep === "delivery" ? "bg-primary" : "bg-primary/30"}`} />
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="p-4 space-y-4">

                {/* ── PASO 1: Identificación ── */}
                {publicStep === "identify" && (
                  <>
                    {/* DNI/CUIT lookup */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">¿Ya sos cliente? Buscá por DNI o CUIT</Label>
                      <div className="flex gap-1">
                        <Button
                          type="button" size="sm"
                          variant={cartState.lookupType === "dni" ? "default" : "outline"}
                          className="h-8 text-xs px-3 flex-1"
                          onClick={() => { cartActions.setDniLookup(""); cartActions.setLookupType("dni"); }}
                          disabled={cartState.dniFound}
                        >
                          DNI
                        </Button>
                        <Button
                          type="button" size="sm"
                          variant={cartState.lookupType === "cuit" ? "default" : "outline"}
                          className="h-8 text-xs px-3 flex-1"
                          onClick={() => { cartActions.setDniLookup(""); cartActions.setLookupType("cuit"); }}
                          disabled={cartState.dniFound}
                        >
                          CUIT / CUIL
                        </Button>
                      </div>
                      <Input
                        placeholder={cartState.lookupType === "dni" ? "Ej: 30123456" : "Ej: 20-30123456-9"}
                        value={cartState.dniLookup}
                        onChange={(e) => cartActions.setDniLookup(e.target.value)}
                        className="h-10"
                        disabled={cartState.dniFound}
                      />
                      {cartState.dniLoading && (
                        <p className="text-xs text-muted-foreground">Buscando...</p>
                      )}
                    </div>

                    {/* Cliente encontrado → formulario editable pre-cargado */}
                    {cartState.dniFound && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle className="h-3.5 w-3.5" /> Cliente encontrado — podés editar tus datos
                          </span>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => cartActions.setDniLookup("")}
                          >
                            Cambiar
                          </button>
                        </div>
                        <Input
                          placeholder="Nombre completo *"
                          value={cartState.clientName}
                          onChange={(e) => cartActions.setClientName(e.target.value)}
                          className="h-10"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="DNI"
                            value={cartState.clientDni}
                            onChange={(e) => cartActions.setClientDni(e.target.value)}
                            className="h-10"
                          />
                          <Input
                            placeholder="CUIT / CUIL"
                            value={cartState.clientCuit}
                            onChange={(e) => cartActions.setClientCuit(e.target.value)}
                            className="h-10"
                          />
                        </div>
                        <Input
                          type="tel" inputMode="tel"
                          placeholder="Teléfono *"
                          value={cartState.clientPhone}
                          onChange={(e) => cartActions.setClientPhone(e.target.value)}
                          className="h-10"
                        />
                        <Input
                          type="email"
                          placeholder="Email *"
                          value={cartState.clientEmail}
                          onChange={(e) => cartActions.setClientEmail(e.target.value)}
                          className="h-10"
                        />
                        <Select
                          value={cartState.clientTaxCategory || "consumidor_final"}
                          onValueChange={(v) => cartActions.setClientTaxCategory(v as any)}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Categoría fiscal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consumidor_final">Consumidor Final</SelectItem>
                            <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                            <SelectItem value="monotributista">Monotributista</SelectItem>
                            <SelectItem value="exento">Exento</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* No encontrado o sin buscar → formulario completo de registro */}
                    {!cartState.dniFound && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">
                          {cartState.dniNotFound ? "No encontramos tu cuenta. Completá tus datos:" : "O ingresá tus datos:"}
                        </Label>
                        <Input
                          placeholder="Nombre completo *"
                          value={cartState.clientName}
                          onChange={(e) => cartActions.setClientName(e.target.value)}
                          className="h-10"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder={cartState.lookupType === "dni" ? "DNI (ya ingresado)" : "DNI"}
                            value={cartState.clientDni}
                            onChange={(e) => cartActions.setClientDni(e.target.value)}
                            className="h-10"
                          />
                          <Input
                            placeholder="CUIT / CUIL"
                            value={cartState.clientCuit}
                            onChange={(e) => cartActions.setClientCuit(e.target.value)}
                            className="h-10"
                          />
                        </div>
                        <Input
                          type="tel" inputMode="tel"
                          placeholder="Teléfono *"
                          value={cartState.clientPhone}
                          onChange={(e) => cartActions.setClientPhone(e.target.value)}
                          className="h-10"
                        />
                        <Input
                          type="email"
                          placeholder="Email *"
                          value={cartState.clientEmail}
                          onChange={(e) => cartActions.setClientEmail(e.target.value)}
                          className="h-10"
                        />
                        <Select
                          value={cartState.clientTaxCategory || "consumidor_final"}
                          onValueChange={(v) => cartActions.setClientTaxCategory(v as any)}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Categoría fiscal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consumidor_final">Consumidor Final</SelectItem>
                            <SelectItem value="monotributo">Monotributista</SelectItem>
                            <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                            <SelectItem value="exento">Exento</SelectItem>
                            <SelectItem value="no_responsable">No Responsable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}

                {/* ── PASO 2: Entrega y confirmación ── */}
                {publicStep === "delivery" && (
                  <>
                    {/* Resumen cliente */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cartState.clientName}</p>
                        {cartState.clientPhone && <p className="text-xs text-muted-foreground">{cartState.clientPhone}</p>}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-primary hover:text-primary/80 shrink-0"
                        onClick={() => setPublicStep("identify")}
                      >
                        Cambiar
                      </button>
                    </div>

                    {/* Método de entrega */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Método de entrega</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={cartState.deliveryMethod === "pickup" ? "default" : "outline"}
                          className="h-auto py-3 flex-col gap-1.5 text-sm"
                          onClick={() => cartActions.setDeliveryMethod("pickup")}
                        >
                          <Home className="h-5 w-5" />
                          Retiro en local
                        </Button>
                        <Button
                          type="button"
                          variant={cartState.deliveryMethod === "delivery" ? "default" : "outline"}
                          className="h-auto py-3 flex-col gap-1.5 text-sm"
                          onClick={() => {
                            cartActions.setDeliveryMethod("delivery");
                            cartActions.setDeliveryAddress("new");
                          }}
                        >
                          <Truck className="h-5 w-5" />
                          A domicilio
                        </Button>
                      </div>
                    </div>

                    {/* Ciudad + sección de entrega completa (con mapa) si es delivery */}
                    {cartState.deliveryMethod === "delivery" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold">Ciudad <span className="text-destructive">*</span></Label>
                          <Select
                            value={cartState.selectedCity || "none"}
                            onValueChange={(v) => cartActions.setSelectedCity(v === "none" ? "" : v as any)}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Seleccioná tu ciudad" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Seleccioná tu ciudad</SelectItem>
                              {CITIES.map((city) => (
                                <SelectItem key={city} value={city}>{city}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <DeliveryAddressSection
                          deliveryAddress={cartState.deliveryAddress}
                          clientAddressBook={[]}
                          legacyMainAddress={cartState.clientAddress || undefined}
                          selectedSavedAddress={cartState.selectedSavedAddress}
                          newAddress={cartState.newAddress}
                          onSelectType={cartActions.setDeliveryAddress}
                          onNewAddressChange={cartActions.setNewAddress}
                          onSelectSavedAddress={cartActions.selectSavedAddress}
                          onEditSavedAddress={cartActions.updateClientAddress}
                          onDeleteSavedAddress={cartActions.deleteClientAddress}
                          city={cartState.selectedCity}
                          lat={cartState.deliveryLat}
                          lng={cartState.deliveryLng}
                          onCoordsChange={cartActions.setDeliveryCoords}
                        />
                      </>
                    )}

                    {/* Resumen del pedido */}
                    <div className="rounded-xl border p-3 space-y-2 bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumen del pedido</p>
                      <div className="space-y-1">
                        {cartState.cart.map((item) => (
                          <div key={item.product.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.product.name} × {item.quantity}</span>
                            <span className="font-medium">{formatPrice(item.product.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between font-bold text-base pt-2 border-t">
                        <span>Total</span>
                        <span>{formatPrice(cartState.finalTotal)}</span>
                      </div>
                    </div>
                  </>
                )}

              </div>
            </div>

            {/* Footer con botón de acción */}
            <div className="p-4 border-t shrink-0 space-y-2">
              {publicStep === "identify" ? (
                <Button
                  className="w-full h-11 text-sm font-semibold"
                  disabled={!canProceedFromIdentify()}
                  onClick={handleIdentifyNext}
                >
                  Continuar
                </Button>
              ) : (
                <>
                  {/* Mensajes de validación */}
                  {!cartActions.canProcessSale() && publicStep === "delivery" && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-0.5">
                      {cartState.deliveryMethod === "delivery" && !cartState.selectedCity && <p>• Seleccioná una ciudad</p>}
                      {cartState.deliveryMethod === "delivery" && cartState.deliveryAddress === "new" && !cartState.newAddress.trim() && <p>• Ingresá la dirección de entrega</p>}
                      {!cartState.clientName.trim() && <p>• Ingresá tu nombre</p>}
                      {!cartState.clientPhone.trim() && <p>• Ingresá tu teléfono</p>}
                      {!cartState.clientEmail.trim() && <p>• Ingresá tu email</p>}
                    </div>
                  )}
                  <Button
                    className="w-full h-11 text-sm font-semibold"
                    disabled={!cartActions.canProcessSale()}
                    onClick={handleProcessSale}
                  >
                    Confirmar Pedido
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <main
          id="catalogo"
          className={`container mx-auto px-3 sm:px-4 ${showHeader ? "py-6 sm:py-8" : "py-4 sm:py-8"}`}
        >
          <div className="mb-6 sm:mb-8 rounded-2xl border border-border/50 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-4 sm:p-6">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground text-center">
              Nuestros Helados
            </h2>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              {filteredProducts.length} productos disponibles
            </p>
            <div className="mt-3 sm:mt-4 max-w-md mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, sabor, tipo... ej: balde, chocolate"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 sm:h-11 rounded-full bg-background/80 border-border/60 focus-visible:bg-background transition-colors text-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 sm:mt-4 flex flex-wrap justify-center items-center gap-2">
              <div className="lg:hidden">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full px-4 h-9 flex items-center gap-2"
                  onClick={() => setIsFilterOpen(true)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 rounded-full px-2 text-[10px]"
                    >
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortOption} onValueChange={setSortOption}>
                  <SelectTrigger className="h-9 w-[160px] rounded-full text-xs border-border/60">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Marca Mio primero</SelectItem>
                    <SelectItem value="price-asc">Menor precio</SelectItem>
                    <SelectItem value="price-desc">Mayor precio</SelectItem>
                    <SelectItem value="name-asc">A-Z</SelectItem>
                    <SelectItem value="name-desc">Z-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6 lg:items-start">
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-border/50 bg-card/80 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">
                    Filtros
                  </p>
                  {activeFiltersCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="rounded-full px-2 text-[10px]"
                    >
                      {activeFiltersCount}
                    </Badge>
                  )}
                </div>

                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Categorías
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant={
                          categoryFilter === "all" ? "default" : "outline"
                        }
                        className="justify-start rounded-full border-border/60 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                        onClick={() => setCategoryFilter("all")}
                      >
                        Todos
                      </Button>
                      {categories.map((category) => (
                        <Button
                          key={category}
                          size="sm"
                          variant={
                            categoryFilter === category ? "default" : "outline"
                          }
                          className="justify-start rounded-full border-border/60 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                          onClick={() => setCategoryFilter(category)}
                        >
                          {category}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Precio
                    </p>
                    <div className="flex flex-col gap-2">
                      {priceRanges.map((range) => (
                        <Button
                          key={range.id}
                          size="sm"
                          variant={
                            priceFilter === range.id ? "default" : "outline"
                          }
                          className="justify-start rounded-full border-border/60 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                          onClick={() => setPriceFilter(range.id)}
                        >
                          {range.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Marca
                    </p>
                    <div className="flex flex-col gap-2">
                      {marcas.map((marca) => (
                        <Button
                          key={marca}
                          size="sm"
                          variant={marcaFilter === marca ? "default" : "outline"}
                          className="justify-start rounded-full border-border/60 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                          onClick={() => setMarcaFilter(marca)}
                        >
                          {marca === "all" ? "Todas" : marca}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* NUEVO: Filtro Sin TACC - Desktop */}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Contenido
                    </p>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: "all", label: "Todos" },
                        { id: "sin-tacc", label: "Sin TACC", icon: WheatOff },
                        { id: "con-tacc", label: "Con TACC" },
                      ].map((option) => (
                        <Button
                          key={option.id}
                          size="sm"
                          variant={
                            sinTaccFilter === option.id ? "default" : "outline"
                          }
                          className="justify-start rounded-full gap-2 border-border/60 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                          onClick={() =>
                            setSinTaccFilter(option.id as typeof sinTaccFilter)
                          }
                        >
                          {option.icon && <option.icon className="h-3 w-3" />}
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Disponibilidad
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={onlyInStock}
                          onCheckedChange={(value) =>
                            setOnlyInStock(Boolean(value))
                          }
                        />
                        Solo disponibles
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={onlyLowStock}
                          onCheckedChange={(value) =>
                            setOnlyLowStock(Boolean(value))
                          }
                        />
                        Pocas unidades
                      </label>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="justify-start"
                    onClick={() => {
                      setCategoryFilter("all");
                      setPriceFilter("all");
                      setMarcaFilter("all");
                      setSinTaccFilter("all");
                      setOnlyInStock(false);
                      setOnlyLowStock(false);
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            </aside>

            <div className="min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 auto-rows-min content-start items-start">
              {filteredProducts.length === 0 && !loading && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <Search className="h-16 w-16 text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground">No se encontraron productos</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1 mb-4">Proba ajustando los filtros o la busqueda</p>
                  <Button variant="outline" onClick={() => { setSearch(""); setCategoryFilter("all"); setMarcaFilter("all"); setPriceFilter("all"); setSinTaccFilter("all"); setOnlyInStock(false); setOnlyLowStock(false); }}>
                    Limpiar filtros
                  </Button>
                </div>
              )}
              {pagedProducts.map((product, productIndex) => {
                const inCart = cart.find(
                  (item) => item.product.id === product.id,
                );
                const isOutOfStock = product.stock === 0;

                return (
                  <Card
                    key={product.id}
                    className={`group overflow-hidden ${isOutOfStock ? "opacity-60" : ""} rounded-2xl border border-border/50 bg-card/90 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
                  >
                    <div className="cursor-pointer" onClick={() => setSelectedProduct(product)}>
                      <div className="relative aspect-[4/3] bg-muted">
                        <ProductImage imageUrl={product.imageUrl} name={product.name} priority={productIndex < 4} />
                        {(product as any).sinTacc && (
                          <div className="absolute top-2 left-2 z-10">
                            <Badge className="bg-green-600 text-white border-green-700 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-semibold shadow-sm">
                              <WheatOff className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
                              <span className="hidden sm:inline">Sin TACC</span>
                              <span className="sm:hidden">S/T</span>
                            </Badge>
                          </div>
                        )}
                        {product.stock < 10 && product.stock > 0 && (
                          <Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] sm:text-xs rounded-full shadow-sm px-1.5 sm:px-2">
                            Pocas ud.
                          </Badge>
                        )}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                            <Badge variant="secondary" className="rounded-full text-xs">Agotado</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-3 sm:p-4">
                      <div className="cursor-pointer" onClick={() => setSelectedProduct(product)}>
                        <Badge
                          variant="secondary"
                          className="mb-1.5 text-[9px] sm:text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary border-primary/20 rounded-full px-2"
                        >
                          {product.category}
                        </Badge>
                        <h3 className="font-semibold text-foreground line-clamp-1 text-sm">
                          {product.name}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {product.description}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 sm:mt-3">
                        <span className="text-sm sm:text-lg font-bold text-foreground">
                          {formatPrice(product.price)}
                        </span>
                        {inCart ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-transparent"
                              onClick={() => updateQuantity(product.id, -1)}
                            >
                              <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </Button>
                            <span className="w-5 text-center text-xs sm:text-sm font-semibold">
                              {inCart.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-transparent"
                              onClick={() => updateQuantity(product.id, 1)}
                              disabled={inCart.quantity >= product.stock}
                            >
                              <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-full text-xs"
                            onClick={() => addToCart(product)}
                            disabled={isOutOfStock}
                          >
                            <Plus className="h-3.5 w-3.5 mr-0.5" />
                            <span className="hidden sm:inline">Agregar</span>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Paginado */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: document.getElementById("catalogo")?.offsetTop ?? 0, behavior: "smooth" }); }}
                  disabled={page === 1}
                >
                  ← Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: document.getElementById("catalogo")?.offsetTop ?? 0, behavior: "smooth" }); }}
                  disabled={page === totalPages}
                >
                  Siguiente →
                </Button>
              </div>
            )}
            </div>
          </div>
        </main>

        {/* Product Detail Modal */}
        <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card/95 backdrop-blur-lg border border-border/60 shadow-xl rounded-t-2xl sm:rounded-2xl">
            <DialogHeader className="sr-only">
              <DialogTitle>{selectedProduct?.name || "Detalle del producto"}</DialogTitle>
            </DialogHeader>
            {selectedProduct && (() => {
              const detailInCart = cart.find((item) => item.product.id === selectedProduct.id);
              const detailOutOfStock = selectedProduct.stock === 0;
              const stockStatus = detailOutOfStock
                ? { label: "Agotado", color: "bg-red-100 text-red-700 border-red-200" }
                : selectedProduct.stock < 10
                  ? { label: "Pocas unidades", color: "bg-amber-100 text-amber-700 border-amber-200" }
                  : { label: "Disponible", color: "bg-green-100 text-green-700 border-green-200" };
              return (
                <div>
                  <div className="relative aspect-square sm:aspect-[4/3] bg-muted">
                    <ProductImage imageUrl={selectedProduct.imageUrl} name={selectedProduct.name} priority />
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm border-border/60"
                      onClick={() => setSelectedProduct(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {(selectedProduct as any).sinTacc && (
                      <div className="absolute top-3 left-3 z-10">
                        <Badge className="bg-green-600 text-white border-green-700 text-xs px-2 py-0.5 rounded-full font-semibold shadow-sm">
                          <WheatOff className="h-3 w-3 mr-1" />
                          Sin TACC
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary border-primary/20 rounded-full px-2"
                          >
                            {selectedProduct.category}
                          </Badge>
                          <Badge className={`text-[10px] rounded-full px-2 border ${stockStatus.color}`}>
                            {stockStatus.label}
                          </Badge>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-foreground">
                          {selectedProduct.name}
                        </h3>
                        {(selectedProduct as any).marca && (
                          <p className="text-xs text-muted-foreground">
                            Marca: <span className="font-medium text-foreground">{(selectedProduct as any).marca}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedProduct.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedProduct.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-2xl font-bold text-foreground">
                        {formatPrice(selectedProduct.price)}
                      </span>
                      {detailInCart ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-full bg-transparent"
                            onClick={(e) => { e.stopPropagation(); updateQuantity(selectedProduct.id, -1); }}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-6 text-center text-sm font-semibold">
                            {detailInCart.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-full bg-transparent"
                            onClick={(e) => { e.stopPropagation(); updateQuantity(selectedProduct.id, 1); }}
                            disabled={detailInCart.quantity >= selectedProduct.stock}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="h-9 px-4 rounded-full"
                          onClick={(e) => { e.stopPropagation(); addToCart(selectedProduct); }}
                          disabled={detailOutOfStock}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Filtros</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Categorías
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={categoryFilter === "all" ? "default" : "outline"}
                    className="rounded-full px-3"
                    onClick={() => setCategoryFilter("all")}
                  >
                    Todos
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category}
                      size="sm"
                      variant={
                        categoryFilter === category ? "default" : "outline"
                      }
                      className="rounded-full px-3"
                      onClick={() => setCategoryFilter(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Precio
                </p>
                <div className="flex flex-wrap gap-2">
                  {priceRanges.map((range) => (
                    <Button
                      key={range.id}
                      size="sm"
                      variant={priceFilter === range.id ? "default" : "outline"}
                      className="rounded-full px-3"
                      onClick={() => setPriceFilter(range.id)}
                    >
                      {range.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Marca
                </p>
                <div className="flex flex-wrap gap-2">
                  {marcas.map((marca) => (
                    <Button
                      key={marca}
                      size="sm"
                      variant={marcaFilter === marca ? "default" : "outline"}
                      className="rounded-full px-3"
                      onClick={() => setMarcaFilter(marca)}
                    >
                      {marca === "all" ? "Todas" : marca}
                    </Button>
                  ))}
                </div>
              </div>

              {/* NUEVO: Filtro Sin TACC - Mobile */}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Contenido
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "all", label: "Todos" },
                    { id: "sin-tacc", label: "Sin TACC", icon: WheatOff },
                    { id: "con-tacc", label: "Con TACC" },
                  ].map((option) => (
                    <Button
                      key={option.id}
                      size="sm"
                      variant={
                        sinTaccFilter === option.id ? "default" : "outline"
                      }
                      className="rounded-full px-3 gap-2"
                      onClick={() =>
                        setSinTaccFilter(option.id as typeof sinTaccFilter)
                      }
                    >
                      {option.icon && <option.icon className="h-3 w-3" />}
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Disponibilidad
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={onlyInStock}
                      onCheckedChange={(value) =>
                        setOnlyInStock(Boolean(value))
                      }
                    />
                    Solo disponibles
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={onlyLowStock}
                      onCheckedChange={(value) =>
                        setOnlyLowStock(Boolean(value))
                      }
                    />
                    Pocas unidades
                  </label>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCategoryFilter("all");
                  setPriceFilter("all");
                  setMarcaFilter("all");
                  setSinTaccFilter("all");
                  setOnlyInStock(false);
                  setOnlyLowStock(false);
                }}
              >
                Limpiar
              </Button>
              <Button onClick={() => setIsFilterOpen(false)}>Aplicar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Success Modal */}
        <Dialog open={cartState.saleComplete} onOpenChange={(open) => { if (!open) cartActions.resetCart(); }}>
          <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur border border-border/60 shadow-xl">
            <DialogHeader>
              <DialogTitle className="sr-only">
                {isPublicStore ? "Pedido Recibido" : "Venta Completada"}
              </DialogTitle>
            </DialogHeader>
            <div className="text-center py-2">
              <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4 ring-1 ring-success/20">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">
                {isPublicStore ? "Pedido Recibido" : "Venta Completada"}
              </h2>
              {isPublicStore ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    Tu pedido fue generado correctamente. Te contactaremos para
                    coordinar la entrega.
                  </p>
                  <div className="mt-5 rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-left">
                    <p className="text-sm font-medium text-foreground">
                      ¡Gracias por tu pedido!
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Te vamos a contactar para coordinar la entrega. Podés cerrar
                      esta ventana y seguir navegando.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground">La venta se procesó correctamente</p>
                  <div className="mt-5 p-4 bg-muted/60 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-muted-foreground">Total</span>
                      <span className="text-lg font-bold text-foreground">
                        {formatPrice(cartState.finalTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Método</span>
                      <Badge variant={cartState.paymentType === "cash" ? "default" : "secondary"}>
                        {cartState.paymentType === "cash" ? (cartState.paymentMethod === "transferencia" ? "Transferencia" : "Efectivo") : cartState.paymentType === "credit" ? "A Cuenta" : "Mixto"}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button className="w-full sm:w-auto" onClick={cartActions.resetCart}>
                {isPublicStore ? "Seguir Comprando" : "Nueva Venta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>{" "}
      {/* Cierre del z-10 wrapper */}
    </div>
  );
}

export default function TiendaPage() {
  return <StoreFront />;
}
