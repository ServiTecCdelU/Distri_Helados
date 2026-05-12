// app/api/public/productos/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('productos')
    .select('*')
    .or('disabled.is.null,disabled.eq.false')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const products = (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    price: r.price,
    stock: r.stock,
    imageUrl: r.image_url,
    category: r.category,
    createdAt: r.created_at,
    marca: r.marca ?? null,
    base: r.base ?? "crema",
    sinTacc: r.sin_tacc ?? false,
    disabled: r.disabled ?? false,
  }));

  return NextResponse.json({ products });
}
