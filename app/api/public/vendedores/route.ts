// app/api/public/vendedores/route.ts
import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";
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

  const snapshot = await adminFirestore
    .collection("vendedores")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (snapshot.empty) {
    return NextResponse.json({ found: false });
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  return NextResponse.json({
    found: true,
    sellerId: doc.id,
    sellerName: data.name || "",
  });
}
