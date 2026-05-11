"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck

// hooks/useGenerarPdf.tsx
// Genera PDFs directamente en el cliente usando @react-pdf/renderer
// SIN necesidad de Chromium ni ninguna API server-side
import { Document, Page, Text, View, StyleSheet, Image, pdf } from "@react-pdf/renderer";
import { formatCurrencyDecimals as formatCurrency } from "@/lib/utils/format";

// ===================== TIPOS =====================
export interface VentaItem {
  name: string;
  quantity: number;
  price: number;
  itemDiscount?: number; // porcentaje
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
  remitoNumber?: string;
  deliveryAddress?: string;
  discount?: number;
  discountType?: "percent" | "fixed";
  afipData?: {
    cae?: string;
    caeVencimiento?: string;
    tipoComprobante?: number;
    puntoVenta?: number;
    numeroComprobante?: number;
  };
  clientData?: {
    name?: string;
    phone?: string;
    cuit?: string;
    address?: string;
    taxCategory?: string;
  };
}

// ===================== HELPERS =====================
const safeFormatDate = (date: any): string => {
  if (!date) return "-";
  try {
    let d: Date;
    if (date?.toDate) d = date.toDate();
    else if (typeof date === "string") d = new Date(date);
    else if (typeof date === "number") d = new Date(date);
    else if (date instanceof Date) d = date;
    else if (date?.seconds) d = new Date(date.seconds * 1000);
    else return "-";
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

const safeFormatTime = (date: any): string => {
  if (!date) return "--:--";
  try {
    let d: Date;
    if (date?.toDate) d = date.toDate();
    else if (typeof date === "string") d = new Date(date);
    else if (date instanceof Date) d = date;
    else if (date?.seconds) d = new Date(date.seconds * 1000);
    else return "--:--";
    return isNaN(d.getTime())
      ? "--:--"
      : d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
};

const getTaxCategoryLabel = (category?: string) => {
  const categories: Record<string, string> = {
    responsable_inscripto: "Responsable Inscripto",
    monotributo: "Monotributo",
    consumidor_final: "Consumidor Final",
    exento: "Exento",
    no_responsable: "No Responsable",
  };
  return categories[category || ""] || "Consumidor Final";
};

const getPaymentTypeLabel = (type: string, method?: string) => {
  if (type === "cash" && method === "transferencia") return "Transferencia";
  const types: Record<string, string> = {
    cash: "Efectivo",
    credit: "Cuenta Corriente",
    mixed: "Contado y Cuenta Corriente",
  };
  return types[type] || type;
};

/** Mapea tipoComprobante AFIP a letra, código y nombre */
const getDocTypeInfo = (tipoComprobante?: number) => {
  const map: Record<number, { letter: string; code: string; name: string }> = {
    1:  { letter: "A", code: "001", name: "FACTURA A" },
    2:  { letter: "A", code: "002", name: "NOTA DE DÉBITO A" },
    3:  { letter: "A", code: "003", name: "NOTA DE CRÉDITO A" },
    6:  { letter: "B", code: "006", name: "FACTURA B" },
    7:  { letter: "B", code: "007", name: "NOTA DE DÉBITO B" },
    8:  { letter: "B", code: "008", name: "NOTA DE CRÉDITO B" },
    11: { letter: "C", code: "011", name: "FACTURA C" },
    12: { letter: "C", code: "012", name: "NOTA DE DÉBITO C" },
    13: { letter: "C", code: "013", name: "NOTA DE CRÉDITO C" },
  };
  return map[tipoComprobante || 6] || { letter: "B", code: "006", name: "FACTURA B" };
};

/** Genera URL del QR AFIP según RG 4291/18 */
const generarQrAfip = (venta: Venta, afipData: any): string | null => {
  if (!afipData?.cae) return null;
  try {
    const cuitEmisor = 20145983836; // CUIT de DOMINGUEZ MARIO CESAR
    const fechaStr = (() => {
      const d = venta.createdAt?.toDate
        ? venta.createdAt.toDate()
        : venta.createdAt instanceof Date
        ? venta.createdAt
        : new Date(venta.createdAt || Date.now());
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();

    const docRec = (venta.clientCuit || venta.clientData?.cuit || "").replace(/\D/g, "");
    const tipoDocRec = docRec.length === 11 ? 80 : docRec.length === 8 ? 96 : 99;
    const nroDocRec = docRec ? parseInt(docRec, 10) : 0;

    const payload = {
      ver: 1,
      fecha: fechaStr,
      cuit: cuitEmisor,
      ptoVta: afipData.puntoVenta || 10,
      tipoCmp: afipData.tipoComprobante || 6,
      nroCmp: afipData.numeroComprobante || 0,
      importe: Number(venta.total || 0),
      moneda: "PES",
      ctz: 1,
      tipoDocRec,
      nroDocRec,
      tipoCodAut: "E",
      codAut: parseInt(String(afipData.cae).replace(/\D/g, ""), 10) || 0,
    };
    const json = JSON.stringify(payload);
    const b64 =
      typeof window !== "undefined"
        ? btoa(unescape(encodeURIComponent(json)))
        : Buffer.from(json, "utf-8").toString("base64");
    const afipUrl = `https://www.afip.gob.ar/fe/qr/?p=${b64}`;
    // Usar servicio externo para generar la imagen del QR (sin instalar librerías)
    return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(afipUrl)}`;
  } catch {
    return null;
  }
};

// ===================== ESTILOS BOLETA =====================
const boletaStyles = StyleSheet.create({
  page: {
    padding: "12mm",
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a1a",
    backgroundColor: "white",
  },
  // ── Header principal ──
  headerBox: { border: "1.5px solid black", marginBottom: 10 },
  headerTopRow: { flexDirection: "row", borderBottom: "1.5px solid black", minHeight: 70 },
  headerLeft: {
    width: "42%",
    padding: 10,
    borderRight: "1.5px solid black",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    width: "16%",
    padding: 6,
    borderRight: "1.5px solid black",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    width: "42%",
    padding: 10,
    justifyContent: "center",
  },
  logo: { width: 90, height: 55, objectFit: "contain", marginBottom: 2 },
  docTypeBox: {
    border: "2px solid black",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  docTypeText: { fontSize: 22, fontWeight: "bold" },
  docTypeLabel: { fontSize: 6, textAlign: "center", lineHeight: 1.3 },
  invoiceTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  invoiceInfo: { fontSize: 9, lineHeight: 1.6 },
  // ── Header info row (datos empresa) ──
  headerBottomRow: { flexDirection: "row", padding: "8px 10px", minHeight: 44 },
  headerInfoLeft: { width: "50%", paddingRight: 10, borderRight: "0.5px solid #999" },
  headerInfoRight: { width: "50%", paddingLeft: 10 },
  infoText: { fontSize: 8, lineHeight: 1.7 },
  // ── Client section ──
  clientSection: { border: "1px solid black", padding: "8px 10px", marginBottom: 10 },
  row: { flexDirection: "row", marginBottom: 2 },
  col: { width: "50%" },
  bold: { fontWeight: "bold" },
  text: { fontSize: 8.5 },
  textXs: { fontSize: 7 },
  textCenter: { textAlign: "center" },
  textRight: { textAlign: "right" },
  // ── Table ──
  table: { border: "1px solid black", marginBottom: 10 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1.5px solid black",
    backgroundColor: "#f5f5f5",
    padding: "6px 8px",
    fontWeight: "bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #ccc",
    padding: "5px 8px",
    fontSize: 8,
  },
  colQty: { width: "10%", textAlign: "center" },
  colDesc: { width: "42%" },
  colPrice: { width: "16%", textAlign: "right" },
  colDto: { width: "8%", textAlign: "center" },
  colUnitDto: { width: "12%", textAlign: "right" },
  colSubtotal: { width: "12%", textAlign: "right" },
  // ── Totals ──
  totalsSection: { marginBottom: 10 },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: "45%", border: "1px solid black", padding: 10 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 9,
  },
  totalRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 13,
    fontWeight: "bold",
    borderTop: "1.5px solid black",
    paddingTop: 6,
    marginTop: 4,
  },
  // ── CAE ──
  caeSection: {
    border: "1px solid black",
    padding: "8px 12px",
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qrBox: {
    width: 85,
    height: 85,
    marginRight: 8,
  },
  qrImage: {
    width: 85,
    height: 85,
  },
  caeInfoBox: { flex: 1 },
  warningBox: {
    border: "2px solid #dc2626",
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
  },
  warningText: { color: "#dc2626", fontWeight: "bold", fontSize: 11 },
  warningSubText: { color: "#666", fontSize: 8, marginTop: 4 },
  footer: {
    marginTop: "auto",
    paddingTop: 8,
    borderTop: "0.5px solid #ccc",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#999",
  },
});

// ===================== COMPONENTE BOLETA =====================
const BoletaPDF = ({ venta, afipData }: { venta: Venta; afipData?: any }) => {
  const isElectronica = !!afipData?.cae;
  const docType = getDocTypeInfo(afipData?.tipoComprobante);
  const items = venta.items || [];
  const emptyRows = Math.max(0, 6 - items.length);
  const pv = venta.invoiceNumber?.split("-")[0] || "0010";
  const nro = venta.invoiceNumber?.split("-")[1] || "00000000";
  const clientCuit =
    venta.clientCuit || venta.clientData?.cuit || "-";
  const clientName =
    venta.clientName || venta.clientData?.name || "Consumidor Final";
  const clientAddress = venta.clientAddress || venta.clientData?.address || "-";
  const taxCategory = venta.clientTaxCategory || venta.clientData?.taxCategory;

  const logoSrc = typeof window !== "undefined"
    ? `${window.location.origin}/logo-small.png`
    : "/logo-small.png";

  const qrUrl = isElectronica ? generarQrAfip(venta, afipData) : null;

  const total = venta.total || 0;
  const neto = total / 1.21;
  const iva = total - neto;
  // Subtotal bruto antes de descuentos
  const subtotalBruto = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const subtotalConItemDtos = items.reduce((acc, item) => {
    const base = item.price * item.quantity;
    const disc = item.itemDiscount ? (base * item.itemDiscount) / 100 : 0;
    return acc + base - disc;
  }, 0);
  const haySaleDiscount = venta.discount && venta.discount > 0;
  const hayItemDiscounts = subtotalBruto > subtotalConItemDtos;

  return (
    <Document>
      <Page size="A4" style={boletaStyles.page}>
        {/* ══ HEADER ══ */}
        <View style={boletaStyles.headerBox}>
          <View style={boletaStyles.headerTopRow}>
            {/* Izquierda: Logo + datos empresa */}
            <View style={boletaStyles.headerLeft}>
              <Image src={logoSrc} style={boletaStyles.logo} />
            </View>
            {/* Centro: Tipo de documento */}
            <View style={boletaStyles.headerCenter}>
              <View style={boletaStyles.docTypeBox}>
                <Text style={boletaStyles.docTypeText}>
                  {isElectronica ? docType.letter : "X"}
                </Text>
              </View>
              <Text style={boletaStyles.docTypeLabel}>
                {isElectronica
                  ? `Cod. ${docType.code}`
                  : "No Valido"}
              </Text>
            </View>
            {/* Derecha: Datos factura */}
            <View style={boletaStyles.headerRight}>
              <Text style={boletaStyles.invoiceTitle}>
                {isElectronica ? docType.name : "PRESUPUESTO"}
              </Text>
              <Text style={boletaStyles.invoiceInfo}>
                {`Punto de Venta: ${pv}    Comp. Nro: ${nro}\n`}
                {`Fecha de Emision: ${safeFormatDate(venta.createdAt)}`}
              </Text>
            </View>
          </View>
          {/* Fila inferior: Datos fiscales emisor */}
          <View style={boletaStyles.headerBottomRow}>
            <View style={boletaStyles.headerInfoLeft}>
              <Text style={boletaStyles.infoText}>
                {"Razon Social: DOMINGUEZ MARIO CESAR\n"}
                {"Domicilio Comercial: DR. BASTIAN 1049 - SAN JOSE\n"}
                {"Condicion frente al IVA: IVA Responsable Inscripto"}
              </Text>
            </View>
            <View style={boletaStyles.headerInfoRight}>
              <Text style={boletaStyles.infoText}>
                {"CUIT: 20-14598383-6\n"}
                {"Ingresos Brutos: 20-14598383-6\n"}
                {"Inicio de Actividades: 01/01/2000"}
              </Text>
            </View>
          </View>
        </View>

        {/* ══ DATOS DEL RECEPTOR ══ */}
        <View style={boletaStyles.clientSection}>
          <View style={boletaStyles.row}>
            <View style={boletaStyles.col}>
              <Text style={boletaStyles.text}>
                <Text style={boletaStyles.bold}>CUIT/DNI: </Text>
                {clientCuit}
              </Text>
              <Text style={[boletaStyles.text, { marginTop: 2 }]}>
                <Text style={boletaStyles.bold}>Condicion frente al IVA: </Text>
                {getTaxCategoryLabel(taxCategory)}
              </Text>
            </View>
            <View style={boletaStyles.col}>
              <Text style={boletaStyles.text}>
                <Text style={boletaStyles.bold}>Apellido y Nombre / Razon Social: </Text>
                {clientName}
              </Text>
              <Text style={[boletaStyles.text, { marginTop: 2 }]}>
                <Text style={boletaStyles.bold}>Domicilio: </Text>
                {clientAddress}
              </Text>
            </View>
          </View>
          <View style={[boletaStyles.row, { marginTop: 2 }]}>
            <Text style={boletaStyles.text}>
              <Text style={boletaStyles.bold}>Condicion de Venta: </Text>
              {getPaymentTypeLabel(venta.paymentType, (venta as any).paymentMethod)}
            </Text>
          </View>
        </View>

        {/* ══ TABLA DE ITEMS ══ */}
        <View style={boletaStyles.table}>
          <View style={boletaStyles.tableHeader}>
            <Text style={boletaStyles.colQty}>Cant.</Text>
            <Text style={boletaStyles.colDesc}>Producto / Servicio</Text>
            <Text style={boletaStyles.colPrice}>P. Unit.</Text>
            <Text style={boletaStyles.colDto}>Dto.%</Text>
            <Text style={boletaStyles.colUnitDto}>Unit. c/ Dto.</Text>
            <Text style={boletaStyles.colSubtotal}>Subtotal</Text>
          </View>
          {items.map((item, i) => {
            const dto = item.itemDiscount || 0;
            const unitConDto = item.price * (1 - dto / 100);
            const lineSubtotal = unitConDto * item.quantity;
            return (
              <View key={i} style={boletaStyles.tableRow}>
                <Text style={boletaStyles.colQty}>{item.quantity.toFixed(2)}</Text>
                <Text style={boletaStyles.colDesc}>{item.name}</Text>
                <Text style={boletaStyles.colPrice}>
                  {formatCurrency(item.price)}
                </Text>
                <Text style={boletaStyles.colDto}>{dto.toFixed(2)}</Text>
                <Text style={boletaStyles.colUnitDto}>
                  {formatCurrency(unitConDto)}
                </Text>
                <Text style={boletaStyles.colSubtotal}>{formatCurrency(lineSubtotal)}</Text>
              </View>
            );
          })}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <View key={`e${i}`} style={boletaStyles.tableRow}>
              <Text style={boletaStyles.colQty}> </Text>
              <Text style={boletaStyles.colDesc}> </Text>
              <Text style={boletaStyles.colPrice}> </Text>
              <Text style={boletaStyles.colDto}> </Text>
              <Text style={boletaStyles.colUnitDto}> </Text>
              <Text style={boletaStyles.colSubtotal}> </Text>
            </View>
          ))}
        </View>

        {/* ══ TOTALES ══ */}
        <View style={boletaStyles.totalsSection}>
          <View style={boletaStyles.totalsRow}>
            <View style={boletaStyles.totalsBox}>
              {(hayItemDiscounts || haySaleDiscount) && (
                <View style={boletaStyles.totalRow}>
                  <Text>Subtotal bruto:</Text>
                  <Text>{formatCurrency(subtotalBruto)}</Text>
                </View>
              )}
              {hayItemDiscounts && (
                <View style={boletaStyles.totalRow}>
                  <Text>Dto. por producto:</Text>
                  <Text>-{formatCurrency(subtotalBruto - subtotalConItemDtos)}</Text>
                </View>
              )}
              {haySaleDiscount && (
                <View style={boletaStyles.totalRow}>
                  <Text>Dto. venta ({venta.discountType === "percent" ? `${venta.discount}%` : "fijo"}):</Text>
                  <Text>-{formatCurrency(subtotalConItemDtos - total)}</Text>
                </View>
              )}
              <View style={boletaStyles.totalRow}>
                <Text>Subtotal:</Text>
                <Text>{formatCurrency(neto)}</Text>
              </View>
              <View style={boletaStyles.totalRow}>
                <Text>21.00% IVA:</Text>
                <Text>{formatCurrency(iva)}</Text>
              </View>
              <View style={boletaStyles.totalRowFinal}>
                <Text>Importe Total:</Text>
                <Text>{formatCurrency(total)}</Text>
              </View>
              {venta.paymentType === "mixed" && (
                <View style={{ marginTop: 6, paddingTop: 4, borderTop: "1px dashed #999" }}>
                  <View style={boletaStyles.totalRow}>
                    <Text style={boletaStyles.textXs}>Efectivo:</Text>
                    <Text style={boletaStyles.textXs}>{formatCurrency(venta.cashAmount || 0)}</Text>
                  </View>
                  <View style={boletaStyles.totalRow}>
                    <Text style={boletaStyles.textXs}>Cuenta Corriente:</Text>
                    <Text style={boletaStyles.textXs}>{formatCurrency(venta.creditAmount || 0)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ══ CAE / WARNING ══ */}
        {isElectronica ? (
          <View style={boletaStyles.caeSection}>
            {qrUrl && (
              <View style={boletaStyles.qrBox}>
                <Image src={qrUrl} style={boletaStyles.qrImage} />
              </View>
            )}
            <View style={boletaStyles.caeInfoBox}>
              <Text style={[boletaStyles.text, { fontSize: 9 }]}>
                <Text style={boletaStyles.bold}>CAE N°: </Text>
                {afipData.cae}
              </Text>
              <Text style={[boletaStyles.text, { fontSize: 9, marginTop: 3 }]}>
                <Text style={boletaStyles.bold}>Fecha de Vto. de CAE: </Text>
                {afipData.caeVencimiento
                  ? safeFormatDate(afipData.caeVencimiento)
                  : "-"}
              </Text>
              <Text style={[boletaStyles.textXs, { marginTop: 4, color: "#666" }]}>
                Comprobante autorizado por AFIP - RG 4291/18
              </Text>
            </View>
          </View>
        ) : (
          <View style={boletaStyles.warningBox}>
            <Text style={boletaStyles.warningText}>
              DOCUMENTO NO VALIDO COMO FACTURA
            </Text>
            <Text style={boletaStyles.warningSubText}>
              Este documento es un presupuesto. Solicite factura electronica si la requiere.
            </Text>
          </View>
        )}

        {/* ══ FOOTER ══ */}
        <View style={boletaStyles.footer}>
          <Text>
            {isElectronica
              ? "Comprobante Autorizado por AFIP"
              : "Documento interno - No valido fiscalmente"}
          </Text>
          <Text>Pagina 1 de 1</Text>
        </View>
      </Page>
    </Document>
  );
};

// ===================== ESTILOS REMITO =====================
const remitoStyles = StyleSheet.create({
  page: {
    padding: "12mm",
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a1a",
    backgroundColor: "white",
  },
  // ── Header principal ──
  headerBox: { border: "1.5px solid black", marginBottom: 10 },
  headerTopRow: { flexDirection: "row", borderBottom: "1.5px solid black", minHeight: 70 },
  headerLeft: {
    width: "42%",
    padding: 10,
    borderRight: "1.5px solid black",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    width: "16%",
    padding: 6,
    borderRight: "1.5px solid black",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    width: "42%",
    padding: 10,
    justifyContent: "center",
  },
  logo: { width: 90, height: 55, objectFit: "contain", marginBottom: 2 },
  docTypeBox: {
    border: "2px solid black",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  docTypeText: { fontSize: 22, fontWeight: "bold" },
  docTypeLabel: { fontSize: 6, textAlign: "center", lineHeight: 1.3 },
  invoiceTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  invoiceInfo: { fontSize: 9, lineHeight: 1.6 },
  // ── Header info row (datos empresa) ──
  headerBottomRow: { flexDirection: "row", padding: "8px 10px", minHeight: 44 },
  headerInfoLeft: { width: "50%", paddingRight: 10, borderRight: "0.5px solid #999" },
  headerInfoRight: { width: "50%", paddingLeft: 10 },
  infoText: { fontSize: 8, lineHeight: 1.7 },
  originalBadge: {
    alignSelf: "flex-end",
    fontSize: 8,
    fontWeight: "bold",
    marginTop: 4,
  },
  // ── Client section ──
  clientSection: { border: "1px solid black", padding: "8px 10px", marginBottom: 10 },
  row: { flexDirection: "row", marginBottom: 2 },
  col: { width: "50%" },
  bold: { fontWeight: "bold" },
  text: { fontSize: 8.5 },
  textXs: { fontSize: 7 },
  // ── Table ──
  table: { border: "1px solid black", marginBottom: 10 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1.5px solid black",
    backgroundColor: "#f5f5f5",
    padding: "6px 8px",
    fontWeight: "bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #ccc",
    padding: "5px 8px",
    fontSize: 8,
  },
  colCodigo: { width: "14%", textAlign: "center" },
  colCant: { width: "10%", textAlign: "center" },
  colDesc: { width: "76%" },
  // ── Observaciones ──
  obsSection: {
    border: "1px solid black",
    padding: "6px 10px",
    marginBottom: 10,
    minHeight: 30,
  },
  // ── Firma ──
  firmaSection: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  firmaBox: {
    flex: 1,
    border: "1px solid black",
    padding: "18px 10px 6px 10px",
    minHeight: 60,
  },
  firmaLabel: {
    fontSize: 7,
    color: "#666",
    textAlign: "center",
    marginTop: 14,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 8,
    borderTop: "0.5px solid #ccc",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#999",
  },
});

// ===================== COMPONENTE REMITO =====================
const RemitoPDF = ({ venta }: { venta: Venta }) => {
  const items = venta.items || [];
  const emptyRows = Math.max(0, 10 - items.length);
  // Formato AFIP: punto de venta - número (0001-00000001)
  const remitoRaw = venta.remitoNumber || "";
  const [pvPart, nroPart] = remitoRaw.includes("-")
    ? remitoRaw.split("-")
    : ["0001", remitoRaw || "00000001"];
  const pv = String(pvPart).padStart(4, "0");
  const nro = String(nroPart).padStart(8, "0");

  const clientCuit = venta.clientCuit || venta.clientData?.cuit || "-";
  const clientName =
    venta.clientName || venta.clientData?.name || "Consumidor Final";
  const clientAddress =
    venta.deliveryAddress ||
    venta.clientAddress ||
    venta.clientData?.address ||
    "-";
  const taxCategory = venta.clientTaxCategory || venta.clientData?.taxCategory;

  const logoSrc = typeof window !== "undefined"
    ? `${window.location.origin}/logo-small.png`
    : "/logo-small.png";

  return (
    <Document>
      <Page size="A4" style={remitoStyles.page}>
        {/* ══ HEADER ══ */}
        <View style={remitoStyles.headerBox}>
          <View style={remitoStyles.headerTopRow}>
            {/* Izquierda: Logo */}
            <View style={remitoStyles.headerLeft}>
              <Image src={logoSrc} style={remitoStyles.logo} />
            </View>
            {/* Centro: Tipo de documento */}
            <View style={remitoStyles.headerCenter}>
              <View style={remitoStyles.docTypeBox}>
                <Text style={remitoStyles.docTypeText}>R</Text>
              </View>
              <Text style={remitoStyles.docTypeLabel}>
                DOCUMENTO{"\n"}NO FISCAL
              </Text>
            </View>
            {/* Derecha: Datos remito */}
            <View style={remitoStyles.headerRight}>
              <Text style={remitoStyles.invoiceTitle}>REMITO</Text>
              <Text style={remitoStyles.invoiceInfo}>
                {`Punto de Venta: ${pv}    Nro: ${nro}\n`}
                {`Fecha: ${safeFormatDate(venta.createdAt)}  ${safeFormatTime(venta.createdAt)}`}
              </Text>
              <Text style={remitoStyles.originalBadge}>ORIGINAL</Text>
            </View>
          </View>
          {/* Fila inferior: Datos del emisor */}
          <View style={remitoStyles.headerBottomRow}>
            <View style={remitoStyles.headerInfoLeft}>
              <Text style={remitoStyles.infoText}>
                {"Razon Social: DOMINGUEZ MARIO CESAR\n"}
                {"Domicilio Comercial: DR. BASTIAN 1049 - SAN JOSE\n"}
                {"Condicion frente al IVA: IVA Responsable Inscripto"}
              </Text>
            </View>
            <View style={remitoStyles.headerInfoRight}>
              <Text style={remitoStyles.infoText}>
                {"CUIT: 20-14598383-6\n"}
                {"Ingresos Brutos: 20-14598383-6\n"}
                {"Inicio de Actividades: 01/01/2000"}
              </Text>
            </View>
          </View>
        </View>

        {/* ══ DATOS DEL DESTINATARIO ══ */}
        <View style={remitoStyles.clientSection}>
          <View style={remitoStyles.row}>
            <View style={remitoStyles.col}>
              <Text style={remitoStyles.text}>
                <Text style={remitoStyles.bold}>CUIT/DNI: </Text>
                {clientCuit}
              </Text>
              <Text style={[remitoStyles.text, { marginTop: 2 }]}>
                <Text style={remitoStyles.bold}>Condicion frente al IVA: </Text>
                {getTaxCategoryLabel(taxCategory)}
              </Text>
            </View>
            <View style={remitoStyles.col}>
              <Text style={remitoStyles.text}>
                <Text style={remitoStyles.bold}>Destinatario: </Text>
                {clientName}
              </Text>
              <Text style={[remitoStyles.text, { marginTop: 2 }]}>
                <Text style={remitoStyles.bold}>Domicilio de Entrega: </Text>
                {clientAddress}
              </Text>
            </View>
          </View>
          {venta.clientPhone && (
            <View style={[remitoStyles.row, { marginTop: 2 }]}>
              <Text style={remitoStyles.text}>
                <Text style={remitoStyles.bold}>Telefono: </Text>
                {venta.clientPhone}
              </Text>
            </View>
          )}
        </View>

        {/* ══ TABLA DE ITEMS (sin precios - es remito) ══ */}
        <View style={remitoStyles.table}>
          <View style={remitoStyles.tableHeader}>
            <Text style={remitoStyles.colCodigo}>Codigo</Text>
            <Text style={remitoStyles.colCant}>Cant.</Text>
            <Text style={remitoStyles.colDesc}>Descripcion</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={remitoStyles.tableRow}>
              <Text style={remitoStyles.colCodigo}>{String(i + 1).padStart(4, "0")}</Text>
              <Text style={remitoStyles.colCant}>{item.quantity}</Text>
              <Text style={remitoStyles.colDesc}>{item.name}</Text>
            </View>
          ))}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <View key={`e${i}`} style={remitoStyles.tableRow}>
              <Text style={remitoStyles.colCodigo}>{" "}</Text>
              <Text style={remitoStyles.colCant}>{" "}</Text>
              <Text style={remitoStyles.colDesc}>{" "}</Text>
            </View>
          ))}
        </View>

        {/* ══ OBSERVACIONES ══ */}
        <View style={remitoStyles.obsSection}>
          <Text style={[remitoStyles.text, remitoStyles.bold]}>Observaciones:</Text>
          <Text style={[remitoStyles.textXs, { marginTop: 2, color: "#666" }]}>
            Este documento acompaña la mercadería detallada. No tiene valor fiscal.
          </Text>
        </View>

        {/* ══ FIRMAS ══ */}
        <View style={remitoStyles.firmaSection}>
          <View style={remitoStyles.firmaBox}>
            <Text style={remitoStyles.firmaLabel}>
              Firma y Aclaracion - Entregó
            </Text>
          </View>
          <View style={remitoStyles.firmaBox}>
            <Text style={remitoStyles.firmaLabel}>
              Firma, Aclaracion y DNI - Recibió conforme
            </Text>
          </View>
        </View>

        {/* ══ FOOTER ══ */}
        <View style={remitoStyles.footer}>
          <Text>Documento no fiscal - Comprobante de entrega</Text>
          <Text>Pagina 1 de 1</Text>
        </View>
      </Page>
    </Document>
  );
};

// ===================== FUNCIÓN EXPORTABLE =====================
/**
 * Genera un PDF de boleta o remito directamente en el cliente.
 * No usa Chromium ni ninguna API server-side.
 * Retorna el PDF como string base64.
 */
export const generarPdfCliente = async (
  venta: Venta,
  tipo: "boleta" | "remito",
  afipData?: any,
): Promise<string> => {
  const doc =
    tipo === "boleta" ? (
      <BoletaPDF venta={venta} afipData={afipData} />
    ) : (
      <RemitoPDF venta={venta} />
    );

  const pdfBlob = await pdf(doc).toBlob();
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// ===================== BOLETA MEDIA HOJA (dos copias en A4) =====================

const halfStyles = StyleSheet.create({
  page: { fontFamily: "Helvetica", backgroundColor: "white" },
  half: { height: "50%", padding: "5mm 8mm", position: "relative" },
  cutLine: {
    borderBottom: "1px dashed #aaa",
    marginHorizontal: "8mm",
  },
  // Header
  headerBox: { border: "1px solid black", marginBottom: 5 },
  headerTopRow: { flexDirection: "row", borderBottom: "1px solid black", minHeight: 44 },
  headerLeft: { width: "42%", padding: 5, borderRight: "1px solid black", alignItems: "center", justifyContent: "center" },
  headerCenter: { width: "16%", padding: 3, borderRight: "1px solid black", alignItems: "center", justifyContent: "center" },
  headerRight: { width: "42%", padding: 5, justifyContent: "center" },
  logo: { width: 60, height: 36, objectFit: "contain" },
  docTypeBox: { border: "1.5px solid black", width: 24, height: 24, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  docTypeText: { fontSize: 14, fontWeight: "bold" },
  docTypeLabel: { fontSize: 5, textAlign: "center" },
  invoiceTitle: { fontSize: 9, fontWeight: "bold", marginBottom: 2 },
  invoiceInfo: { fontSize: 6.5, lineHeight: 1.5 },
  headerBottomRow: { flexDirection: "row", padding: "4px 6px" },
  headerInfoLeft: { width: "50%", paddingRight: 6, borderRight: "0.5px solid #999" },
  headerInfoRight: { width: "50%", paddingLeft: 6 },
  infoText: { fontSize: 6, lineHeight: 1.5 },
  // Client
  clientSection: { border: "1px solid black", borderTop: "none", padding: "4px 6px", marginBottom: 4 },
  row: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },
  text: { fontSize: 6.5, marginBottom: 1 },
  bold: { fontWeight: "bold" },
  // Table
  table: { border: "1px solid black", marginBottom: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f0f0f0", borderBottom: "1px solid black", padding: "2px 4px", fontSize: 6, fontWeight: "bold" },
  tableRow: { flexDirection: "row", borderBottom: "0.5px solid #ddd", padding: "1.5px 4px", fontSize: 6 },
  colQty: { width: "8%", textAlign: "center" },
  colDesc: { width: "44%", paddingLeft: 2 },
  colPrice: { width: "14%", textAlign: "right" },
  colDto: { width: "8%", textAlign: "center" },
  colUnitDto: { width: "13%", textAlign: "right" },
  colSubtotal: { width: "13%", textAlign: "right" },
  // Totals
  totalsSection: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 },
  totalsBox: { width: "38%", fontSize: 6.5 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  totalRowFinal: { flexDirection: "row", justifyContent: "space-between", borderTop: "1px solid black", paddingTop: 2, fontWeight: "bold", fontSize: 7.5 },
  // CAE / warning
  caeSection: { flexDirection: "row", gap: 6, marginBottom: 3 },
  qrBox: { alignItems: "center" },
  qrImage: { width: 50, height: 50 },
  caeInfoBox: { flex: 1, fontSize: 6 },
  warningBox: { border: "1.5px solid #dc2626", padding: 6, marginBottom: 4, alignItems: "center" },
  warningText: { color: "#dc2626", fontWeight: "bold", fontSize: 7 },
  warningSubText: { color: "#666", fontSize: 5.5, marginTop: 2 },
  footer: { paddingTop: 3, borderTop: "0.5px solid #ccc", flexDirection: "row", justifyContent: "space-between", fontSize: 5.5, color: "#999" },
});

const BoletaMediaHoja = ({ venta, afipData }: { venta: Venta; afipData?: any }) => {
  const isElectronica = !!afipData?.cae;
  const docType = getDocTypeInfo(afipData?.tipoComprobante);
  const items = venta.items || [];
  const emptyRows = Math.max(0, 4 - items.length);
  const pv = venta.invoiceNumber?.split("-")[0] || "0010";
  const nro = venta.invoiceNumber?.split("-")[1] || "00000000";
  const clientCuit = venta.clientCuit || venta.clientData?.cuit || "-";
  const clientName = venta.clientName || venta.clientData?.name || "Consumidor Final";
  const clientAddress = venta.clientAddress || venta.clientData?.address || "-";
  const taxCategory = venta.clientTaxCategory || venta.clientData?.taxCategory;
  const logoSrc = typeof window !== "undefined" ? `${window.location.origin}/logo-small.png` : "/logo-small.png";
  const qrUrl = isElectronica ? generarQrAfip(venta, afipData) : null;
  const total = venta.total || 0;
  const neto = total / 1.21;
  const iva = total - neto;
  const subtotalBruto = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const subtotalConItemDtos = items.reduce((acc, item) => {
    const base = item.price * item.quantity;
    const disc = item.itemDiscount ? (base * item.itemDiscount) / 100 : 0;
    return acc + base - disc;
  }, 0);
  const haySaleDiscount = venta.discount && venta.discount > 0;
  const hayItemDiscounts = subtotalBruto > subtotalConItemDtos;

  const contenido = (
    <>
      {/* Header */}
      <View style={halfStyles.headerBox}>
        <View style={halfStyles.headerTopRow}>
          <View style={halfStyles.headerLeft}>
            <Image src={logoSrc} style={halfStyles.logo} />
          </View>
          <View style={halfStyles.headerCenter}>
            <View style={halfStyles.docTypeBox}>
              <Text style={halfStyles.docTypeText}>{isElectronica ? docType.letter : "X"}</Text>
            </View>
            <Text style={halfStyles.docTypeLabel}>{isElectronica ? `Cod. ${docType.code}` : "Cod. 000"}</Text>
          </View>
          <View style={halfStyles.headerRight}>
            <Text style={halfStyles.invoiceTitle}>{isElectronica ? docType.name : "PRESUPUESTO"}</Text>
            <Text style={halfStyles.invoiceInfo}>
              {`Pto. Vta: ${pv}   Nro: ${nro}\n`}
              {`Fecha: ${safeFormatDate(venta.createdAt)}`}
            </Text>
          </View>
        </View>
        <View style={halfStyles.headerBottomRow}>
          <View style={halfStyles.headerInfoLeft}>
            <Text style={halfStyles.infoText}>{"Razon Social: DOMINGUEZ MARIO CESAR\nDomicilio: DR. BASTIAN 1049 - SAN JOSE\nInicio Act.: 01/01/2015"}</Text>
          </View>
          <View style={halfStyles.headerInfoRight}>
            <Text style={halfStyles.infoText}>{"CUIT: 20-14598383-6\nIngresos Brutos: 20-14598383-6\nCondicion IVA: Responsable Inscripto"}</Text>
          </View>
        </View>
      </View>

      {/* Cliente */}
      <View style={halfStyles.clientSection}>
        <View style={halfStyles.row}>
          <View style={halfStyles.col}>
            <Text style={halfStyles.text}><Text style={halfStyles.bold}>CUIT/DNI: </Text>{clientCuit}</Text>
            <Text style={halfStyles.text}><Text style={halfStyles.bold}>Cond. IVA: </Text>{getTaxCategoryLabel(taxCategory)}</Text>
          </View>
          <View style={halfStyles.col}>
            <Text style={halfStyles.text}><Text style={halfStyles.bold}>Cliente: </Text>{clientName}</Text>
            <Text style={halfStyles.text}><Text style={halfStyles.bold}>Domicilio: </Text>{clientAddress}</Text>
          </View>
        </View>
        <Text style={[halfStyles.text, { marginTop: 1 }]}>
          <Text style={halfStyles.bold}>Cond. Venta: </Text>
          {getPaymentTypeLabel(venta.paymentType, (venta as any).paymentMethod)}
        </Text>
      </View>

      {/* Tabla */}
      <View style={halfStyles.table}>
        <View style={halfStyles.tableHeader}>
          <Text style={halfStyles.colQty}>Cant.</Text>
          <Text style={halfStyles.colDesc}>Producto / Servicio</Text>
          <Text style={halfStyles.colPrice}>P. Unit.</Text>
          <Text style={halfStyles.colDto}>Dto.%</Text>
          <Text style={halfStyles.colUnitDto}>Unit. c/Dto.</Text>
          <Text style={halfStyles.colSubtotal}>Subtotal</Text>
        </View>
        {items.map((item, i) => {
          const dto = item.itemDiscount || 0;
          const unitConDto = item.price * (1 - dto / 100);
          return (
            <View key={i} style={halfStyles.tableRow}>
              <Text style={halfStyles.colQty}>{item.quantity.toFixed(2)}</Text>
              <Text style={halfStyles.colDesc}>{item.name}</Text>
              <Text style={halfStyles.colPrice}>{formatCurrency(item.price)}</Text>
              <Text style={halfStyles.colDto}>{dto.toFixed(2)}</Text>
              <Text style={halfStyles.colUnitDto}>{formatCurrency(unitConDto)}</Text>
              <Text style={halfStyles.colSubtotal}>{formatCurrency(unitConDto * item.quantity)}</Text>
            </View>
          );
        })}
        {Array.from({ length: emptyRows }).map((_, i) => (
          <View key={`e${i}`} style={halfStyles.tableRow}>
            <Text style={halfStyles.colQty}> </Text><Text style={halfStyles.colDesc}> </Text>
            <Text style={halfStyles.colPrice}> </Text><Text style={halfStyles.colDto}> </Text>
            <Text style={halfStyles.colUnitDto}> </Text><Text style={halfStyles.colSubtotal}> </Text>
          </View>
        ))}
      </View>

      {/* Totales */}
      <View style={halfStyles.totalsSection}>
        <View style={halfStyles.totalsBox}>
          {(hayItemDiscounts || haySaleDiscount) && (
            <View style={halfStyles.totalRow}><Text>Subtotal bruto:</Text><Text>{formatCurrency(subtotalBruto)}</Text></View>
          )}
          <View style={halfStyles.totalRow}><Text>Subtotal:</Text><Text>{formatCurrency(neto)}</Text></View>
          <View style={halfStyles.totalRow}><Text>21.00% IVA:</Text><Text>{formatCurrency(iva)}</Text></View>
          <View style={halfStyles.totalRowFinal}><Text>Total:</Text><Text>{formatCurrency(total)}</Text></View>
        </View>
      </View>

      {/* CAE / Warning */}
      {isElectronica ? (
        <View style={halfStyles.caeSection}>
          {qrUrl && <View style={halfStyles.qrBox}><Image src={qrUrl} style={halfStyles.qrImage} /></View>}
          <View style={halfStyles.caeInfoBox}>
            <Text><Text style={halfStyles.bold}>CAE N°: </Text>{afipData.cae}</Text>
            <Text style={{ marginTop: 2 }}><Text style={halfStyles.bold}>Vto. CAE: </Text>{afipData.caeVencimiento ? safeFormatDate(afipData.caeVencimiento) : "-"}</Text>
            <Text style={{ marginTop: 2, color: "#666" }}>Comprobante autorizado por AFIP - RG 4291/18</Text>
          </View>
        </View>
      ) : (
        <View style={halfStyles.warningBox}>
          <Text style={halfStyles.warningText}>DOCUMENTO NO VALIDO COMO FACTURA</Text>
          <Text style={halfStyles.warningSubText}>Presupuesto. Solicite factura electrónica si la requiere.</Text>
        </View>
      )}

      {/* Footer */}
      <View style={halfStyles.footer}>
        <Text>{isElectronica ? `${docType.name} - ${safeFormatDate(venta.createdAt)}` : `Presupuesto - ${safeFormatDate(venta.createdAt)}`}</Text>
        <Text>Pág. 1/1</Text>
      </View>
    </>
  );

  return (
    <Document>
      <Page size="A5" style={[halfStyles.page, { padding: "5mm 8mm" }]}>
        {contenido}
      </Page>
    </Document>
  );
};

export const generarBoletaDoble = async (venta: Venta, afipData?: any): Promise<string> => {
  const pdfBlob = await pdf(<BoletaMediaHoja venta={venta} afipData={afipData} />).toBlob();
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
