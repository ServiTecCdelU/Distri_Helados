import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    await adminAuth.verifyIdToken(token);

    const body = await request.json();
    const { saleId } = body;

    if (!saleId) {
      return NextResponse.json({ message: "Falta saleId" }, { status: 400 });
    }

    // Obtener venta
    const ventaRef = adminFirestore.collection("ventas").doc(saleId);
    const ventaSnap = await ventaRef.get();

    if (!ventaSnap.exists) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }

    // Generar número de remito secuencial
    const remitosQuery = await adminFirestore
      .collection("ventas")
      .where("remitoNumber", "!=", null)
      .orderBy("remitoNumber", "desc")
      .limit(1)
      .get();

    let lastNumber = 0;
    if (!remitosQuery.empty) {
      const lastRemito = remitosQuery.docs[0].data().remitoNumber;
      const match = lastRemito?.match(/R-\d+-(\d+)/);
      if (match) lastNumber = parseInt(match[1], 10);
    }

    const remitoNumber = `R-${new Date().getFullYear()}-${String(lastNumber + 1).padStart(5, "0")}`;

    // Actualizar venta con el número de remito (el PDF se genera en el frontend)
    await ventaRef.update({
      remitoNumber,
      remitoGeneratedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      remitoNumber,
      message: "Número de remito asignado. Genere el PDF desde el frontend.",
    });

  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { message: "Error interno", error: error.message },
      { status: 500 }
    );
  }
}