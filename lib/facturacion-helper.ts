// lib/facturacion-helper-supabase.ts
// Logica compartida para emision de comprobantes AFIP — versión Supabase
import { supabaseAdmin } from "@/lib/supabase-admin";
import { solicitarCAE } from "@/lib/afip-direct";

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
  tableName: string = "ventas",
): Promise<EmitirResult> {
  // Leer venta/pedido con items (tabla de items depende del origen)
  const itemsRelation = tableName === 'pedidos' ? 'pedido_items(*)' : 'venta_items(*)';
  const { data: sale, error: saleError } = await supabaseAdmin
    .from(tableName)
    .select(`*, ${itemsRelation}`)
    .eq('id', saleId)
    .single();

  if (saleError || !sale) {
    console.error("[facturacion-helper] Venta no encontrada:", { saleId, tableName, error: saleError });
    return {
      success: false,
      invoiceNumber: null,
      afipData: null,
      message: `Documento no encontrado (id: ${saleId}, tabla: ${tableName})`,
      statusCode: 404,
    };
  }

  // Resolver datos del cliente
  let clientData: any = clientOverride || {};
  if (sale.client_id && !clientOverride?.name) {
    const { data: client } = await supabaseAdmin
      .from('clientes')
      .select('name, phone, email, tax_category, cuit, dni, address')
      .eq('id', sale.client_id)
      .single();
    if (client) {
      clientData = {
        name: client.name,
        phone: client.phone,
        email: client.email,
        taxCategory: client.tax_category || "consumidor_final",
        cuit: client.cuit,
        dni: client.dni,
        address: client.address,
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
    // Calcular total si no viene en el documento
    const items = sale.venta_items || sale.pedido_items || [];
    let importeTotal = sale.total || 0;
    if (!importeTotal && Array.isArray(items)) {
      importeTotal = items.reduce(
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
    const docNro =
      docType === 99
        ? 0
        : cuitValido
          ? parseInt(clientData.cuit.replace(/\D/g, "")) || 0
          : parseInt(clientData.dni?.replace(/\D/g, "") || "0") || 0;

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

  // Guardar en Supabase
  const tipoComprobanteGuardado = afipResponse
    ? (TAX_CATEGORY_TO_TIPO_COMP[clientData.taxCategory] ?? 6)
    : null;

  const updateData: any = {
    client_data: {
      name: clientData.name,
      phone: clientData.phone,
      email: clientData.email || "",
      taxCategory: clientData.taxCategory,
      cuit: clientData.cuit || "",
      dni: clientData.dni || "",
    },
  };

  if (afipResponse) {
    updateData.invoice_number = invoiceNumber;
    updateData.invoice_emitted = true;
    updateData.invoice_status = 'emitted';

    // Guardar AFIP data en tabla separada
    await supabaseAdmin.from('venta_afip_data').upsert({
      sale_id: saleId,
      cae: afipResponse.cae,
      cae_vencimiento: afipResponse.caeVencimiento,
      tipo_comprobante: tipoComprobanteGuardado,
      punto_venta: afipResponse.puntoVenta,
      numero_comprobante: afipResponse.numeroComprobante,
    }, { onConflict: 'sale_id' });
  }

  await supabaseAdmin.from(tableName).update(updateData).eq('id', saleId);

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
