"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { useVentas } from "@/hooks/useVentas";
import { ListaVentas } from "@/components/ListaVentas";
import { ModalDetalleVenta } from "@/components/ModalDetalleVenta";
import { ModalEmitirDocumento } from "@/components/ModalEmitirDocumento";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { clientsApi, sellersApi } from "@/lib/api";

function VentasInner() {
  const searchParams = useSearchParams();
  const saleIdFromUrl = searchParams.get("saleId");
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const [clients, setClients] = useState<{ id: string; name: string; city?: string }[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);

  const filterBySellerId = user?.role === "seller" ? user.sellerId : undefined;

  // Cargar clientes y vendedores para filtros
  useEffect(() => {
    clientsApi.getAll().then((data) =>
      setClients(data.map((c) => ({ id: c.id, name: c.name, city: (c as any).city })))
    ).catch(() => {});
    sellersApi.getAll().then((data) =>
      setSellers(data.map((s) => ({ id: s.id, name: s.name })))
    ).catch(() => {});
  }, []);

  const clientCityMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { if (c.city) map[c.id] = c.city; });
    return map;
  }, [clients]);

  const {
    ventasFiltradas,
    cargando,
    filtros,
    actualizarFiltros,
    modalDetalleAbierto,
    ventaSeleccionada,
    abrirDetalle,
    cerrarDetalle,
    abrirDetallePorId,
    modalEmitirAbierto,
    ventaParaEmitir,
    tipoDocumento,
    emitiendo,
    abrirEmitir,
    cerrarEmitir,
    emitirDocumento,
    emitirConDatos,
    resolverTelefono,
    setTipoDocumento,
    formatearMoneda,
    formatearFechaHora,
    etiquetaPago,
    claseBadgePago,
  } = useVentas(filterBySellerId, clientCityMap);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (saleIdFromUrl && !cargando && mounted) {
      abrirDetallePorId(saleIdFromUrl);
    }
  }, [saleIdFromUrl, cargando, abrirDetallePorId, mounted]);

  if (!mounted) return null;

  return (
    <>
      <ListaVentas
        ventas={ventasFiltradas}
        cargando={cargando}
        filtros={filtros}
        onCambiarFiltros={actualizarFiltros}
        onVerDetalle={abrirDetalle}
        onEmitirDocumento={abrirEmitir}
        clients={clients}
        sellers={user?.role === "admin" ? sellers : []}
        isAdmin={user?.role === "admin"}
      />

      <ModalDetalleVenta
        abierto={modalDetalleAbierto}
        venta={ventaSeleccionada}
        onCerrar={cerrarDetalle}
        onGenerarDoc={emitirConDatos}
        formatearMoneda={formatearMoneda}
        formatearFechaHora={formatearFechaHora}
        etiquetaPago={etiquetaPago}
        claseBadgePago={claseBadgePago}
        resolverTelefono={resolverTelefono}
      />

      {/* ModalEmitirDocumento se mantiene para el botón de la lista */}
      <ModalEmitirDocumento
        abierto={modalEmitirAbierto}
        venta={ventaParaEmitir}
        tipoDocumento={tipoDocumento}
        emitiendo={emitiendo}
        onCerrar={cerrarEmitir}
        onConfirmar={emitirDocumento}
        onCambiarTipo={setTipoDocumento}
        formatearMoneda={formatearMoneda}
      />
    </>
  );
}

export default function VentasPage() {
  const { user } = useAuth();
  const isSeller = user?.role === "seller";
  return (
    <MainLayout
      title={isSeller ? "Mis Ventas" : "Ventas"}
      description={isSeller ? "Historial de tus ventas" : "Historial y gestión de ventas"}
    >
      <Suspense
        fallback={
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-32 bg-muted rounded" />
          </div>
        }
      >
        <VentasInner />
      </Suspense>
    </MainLayout>
  );
}
