// app/api/facturacion/comprobantes/route.ts
// Consulta comprobantes emitidos en AFIP via Bit Ingeniería
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { consultarComprobantes, obtenerUltimoNumero } from "@/lib/bitingenieria";

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
    const { tipoComprobante, nroInicial, nroFinal, ptoVta } = body;

    if (!tipoComprobante) {
      return NextResponse.json(
        { error: "tipoComprobante es requerido" },
        { status: 400 }
      );
    }

    // Si no se pasa rango, consultar los últimos 10
    let inicio = nroInicial;
    let fin = nroFinal;

    if (!inicio || !fin) {
      const ultimo = await obtenerUltimoNumero(tipoComprobante, ptoVta);
      fin = ultimo;
      inicio = Math.max(1, ultimo - 9);
    }

    const resultado = await consultarComprobantes(
      tipoComprobante,
      inicio,
      fin,
      ptoVta
    );

    return NextResponse.json({
      success: true,
      data: resultado,
      rango: { inicio, fin },
    });
  } catch (error: any) {
    console.error("[API comprobantes] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
