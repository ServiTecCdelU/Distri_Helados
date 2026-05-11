// app/api/facturacion/pdf/[saleId]/route.tsx
import { NextResponse } from "next/server";
import { adminAuth, adminFirestore, adminStorage } from "@/lib/firebase-admin";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";
import { formatCurrencyDecimals as formatCurrency, formatDate } from "@/lib/utils/format";

export const runtime = "nodejs";

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

// Read logo as base64 for server-side rendering
function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-small.png");
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  page: {
    padding: "10mm",
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "black",
    backgroundColor: "white",
  },
  headerBox: { border: "1px solid black", marginBottom: 8 },
  headerTopRow: { flexDirection: "row", borderBottom: "1px solid black" },
  headerLeft: {
    width: "30%",
    padding: 10,
    borderRight: "1px solid black",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    width: "14%",
    padding: 8,
    borderRight: "1px solid black",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: { width: "56%", padding: 10 },
  logo: { width: 80, height: 50, objectFit: "contain", marginBottom: 4 },
  codText: { fontSize: 8, textAlign: "center" },
  docTypeBox: {
    border: "1px solid black",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  docTypeText: { fontSize: 24, fontWeight: "bold" },
  docTypeLabel: { fontSize: 7, textAlign: "center" },
  invoiceTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 2 },
  invoiceInfo: { fontSize: 9, lineHeight: 1.5 },
  headerBottomRow: { flexDirection: "row", padding: "6px 10px" },
  headerInfoLeft: { width: "55%", paddingRight: 8 },
  headerInfoRight: { width: "45%" },
  infoText: { fontSize: 8, lineHeight: 1.6 },
  textXs: { fontSize: 7 },
  clientSection: { border: "1px solid black", padding: 10, marginBottom: 8 },
  gridRow: { flexDirection: "row", marginBottom: 3 },
  gridCol: { width: "50%" },
  bold: { fontWeight: "bold" },
  text: { fontSize: 9 },
  table: { border: "1px solid black", marginBottom: 8 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid black",
    padding: "5px 6px",
    fontWeight: "bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #999",
    padding: "4px 6px",
    fontSize: 8,
  },
  tableCell: { fontSize: 8 },
  colQuantity: { width: "8%", textAlign: "center" },
  colDescription: { width: "36%" },
  colPrice: { width: "16%", textAlign: "right" },
  colDto: { width: "8%", textAlign: "center" },
  colUnitDto: { width: "16%", textAlign: "right" },
  colSubtotal: { width: "16%", textAlign: "right" },
  totalsSection: { border: "1px solid black", padding: 10, marginBottom: 8 },
  totalsBox: { width: "60%", marginLeft: "auto" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 10,
  },
  totalRowBold: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: "bold",
    fontSize: 14,
    borderTop: "1px solid black",
    paddingTop: 4,
    marginTop: 3,
  },
  caeSection: {
    border: "1px solid black",
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  warningBox: {
    border: "1px solid black",
    padding: 10,
    marginBottom: 8,
    textAlign: "center",
  },
  textRed: { color: "#dc2626", fontWeight: "bold" },
  textGray: { color: "#6b7280", fontSize: 9 },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    fontSize: 7,
    color: "#6b7280",
  },
  textCenter: { textAlign: "center" },
});

interface InvoicePDFProps {
  sale: any;
  clientData: any;
  isElectronica: boolean;
}

function InvoicePDF({ sale, clientData, isElectronica }: InvoicePDFProps) {
  const items: any[] = sale.items || [];
  const emptyRows = Math.max(0, 8 - items.length);
  const pv = sale.invoiceNumber?.split("-")[0] || "0001";
  const nro = sale.invoiceNumber?.split("-")[1] || sale.invoiceNumber || "00000000";
  const logoBase64 = getLogoBase64();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.headerBox}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeft}>
              {logoBase64 ? (
                <Image src={logoBase64} style={styles.logo} />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: "bold" }}>MIO</Text>
              )}
              <Text style={styles.codText}>COD. 001</Text>
            </View>
            <View style={styles.headerCenter}>
              <View style={styles.docTypeBox}>
                <Text style={styles.docTypeText}>
                  {isElectronica ? "B" : "X"}
                </Text>
              </View>
              <Text style={styles.docTypeLabel}>
                {isElectronica
                  ? "Codigo 006\nFACTURA"
                  : "No Valido\nPRESUPUESTO"}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.invoiceTitle}>FACTURA</Text>
              <Text style={styles.invoiceInfo}>
                {"Punto de Venta:  " + pv + "\n"}
                {"Comp. Nro.:  " + nro + "\n"}
                {"Fecha de Emision:  " + formatDate(sale.createdAt || new Date())}
              </Text>
            </View>
          </View>
          <View style={styles.headerBottomRow}>
            <View style={styles.headerInfoLeft}>
              <Text style={styles.infoText}>
                {"R. Social:  DOMINGUEZ MARIO CESAR\n"}
                {"Domicilio:  BASTIAN 1049\n"}
                {"Cond. IVA:  IVA Responsable Inscripto"}
              </Text>
            </View>
            <View style={styles.headerInfoRight}>
              <Text style={styles.infoText}>
                {"CUIT:  20-14598383-6\n"}
                {"Ingresos Brutos:  20-14598383-6\n"}
                {"Inicio de Actividades:  / /"}
              </Text>
            </View>
          </View>
        </View>

        {/* Client Info */}
        <View style={styles.clientSection}>
          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={styles.text}>
                <Text style={styles.bold}>{"CUIT: "}</Text>
                {clientData.cuit || sale.clientCuit || "00-00000000-0"}
              </Text>
              <Text style={styles.text}>
                <Text style={styles.bold}>{"Cond. IVA: "}</Text>
                {getTaxCategoryLabel(
                  clientData.taxCategory || sale.clientTaxCategory,
                )}
              </Text>
              <Text style={styles.text}>
                <Text style={styles.bold}>{"Cond. Vta.: "}</Text>
                {getPaymentTypeLabel(sale.paymentType || "cash", (sale as any).paymentMethod)}
              </Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.text}>
                <Text style={styles.bold}>{"Cliente: "}</Text>
                {sale.clientName || clientData.name || "Consumidor Final"}
              </Text>
              <Text style={styles.text}>
                <Text style={styles.bold}>{"Domicilio: "}</Text>
                {clientData.address || sale.clientAddress || "-"}
              </Text>
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.colQuantity]}>
              {"Cantidad"}
            </Text>
            <Text style={[styles.tableCell, styles.colDescription]}>
              {"Producto / Servicio"}
            </Text>
            <Text style={[styles.tableCell, styles.colPrice]}>
              {"P. Unit."}
            </Text>
            <Text style={[styles.tableCell, styles.colDto]}>{"Dto.%"}</Text>
            <Text style={[styles.tableCell, styles.colUnitDto]}>
              {"Unit. c/Dto."}
            </Text>
            <Text style={[styles.tableCell, styles.colSubtotal]}>
              {"Subtotal"}
            </Text>
          </View>
          {items.map((item: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colQuantity]}>
                {String(item.quantity)}
              </Text>
              <Text style={[styles.tableCell, styles.colDescription]}>
                {String(item.name)}
              </Text>
              <Text style={[styles.tableCell, styles.colPrice]}>
                {formatCurrency(item.price)}
              </Text>
              <Text style={[styles.tableCell, styles.colDto]}>{"0.00"}</Text>
              <Text style={[styles.tableCell, styles.colUnitDto]}>
                {formatCurrency(item.price)}
              </Text>
              <Text style={[styles.tableCell, styles.colSubtotal]}>
                {formatCurrency(item.price * item.quantity)}
              </Text>
            </View>
          ))}
          {Array.from({ length: emptyRows }).map((_, index) => (
            <View key={`empty-${index}`} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colQuantity]}> </Text>
              <Text style={[styles.tableCell, styles.colDescription]}> </Text>
              <Text style={[styles.tableCell, styles.colPrice]}> </Text>
              <Text style={[styles.tableCell, styles.colDto]}> </Text>
              <Text style={[styles.tableCell, styles.colUnitDto]}> </Text>
              <Text style={[styles.tableCell, styles.colSubtotal]}> </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>{"Subtotal: $"}</Text>
              <Text>{formatCurrency((sale.total || 0) / 1.21)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>{"21.00% IVA: $"}</Text>
              <Text>
                {formatCurrency((sale.total || 0) - (sale.total || 0) / 1.21)}
              </Text>
            </View>
            <View style={styles.totalRowBold}>
              <Text>{"Total: $"}</Text>
              <Text>{formatCurrency(sale.total || 0)}</Text>
            </View>
            {sale.paymentType === "mixed" && (
              <View
                style={{
                  marginTop: 6,
                  paddingTop: 4,
                  borderTop: "1px dashed black",
                }}
              >
                <View style={styles.totalRow}>
                  <Text style={styles.textXs}>{"Efectivo:"}</Text>
                  <Text style={styles.textXs}>
                    {formatCurrency(sale.cashAmount || 0)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.textXs}>{"A Cuenta:"}</Text>
                  <Text style={styles.textXs}>
                    {formatCurrency(sale.creditAmount || 0)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* CAE or Warning */}
        {isElectronica ? (
          <View style={styles.caeSection}>
            <View>
              <Text style={styles.text}>
                <Text style={styles.bold}>{"CAE N°: "}</Text>
                {sale.afipData?.cae || "N/A"}
              </Text>
              <Text style={[styles.text, { marginTop: 3 }]}>
                <Text style={styles.bold}>{"CAE Vto.: "}</Text>
                {sale.afipData?.caeVencimiento
                  ? formatDate(sale.afipData.caeVencimiento)
                  : "-"}
              </Text>
            </View>
            <Text style={styles.textXs}>Pagina 1 de 1</Text>
          </View>
        ) : (
          <View style={styles.warningBox}>
            <Text style={styles.textRed}>
              {"DOCUMENTO NO VALIDO COMO FACTURA"}
            </Text>
            <Text style={styles.textGray}>
              {
                "Este documento es un presupuesto. Solicite factura electronica si la requiere."
              }
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            {isElectronica
              ? ""
              : "Documento interno - No valido fiscalmente"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ saleId: string }> },
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        await adminAuth.verifyIdToken(authHeader.replace("Bearer ", ""));
      } catch {
        // Auth falló, permitir en modo desarrollo
      }
    }

    const { saleId } = await context.params;

    const bucket = adminStorage.bucket();
    const filePath = `facturas/${saleId}.pdf`;
    const file = bucket.file(filePath);

    try {
      const [exists] = await file.exists();
      if (exists) {
        const [url] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 60 * 60 * 1000,
        });
        return NextResponse.redirect(url);
      }
    } catch {
      // No se pudo verificar Storage, generar nuevo PDF
    }

    const saleSnapshot = await adminFirestore
      .collection("ventas")
      .doc(saleId)
      .get();
    if (!saleSnapshot.exists) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 },
      );
    }

    const sale = saleSnapshot.data() || {};

    let clientData: any = {};
    if (sale.clientId) {
      const clientSnapshot = await adminFirestore
        .collection("clientes")
        .doc(sale.clientId)
        .get();
      if (clientSnapshot.exists) {
        clientData = clientSnapshot.data();
      }
    }

    const isElectronica = !!sale.afipData?.cae;

    // renderToBuffer funciona server-side con Node.js
    const pdfBuffer = await renderToBuffer(
      <InvoicePDF
        sale={sale}
        clientData={clientData}
        isElectronica={isElectronica}
      />,
    );

    await file.save(pdfBuffer, {
      metadata: {
        contentType: "application/pdf",
        metadata: {
          saleId,
          invoiceNumber: sale.invoiceNumber || "",
          generatedAt: new Date().toISOString(),
        },
      },
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    await adminFirestore.collection("ventas").doc(saleId).update({
      invoicePdfUrl: publicUrl,
      invoicePdfGeneratedAt: new Date().toISOString(),
    });

    // Convertir Buffer a Uint8Array para NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="factura-${sale.invoiceNumber || saleId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error generando PDF:", error);
    return NextResponse.json(
      { error: error.message || "Error generando PDF" },
      { status: 500 },
    );
  }
}
