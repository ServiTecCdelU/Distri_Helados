"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Truck,
  MapPin,
  LogOut,
  Menu,
  X,
  Receipt,
  UserCheck,
  Home,
  BarChart3,
  Banknote,
  Shield,
  Tag,
} from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/services/auth-service";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const { user } = useAuth();

  const employeeType = user?.employeeType;
  const isVendedor = employeeType === "vendedor" || employeeType === "ambos";
  const isTransportista = employeeType === "transportista" || employeeType === "ambos";


  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
    { href: "/productos", label: "Productos", icon: Package, roles: ["admin"] },
    { href: "/clientes", label: "Clientes", icon: Users, roles: ["admin"] },
    {
      href: "/empleados",
      label: "Empleados",
      icon: UserCheck,
      roles: ["admin"],
    },
    { href: "/ventas", label: user?.role === "seller" ? "Mis Ventas" : "Ventas", icon: Receipt, roles: ["admin", ...(isVendedor ? ["seller"] : [])] },
    { href: "/ventas/nueva", label: "Nueva Venta", icon: ShoppingCart, roles: ["admin", ...(isVendedor ? ["seller"] : [])] },
    { href: "/pedidos", label: "Pedidos", icon: Truck, roles: ["admin", ...(isTransportista ? ["seller"] : [])] },
    // { href: "/transporte", label: "Transporte", icon: MapPin, roles: ["admin", ...(isTransportista ? ["seller"] : [])] },
    { href: "/comisiones", label: "Mis Comisiones", icon: Banknote, roles: ["seller"] },
    // { href: "/caja", label: "Caja Diaria", icon: Banknote, roles: ["admin"] },
    // { href: "/reportes", label: "Reportes", icon: BarChart3, roles: ["admin"] },
    // { href: "/listas-precios", label: "Listas de Precios", icon: Tag, roles: ["admin"] },
    // { href: "/auditoria", label: "Auditoria", icon: Shield, roles: ["admin"] },
  ].filter(
    (item) => !item.roles || item.roles.includes(user?.role ?? "customer"),
  );

  return (
    <>
      {/* HEADER MÓVIL (Solo visible en celular) */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-sidebar border-b border-sidebar-border sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 shrink-0">
            {!logoLoaded && <div className="absolute inset-0 animate-pulse rounded-lg bg-sidebar-accent" />}
            <Image
              src="/logo.png"
              alt="Helados Mio"
              width={32}
              height={32}
              priority
              className={`rounded-lg object-contain transition-opacity duration-200 ${logoLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setLogoLoaded(true)}
            />
          </div>
          <span className="font-bold text-sidebar-foreground">Helados Mio</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="text-sidebar-foreground"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* OVERLAY */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-[70] h-full w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 flex flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Header del Sidebar */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center min-w-10 h-10 rounded-lg bg-sidebar-primary overflow-hidden">
              {!logoLoaded && <div className="absolute inset-0 animate-pulse bg-sidebar-accent" />}
              <Image
                src="/logo.png"
                alt="Helados Mio"
                width={40}
                height={40}
                priority
                className={`object-contain transition-opacity duration-200 ${logoLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setLogoLoaded(true)}
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-base text-sidebar-foreground truncate">
                Helados Mio
              </h1>
              <p className="text-xs text-sidebar-foreground/60">
                Distribuidora
              </p>
            </div>
          </div>
          {/* Botón Cerrar (Solo móvil) */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navegación con Scroll */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer (Fijo al fondo) */}
        <div className="p-4 border-t border-sidebar-border space-y-3 bg-sidebar">
          <Link
            href="/tienda"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
          >
            <Home className="h-5 w-5" />
            Inicio
          </Link>

          {user && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/50">
              <Avatar className="h-9 w-9 border border-sidebar-border">
                <AvatarImage
                  src={user.photoURL || ""}
                  alt={user.name || "Usuario"}
                />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  {(user.name || user.email || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-bold text-sidebar-foreground truncate">
                  {user.name || "Usuario"}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-bold">
                  {user.role === "admin"
                    ? "Administrador"
                    : user.employeeType === "transportista"
                      ? "Solo Transportista"
                      : user.employeeType === "ambos"
                        ? "Distribuidor Transportista"
                        : "Distribuidor"}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
