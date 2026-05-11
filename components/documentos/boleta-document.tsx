import { forwardRef } from "react";
import { formatCurrencyDecimals as formatCurrency, formatDate } from "@/lib/utils/format";

interface BoletaItem {
  name: string;
  quantity: number;
  price: number;
}

interface BoletaDocumentProps {
  boletaNumber: string;
  date: Date;
  clientName?: string;
  clientCuit?: string;
  clientAddress?: string;
  clientPhone?: string;
  clientTaxCategory?: string;
  items: BoletaItem[];
  total: number;
  paymentType: "cash" | "credit" | "mixed";
  paymentMethod?: "efectivo" | "transferencia";
  cashAmount?: number;
  creditAmount?: number;
  cae?: string;
  caeVencimiento?: string | Date;
  barcodeData?: string;
}

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

export const BoletaDocument = forwardRef<HTMLDivElement, BoletaDocumentProps>(
  (
    {
      boletaNumber,
      date,
      clientName,
      clientCuit,
      clientAddress,
      clientPhone,
      clientTaxCategory,
      items,
      total,
      paymentType,
      paymentMethod,
      cashAmount,
      creditAmount,
      cae,
      caeVencimiento,
      barcodeData,
    },
    ref,
  ) => {
    const isElectronica = !!cae;

    // ESTILOS INLINE CON COLORES HEX - Compatible con html2canvas
    const styles = {
      container: {
        backgroundColor: "#ffffff",
        color: "#000000",
        padding: "10mm",
        width: "210mm",
        minHeight: "297mm",
        fontFamily: "monospace",
        fontSize: "11px",
        lineHeight: 1.4,
        boxSizing: "border-box" as const,
      },
      borderBox: {
        border: "2px solid #000000",
        marginBottom: "16px",
      },
      grid3: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
      },
      grid2: {
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "16px",
      },
      borderR: {
        borderRight: "2px solid #000000",
      },
      p4: {
        padding: "16px",
      },
      textCenter: {
        textAlign: "center" as const,
      },
      textRight: {
        textAlign: "right" as const,
      },
      fontBold: {
        fontWeight: "bold",
      },
      textXl: {
        fontSize: "20px",
      },
      textLg: {
        fontSize: "18px",
      },
      textXs: {
        fontSize: "9px",
      },
      mb2: {
        marginBottom: "8px",
      },
      mb4: {
        marginBottom: "16px",
      },
      mt2: {
        marginTop: "8px",
      },
      mt4: {
        marginTop: "16px",
      },
      docTypeBox: {
        border: "2px solid #000000",
        width: "64px",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "32px",
        fontWeight: "bold",
        margin: "0 auto 8px",
      },
      table: {
        width: "100%",
        borderCollapse: "collapse" as const,
        tableLayout: "fixed" as const,
      },
      th: {
        padding: "8px",
        border: "1px solid #000000",
        fontWeight: "bold",
        textAlign: "left" as const,
        backgroundColor: "#f0f0f0",
      },
      td: {
        padding: "8px",
        border: "1px solid #000000",
      },
      textRed: {
        color: "#dc2626",
      },
      textGray: {
        color: "#6b7280",
      },
      borderT: {
        borderTop: "1px dashed #000000",
        paddingTop: "8px",
      },
      qrBox: {
        border: "2px solid #000000",
        width: "96px",
        height: "96px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "10px",
      },
      totalsBox: {
        width: "256px",
        marginLeft: "auto",
      },
    };

    return (
      <div ref={ref} style={styles.container}>
        {/* HEADER */}
        <div style={styles.borderBox}>
          {/* Top row: Logo | Doc Type | Invoice Info */}
          <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
            <div
              style={{
                width: "30%",
                padding: "12px",
                borderRight: "1px solid #000",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="/logo-small.png"
                alt="Mio Helados"
                style={{ width: "90px", height: "56px", objectFit: "contain" }}
              />
              <p style={{ fontSize: "8px", marginTop: "4px" }}>COD. 001</p>
            </div>
            <div
              style={{
                width: "14%",
                padding: "10px",
                borderRight: "1px solid #000",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={styles.docTypeBox}>{isElectronica ? "B" : "X"}</div>
              <p style={{ fontSize: "7px", textAlign: "center" }}>
                {isElectronica
                  ? "Codigo 006"
                  : "No Valido"}
                <br />
                {isElectronica ? "FACTURA" : "PRESUPUESTO"}
              </p>
            </div>
            <div style={{ width: "56%", padding: "12px" }}>
              <p
                style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}
              >
                FACTURA
              </p>
              <p style={{ fontSize: "9px", lineHeight: 1.6 }}>
                Punto de Venta: {boletaNumber.split("-")[0] || "0001"}
                <br />
                Comp. Nro.: {boletaNumber.split("-")[1] || boletaNumber}
                <br />
                Fecha de Emision: {formatDate(date)}
              </p>
            </div>
          </div>
          {/* Bottom row: Company details | Fiscal details */}
          <div style={{ display: "flex", padding: "8px 12px" }}>
            <div style={{ width: "55%", paddingRight: "10px" }}>
              <p style={{ fontSize: "8px", lineHeight: 1.7 }}>
                R. Social: DOMINGUEZ MARIO CESAR
                <br />
                Domicilio: BASTIAN 1049
                <br />
                Cond. IVA: IVA Responsable Inscripto
              </p>
            </div>
            <div style={{ width: "45%" }}>
              <p style={{ fontSize: "8px", lineHeight: 1.7 }}>
                CUIT: 20-14598383-6
                <br />
                Ingresos Brutos: 20-14598383-6
                <br />
                Inicio de Actividades: / /
              </p>
            </div>
          </div>
        </div>

        {/* CLIENTE */}
        <div style={{ ...styles.borderBox, ...styles.p4 }}>
          <div style={styles.grid2}>
            <div>
              <p style={{ fontSize: "9px" }}>
                <span style={styles.fontBold}>CUIT:</span>{" "}
                {clientCuit || "00-00000000-0"}
              </p>
              <p style={{ fontSize: "9px" }}>
                <span style={styles.fontBold}>Cond. IVA:</span>{" "}
                {getTaxCategoryLabel(clientTaxCategory)}
              </p>
              <p style={{ fontSize: "9px" }}>
                <span style={styles.fontBold}>Cond. Vta.:</span>{" "}
                {getPaymentTypeLabel(paymentType, paymentMethod)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "9px" }}>
                <span style={styles.fontBold}>Cliente:</span>{" "}
                {clientName || "Consumidor Final"}
              </p>
              <p style={{ fontSize: "9px" }}>
                <span style={styles.fontBold}>Domicilio:</span>{" "}
                {clientAddress || "-"}
              </p>
            </div>
          </div>
        </div>

        {/* TABLA */}
        <div style={styles.borderBox}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: "60px" }}>Cantidad</th>
                <th style={styles.th}>Producto / Servicio</th>
                <th
                  style={{ ...styles.th, ...styles.textRight, width: "90px" }}
                >
                  P. Unit.
                </th>
                <th
                  style={{ ...styles.th, textAlign: "center", width: "50px" }}
                >
                  Dto.%
                </th>
                <th
                  style={{ ...styles.th, ...styles.textRight, width: "90px" }}
                >
                  Unit. c/Dto.
                </th>
                <th
                  style={{ ...styles.th, ...styles.textRight, width: "90px" }}
                >
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    {item.quantity}
                  </td>
                  <td style={styles.td}>{item.name}</td>
                  <td style={{ ...styles.td, ...styles.textRight }}>
                    {formatCurrency(item.price)}
                  </td>
                  <td style={{ ...styles.td, textAlign: "center" }}>0.00</td>
                  <td style={{ ...styles.td, ...styles.textRight }}>
                    {formatCurrency(item.price)}
                  </td>
                  <td style={{ ...styles.td, ...styles.textRight }}>
                    {formatCurrency(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 8 - items.length) }).map(
                (_, i) => (
                  <tr key={`empty-${i}`}>
                    <td style={styles.td}>&nbsp;</td>
                    <td style={styles.td}>&nbsp;</td>
                    <td style={styles.td}>&nbsp;</td>
                    <td style={styles.td}>&nbsp;</td>
                    <td style={styles.td}>&nbsp;</td>
                    <td style={styles.td}>&nbsp;</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        {/* TOTALES */}
        <div style={{ ...styles.borderBox, ...styles.p4 }}>
          <div style={{ width: "280px", marginLeft: "auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px",
                fontSize: "10px",
              }}
            >
              <span>Subtotal: $</span>
              <span>{formatCurrency((total || 0) / 1.21)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px",
                fontSize: "10px",
              }}
            >
              <span>21.00% IVA: $</span>
              <span>{formatCurrency((total || 0) - (total || 0) / 1.21)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: "14px",
                borderTop: "1px solid #000000",
                paddingTop: "6px",
              }}
            >
              <span>Total: $</span>
              <span>{formatCurrency(total || 0)}</span>
            </div>
            {paymentType === "mixed" && (
              <div
                style={{
                  ...styles.borderT,
                  marginTop: "6px",
                  fontSize: "10px",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>Efectivo:</span>
                  <span>{formatCurrency(cashAmount || 0)}</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>A Cuenta:</span>
                  <span>{formatCurrency(creditAmount || 0)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CAE o WARNING */}
        {isElectronica ? (
          <div
            style={{
              ...styles.borderBox,
              ...styles.p4,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {barcodeData && (
                <div style={styles.qrBox}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(barcodeData)}`}
                    alt="QR AFIP"
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
              )}
              <div>
                <p style={{ fontSize: "9px" }}>
                  <span style={styles.fontBold}>CAE N°:</span> {cae}
                </p>
                <p style={{ fontSize: "9px", marginTop: "3px" }}>
                  <span style={styles.fontBold}>CAE Vto.:</span>{" "}
                  {caeVencimiento ? formatDate(caeVencimiento) : "-"}
                </p>
              </div>
            </div>
            <p style={{ fontSize: "8px", color: "#666" }}>Pagina 1 de 1</p>
          </div>
        ) : (
          <div
            style={{ ...styles.borderBox, ...styles.p4, ...styles.textCenter }}
          >
            <p
              style={{
                ...styles.fontBold,
                ...styles.textRed,
                fontSize: "14px",
              }}
            >
              DOCUMENTO NO VALIDO COMO FACTURA
            </p>
            <p style={{ ...styles.textXs, ...styles.textGray }}>
              Este documento es un presupuesto. Solicite factura electronica si
              la requiere.
            </p>
          </div>
        )}
      </div>
    );
  },
);

BoletaDocument.displayName = "BoletaDocument";
