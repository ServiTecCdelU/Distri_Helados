"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { savePdfToDatabase, downloadBase64Pdf } from "@/services/pdf-service";
import { toast } from "sonner";
import { formatCurrencyDecimals, formatDateTime } from "@/lib/utils/format";

// Helper para nombre de archivo: N°{numero}_{nombre_cliente}.pdf
function buildDocFilename(tipo: "boleta" | "remito", numero: string | undefined, clientName?: string): string {
  const nombre = (clientName || "cliente")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  let nro = numero || "0";
  const match = nro.match(/(\d+)$/);
  if (match) nro = String(parseInt(match[1], 10));
  const prefix = tipo === "boleta" ? "boleta" : "remito";
  return `${prefix}_N°${nro}_${nombre}.pdf`;
}

// Tipos (misma interfaz que la versión Firebase)
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
    if (typeof date === "string") d = new Date(date);
    else if (typeof date === "number") d = new Date(date);
    else if (date instanceof Date) d = date;
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

// Mapear fila de Supabase a Venta
function mapVentaRow(row: any): Venta {
  const items: VentaItem[] = (row.venta_items || []).map((i: any) => ({
    name: i.name,
    quantity: i.quantity,
    price: i.price,
    itemDiscount: i.item_discount ?? undefined,
  }));

  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name ?? undefined,
    clientPhone: row.client_phone ?? undefined,
    clientAddress: row.client_address ?? undefined,
    clientCuit: row.client_cuit ?? undefined,
    clientTaxCategory: row.client_tax_category ?? undefined,
    items,
    total: row.total,
    paymentType: row.payment_type,
    cashAmount: row.cash_amount ?? undefined,
    creditAmount: row.credit_amount ?? undefined,
    createdAt: row.created_at,
    invoiceNumber: row.invoice_number ?? undefined,
    invoiceEmitted: row.invoice_emitted ?? false,
    afipData: row.venta_afip_data?.[0] ? {
      cae: row.venta_afip_data[0].cae,
      caeVencimiento: row.venta_afip_data[0].cae_vencimiento,
      tipoComprobante: row.venta_afip_data[0].tipo_comprobante,
      puntoVenta: row.venta_afip_data[0].punto_venta,
      numeroComprobante: row.venta_afip_data[0].numero_comprobante,
    } : undefined,
    invoiceDriveUrl: row.invoice_drive_url ?? undefined,
    invoiceDriveFileId: row.invoice_drive_file_id ?? undefined,
    remitoDriveUrl: row.remito_drive_url ?? undefined,
    remitoDriveFileId: row.remito_drive_file_id ?? undefined,
    remitoNumber: row.remito_number ?? undefined,
    remitoPdfBase64: row.remito_pdf_base64 ?? undefined,
    invoicePdfBase64: row.invoice_pdf_base64 ?? undefined,
    sellerName: row.seller_name ?? undefined,
    saleNumber: row.sale_number ?? undefined,
    deliveryAddress: row.delivery_address ?? undefined,
    discount: row.discount ?? undefined,
    discountType: row.discount_type ?? undefined,
    clientData: row.client_data ?? undefined,
  };
}

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
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);
  const [modalEmitirAbierto, setModalEmitirAbierto] = useState(false);
  const [ventaParaEmitir, setVentaParaEmitir] = useState<Venta | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState<"boleta" | "remito">("boleta");
  const [emitiendo, setEmitiendo] = useState(false);

  // Cargar ventas con JOIN a venta_items y venta_afip_data
  const cargarVentas = useCallback(async () => {
    try {
      setCargando(true);
      let q = supabase
        .from('ventas')
        .select('*, venta_items(*), venta_afip_data(*)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filterBySellerId) {
        q = q.eq('seller_id', filterBySellerId);
      }

      const { data, error } = await q;
      if (error) throw error;
      setVentas((data || []).map(mapVentaRow));
    } catch {
      toast.error("Error al cargar ventas");
    } finally {
      setCargando(false);
    }
  }, [filterBySellerId]);

  useEffect(() => {
    cargarVentas();
  }, [cargarVentas]);

  // Filtrado memoizado
  const ventasFiltradas = useMemo(() => {
    return ventas.filter((venta) => {
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

      if (filtros.dateFrom) {
        const ventaDate = safeGetDate(venta.createdAt);
        const fromDate = new Date(filtros.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (!ventaDate || ventaDate < fromDate) return false;
      }

      if (filtros.dateTo) {
        const ventaDate = safeGetDate(venta.createdAt);
        const toDate = new Date(filtros.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (!ventaDate || ventaDate > toDate) return false;
      }

      if (filtros.paymentFilter !== "all" && venta.paymentType !== filtros.paymentFilter) return false;

      if (filtros.invoiceFilter !== "all") {
        if (filtros.invoiceFilter === "emitted" && !venta.invoiceEmitted) return false;
        if (filtros.invoiceFilter === "pending" && venta.invoiceEmitted) return false;
      }

      if (filtros.remitoFilter && filtros.remitoFilter !== "all") {
        const tieneRemito = !!venta.remitoNumber;
        if (filtros.remitoFilter === "emitted" && !tieneRemito) return false;
        if (filtros.remitoFilter === "pending" && tieneRemito) return false;
      }

      if (filtros.discountFilter && filtros.discountFilter !== "all") {
        const tieneDescuento = !!(venta.discount && venta.discount > 0)
          || (venta.items || []).some((i) => i.itemDiscount && i.itemDiscount > 0);
        if (filtros.discountFilter === "with" && !tieneDescuento) return false;
        if (filtros.discountFilter === "without" && tieneDescuento) return false;
      }

      if (filtros.clientId && venta.clientId !== filtros.clientId) return false;

      if (filtros.sellerId && (venta as any).sellerId !== filtros.sellerId) return false;

      if (filtros.city && clientCityMap) {
        const ventaCity = venta.clientId ? clientCityMap[venta.clientId] : undefined;
        if (ventaCity !== filtros.city) return false;
      }

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
      const { data, error } = await supabase
        .from('ventas')
        .select('*, venta_items(*), venta_afip_data(*)')
        .eq('id', saleId)
        .single();
      if (error) throw error;
      if (data) {
        setVentaSeleccionada(mapVentaRow(data));
        setModalDetalleAbierto(true);
      }
    } catch {}
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
    const pdfBase64 = await generarPdfCliente(venta, tipo, afipData);
    return pdfBase64;
  };

  // Helper: obtener token de sesión Supabase
  const getAuthToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Usuario no autenticado");
    return session.access_token;
  };

  // Helper: obtener datos frescos del cliente desde Supabase
  const fetchClientData = async (clientId: string) => {
    const { data } = await supabase
      .from('clientes')
      .select('name, phone, cuit, address, tax_category')
      .eq('id', clientId)
      .single();
    return data;
  };

  // Helper: obtener siguiente número de remito
  const getNextRemitoNumber = async (): Promise<string> => {
    const { data } = await supabase
      .from('ventas')
      .select('remito_number')
      .not('remito_number', 'is', null)
      .order('remito_number', { ascending: false })
      .limit(1);

    let ultimoNumero = 0;
    if (data && data.length > 0) {
      const last = data[0].remito_number;
      const match = last?.match(/R-\d+-(\d+)/);
      if (match) ultimoNumero = parseInt(match[1], 10);
    }
    return `R-${new Date().getFullYear()}-${String(ultimoNumero + 1).padStart(5, "0")}`;
  };

  // ==================== EMITIR DOCUMENTO ====================
  const emitirDocumento = async () => {
    if (!ventaParaEmitir) return;
    setEmitiendo(true);
    const toastId = `generar-${tipoDocumento}`;
    toast.loading(`Generando ${tipoDocumento}...`, { id: toastId });

    try {
      const token = await getAuthToken();

      if (tipoDocumento === "boleta") {
        let taxCategory = ventaParaEmitir.clientTaxCategory || "consumidor_final";
        let clientName = ventaParaEmitir.clientName || "Cliente";
        let clientCuit = ventaParaEmitir.clientCuit || "";
        let clientPhone = ventaParaEmitir.clientPhone || "";
        let clientAddress = ventaParaEmitir.clientAddress || "";

        if (ventaParaEmitir.clientId) {
          try {
            const clientData = await fetchClientData(ventaParaEmitir.clientId);
            if (clientData) {
              taxCategory = clientData.tax_category || taxCategory;
              clientName = clientData.name || clientName;
              clientCuit = clientData.cuit || clientCuit;
              clientPhone = clientData.phone || clientPhone;
              clientAddress = clientData.address || clientAddress;
            }
          } catch {}
        }

        // 1. Emitir en AFIP
        const afipResponse = await fetch("/api/ventas/emitir", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            saleId: ventaParaEmitir.id,
            client: { name: clientName, phone: clientPhone, cuit: clientCuit, address: clientAddress, taxCategory },
            emitirAfip: true,
          }),
        });

        if (!afipResponse.ok) {
          const errorText = await afipResponse.text().catch(() => "Error desconocido");
          throw new Error(`Error en AFIP (${afipResponse.status}): ${errorText.substring(0, 200)}`);
        }

        const afipResult = await afipResponse.json();
        const { invoiceNumber, afipData } = afipResult;

        // 2. Generar PDF
        const pdfBase64 = await generarPdfCompleto({ ...ventaParaEmitir, invoiceNumber }, "boleta", afipData);

        // 3. Guardar en Supabase
        await supabase.from('ventas').update({
          invoice_pdf_base64: pdfBase64,
          invoice_number: invoiceNumber,
          invoice_emitted: true,
          invoice_status: 'emitted',
        }).eq('id', ventaParaEmitir.id);

        // Guardar AFIP data en tabla separada
        if (afipData) {
          await supabase.from('venta_afip_data').upsert({
            sale_id: ventaParaEmitir.id,
            cae: afipData.cae,
            cae_vencimiento: afipData.caeVencimiento,
            tipo_comprobante: afipData.tipoComprobante,
            punto_venta: afipData.puntoVenta,
            numero_comprobante: afipData.numeroComprobante,
          }, { onConflict: 'sale_id' });
        }

        // 4. Guardar metadata del PDF
        await savePdfToDatabase(ventaParaEmitir.id, "invoice", {
          base64: pdfBase64,
          filename: buildDocFilename("boleta", invoiceNumber, ventaParaEmitir.clientName),
          contentType: "application/pdf",
          size: Math.ceil((pdfBase64.length * 3) / 4),
          generatedAt: new Date().toISOString(),
        });

        // 5. Descargar
        downloadBase64Pdf(pdfBase64, buildDocFilename("boleta", invoiceNumber, ventaParaEmitir.clientName));
        toast.success("Boleta emitida correctamente", { id: toastId });
      } else if (tipoDocumento === "remito") {
        const remitoNumber = await getNextRemitoNumber();
        const pdfBase64 = await generarPdfCompleto({ ...ventaParaEmitir, remitoNumber }, "remito");

        await supabase.from('ventas').update({
          remito_pdf_base64: pdfBase64,
          remito_number: remitoNumber,
        }).eq('id', ventaParaEmitir.id);

        await savePdfToDatabase(ventaParaEmitir.id, "remito", {
          base64: pdfBase64,
          filename: buildDocFilename("remito", remitoNumber, ventaParaEmitir.clientName),
          contentType: "application/pdf",
          size: Math.ceil((pdfBase64.length * 3) / 4),
          generatedAt: new Date().toISOString(),
        });

        downloadBase64Pdf(pdfBase64, buildDocFilename("remito", remitoNumber, ventaParaEmitir.clientName));
        toast.success("Remito generado correctamente", { id: toastId });
      }

      await cargarVentas();
      cerrarEmitir();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setEmitiendo(false);
    }
  };

  // ==================== EMITIR CON DATOS (sin modal) ====================
  const emitirConDatos = useCallback(async (venta: Venta, tipo: "boleta" | "remito") => {
    setEmitiendo(true);
    const toastId = `generar-${tipo}-${venta.id}`;
    toast.loading(`Generando ${tipo}...`, { id: toastId });
    try {
      const token = await getAuthToken();

      if (tipo === "boleta") {
        let taxCategory = venta.clientTaxCategory || "consumidor_final";
        let clientName = venta.clientName || "Cliente";
        let clientCuit = venta.clientCuit || "";
        let clientPhone = venta.clientPhone || "";
        let clientAddress = venta.clientAddress || "";

        if (venta.clientId) {
          try {
            const clientData = await fetchClientData(venta.clientId);
            if (clientData) {
              taxCategory = clientData.tax_category || taxCategory;
              clientName = clientData.name || clientName;
              clientCuit = clientData.cuit || clientCuit;
              clientPhone = clientData.phone || clientPhone;
              clientAddress = clientData.address || clientAddress;
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

        await supabase.from('ventas').update({
          invoice_pdf_base64: pdfBase64, invoice_number: invoiceNumber,
          invoice_emitted: true, invoice_status: 'emitted',
        }).eq('id', venta.id);

        if (afipData) {
          await supabase.from('venta_afip_data').upsert({
            sale_id: venta.id,
            cae: afipData.cae, cae_vencimiento: afipData.caeVencimiento,
            tipo_comprobante: afipData.tipoComprobante, punto_venta: afipData.puntoVenta,
            numero_comprobante: afipData.numeroComprobante,
          }, { onConflict: 'sale_id' });
        }

        await savePdfToDatabase(venta.id, "invoice", {
          base64: pdfBase64, filename: `boleta-${invoiceNumber}.pdf`,
          contentType: "application/pdf", size: Math.ceil((pdfBase64.length * 3) / 4),
          generatedAt: new Date().toISOString(),
        });
        downloadBase64Pdf(pdfBase64, buildDocFilename("boleta", invoiceNumber, venta.clientName));
        setVentaSeleccionada((prev) => prev && prev.id === venta.id ? {
          ...prev, invoicePdfBase64: pdfBase64, invoiceNumber, invoiceEmitted: true,
          invoiceStatus: "emitted", afipData,
        } as Venta : prev);
        toast.success("Boleta emitida correctamente", { id: toastId });
      } else {
        const remitoNumber = await getNextRemitoNumber();
        const pdfBase64 = await generarPdfCompleto({ ...venta, remitoNumber }, "remito");

        await supabase.from('ventas').update({
          remito_pdf_base64: pdfBase64, remito_number: remitoNumber,
        }).eq('id', venta.id);

        await savePdfToDatabase(venta.id, "remito", {
          base64: pdfBase64, filename: `remito-${remitoNumber}.pdf`,
          contentType: "application/pdf", size: Math.ceil((pdfBase64.length * 3) / 4),
          generatedAt: new Date().toISOString(),
        });
        downloadBase64Pdf(pdfBase64, buildDocFilename("remito", remitoNumber, venta.clientName));
        setVentaSeleccionada((prev) => prev && prev.id === venta.id ? {
          ...prev, remitoPdfBase64: pdfBase64, remitoNumber,
        } as Venta : prev);
        toast.success("Remito generado correctamente", { id: toastId });
      }
      await cargarVentas();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setEmitiendo(false);
    }
  }, [cargarVentas]);

  // Descargar PDF existente
  const descargarPdf = useCallback((venta: Venta, tipo: "boleta" | "remito" = "boleta") => {
    const base64 = tipo === "boleta" ? venta.invoicePdfBase64 : venta.remitoPdfBase64;
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
    const formattedPhone = telefono.startsWith("54") ? telefono : `54${telefono}`;

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

  const enviarPorWhatsapp = useCallback(async (venta: Venta, tipo: "boleta" | "remito" = "boleta") => {
    const base64 = tipo === "boleta" ? venta.invoicePdfBase64 : venta.remitoPdfBase64;
    const phone = venta.clientPhone;

    if (!base64) { toast.error("El PDF no está disponible"); return; }
    if (!phone) { toast.error("El cliente no tiene teléfono"); return; }

    try {
      const filename = tipo === "boleta"
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
      const formattedPhone = cleanPhone.startsWith("54") ? cleanPhone : `54${cleanPhone}`;

      if (navigator.share) {
        try {
          const file = new File([blob], filename, { type: "application/pdf" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: filename,
              text: tipo === "boleta"
                ? `Factura N° ${venta.invoiceNumber} - Total: $${venta.total.toLocaleString("es-AR")}`
                : `Remito N° ${venta.remitoNumber}`,
            });
            toast.success("Archivo compartido");
            return;
          }
        } catch {}
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const mensaje = tipo === "boleta"
        ? `Hola ${venta.clientName || ""}! 👋\n\nTe descargué la *Factura N° ${venta.invoiceNumber}*\nTotal: $${venta.total.toLocaleString("es-AR")}\n\n📎 Adjuntá el archivo PDF que se descargó automáticamente.`
        : `Hola ${venta.clientName || ""}! 👋\n\nTe descargué el *Remito N° ${venta.remitoNumber}*\n\n📎 Adjuntá el archivo PDF que se descargó automáticamente.`;

      window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(mensaje)}`, "_blank");
      toast.success("PDF descargado. Adjuntalo manualmente en WhatsApp.", { duration: 5000 });
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  }, []);

  const formatearMoneda = useCallback((monto: number) => formatCurrencyDecimals(monto), []);
  const formatearFechaHora = useCallback((fecha: any) => formatDateTime(fecha), []);

  const etiquetaPago = useCallback((tipo: string, metodo?: string) => {
    if (tipo === "cash" && metodo) return PAYMENT_METHOD_LABELS[metodo] || PAYMENT_LABELS[tipo] || tipo;
    return PAYMENT_LABELS[tipo] || tipo;
  }, []);

  const claseBadgePago = useCallback((tipo: string) => {
    return PAYMENT_BADGE_CLASSES[tipo] || "bg-gray-100 text-gray-800";
  }, []);

  // Resolver teléfono del cliente
  const resolverTelefono = useCallback(async (venta: Venta): Promise<string> => {
    const phone = venta.clientPhone?.replace(/\D/g, "") || "";
    if (phone) return phone;
    if (!venta.clientId) return "";
    try {
      const { data } = await supabase
        .from('clientes')
        .select('phone')
        .eq('id', venta.clientId)
        .single();
      return data?.phone?.replace(/\D/g, "") || "";
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
