// lib/bitingenieria.ts
// Integración con API FEAFIP de Bit Ingeniería para factura electrónica AFIP
// Testing:    https://api.bitingenieria.com.ar/silex/feafip
// Producción: https://api.bitingenieria.com.ar/silex/feafip_prod

const BASE_URL_TESTING = "https://api.bitingenieria.com.ar/silex/feafip";
const BASE_URL_PROD = "https://api.bitingenieria.com.ar/silex/feafip_prod";

function getBaseUrl(): string {
  return process.env.BIT_INGENIERIA_PRODUCTION === "true"
    ? BASE_URL_PROD
    : BASE_URL_TESTING;
}

export interface BitProduct {
  description: string;
  price: number;
  quantity: number;
  sum_tax: number;
  discount?: number;
  total: number;
}

export interface BitCompanyData {
  name: string;
  address: string;
  postal_code?: string;
  city: string;
  country?: string;
  ident: string; // CUIT sin guiones ni espacios
}

export interface BitCustomerData {
  name: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  ident: string; // CUIT/DNI del cliente, o "0" para consumidor final
  doc_type: number; // 80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final
  condicion_iva_receptor_id?: number;
}

export interface BitAutorizarRequest {
  tipo_comp: number; // 1=Factura A, 6=Factura B, 11=Factura C
  pto_vta: number;
  date: string; // formato dd/mm/yyyy
  payment_m?: string;
  company_data: BitCompanyData;
  customer_data: BitCustomerData;
  products: BitProduct[];
  base: {
    subtotal: number; // importe neto (sin IVA)
    sum_tax: number;  // importe IVA
    discount?: number;
    total: number;    // total final
  };
}

export interface BitAutorizarResponse {
  sucess: boolean; // typo intencional de la API de Bit Ingeniería
  cae?: string;
  nro?: number;    // número de comprobante
  vto?: string;    // vencimiento CAE, formato dd/mm/yyyy
  pdf?: string;    // PDF en base64
  description?: string; // mensaje de error si sucess=false
}

const COMPANY_DATA: BitCompanyData = {
  name: process.env.BIT_INGENIERIA_COMPANY_NAME || "DOMINGUEZ MARIO CESAR",
  address: process.env.BIT_INGENIERIA_COMPANY_ADDRESS || "DR. BASTIAN 1049",
  city: process.env.BIT_INGENIERIA_COMPANY_CITY || "SAN JOSE",
  postal_code: process.env.BIT_INGENIERIA_COMPANY_POSTAL_CODE || "",
  country: "ARGENTINA",
  ident: process.env.BIT_INGENIERIA_CUIT || "20145983836",
};

/**
 * Autoriza un comprobante en AFIP y obtiene CAE + PDF.
 * En modo testing no factura real, solo simula.
 */
export async function autorizarComprobante(
  req: BitAutorizarRequest
): Promise<BitAutorizarResponse> {
  const url = `${getBaseUrl()}/fe_autorizar`;
  const isProduction = process.env.BIT_INGENIERIA_PRODUCTION === "true";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  const rawText = await response.text();

  if (!response.ok || rawText.trim().startsWith("<")) {
    // La API devolvió XML (SOAP Fault) en vez de JSON
    console.error("[BitIngenieria] Respuesta no-JSON:", rawText.substring(0, 500));
    throw new Error(
      `Bit Ingeniería devolvió error. Respuesta: ${rawText.substring(0, 200)}`
    );
  }

  let data: BitAutorizarResponse;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("[BitIngenieria] Respuesta no parseable:", rawText.substring(0, 500));
    throw new Error(`Respuesta inválida de Bit Ingeniería: ${rawText.substring(0, 200)}`);
  }

  if (!data.sucess) {
    throw new Error(
      data.description || "Error al autorizar comprobante en Bit Ingeniería"
    );
  }

  return data;
}

/**
 * Construye el request para fe_autorizar a partir de los datos de la venta.
 */
export function buildAutorizarRequest(params: {
  tipoComprobante: number;
  fecha: Date;
  paymentMethod?: string;
  customerData: BitCustomerData;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  discount?: number;
}): BitAutorizarRequest {
  const ptoVta = parseInt(process.env.BIT_INGENIERIA_PTO_VTA || "10");

  const totalConDescuento = params.discount
    ? params.total - params.discount
    : params.total;

  const subtotal = totalConDescuento / 1.21;
  const sumTax = totalConDescuento - subtotal;

  const date = params.fecha
    .toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "/");

  const products: BitProduct[] = params.items.map((item) => ({
    description: item.name,
    price: item.price,
    quantity: item.quantity,
    sum_tax: 0, // IVA detallado en base.sum_tax
    discount: 0,
    total: item.price * item.quantity,
  }));

  return {
    tipo_comp: params.tipoComprobante,
    pto_vta: ptoVta,
    date,
    payment_m: params.paymentMethod || "Efectivo",
    company_data: COMPANY_DATA,
    customer_data: params.customerData,
    products,
    base: {
      subtotal: Math.round(subtotal * 100) / 100,
      sum_tax: Math.round(sumTax * 100) / 100,
      discount: params.discount || 0,
      total: Math.round(totalConDescuento * 100) / 100,
    },
  };
}

// ── Interfaces para endpoints adicionales ──

export interface BitUltimoNumeroRequest {
  cuit: number;
  tipo_comp: number;
  pto_vta: number;
}

export interface BitUltimoNumeroResponse {
  sucess: boolean;
  nro?: number;
  description?: string;
}

export interface BitConsultarComprobantesRequest {
  cuit: number;
  pto_vta: number;
  tipo_comp: number;
  nro_inicial: number;
  nro_final: number;
}

export interface BitConsultarCuitRequest {
  cuit: number;
  cuit_consulta: number;
}

export interface BitConsultarCuitResponse {
  sucess: boolean;
  description?: string;
  // Campos devueltos por AFIP sobre el CUIT consultado
  [key: string]: any;
}

export interface BitPdfRequest {
  tipo_comp: number;
  pto_vta: number;
  date: string;
  payment_m?: string;
  cae: string;
  vto: string;
  nro: number;
  company_data: BitCompanyData;
  customer_data: BitCustomerData;
  products: BitProduct[];
  base: {
    subtotal: number;
    sum_tax: number;
    discount?: number;
    total: number;
  };
  output_format?: string;
}

export interface BitPdfResponse {
  sucess: boolean;
  pdf?: string; // base64
  description?: string;
}

// ── Helper genérico para llamadas a la API ──

async function bitFetch<T>(endpoint: string, body: any): Promise<T> {
  const url = `${getBaseUrl()}/${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();

  if (!response.ok || rawText.trim().startsWith("<")) {
    console.error(`[BitIngenieria] ${endpoint} respuesta no-JSON:`, rawText.substring(0, 500));
    throw new Error(`Bit Ingeniería ${endpoint} error: ${rawText.substring(0, 200)}`);
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    console.error(`[BitIngenieria] ${endpoint} respuesta no parseable:`, rawText.substring(0, 500));
    throw new Error(`Respuesta inválida de Bit Ingeniería (${endpoint}): ${rawText.substring(0, 200)}`);
  }
}

// ── Endpoints adicionales ──

/**
 * Consulta el último número de comprobante emitido para un tipo y punto de venta.
 */
export async function obtenerUltimoNumero(
  tipoComp: number,
  ptoVta?: number
): Promise<number> {
  const cuit = parseInt((process.env.BIT_INGENIERIA_CUIT || "20145983836").replace(/\D/g, ""));
  const pto = ptoVta ?? parseInt(process.env.BIT_INGENIERIA_PTO_VTA || "10");

  const data = await bitFetch<BitUltimoNumeroResponse>("fe_ultimo_numero", {
    cuit,
    tipo_comp: tipoComp,
    pto_vta: pto,
  });

  if (!data.sucess) {
    throw new Error(data.description || "Error al obtener último número de comprobante");
  }

  return data.nro ?? 0;
}

/**
 * Consulta comprobantes emitidos en un rango de números.
 */
export async function consultarComprobantes(
  tipoComp: number,
  nroInicial: number,
  nroFinal: number,
  ptoVta?: number
): Promise<any> {
  const cuit = parseInt((process.env.BIT_INGENIERIA_CUIT || "20145983836").replace(/\D/g, ""));
  const pto = ptoVta ?? parseInt(process.env.BIT_INGENIERIA_PTO_VTA || "10");

  return bitFetch("fe_cmp_consultar", {
    cuit,
    pto_vta: pto,
    tipo_comp: tipoComp,
    nro_inicial: nroInicial,
    nro_final: nroFinal,
  });
}

/**
 * Consulta datos fiscales de un CUIT en AFIP (razón social, condición IVA, etc.).
 */
export async function consultarCuit(
  cuitConsulta: number | string
): Promise<BitConsultarCuitResponse> {
  const cuit = parseInt((process.env.BIT_INGENIERIA_CUIT || "20145983836").replace(/\D/g, ""));
  const cuitNum = typeof cuitConsulta === "string"
    ? parseInt(cuitConsulta.replace(/\D/g, ""))
    : cuitConsulta;

  return bitFetch<BitConsultarCuitResponse>("fe_consultar_cuit", {
    cuit,
    cuit_consulta: cuitNum,
  });
}

/**
 * Regenera el PDF de un comprobante ya autorizado (reimpresión).
 */
export async function reimprimirPdf(
  params: BitPdfRequest
): Promise<string> {
  const data = await bitFetch<BitPdfResponse>("fe_pdf", params);

  if (!data.sucess || !data.pdf) {
    throw new Error(data.description || "Error al generar PDF de reimpresión");
  }

  return data.pdf;
}

/**
 * Construye el request para fe_pdf a partir de datos de un comprobante ya emitido.
 */
export function buildPdfRequest(params: {
  tipoComprobante: number;
  fecha: string; // dd/mm/yyyy
  paymentMethod?: string;
  cae: string;
  vto: string; // dd/mm/yyyy
  nro: number;
  customerData: BitCustomerData;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  subtotal: number;
  sumTax: number;
  discount?: number;
}): BitPdfRequest {
  const ptoVta = parseInt(process.env.BIT_INGENIERIA_PTO_VTA || "10");

  const products: BitProduct[] = params.items.map((item) => ({
    description: item.name,
    price: item.price,
    quantity: item.quantity,
    sum_tax: 0,
    discount: 0,
    total: item.price * item.quantity,
  }));

  return {
    tipo_comp: params.tipoComprobante,
    pto_vta: ptoVta,
    date: params.fecha,
    payment_m: params.paymentMethod || "Efectivo",
    cae: params.cae,
    vto: params.vto,
    nro: params.nro,
    company_data: COMPANY_DATA,
    customer_data: params.customerData,
    products,
    base: {
      subtotal: params.subtotal,
      sum_tax: params.sumTax,
      discount: params.discount || 0,
      total: params.total,
    },
    output_format: "i",
  };
}

/**
 * Convierte la fecha de vencimiento de CAE de "dd/mm/yyyy" a "yyyy-mm-dd"
 */
export function parseCaeVto(vto: string): string {
  if (!vto) return "";
  const [d, m, y] = vto.split("/");
  return `${y}-${m}-${d}`;
}

/** Exporta COMPANY_DATA para uso en otros módulos */
export { COMPANY_DATA };
