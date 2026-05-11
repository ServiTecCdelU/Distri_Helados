// app/api/public/clientes/route.ts
import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase-admin";
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

  // Prioridad: buscar por dni/cuit exacto si fue provisto
  if (dni || cuit) {
    let snapshot = null as FirebaseFirestore.QuerySnapshot | null;
    for (const value of candidates) {
      const snap = await adminFirestore
        .collection("clientes")
        .where(field, "==", value)
        .limit(1)
        .get();
      if (!snap.empty) {
        snapshot = snap;
        break;
      }
    }
    if (!snapshot || snapshot.empty) {
      return NextResponse.json({ found: false });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    return NextResponse.json({
      found: true,
      client: {
        id: doc.id,
        name: data.name || "",
        phone: data.phone || "",
        address: data.address || "",
        email: data.email || "",
        cuit: data.cuit || "",
        dni: data.dni || "",
        taxCategory: data.taxCategory || "consumidor_final",
        creditLimit: data.creditLimit ?? 50000,
        currentBalance: data.currentBalance ?? 0,
      },
    });
  }

  // Si llegamos acá hay un query libre 'q' -> buscar server-side por varios campos
  if (q) {
    const normQ = normalizeForSearch(q);
    // Obtener todos los clientes y filtrar (dataset pequeño asumido)
    const snap = await adminFirestore.collection("clientes").get();
    const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    const matches: Array<{ id: string; data: FirebaseFirestore.DocumentData }> = [];

    const digitsQ = (q || "").replace(/[^0-9]/g, "");

    for (const docItem of docs) {
      const data = docItem.data;
      const nName = normalizeForSearch(data.name || "");
      const nEmail = normalizeForSearch(data.email || "");
      const nAddr = normalizeForSearch(data.address || "");
      const nDni = normalizeForSearch(data.dni || "");
      const nCuit = normalizeForSearch(data.cuit || "");
      let matched = false;
      if (nName === normQ || nName.includes(normQ)) matched = true;
      else if (nEmail && nEmail.includes(normQ)) matched = true;
      else if (digitsQ && String(data.phone || "").replace(/[^0-9]/g, "").includes(digitsQ)) matched = true;
      else if (nDni.includes(normQ) || nCuit.includes(normQ)) matched = true;
      else if (nAddr.includes(normQ)) matched = true;
      else if (Array.isArray(data.addresses)) {
        for (const a of data.addresses) {
          if (normalizeForSearch(a.address || "").includes(normQ)) { matched = true; break; }
        }
      }
      if (matched) matches.push(docItem);
      if (matches.length >= 10) break;
    }

    if (matches.length === 0) return NextResponse.json({ found: false });

    return NextResponse.json({
      found: true,
      clients: matches.map((m) => ({
        id: m.id,
        name: m.data.name || "",
        phone: m.data.phone || "",
        address: m.data.address || "",
        email: m.data.email || "",
        cuit: m.data.cuit || "",
        dni: m.data.dni || "",
        taxCategory: m.data.taxCategory || "consumidor_final",
        creditLimit: m.data.creditLimit ?? 50000,
        currentBalance: m.data.currentBalance ?? 0,
      })),
    });
  }
}
