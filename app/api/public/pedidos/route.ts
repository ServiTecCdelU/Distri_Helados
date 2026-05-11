// app/api/public/pedidos/route.ts
import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function generateAdminReadableId(
  collection: string,
  prefix: string,
  identifier: string,
): Promise<string> {
  const slug = slugify(identifier);
  const base = `${prefix}_${slug}`;
  for (let num = 1; num < 1000; num++) {
    const candidateId = `${base}_${num}`;
    const doc = await adminFirestore.collection(collection).doc(candidateId).get();
    if (!doc.exists) return candidateId;
  }
  return `${base}_${Date.now()}`;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = rateLimit(ip, { maxRequests: 15, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ message: "Items requeridos" }, { status: 400 });
  }

  const client = body.client || {};
  const name = String(client.name || "").trim();
  const phone = String(client.phone || body.clientPhone || "").trim();
  const email = String(client.email || body.clientEmail || "").trim();
  const dni = String(client.dni || "").trim();
  const cuit = String(client.cuit || "").trim();
  const address = String(client.address || "").trim();
  const taxCategory = String(client.taxCategory || "consumidor_final").trim();

  if (!name || !phone) {
    return NextResponse.json(
      { message: "Nombre y teléfono son obligatorios" },
      { status: 400 },
    );
  }

  // Si ya viene un clientId (ya registrado), usarlo directamente
  let clientId: string | null = body.clientId || null;
  let clientName = name;

  if (!clientId) {
    // Buscar cliente existente por CUIT, DNI o email
    let existingSnap = null;

    if (cuit) {
      existingSnap = await adminFirestore
        .collection("clientes")
        .where("cuit", "==", cuit)
        .limit(1)
        .get();
    }
    if ((!existingSnap || existingSnap.empty) && dni) {
      existingSnap = await adminFirestore
        .collection("clientes")
        .where("dni", "==", dni)
        .limit(1)
        .get();
    }
    if ((!existingSnap || existingSnap.empty) && email) {
      existingSnap = await adminFirestore
        .collection("clientes")
        .where("email", "==", email)
        .limit(1)
        .get();
    }

    if (existingSnap && !existingSnap.empty) {
      const docSnap = existingSnap.docs[0];
      clientId = docSnap.id;
      clientName = docSnap.data().name || name;

      // Actualizar datos si cambió algo
      const updates: Record<string, unknown> = {};
      if (phone && !docSnap.data().phone) updates.phone = phone;
      if (email && !docSnap.data().email) updates.email = email;
      if (address && !docSnap.data().address) updates.address = address;
      if (Object.keys(updates).length > 0) {
        await adminFirestore.collection("clientes").doc(clientId).update(updates);
      }
    } else {
      // Crear nuevo cliente con ID legible: cliente_{name}_{cuit} o cliente_{name}_{counter}
      let clientDocId: string;
      if (cuit) {
        // ID con nombre + CUIT (único por persona)
        const namePart = slugify(name);
        const cuitPart = cuit.replace(/[^0-9]/g, "");
        clientDocId = `cliente_${namePart}_${cuitPart}`;
        // Verificar si ya existe ese ID
        const existing = await adminFirestore.collection("clientes").doc(clientDocId).get();
        if (existing.exists) {
          // Fallback a contador
          clientDocId = await generateAdminReadableId("clientes", "cliente", name);
        }
      } else {
        clientDocId = await generateAdminReadableId("clientes", "cliente", name);
      }

      await adminFirestore.collection("clientes").doc(clientDocId).set({
        name,
        dni: dni || null,
        cuit: cuit || null,
        email: email || null,
        phone,
        address: address || null,
        taxCategory,
        creditLimit: 0,
        currentBalance: 0,
        createdAt: new Date(),
      });
      clientId = clientDocId;
    }
  }

  // Resolver dirección
  const deliveryMethod = String(body.deliveryMethod || "pickup");
  const isPickup = deliveryMethod === "pickup";
  const resolvedAddress =
    body.address ||
    (isPickup ? "Retiro en local" : "Dirección no especificada");

  // Crear pedido con ID legible: pedido_{clientName}_{counter}
  const orderDocId = await generateAdminReadableId("pedidos", "pedido", clientName);

  await adminFirestore.collection("pedidos").doc(orderDocId).set({
    saleId: null,
    clientId,
    clientName,
    clientPhone: phone || null,
    clientEmail: email || null,
    sellerId: null,
    sellerName: null,
    items: body.items,
    city: isPickup ? null : (body.city || null),
    address: resolvedAddress,
    lat: isPickup ? null : (body.lat ?? null),
    lng: isPickup ? null : (body.lng ?? null),
    deliveryMethod,
    status: "pending",
    source: "tienda",
    discount: body.discount ?? null,
    discountType: body.discountType ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json({ orderId: orderDocId });
}
