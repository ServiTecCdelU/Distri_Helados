import { getAuthToken } from "@/services/auth-service";

export interface InvoiceClient {
  name?: string;
  phone?: string;
  email?: string;
  taxCategory?: string;
  cuit?: string;
  dni?: string;
}

export interface InvoiceResult {
  invoiceNumber: string;
  pdfUrl: string;
  whatsappUrl?: string;
  mock?: boolean;
  saleId?: string;
  afipData?: {
    cae: string;
    caeVencimiento: string;
    tipoComprobante: number;
  };
}

/**
 * Crea una factura electrónica y sube el PDF a Firebase Storage
 */
export const createInvoice = async (payload: {
  saleId: string;
  client?: InvoiceClient;
}): Promise<InvoiceResult> => {
  const token = await getAuthToken();

  const response = await fetch("/api/facturacion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Error ${response.status}`);
  }

  const data = await response.json();
  return data;
};

/**
 * Crea un remito y sube el PDF a Firebase Storage
 */
export const createRemito = async (payload: { saleId: string }) => {
  const token = await getAuthToken();
  
  const response = await fetch("/api/remitos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Error ${response.status}`);
  }

  return response.json();
};