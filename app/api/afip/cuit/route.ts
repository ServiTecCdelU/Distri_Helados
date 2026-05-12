// app/api/afip/cuit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { consultarCUIT } from "@/lib/afip-direct";
import { verifyAuthToken } from "@/lib/supabase-auth-helper";

export async function GET(req: NextRequest) {
  const user = await verifyAuthToken(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
