import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export interface PdfData {
  base64: string;
  filename: string;
  contentType: string;
  size: number;
  generatedAt: string;
  driveUrl?: string;
  driveFileId?: string;
}

/**
 * Guarda el PDF en base64 directamente en Firestore.
 * NO usa compresión porque puede corromper el PDF.
 *
 * Firestore tiene un límite de 1MB por campo, así que:
 * - PDFs pequeños (<900KB en base64) se guardan directamente
 * - PDFs grandes se deberían guardar en Firebase Storage (no implementado)
 */
export const savePdfToDatabase = async (
  saleId: string,
  type: "invoice" | "remito",
  pdfData: PdfData,
): Promise<void> => {
  // Validar que sea base64 válido ANTES de guardar
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(pdfData.base64)) {
    console.error("El base64 a guardar contiene caracteres inválidos");
    throw new Error(
      "El base64 contiene caracteres inválidos y no se puede guardar",
    );
  }

  // ADVERTENCIA: Firestore tiene límite de 1MB por documento
  // Base64 aumenta el tamaño ~33%, entonces un PDF de 750KB → ~1MB en base64
  const MAX_BASE64_SIZE = 900000; // ~900KB en base64 = ~675KB de PDF

  if (pdfData.base64.length > MAX_BASE64_SIZE) {
    console.warn(
      `PDF muy grande (${Math.ceil(pdfData.base64.length / 1024)}KB en base64). Considera usar Firebase Storage.`,
    );
  }

  const updateData: Record<string, any> =
    type === "invoice"
      ? {
          invoicePdfBase64: pdfData.base64,
          invoicePdfGeneratedAt: pdfData.generatedAt,
          invoiceFilename: pdfData.filename,
          invoicePdfSize: pdfData.size,
          ...(pdfData.driveUrl && { invoiceDriveUrl: pdfData.driveUrl }),
          ...(pdfData.driveFileId && {
            invoiceDriveFileId: pdfData.driveFileId,
          }),
        }
      : {
          remitoPdfBase64: pdfData.base64,
          remitoPdfGeneratedAt: pdfData.generatedAt,
          remitoFilename: pdfData.filename,
          remitoPdfSize: pdfData.size,
          ...(pdfData.driveUrl && { remitoDriveUrl: pdfData.driveUrl }),
          ...(pdfData.driveFileId && {
            remitoDriveFileId: pdfData.driveFileId,
          }),
        };

  try {
    const docRef = doc(db, "ventas", saleId);
    await updateDoc(docRef, updateData);

    // Verificar que se guardó correctamente leyendo de vuelta
    const verificacion = await getDoc(docRef);
    if (verificacion.exists()) {
      const data = verificacion.data();
      const base64Guardado =
        type === "invoice" ? data.invoicePdfBase64 : data.remitoPdfBase64;
      if (base64Guardado && base64Guardado !== pdfData.base64) {
        console.error("Base64 guardado es DIFERENTE al original");
      }
    }
  } catch (error: any) {
    console.error("Error guardando PDF en Firestore:", error);

    // Si el error es por tamaño, dar un mensaje más claro
    if (
      error.code === "invalid-argument" ||
      error.message?.includes("too large")
    ) {
      throw new Error(
        `El PDF es demasiado grande para Firestore (${Math.ceil(pdfData.base64.length / 1024)}KB). ` +
          "Necesitas implementar Firebase Storage para PDFs grandes.",
      );
    }

    throw error;
  }
};

/**
 * Convierte base64 a Blob para descargas.
 * Valida que el base64 sea válido antes de convertir.
 */
export const base64ToBlob = (
  base64: string,
  contentType: string = "application/pdf",
): Blob => {
  try {
    // Validar que sea base64 válido
    if (!base64 || base64.length === 0) {
      throw new Error("El base64 está vacío");
    }

    // Limpiar el base64 (por si tiene el prefijo data:application/pdf;base64,)
    let cleanBase64 = base64.replace(/^data:.*?;base64,/, "");

    // Limpiar espacios en blanco y saltos de línea que podrían corromper el base64
    cleanBase64 = cleanBase64.replace(/\s/g, "");

    // Validar que sea base64 válido (solo caracteres permitidos)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanBase64)) {
      throw new Error("Base64 contiene caracteres inválidos");
    }

    // Decodificar base64
    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  } catch (error: any) {
    console.error("Error al convertir base64 a blob:", error);
    throw new Error(`El formato del PDF es inválido: ${error.message}`);
  }
};

/**
 * Descarga un PDF desde su base64.
 * Crea un blob y dispara la descarga.
 */
export const downloadBase64Pdf = (base64: string, filename: string) => {
  try {
    const blob = base64ToBlob(base64);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Liberar memoria
    URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error("Error descargando PDF:", error);
    toast.error(
      "No se pudo descargar el PDF: " + (error.message || "error desconocido"),
    );
  }
};

/**
 * Valida que un base64 corresponda a un PDF válido.
 * Verifica la firma del archivo PDF (%PDF).
 */
export const validatePdfBase64 = (base64: string): boolean => {
  try {
    const cleanBase64 = base64.replace(/^data:.*?;base64,/, "");
    const binaryString = atob(cleanBase64);

    // Los PDFs empiezan con %PDF-
    const pdfSignature = "%PDF-";
    const fileStart = binaryString.substring(0, 5);

    if (fileStart !== pdfSignature) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error validando PDF:", error);
    return false;
  }
};
