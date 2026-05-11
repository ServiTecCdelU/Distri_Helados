// app/api/public/mas-vendidos/route.ts
import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  const [ventasSnap, productosSnap] = await Promise.all([
    adminFirestore.collection("ventas").get(),
    adminFirestore.collection("productos").get(),
  ]);

  // Aggregate quantities sold per productId
  const countMap: Record<string, number> = {};
  for (const doc of ventasSnap.docs) {
    const data = doc.data();
    const items: { productId: string; quantity: number }[] = data.items || [];
    for (const item of items) {
      if (item.productId) {
        countMap[item.productId] = (countMap[item.productId] || 0) + (item.quantity || 1);
      }
    }
  }

  // Build product map
  const productMap: Record<string, any> = {};
  for (const doc of productosSnap.docs) {
    const data = doc.data();
    if (data.disabled === true) continue;
    productMap[doc.id] = {
      id: doc.id,
      name: data.name,
      description: data.description,
      price: data.price,
      stock: data.stock,
      imageUrl: data.imageUrl,
      category: data.category,
      sinTacc: data.sinTacc ?? false,
    };
  }

  // Sort by sold quantity, take top 3
  const top3 = Object.entries(countMap)
    .filter(([id]) => productMap[id])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, soldCount]) => ({ ...productMap[id], soldCount }));

  // If fewer than 3 products have sales, fill with other products
  if (top3.length < 3) {
    const existing = new Set(top3.map((p) => p.id));
    const extras = Object.values(productMap)
      .filter((p) => !existing.has(p.id))
      .slice(0, 3 - top3.length)
      .map((p) => ({ ...p, soldCount: 0 }));
    top3.push(...extras);
  }

  return NextResponse.json({ products: top3 });
}
