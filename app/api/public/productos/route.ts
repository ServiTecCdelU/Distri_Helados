// app/api/public/productos/route.ts
import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = await adminFirestore.collection("productos").get();

  const products = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        imageUrl: data.imageUrl,
        category: data.category,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
        marca: data.marca ?? null,
        base: data.base ?? "crema",
        sinTacc: data.sinTacc ?? false,
        disabled: data.disabled ?? false,
      };
    })
    .filter((product) => product.disabled !== true);

  return NextResponse.json({ products });
}
