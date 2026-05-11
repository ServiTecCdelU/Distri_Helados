"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { savePdfToDatabase, downloadBase64Pdf } from "@/services/pdf-service";
import { toast } from "sonner";
import { getAuth } from "firebase/auth";
import { formatCurrencyDecimals, formatDateTime } from "@/lib/utils/format";

// Helper para nombre de archivo: N°{numero}_{nombre_cliente}.pdf
function buildDocFilename(tipo: "boleta" | "remito", numero: string | undefined, clientName?: string): string {
  const nombre = (clientName || "cliente")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  // Extraer solo el número del comprobante (de "0010-00003068" sacar "3068")
  let nro = numero || "0";
  const match = nro.match(/(\d+)$/);
  if (match) nro = String(parseInt(match[1], 10));
  const prefix = tipo === "boleta" ? "boleta" : "remito";
  return `${prefix}_N°${nro}_${nombre}.pdf`;
}

// Tipos
export interface VentaItem {
  name: string;
  quantity: number;
  price: number;
  itemDiscount?: number;
}

export interface Venta {
  id: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientCuit?: string;
  clientTaxCategory?: string;
  items: VentaItem[];
  total: number;
  paymentType: "cash" | "credit" | "mixed";
  cashAmount?: number;
  creditAmount?: number;
  createdAt: any;
  invoiceNumber?: string;
  invoiceEmitted?: boolean;
  afipData?: {
    cae?: string;
    caeVencimiento?: string;
    tipoComprobante?: number;
    puntoVenta?: number;
    numeroComprobante?: number;
  };
  invoiceDriveUrl?: string;
  invoiceDriveFileId?: string;
  remitoDriveUrl?: string;
  remitoDriveFileId?: string;
  remitoNumber?: string;
  remitoPdfBase64?: string;
  invoicePdfBase64?: string;
  sellerName?: string;
  saleNumber?: number;
  deliveryAddress?: string;
  discount?: number;
  discountType?: "percent" | "fixed";
  clientData?: {
    name?: string;
    phone?: string;
    cuit?: string;
    address?: string;
    taxCategory?: string;
  };
}

interface FiltrosVentas {
  searchQuery: string;
  invoiceFilter: string;
  remitoFilter: string;
  discountFilter: string;
  paymentFilter: string;
  periodFilter: string;
  dateFrom: string;
  dateTo: string;
  clientId: string;
  sellerId: string;
  city: string;
  deliveryFilter: string;
}

const safeGetDate = (date: any): Date | null => {
  if (!date) return null;
  try {
    let d: Date;
    if (date?.toDate) d = date.toDate();
    else if (typeof date === "string") d = new Date(date);
    else if (typeof date === "number") d = new Date(date);
    else if (date instanceof Date) d = date;
    else if (date?.seconds) d = new Date(date.seconds * 1000);
    else return null;
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Contado",
  credit: "Cuenta Corriente",
  mixed: "Mixto",
};

const PAYMENT_BADGE_CLASSES: Record<string, string> = {
  cash: "bg-green-100 text-green-800",
  credit: "bg-blue-100 text-blue-800",
  mixed: "bg-purple-100 text-purple-800",
};

export function useVentas(filterBySellerId?: string, clientCityMap?: Record<string, string>) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosVentas>({
    searchQuery: "",
    invoiceFilter: "all",
    remitoFilter: "all",
    discountFilter: "all",
    paymentFilter: "all",
    periodFilter: "all",
    dateFrom: "",
    dateTo: "",
    clientId: "",
    sellerId: "",
    city: "",
    deliveryFilter: "all",
  });

  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(
    null,
  );
  const [modalEmitirAbierto, setModalEmitirAbierto] = useState(false);
  const [ventaParaEmitir, setVentaParaEmitir] = useState<Venta | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState<"boleta" | "remito">(
    "boleta",
  );
  const [emitiendo, setEmitiendo] = useState(false);

  // Cargar ventas — limit(200) para acotar lecturas de Firestore
  const cargarVentas = useCallback(async () => {
    try {
      setCargando(true);
      const constraints: any[] = [
        orderBy("createdAt", "desc"),
        limit(200),
      ];
      if (filterBySellerId) {
        constraints.unshift(where("sellerId", "==", filterBySellerId));
      }
      const q = query(
        collection(db, "ventas"),
        ...constraints,
      );
      const snapshot = await getDocs(q);
      const ventasData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Venta[];
      setVentas(ventasData);
    } catch (error) {
      // Error silenciado
      toast.error("Error al cargar ventas");
    } finally {
      setCargando(false);
    }
  }, [filterBySellerId]);

  useEffect(() => {
    cargarVentas();
  }, [cargarVentas]);

  // Filtrado memoizado — solo se recalcula cuando cambian ventas o filtros
  const ventasFiltradas = useMemo(() => {
    return ventas.filter((venta) => {
      // Búsqueda de texto
      if (filtros.searchQuery) {
        const q = filtros.searchQuery.toLowerCase();
        const matchSearch =
          venta.clientName?.toLowerCase().includes(q) ||
          venta.sellerName?.toLowerCase().includes(q) ||
          venta.id.toLowerCase().includes(q) ||
          venta.invoiceNumber?.toLowerCase().includes(q) ||
          String(venta.saleNumber || "").toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      // Filtro por período
      if (filtros.periodFilter && filtros.periodFilter !== "all") {
        const ventaDate = safeGetDate(venta.createdAt);
        if (ventaDate) {
          const now = new Date();
          if (filtros.periodFilter === "today") {
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            if (ventaDate < today) return false;
          } else if (filtros.periodFilter === "week") {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            weekAgo.setHours(0, 0, 0, 0);
            if (ventaDate < weekAgo) return false;
          } else if (filtros.periodFilter === "month") {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            if (ventaDate < monthStart) return false;
          } else if (filtros.periodFilter === "year") {
            const yearStart = new Date(now.getFullYear(), 0, 1);
            if (ventaDate < yearStart) return false;
          }
        }
      }

      // Filtro por fecha desde
      if (filtros.dateFrom) {
        const ventaDate = safeGetDate(venta.createdAt);
        const fromDate = new Date(filtros.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (!ventaDate || ventaDate < fromDate) return false;
      }

      // Filtro por fecha hasta
      if (filtros.dateTo) {
        const ventaDate = safeGetDate(venta.createdAt);
        const toDate = new Date(filtros.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (!ventaDate || ventaDate > toDate) return false;
      }

      // Filtro por tipo de pago
      if (filtros.paymentFilter !== "all" && venta.paymentType !== filtros.paymentFilter) {
        return false;
      }

      // Filtro por estado de factura
      if (filtros.invoiceFilter !== "all") {
        if (filtros.invoiceFilter === "emitted" && !venta.invoiceEmitted) return false;
        if (filtros.invoiceFilter === "pending" && venta.invoiceEmitted) return false;
      }

      // Filtro por remito
      if (filtros.remitoFilter && filtros.remitoFilter !== "all") {
        const tieneRemito = !!(venta as any).remitoNumber;
        if (filtros.remitoFilter === "emitted" && !tieneRemito) return false;
        if (filtros.remitoFilter === "pending" && tieneRemito) return false;
      }

      // Filtro por descuento
      if (filtros.discountFilter && filtros.discountFilter !== "all") {
        const tieneDescuento = !!((venta as any).discount && (venta as any).discount > 0)
          || (venta.items || []).some((i: any) => i.itemDiscount && i.itemDiscount > 0);
        if (filtros.discountFilter === "with" && !tieneDescuento) return false;
        if (filtros.discountFilter === "without" && tieneDescuento) return false;
      }

      // Filtro por cliente
      if (filtros.clientId && venta.clientId !== filtros.clientId) return false;

      // Filtro por vendedor
      if (filtros.sellerId && (venta as any).sellerId !== filtros.sellerId) return false;

      // Filtro por ciudad
      if (filtros.city && clientCityMap) {
        const ventaCity = venta.clientId ? clientCityMap[venta.clientId] : undefined;
        if (ventaCity !== filtros.city) return false;
      }

      // Filtro por método de entrega
      if (filtros.deliveryFilter && filtros.deliveryFilter !== "all") {
        if ((venta as any).deliveryMethod !== filtros.deliveryFilter) return false;
      }

      return true;
    });
  }, [ventas, filtros, clientCityMap]);

  const actualizarFiltros = useCallback((nuevosFiltros: Partial<FiltrosVentas>) => {
    setFiltros((prev) => ({ ...prev, ...nuevosFiltros }));
  }, []);

  // Modales
  const abrirDetalle = useCallback((venta: Venta) => {
    setVentaSeleccionada(venta);
    setModalDetalleAbierto(true);
  }, []);

  const cerrarDetalle = useCallback(() => {
    setModalDetalleAbierto(false);
    setVentaSeleccionada(null);
  }, []);

  const abrirDetallePorId = useCallback(async (saleId: string) => {
    try {
      const docRef = doc(db, "ventas", saleId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const venta = { id: docSnap.id, ...docSnap.data() } as Venta;
        setVentaSeleccionada(venta);
        setModalDetalleAbierto(true);
      }
    } catch (error) {
      // Error silenciado
    }
  }, []);

  const abrirEmitir = useCallback((venta: Venta, tipo: "boleta" | "remito" = "boleta") => {
    setVentaParaEmitir(venta);
    setTipoDocumento(tipo);
    setModalEmitirAbierto(true);
  }, []);

  const cerrarEmitir = useCallback(() => {
    setModalEmitirAbierto(false);
    setVentaParaEmitir(null);
    setEmitiendo(false);
  }, []);

  // ==================== GENERACIÓN DE PDF ====================

  const generarPdfCompleto = async (
    venta: Venta,
    tipo: "boleta" | "remito",
    afipData?: any,
  ): Promise<string> => {
    const { generarPdfCliente } = await import("@/hooks/useGenerarPdf");
    try {
      const pdfBase64 = await generarPdfCliente(venta, tipo, afipData);
      return pdfBase64;
    } catch (error: any) {
      // Error silenciado
      throw new Error(`Error al generar PDF: ${error.message}`);
    }
  };

  // ==================== EMITIR DOCUMENTO ====================
  const emitirDocumento = async () => {
    if (!ventaParaEmitir) return;
    setEmitiendo(true);
    const toastId = `generar-${tipoDocumento}`;
    toast.loading(`Generando ${tipoDocumento}...`, { id: toastId });

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Usuario no autenticado");
      const token = await user.getIdToken();

      if (tipoDocumento === "boleta") {
        let taxCategory =
          ventaParaEmitir.clientTaxCategory || "consumidor_final";
        let clientName = ventaParaEmitir.clientName || "Cliente";
        let clientCuit = ventaParaEmitir.clientCuit || "";
        let clientPhone = ventaParaEmitir.clientPhone || "";
        let clientAddress = ventaParaEmitir.clientAddress || "";

        if (ventaParaEmitir.clientId) {
          try {
            const clientRef = doc(db, "clientes", ventaParaEmitir.clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
              const clientData = clientSnap.data();
              taxCategory = clientData.taxCategory || taxCategory;
              clientName = clientData.name || clientName;
              clientCuit = clientData.cuit || clientCuit;
              clientPhone = clientData.phone || clientPhone;
              clientAddress = clientData.address || clientAddress;
            }
          } catch (error) {
            // Error silenciado
          }
        }

        // 1. Emitir en AFIP
        const afipResponse = await fetch("/api/ventas/emitir", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            saleId: ventaParaEmitir.id,
            client: {
              name: clientName,
              phone: clientPhone,
              cuit: clientCuit,
              address: clientAddress,
              taxCategory: taxCategory,
            },
            emitirAfip: true,
          }),
        });

        if (!afipResponse.ok) {
          let errorText = "";
          try {
            errorText = await afipResponse.text();
          } catch {
            errorText = "Error desconocido";
          }
          throw new Error(
            `Error en AFIP (${afipResponse.status}): ${errorText.substring(0, 200)}`,
          );
        }

        const afipResult = await afipResponse.json();
        const { invoiceNumber, afipData } = afipResult;

        // 2. Generar PDF con los datos de AFIP
        const pdfBase64 = await generarPdfCompleto(
          { ...ventaParaEmitir, invoiceNumber },
          "boleta",
          afipData,
        );

        // 3. Guardar en Firestore
        const ventaRef = doc(db, "ventas", ventaParaEmitir.id);
        await updateDoc(ventaRef, {
          invoicePdfBase64: pdfBase64,
          invoiceNumber,
          invoiceEmitted: true,
          invoiceStatus: "emitted",
          afipData,
          invoiceGeneratedAt: serverTimestamp(),
        });

        // 4. Guardar metadata del PDF
        await savePdfToDatabase(ventaParaEmitir.id, "invoice", {
          base64: pdfBase64,
          filename: buildDocFilename("boleta", invoiceNumber, venta.clientName || ventaParaEmitir?.clientName),
          contentType: "application/pdf",
          size: Math.ceil((pdfBase64.length * 3) / 4),
          generatedAt: new Date().toISOString(),
        });

        // 5. Descargar
        downloadBase64Pdf(pdfBase64, buildDocFilename("boleta", invoiceNumber, venta.clientName || ventaParaEmitir?.clientName));
        toast.success("Boleta emitida correctamente", { id: toastId });
      } else if (tipoDocumento === "remito") {
        // 1. Generar número de remito
        const remitosQuery = query(
          collection(db, "ventas"),
          where("remitoNumber", "!=", null),
          orderBy("remitoNumber", "desc"),
          limit(1),
        );
        const remitosSnapshot = await getDocs(remitosQuery);
        let ultimoNumero = 0;
        if (!remitosSnapshot.empty) {
          const lastRemito = remitosSnapshot.docs[0].data().remitoNumber;
          const match = lastRemito?.match(/R-\d+-(\d+)/);
          if (match) ultimoNumero = parseInt(match[1], 10);
        }
        const remitoNumber = `R-${new Date().getFullYear()}-${String(ultimoNumero + 1).padStart(5, "0")}`;

        // 2. Generar PDF
        const pdfBase64 = await generarPdfCompleto(
          { ...ventaParaEmitir, remitoNumber },
          "remito",
        );

        // 3. Guardar en Firestore
        const ventaRef = doc(db, "ventas", ventaParaEmitir.id);
        await updateDoc(ventaRef, {
          remitoPdfBase64: pdfBase64,
          remitoNumber,
          remitoGeneratedAt: serverTimestamp(),
        });

        // 4. Guardar metadata del PDF
        await savePdfToDatabase(ventaParaEmitir.id, "remito", {
          base64: pdfBase64,
          filename: buildDocFilename("remito", remitoNumber, venta.clientName || ventaParaEmitir?.clientName),
          contentType: "application/pdf",
          size: Math.ceil((pdfBase64.length * 3) / 4),
          generatedAt: new Date().toISOString(),
        });

        // 5. Descargar
        downloadBase64Pdf(pdfBase64, buildDocFilename("remito", remitoNumber, venta.clientName || ventaParaEmitir?.clientName));
        toast.success("Remito generado correctamente", { id: toastId });
      }

      await cargarVentas();
      cerrarEmitir();
    } catch (error: any) {
      // Error silenciado
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setEmitiendo(false);
    }
  };

  // ==================== EMITIR CON DATOS (sin necesitar estado de modal) ====================
  const emitirConDatos = useCallback(async (venta: Venta, tipo: "boleta" | "remito") => {
    setEmitiendo(true);
    const toastId = `generar-${tipo}-${venta.id}`;
    toast.loading(`Generando ${tipo}...`, { id: toastId });
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Usuario no autenticado");
      const token = await user.getIdToken();

      if (tipo === "boleta") {
        let taxCategory = venta.clientTaxCategory || "consumidor_final";
        let clientName = venta.clientName || "Cliente";
        let clientCuit = venta.clientCuit || "";
        let clientPhone = venta.clientPhone || "";
        let clientAddress = venta.clientAddress || "";

        if (venta.clientId) {
          try {
            const clientRef = doc(db, "clientes", venta.clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
              const d = clientSnap.data();
              taxCategory = d.taxCategory || taxCategory;
              clientName = d.name || clientName;
              clientCuit = d.cuit || clientCuit;
              clientPhone = d.phone || clientPhone;
              clientAddress = d.address || clientAddress;
            }
          } catch {}
        }

        const afipResponse = await fetch("/api/ventas/emitir", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            saleId: venta.id,
            client: { name: clientName, phone: clientPhone, cuit: clientCuit, address: clientAddress, taxCategory },
            emitirAfip: true,
          }),
        });
        if (!afipResponse.ok) {
          const txt = await afipResponse.text().catch(() => "Error desconocido");
          throw new Error(`Error en AFIP (${afipResponse.status}): ${txt.substring(0, 200)}`);
        }
        const { invoiceNumber, afipData } = await afipResponse.json();
        const pdfBase64 = await generarPdfCompleto({ ...venta, invoiceNumber }, "boleta", afipData);
        await updateDoc(doc(db, "ventas", venta.id), {
          invoicePdfBase64: pdfBase64, invoiceNumber, invoiceEmitted: true,
          invoiceStatus: "emitted", afipData, invoiceGeneratedAt: serverTimestamp(),
        });
        await savePdfToDatabase(venta.id, "invoice", {
          base64: pdfBase64, filename: `boleta-${invoiceNumber}.pdf`,
          contentType: "application/pdf", size: Math.ceil((pdfBase64.length * 3) / 4),
          generatedAt: new Date().toISOString(),
        });
        downloadBase64Pdf(pdfBase64, buildDocFilename("boleta", invoiceNumber, venta.clientName || ventaParaEmitir?.clientName));
        // Actualizar la venta seleccionada para que el modal refleje los cambios
        setVentaSeleccionada((prev) => prev && prev.id === venta.id ? {
          ...prev, invoicePdfBase64: pdfBase64, invoiceNumber, invoiceEmitted: true,
          invoiceStatus: "emitted", afipData,
        } as Venta : prev);
        toast.success("Boleta emitida correctamente", { id: toastId });
      } else {
        const remitosQuery = query(
          collection(db, "ventas"),
          where("remitoNumber", "!=", null),
          orderBy("remitoNumber", "desc"),
          limit(1),
        );
        const snap = await getDocs(remitosQuery);
        let ultimoNumero = 0;
        if (!snap.empty) {
          const last = snap.docs[0].data().remitoNumber;
          const match = last?.match(/R-\d+-(\d+)/);
          if (match) ultimoNumero = parseInt(match[1], 10);
        }
        const remitoNumber = `R-${new Date().getFullYear()}-${String(ultimoNumero + 1).padStart(5, "0")}`;
        const pdfBase64 = await generarPdfCompleto({ ...venta, remitoNumber }, "remito");
        await updateDoc(doc(db, "ventas", venta.id), {
          remitoPdfBase64: pdfBase64, remitoNumber, remitoGeneratedAt: serverTimestamp(),
        });
        await savePdfToDatabase(venta.id, "remito", {
          base64: pdfBase64, filename: `remito-${remitoNumber}.pdf`,
          contentType: "application/pdf", size: Math.ceil((pdfBase64.length * 3) / 4),
          generatedAt: new Date().toISOString(),
        });
        downloadBase64Pdf(pdfBase64, buildDocFilename("remito", remitoNumber, venta.clientName || ventaParaEmitir?.clientName));
        // Actualizar la venta seleccionada para que el modal refleje los cambios
        setVentaSeleccionada((prev) => prev && prev.id === venta.id ? {
          ...prev, remitoPdfBase64: pdfBase64, remitoNumber,
        } as Venta : prev);
        toast.success("Remito generado correctamente", { id: toastId });
      }
      await cargarVentas();
    } catch (error: any) {
      // Error silenciado
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setEmitiendo(false);
    }
  }, [cargarVentas, generarPdfCompleto]);

  // Descargar PDF existente
  const descargarPdf = useCallback((venta: Venta, tipo: "boleta" | "remito" = "boleta") => {
    const base64 =
      tipo === "boleta" ? venta.invoicePdfBase64 : venta.remitoPdfBase64;
    if (base64) {
      const filename = buildDocFilename(tipo, tipo === "boleta" ? venta.invoiceNumber : venta.remitoNumber, venta.clientName);
      downloadBase64Pdf(base64, filename);
    } else {
      toast.error("El PDF no está disponible. Genérelo primero.");
    }
  }, []);

  const construirUrlWhatsapp = useCallback((venta: Venta) => {
    if (!venta.clientPhone) return null;
    const telefono = venta.clientPhone.replace(/\D/g, "");
    const formattedPhone = telefono.startsWith("54")
      ? telefono
      : `54${telefono}`;

    const tieneFactura = venta.invoiceEmitted && venta.invoicePdfBase64;
    const tieneRemito = venta.remitoNumber && venta.remitoPdfBase64;

    let mensaje = `Hola ${venta.clientName || ""},\n\n`;

    if (tieneFactura) {
      mensaje += `Tu factura N° ${venta.invoiceNumber} está lista.\n`;
      mensaje += `Total: $${venta.total.toLocaleString("es-AR")}\n\n`;
    }

    if (tieneRemito) {
      mensaje += `Tu remito N° ${venta.remitoNumber} está listo.\n\n`;
    }

    mensaje += `Para descargar el comprobante, haz clic en el siguiente enlace:\n`;
    mensaje += `${window.location.origin}/ventas?saleId=${venta.id}`;

    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(mensaje)}`;
  }, []);

  const enviarPorWhatsapp = useCallback(async (
    venta: Venta,
    tipo: "boleta" | "remito" = "boleta",
  ) => {
    const base64 =
      tipo === "boleta" ? venta.invoicePdfBase64 : venta.remitoPdfBase64;
    const phone = venta.clientPhone;

    if (!base64) {
      toast.error("El PDF no está disponible");
      return;
    }

    if (!phone) {
      toast.error("El cliente no tiene teléfono");
      return;
    }

    try {
      const filename =
        tipo === "boleta"
          ? `Factura-${venta.invoiceNumber || venta.id}.pdf`
          : `Remito-${venta.remitoNumber || venta.id}.pdf`;

      const cleanBase64 = base64.replace(/\s/g, "");
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("54")
        ? cleanPhone
        : `54${cleanPhone}`;

      // MÓVIL: Intentar compartir nativo
      if (navigator.share) {
        try {
          const file = new File([blob], filename, { type: "application/pdf" });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: filename,
              text:
                tipo === "boleta"
                  ? `Factura N° ${venta.invoiceNumber} - Total: $${venta.total.toLocaleString("es-AR")}`
                  : `Remito N° ${venta.remitoNumber}`,
            });
            toast.success("Archivo compartido");
            return;
          }
        } catch {
          // Compartir nativo no disponible, usar método alternativo
        }
      }

      // DESKTOP/FALLBACK
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const mensaje =
        tipo === "boleta"
          ? `Hola ${venta.clientName || ""}! 👋\n\nTe descargué la *Factura N° ${venta.invoiceNumber}*\nTotal: $${venta.total.toLocaleString("es-AR")}\n\n📎 Adjuntá el archivo PDF que se descargó automáticamente.`
          : `Hola ${venta.clientName || ""}! 👋\n\nTe descargué el *Remito N° ${venta.remitoNumber}*\n\n📎 Adjuntá el archivo PDF que se descargó automáticamente.`;

      window.open(
        `https://wa.me/${formattedPhone}?text=${encodeURIComponent(mensaje)}`,
        "_blank",
      );

      toast.success("PDF descargado. Adjuntalo manualmente en WhatsApp.", {
        duration: 5000,
      });
    } catch (error: any) {
      // Error silenciado
      toast.error("Error: " + error.message);
    }
  }, []);

  const formatearMoneda = useCallback((monto: number) => {
    return formatCurrencyDecimals(monto);
  }, []);

  const formatearFechaHora = useCallback((fecha: any) => {
    return formatDateTime(fecha);
  }, []);

  const etiquetaPago = useCallback((tipo: string, metodo?: string) => {
    if (tipo === "cash" && metodo) {
      return PAYMENT_METHOD_LABELS[metodo] || PAYMENT_LABELS[tipo] || tipo;
    }
    return PAYMENT_LABELS[tipo] || tipo;
  }, []);

  const claseBadgePago = useCallback((tipo: string) => {
    return PAYMENT_BADGE_CLASSES[tipo] || "bg-gray-100 text-gray-800";
  }, []);

  // Resolver teléfono del cliente: primero de la venta, si no busca en Firestore
  const resolverTelefono = useCallback(async (venta: Venta): Promise<string> => {
    const phone = venta.clientPhone?.replace(/\D/g, "") || "";
    if (phone) return phone;
    if (!venta.clientId) return "";
    try {
      const clientSnap = await getDoc(doc(db, "clientes", venta.clientId));
      if (clientSnap.exists()) {
        return clientSnap.data().phone?.replace(/\D/g, "") || "";
      }
    } catch {}
    return "";
  }, []);

  return {
    ventas,
    ventasFiltradas,
    cargando,
    filtros,
    actualizarFiltros,
    recargar: cargarVentas,
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
    setTipoDocumento,
    descargarPdf,
    construirUrlWhatsapp,
    enviarPorWhatsapp,
    resolverTelefono,
    formatearMoneda,
    formatearFechaHora,
    etiquetaPago,
    claseBadgePago,
  };
}
