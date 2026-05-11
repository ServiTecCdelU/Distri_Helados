// app/api/afip/cuit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { consultarCUIT } from "@/lib/afip-direct";
import { adminAuth } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const cuit = req.nextUrl.searchParams.get("cuit");
  if (!cuit) return NextResponse.json({ error: "CUIT requerido" }, { status: 400 });

  try {
    const datos = await consultarCUIT(cuit);
    return NextResponse.json(datos);
  } catch (e: any) {
    const msg: string = e.message || "Error consultando ARCA";
    console.error("[ARCA cuit]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
