import { NextRequest, NextResponse } from "next/server";
import pako from "pako";

interface ParsedItem {
  rawName: string;
  quantity: number;
  lineIndex: number;
}

// Extrae texto de streams PDF usando pako para descomprimir FlateDecode
function extractTextFromPdfBuffer(buffer: Buffer): string[] {
  const binary = buffer.toString("binary");
  const lines: string[] = [];

  // Encontrar todos los streams en el PDF
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRegex.exec(binary)) !== null) {
    const streamData = match[1];
    let textContent = "";

    // Intentar descomprimir con FlateDecode (pako inflate)
    try {
      const streamBytes = new Uint8Array(
        Buffer.from(streamData, "binary")
      );
      const decompressed = pako.inflate(streamBytes, { to: "string" });
      textContent = decompressed;
    } catch {
      // Stream sin comprimir o encoding diferente
      textContent = streamData;
    }

    // Extraer texto con operadores Tj y TJ del content stream PDF
    const extractedParts: string[] = [];

    // Operador Tj: (texto) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(textContent)) !== null) {
      const text = tjMatch[1]
        .replace(/\\n/g, " ")
        .replace(/\\r/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
        .trim();
      if (text) extractedParts.push(text);
    }

    // Operador TJ: [(texto) ajuste (texto)] TJ
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjArrayMatch;
    while ((tjArrayMatch = tjArrayRegex.exec(textContent)) !== null) {
      const parts = tjArrayMatch[1].match(/\(([^)]*)\)/g) || [];
      const combined = parts
        .map((p) => p.slice(1, -1).replace(/\\\(/g, "(").replace(/\\\)/g, ")"))
        .join("")
        .trim();
      if (combined) extractedParts.push(combined);
    }

    if (extractedParts.length > 0) {
      lines.push(...extractedParts);
    }
  }

  return lines;
}

// Normaliza texto para comparación
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Detecta si un token es un número de cantidad válido
function parseQuantity(token: string): number | null {
  const cleaned = token.replace(/[.,]/g, "").trim();
  const num = parseInt(cleaned, 10);
  if (!isNaN(num) && num > 0 && num < 10000) return num;
  return null;
}

// Intenta parsear líneas de texto en items de remito
// Formato típico remito proveedor: descripción + cantidad (y posiblemente precio)
function parseRemitoLines(lines: string[]): ParsedItem[] {
  const items: ParsedItem[] = [];
  const joined = lines.join(" | ");

  // Estrategia 1: buscar líneas que tengan nombre + número
  // Agrupar tokens y buscar patrones como "Producto X   24   $3000   $72000"
  const allText = lines
    .filter((l) => l.length > 1)
    .map((l) => l.trim())
    .join("\n");

  const textLines = allText.split(/\n|\|/).map((l) => l.trim()).filter(Boolean);

  // Buscar líneas con patrón: texto seguido de número (cantidad)
  // En remitos argentinos típicos: "CREMA BATMAN  24  3.500  84.000"
  const linePatterns = textLines.map((line) => {
    const tokens = line.split(/\s+/);
    const numbers: { index: number; value: number }[] = [];
    const words: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const q = parseQuantity(tokens[i]);
      if (q !== null && !tokens[i].includes("$")) {
        numbers.push({ index: i, value: q });
      } else if (isNaN(Number(tokens[i].replace(/[.,]/g, "")))) {
        words.push(tokens[i]);
      }
    }

    return { line, tokens, numbers, words };
  });

  // Filtrar líneas que parecen ser de productos (tienen palabras Y números)
  for (const { line, words, numbers } of linePatterns) {
    if (words.length >= 1 && numbers.length >= 1) {
      // La primera cantidad suele ser la cantidad pedida/entregada
      // Filtrar headers obvios
      const wordsJoined = words.join(" ").toLowerCase();
      if (
        wordsJoined.includes("cantidad") ||
        wordsJoined.includes("descrip") ||
        wordsJoined.includes("precio") ||
        wordsJoined.includes("total") ||
        wordsJoined.includes("subtotal") ||
        wordsJoined.includes("importe") ||
        wordsJoined.includes("unidad") ||
        wordsJoined.includes("codigo") ||
        wordsJoined.includes("cod.") ||
        wordsJoined.includes("remito") ||
        wordsJoined.includes("factura") ||
        wordsJoined.includes("fecha") ||
        wordsJoined.includes("cliente") ||
        wordsJoined.includes("cuit") ||
        wordsJoined.includes("domicilio") ||
        wordsJoined.includes("iva") ||
        words.length === 0
      ) {
        continue;
      }

      const rawName = words.join(" ").trim();
      const quantity = numbers[0].value;

      if (rawName.length >= 3) {
        items.push({ rawName, quantity, lineIndex: items.length });
      }
    }
  }

  return items;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "El archivo debe ser un PDF" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verificar firma PDF
    const header = buffer.slice(0, 5).toString("ascii");
    if (!header.startsWith("%PDF")) {
      return NextResponse.json({ error: "El archivo no es un PDF válido" }, { status: 400 });
    }

    const textLines = extractTextFromPdfBuffer(buffer);
    const parsedItems = parseRemitoLines(textLines);

    return NextResponse.json({
      success: true,
      items: parsedItems,
      rawLines: textLines.slice(0, 100), // para debug si se necesita
    });
  } catch (error) {
    console.error("Error parsing remito PDF:", error);
    return NextResponse.json(
      { error: "Error al procesar el PDF" },
      { status: 500 }
    );
  }
}
