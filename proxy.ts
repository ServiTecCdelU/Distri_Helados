// proxy.ts (anteriormente middleware.ts)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas que requieren sesion (el token Firebase se valida client-side via useAuth,
// pero este proxy evita acceso directo sin cookie de sesion)
const PROTECTED_ROUTES = [
  "/dashboard",
  "/ventas",
  "/clientes",
  "/productos",
  "/vendedores",
  "/empleados",
  "/pedidos",
  "/comisiones",
  "/caja",
  "/reportes",
  "/listas-precios",
  "/auditoria",
];

// Rutas publicas que nunca necesitan auth
const PUBLIC_ROUTES = ["/login", "/tienda", "/api/public"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas publicas y assets
  if (
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Para rutas protegidas: agregar headers de seguridad
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (isProtected) {
    const response = NextResponse.next();
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
