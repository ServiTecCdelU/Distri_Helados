// lib/facturacion-helper.ts
// Logica compartida para emision de comprobantes AFIP — integración directa WSAA + WSFEv1
import { adminFirestore } from "@/lib/firebase-admin";
import { solicitarCAE } from "@/lib/afip-direct";
// Bit Ingeniería desactivado — integración directa con AFIP
// import { autorizarComprobante, buildAutorizarRequest, parseCaeVto, BitCustomerData } from "@/lib/bitingenieria";

const TAX_CATEGORY_TO_TIPO_COMP: Record<string, number> = {
  responsable_inscripto: 1,   // Factura A
  consumidor_final: 6,         // Factura B
  monotributo: 6,
  exento: 6,
  no_categorizado: 6,
  no_responsable: 6,
  cliente_exterior: 6,
  factura_c: 11,              // Factura C
};

const TAX_CATEGORY_TO_CONDICION_IVA: Record<string, number> = {
  responsable_inscripto: 1,
  consumidor_final: 5,
  monotributo: 6,
  exento: 4,
  no_categorizado: 5,
  no_responsable: 5,
  cliente_exterior: 9,
  factura_c: 5,
};

const TAX_CATEGORY_TO_DOC_TYPE: Record<string, number> = {
  responsable_inscripto: 80, // CUIT
  consumidor_final: 99,
  monotributo: 86,           // CUIL
  exento: 80,
  no_categorizado: 99,
  no_responsable: 99,
  cliente_exterior: 99,
  factura_c: 99,
};

function validarCUIT(cuit: string): boolean {
  if (!cuit) return false;
  return cuit.replace(/\D/g, "").length === 11;
}


interface EmitirResult {
  success: boolean;
  invoiceNumber: string | null;
  afipData: {
    cae: string;
    caeVencimiento: string;
    tipoComprobante: number;
    puntoVenta: number;
    numeroComprobante: number;
  } | null;
  invoicePdfBase64?: string;
  message: string;
  error?: string;
  statusCode?: number;
}

export async function procesarEmision(
  saleId: string,
  clientOverride?: any,
  emitirAfip?: boolean,
  collectionName: string = "ventas",
): Promise<EmitirResult> {
  const ventaRef = adminFirestore.collection(collectionName).doc(saleId);
  const ventaSnap = await ventaRef.get();

  if (!ventaSnap.exists) {
    return {
      success: false,
      invoiceNumber: null,
      afipData: null,
      message: "Documento no encontrado",
      statusCode: 404,
    };
  }

  const sale = ventaSnap.data() || {};

  // Resolver datos del cliente
  let clientData: any = clientOverride || {};
  if (sale.clientId && !clientOverride?.name) {
    const clientSnap = await adminFirestore
      .collection("clientes")
      .doc(sale.clientId)
      .get();
    if (clientSnap.exists) {
      const c = clientSnap.data() || {};
      clientData = {
        name: c.name,
        phone: c.phone,
        email: c.email,
        taxCategory: c.taxCategory || "consumidor_final",
        cuit: c.cuit,
        dni: c.dni,
        address: c.address,
        city: c.city,
      };
    }
  }

  if (!clientData.taxCategory) {
    clientData.taxCategory = "consumidor_final";
  }

  let afipResponse = null;
  let invoiceNumber = null;
  let invoicePdfBase64: string | undefined;

  if (emitirAfip) {
    // Fallback: si el documento no trae `total` (caso típico de pedidos),
    // calcularlo sumando los items.
    let importeTotal = sale.total || 0;
    if (!importeTotal && Array.isArray(sale.items)) {
      importeTotal = sale.items.reduce(
        (acc: number, it: any) =>
          acc + (Number(it.price) || 0) * (Number(it.quantity) || 0),
        0,
      );
    }
    if (!importeTotal || importeTotal <= 0) {
      return {
        success: false,
        invoiceNumber: null,
        afipData: null,
        message: "No se pudo determinar el importe total del comprobante",
        statusCode: 400,
      };
    }
    const taxCategory: string = clientData.taxCategory || "consumidor_final";
    const tipoComprobante = TAX_CATEGORY_TO_TIPO_COMP[taxCategory] ?? 6;
    const condicionIVA = TAX_CATEGORY_TO_CONDICION_IVA[taxCategory] ?? 5;
    const docType = TAX_CATEGORY_TO_DOC_TYPE[taxCategory] ?? 99;

    const cuitValido = validarCUIT(clientData.cuit);
    // AFIP: para consumidor final (doc_type 99), docNro DEBE ser 0
    const docNro =
      docType === 99
        ? 0
        : cuitValido
          ? parseInt(clientData.cuit.replace(/\D/g, "")) || 0
          : parseInt(clientData.dni?.replace(/\D/g, "") || "0") || 0;

    // Calcular neto e IVA (21%) desde el total
    const totalConDescuento = sale.discount
      ? importeTotal - sale.discount
      : importeTotal;
    const importeNeto = totalConDescuento / 1.21;
    const importeIVA = totalConDescuento - importeNeto;

    try {
      afipResponse = await solicitarCAE({
        tipoComprobante,
        docTipo: docType,
        docNro,
        condicionIVAReceptor: condicionIVA,
        importeTotal: totalConDescuento,
        importeNeto,
        importeIVA,
        fecha: new Date(),
      });

      invoiceNumber = `${String(afipResponse.puntoVenta).padStart(4, "0")}-${String(afipResponse.numeroComprobante).padStart(8, "0")}`;

      if (!afipResponse.cae) {
        throw new Error("AFIP no devolvió CAE válido");
      }

      // PDF se genera del lado del cliente con diseño personalizado
    } catch (err: any) {
      console.error("[AFIP-Direct] Error:", err.message);
      return {
        success: false,
        invoiceNumber: null,
        afipData: null,
        message: "Error al emitir comprobante",
        error: err.message,
        statusCode: 500,
      };
    }
  }

  // Guardar en Firestore
  const tipoComprobanteGuardado = afipResponse
    ? (TAX_CATEGORY_TO_TIPO_COMP[clientData.taxCategory] ?? 6)
    : null;

  const updateData: any = {
    clientData: {
      name: clientData.name,
      phone: clientData.phone,
      email: clientData.email || "",
      taxCategory: clientData.taxCategory,
      cuit: clientData.cuit || "",
      dni: clientData.dni || "",
    },
    updatedAt: new Date().toISOString(),
  };

  if (afipResponse) {
    updateData.invoiceNumber = invoiceNumber;
    updateData.invoiceEmitted = true;
    updateData.invoiceStatus = "emitted";
    updateData.afipData = {
      cae: afipResponse.cae,
      caeVencimiento: afipResponse.caeVencimiento,
      tipoComprobante: tipoComprobanteGuardado,
      puntoVenta: afipResponse.puntoVenta,
      numeroComprobante: afipResponse.numeroComprobante,
    };
    // PDF se genera del lado del cliente con diseño personalizado
  }

  await ventaRef.update(updateData);

  return {
    success: true,
    invoiceNumber,
    afipData: afipResponse
      ? {
          cae: afipResponse.cae,
          caeVencimiento: afipResponse.caeVencimiento,
          tipoComprobante: tipoComprobanteGuardado!,
          puntoVenta: afipResponse.puntoVenta,
          numeroComprobante: afipResponse.numeroComprobante,
        }
      : null,
    invoicePdfBase64,
    message: emitirAfip ? "Factura emitida en AFIP" : "Datos actualizados",
  };
}
