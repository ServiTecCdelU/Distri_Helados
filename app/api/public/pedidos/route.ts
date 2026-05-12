// app/api/public/pedidos/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
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
  table: string,
  prefix: string,
  identifier: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('generate_readable_id', {
    p_table: table,
    p_prefix: prefix,
    p_identifier: identifier,
  });
  if (error || !data) {
    // Fallback
    const slug = slugify(identifier);
    return `${prefix}_${slug}_${Date.now()}`;
  }
  return data;
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
    let existingClient: any = null;

    if (cuit) {
      const { data } = await supabaseAdmin.from('clientes').select('*').eq('cuit', cuit).limit(1);
      if (data && data.length > 0) existingClient = data[0];
    }
    if (!existingClient && dni) {
      const { data } = await supabaseAdmin.from('clientes').select('*').eq('dni', dni).limit(1);
      if (data && data.length > 0) existingClient = data[0];
    }
    if (!existingClient && email) {
      const { data } = await supabaseAdmin.from('clientes').select('*').eq('email', email).limit(1);
      if (data && data.length > 0) existingClient = data[0];
    }

    if (existingClient) {
      clientId = existingClient.id;
      clientName = existingClient.name || name;

      const updates: Record<string, unknown> = {};
      if (phone && !existingClient.phone) updates.phone = phone;
      if (email && !existingClient.email) updates.email = email;
      if (address && !existingClient.address) updates.address = address;
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('clientes').update(updates).eq('id', clientId);
      }
    } else {
      const clientDocId = await generateAdminReadableId("clientes", "cliente", name);

      await supabaseAdmin.from('clientes').insert({
        id: clientDocId,
        name,
        dni: dni || null,
        cuit: cuit || null,
        email: email || null,
        phone,
        address: address || null,
        tax_category: taxCategory,
        credit_limit: 0,
        current_balance: 0,
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

  // Crear pedido con ID legible
  const orderDocId = await generateAdminReadableId("pedidos", "pedido", clientName);

  await supabaseAdmin.from('pedidos').insert({
    id: orderDocId,
    sale_id: null,
    client_id: clientId,
    client_name: clientName,
    client_phone: phone || null,
    client_email: email || null,
    seller_id: null,
    seller_name: null,
    city: isPickup ? null : (body.city || null),
    address: resolvedAddress,
    lat: isPickup ? null : (body.lat ?? null),
    lng: isPickup ? null : (body.lng ?? null),
    delivery_method: deliveryMethod,
    status: "pending",
    source: "tienda",
    discount: body.discount ?? null,
    discount_type: body.discountType ?? null,
  });

  // Insertar items normalizados
  if (body.items.length > 0) {
    const itemRows = body.items.map((item: any) => ({
      order_id: orderDocId,
      product_id: item.productId || null,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      item_discount: item.itemDiscount ?? null,
    }));
    await supabaseAdmin.from('pedido_items').insert(itemRows);
  }

  return NextResponse.json({ orderId: orderDocId });
}
