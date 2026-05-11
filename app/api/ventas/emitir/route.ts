// app/api/ventas/emitir/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { procesarEmision } from "@/lib/facturacion-helper";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }
    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Token invalido" }, { status: 401 });
    }

    const { saleId, client, emitirAfip, collection: collectionName } = await request.json();
    if (!saleId) {
      return NextResponse.json({ message: "Falta saleId" }, { status: 400 });
    }

    const result = await procesarEmision(saleId, client, emitirAfip, collectionName || "ventas");

    if (!result.success) {
      return NextResponse.json(
        { message: result.message, error: result.error },
        { status: result.statusCode || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      invoiceNumber: result.invoiceNumber,
      afipData: result.afipData,
      message: result.message,
    });
  } catch (error: any) {
    console.error("[Emitir] Error:", error.message, error.stack);
    return NextResponse.json(
      { message: "Error interno", error: error.message, stack: error.stack?.substring(0, 500) },
      { status: 500 },
    );
  }
}
