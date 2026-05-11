import { downloadBase64Pdf } from "@/services/pdf-service";
import { toast } from "sonner";

export function buildDocFilename(tipo: "boleta" | "remito", numero: string | undefined, clientName?: string): string {
  const nombre = (clientName || "cliente")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  let nro = numero || "0";
  const match = nro.match(/(\d+)$/);
  if (match) nro = String(parseInt(match[1], 10));
  const prefix = tipo === "boleta" ? "boleta" : "remito";
  return `${prefix}_N°${nro}_${nombre}.pdf`;
}

export function descargarDocumento(
  base64: string | undefined,
  tipo: "boleta" | "remito",
  numero: string | undefined,
  clientName?: string,
) {
  if (!base64) {
    toast.error("PDF no disponible");
    return;
  }
  const filename = buildDocFilename(tipo, numero, clientName);
  downloadBase64Pdf(base64, filename);
  toast.success("Descargando...");
}

export async function enviarWhatsapp(
  base64: string | undefined,
  tipo: "boleta" | "remito",
  numero: string | undefined,
  clientName?: string,
  clientPhone?: string,
  resolverTelefono?: () => Promise<string>,
) {
  if (!base64) {
    toast.error("Primero generá el PDF");
    return;
  }
  const filename = buildDocFilename(tipo, numero, clientName);

  // Convertir base64 a File
  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArr], { type: "application/pdf" });
  const file = new File([blob], filename, { type: "application/pdf" });

  const clientLabel = clientName || "cliente";
  const docName = tipo === "boleta" ? "comprobante" : "remito";

  // Resolver teléfono
  let phone = clientPhone?.replace(/\D/g, "") || "";
  if (!phone && resolverTelefono) {
    try {
      phone = await resolverTelefono();
    } catch {}
  }
  const phoneFormatted = phone
    ? (phone.startsWith("54") ? phone : `54${phone}`)
    : "";

  const msg = `Hola ${clientLabel}! Te envío tu ${docName}.`;

  try {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: `${docName} - ${clientLabel}`,
        text: msg,
        files: [file],
      });
      toast.success("Compartido");
      return;
    }
  } catch (e: any) {
    if (e.name === "AbortError") return;
  }

  // Desktop: descargar + abrir WhatsApp
  downloadBase64Pdf(base64, filename);

  const wpUrl = phoneFormatted
    ? `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;

  setTimeout(() => {
    window.open(wpUrl, "_blank");
  }, 500);

  toast.success(
    phoneFormatted
      ? "PDF descargado. Adjuntalo en el chat de WhatsApp que se abrió."
      : "PDF descargado. Abrí WhatsApp y elegí el contacto para enviarlo.",
    { duration: 5000 },
  );
}
