// app/api/public/mas-vendidos/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  // Query venta_items with product JOIN — mucho más eficiente que Firestore
  const [itemsRes, productosRes] = await Promise.all([
    supabaseAdmin.from('venta_items').select('product_id, quantity'),
    supabaseAdmin.from('productos').select('id, name, description, price, stock, image_url, category, sin_tacc, disabled'),
  ]);

  // Aggregate quantities sold per productId
  const countMap: Record<string, number> = {};
  for (const item of (itemsRes.data || [])) {
    if (item.product_id) {
      countMap[item.product_id] = (countMap[item.product_id] || 0) + (item.quantity || 1);
    }
  }

  // Build product map (exclude disabled)
  const productMap: Record<string, any> = {};
  for (const r of (productosRes.data || [])) {
    if (r.disabled === true) continue;
    productMap[r.id] = {
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      stock: r.stock,
      imageUrl: r.image_url,
      category: r.category,
      sinTacc: r.sin_tacc ?? false,
    };
  }

  // Sort by sold quantity, take top 3
  const top3 = Object.entries(countMap)
    .filter(([id]) => productMap[id])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, soldCount]) => ({ ...productMap[id], soldCount }));

  if (top3.length < 3) {
    const existing = new Set(top3.map((p) => p.id));
    const extras = Object.values(productMap)
      .filter((p: any) => !existing.has(p.id))
      .slice(0, 3 - top3.length)
      .map((p: any) => ({ ...p, soldCount: 0 }));
    top3.push(...extras);
  }

  return NextResponse.json({ products: top3 });
}
