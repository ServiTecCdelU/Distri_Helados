// app/api/public/productos/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const page = parseInt(searchParams.get("page") || "0", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);
  const from = page * limit;
  const to = from + limit - 1;

  let query = supabaseAdmin
    .from('productos')
    .select('*', { count: 'exact' })
    .or('disabled.is.null,disabled.eq.false')
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%,marca.ilike.%${search}%`);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

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

  return NextResponse.json({ products, count: count ?? products.length, page, limit });
}
