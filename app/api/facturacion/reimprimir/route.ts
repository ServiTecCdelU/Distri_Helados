// app/api/facturacion/reimprimir/route.ts
// Reimprime el PDF de un comprobante ya emitido via Bit Ingeniería
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { reimprimirPdf, buildPdfRequest, BitCustomerData } from "@/lib/bitingenieria";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const body = await request.json();
    const { saleId } = body;

    if (!saleId) {
      return NextResponse.json(
        { error: "saleId es requerido" },
        { status: 400 }
      );
    }

    // Buscar la venta en Firestore
    const ventaSnap = await adminFirestore.collection("ventas").doc(saleId).get();
    if (!ventaSnap.exists) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 }
      );
    }

    const sale = ventaSnap.data() || {};
    const afipData = sale.afipData;

    if (!afipData?.cae || !afipData?.numeroComprobante) {
      return NextResponse.json(
        { error: "La venta no tiene datos AFIP (CAE/número). No se puede reimprimir." },
        { status: 400 }
      );
    }

    // Convertir caeVencimiento de yyyy-mm-dd a dd/mm/yyyy para la API
    let vtoFormatted = afipData.caeVencimiento || "";
    if (vtoFormatted.includes("-")) {
      const [y, m, d] = vtoFormatted.split("-");
      vtoFormatted = `${d}/${m}/${y}`;
    }

    // Obtener fecha de la venta en formato dd/mm/yyyy
    let dateFormatted = "";
    if (sale.date) {
      const saleDate = new Date(sale.date);
      dateFormatted = saleDate.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }

    // Construir customer_data desde la venta
    const clientData = sale.clientData || {};
    const customerData: BitCustomerData = {
      name: clientData.name || "Consumidor Final",
      address: clientData.address || "",
      city: clientData.city || "",
      country: "ARGENTINA",
      ident: clientData.cuit?.replace(/\D/g, "") || clientData.dni?.replace(/\D/g, "") || "0",
      doc_type: clientData.cuit ? 80 : 99,
    };

    // Construir items
    const items = Array.isArray(sale.items) && sale.items.length > 0
      ? sale.items.map((item: any) => ({
          name: item.name || "Producto",
          price: item.price || 0,
          quantity: item.quantity || 1,
        }))
      : [{ name: "Venta", price: sale.total || 0, quantity: 1 }];

    const total = sale.total || 0;
    const subtotal = Math.round((total / 1.21) * 100) / 100;
    const sumTax = Math.round((total - subtotal) * 100) / 100;

    const pdfReq = buildPdfRequest({
      tipoComprobante: afipData.tipoComprobante,
      fecha: dateFormatted,
      paymentMethod: sale.paymentMethod || "Efectivo",
      cae: afipData.cae,
      vto: vtoFormatted,
      nro: afipData.numeroComprobante,
      customerData,
      items,
      total,
      subtotal,
      sumTax,
      discount: sale.discount || 0,
    });

    const pdfBase64 = await reimprimirPdf(pdfReq);

    // Actualizar el PDF en Firestore
    await adminFirestore.collection("ventas").doc(saleId).update({
      invoicePdfBase64: pdfBase64,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      pdf: pdfBase64,
      message: "PDF reimpreso exitosamente",
    });
  } catch (error: any) {
    console.error("[API reimprimir] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
