// app/api/public/vendedores/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = rateLimit(ip, { maxRequests: 20, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ found: false });
  }

  const { data, error } = await supabaseAdmin
    .from('vendedores')
    .select('id, name')
    .eq('email', email)
    .limit(1);

  if (error || !data || data.length === 0) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    sellerId: data[0].id,
    sellerName: data[0].name || "",
  });
}
