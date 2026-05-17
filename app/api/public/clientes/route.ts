// app/api/public/clientes/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { formatCuit, normalizeCuit } from "@/lib/utils/format";

function normalizeForSearch(s?: any) {
  if (!s && s !== 0) return "";
  try {
    return String(s)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") // quitar acentos
      .replace(/[^\p{L}\p{N}]/gu, "")
      .toLowerCase();
  } catch (e) {
    // Fallback si el engine no soporta \p
    return String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = rateLimit(ip, { maxRequests: 15, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const dni = searchParams.get("dni")?.trim();
  const cuit = searchParams.get("cuit")?.trim();
  const q = searchParams.get("q")?.trim();
  if (!dni && !cuit) {
    if (!q) return NextResponse.json({ found: false });
  }

  const field = cuit ? "cuit" : "dni";
  // Para CUIT intentamos ambos formatos (guiones y solo digitos) por compat con datos viejos
  const candidates: string[] = [];
  if (cuit) {
    const digits = normalizeCuit(cuit);
    const dashed = formatCuit(cuit);
    if (dashed) candidates.push(dashed);
    if (digits && !candidates.includes(digits)) candidates.push(digits);
    if (!candidates.includes(cuit)) candidates.push(cuit);
  } else if (dni) {
    candidates.push(dni);
    const digits = normalizeCuit(dni);
    if (digits && !candidates.includes(digits)) candidates.push(digits);
  }

  const mapClient = (r: any) => ({
    id: r.id,
    name: r.name || "",
    phone: r.phone || "",
    address: r.address || "",
    email: r.email || "",
    cuit: r.cuit || "",
    dni: r.dni || "",
    taxCategory: r.tax_category || "consumidor_final",
    creditLimit: r.credit_limit ?? 50000,
    currentBalance: r.current_balance ?? 0,
  });

  // Prioridad: buscar por dni/cuit exacto si fue provisto
  if (dni || cuit) {
    let foundClient = null;
    for (const value of candidates) {
      const { data } = await supabaseAdmin
        .from('clientes')
        .select('*')
        .eq(field, value)
        .limit(1);
      if (data && data.length > 0) {
        foundClient = data[0];
        break;
      }
    }
    if (!foundClient) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({ found: true, client: mapClient(foundClient) });
  }

  // Si llegamos acá hay un query libre 'q' -> buscar server-side con ilike
  if (q) {
    const { data: matches } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%,cuit.ilike.%${q}%,dni.ilike.%${q}%,phone.ilike.%${q}%,address.ilike.%${q}%`)
      .limit(10);

    if (!matches || matches.length === 0) return NextResponse.json({ found: false });

    return NextResponse.json({
      found: true,
      clients: matches.map(mapClient),
    });
  }
}
