// app/api/facturacion/consultar-cuit/route.ts
// Consulta datos fiscales de un CUIT via Bit Ingeniería -> AFIP
import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/supabase-auth-helper";
import { consultarCuit } from "@/lib/bitingenieria";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { cuit } = body;

    if (!cuit) {
      return NextResponse.json(
        { error: "CUIT es requerido" },
        { status: 400 }
      );
    }

    const resultado = await consultarCuit(cuit);

    return NextResponse.json({
      success: true,
      data: resultado,
    });
  } catch (error: any) {
    console.error("[API consultar-cuit] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
