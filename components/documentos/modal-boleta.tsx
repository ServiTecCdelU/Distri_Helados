"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, X, Download, Send, Loader2, Check } from "lucide-react";
import { savePdfToDatabase } from "@/services/pdf-service";
import { toast } from "sonner";
import type { Venta } from "@/hooks/useVentas";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
interface ModalBoletaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  invoiceData: any;
  clientData?: any;
  saleData?: Venta | any;
  saleId: string;
  onPdfGenerated?: () => void;
}

export function ModalBoleta({
  open,
  onOpenChange,
  invoiceNumber,
  invoiceData,
  clientData,
  saleData,
  saleId,
  onPdfGenerated,
}: ModalBoletaProps) {
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(
    saleData?.invoiceDriveUrl || null,
  );
  const handleGenerateAndSave = async () => {
    setGenerating(true);
    setError(null);

    try {
      const venta: Venta = {
        id: saleId,
        invoiceNumber,
        clientName: clientData?.name || saleData?.clientName,
        clientCuit: clientData?.cuit || saleData?.clientCuit,
        clientAddress: clientData?.address || saleData?.clientAddress,
        clientTaxCategory:
          clientData?.taxCategory || saleData?.clientTaxCategory,
        clientPhone: clientData?.phone || saleData?.clientPhone,
        items: saleData?.items || [],
        total: saleData?.total || 0,
        paymentType: saleData?.paymentType || "cash",
        cashAmount: saleData?.cashAmount,
        creditAmount: saleData?.creditAmount,
        createdAt: saleData?.createdAt || new Date(),
        discount: saleData?.discount,
        discountType: saleData?.discountType,
        clientData,
      };

      // ✅ Genera PDF client-side sin Chromium ni usePdfGenerator
      const { generarPdfCliente } = await import("@/hooks/useGenerarPdf");
      const base64 = await generarPdfCliente(venta, "boleta", invoiceData);
      setPdfBase64(base64);
      setGenerating(false);
      setSaving(true);

      await savePdfToDatabase(saleId, "invoice", {
        base64,
        filename: `Boleta-${invoiceNumber}.pdf`,
        contentType: "application/pdf",
        size: Math.ceil((base64.length * 3) / 4),
        generatedAt: new Date().toISOString(),
      });

      setPdfGenerated(true);
      toast.success("✅ PDF generado y guardado correctamente");
      onPdfGenerated?.();
    } catch (err: any) {
      // Error silenciado
      setError(err.message || "Error desconocido");
      toast.error(
        "Error al generar el PDF: " + (err.message || "Error desconocido"),
      );
    } finally {
      setGenerating(false);
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!pdfBase64) return;
    const byteChars = atob(pdfBase64);
    const byteNums = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++)
      byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteNums], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Boleta-${invoiceNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("⬇️ Descargando PDF...");
  };

  const handleWhatsapp = async () => {
    const phone = clientData?.phone || saleData?.clientPhone;
    if (!pdfBase64 || !phone) {
      toast.error("Falta teléfono o PDF");
      return;
    }

    try {
      let downloadUrl = driveUrl; // 👈 reutilizar si ya existe

      if (!downloadUrl) {
        toast.loading("Subiendo PDF a Drive...");

        const res = await fetch("/api/drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64: pdfBase64,
            filename: `Boleta-${invoiceNumber}.pdf`,
          }),
        });

        if (!res.ok) throw new Error("Error al subir a Drive");
        const data = await res.json();
        downloadUrl = data.downloadUrl;

        setDriveUrl(downloadUrl); // 👈 guardar en state

        // 👈 persistir en Firebase
        await updateDoc(doc(db, "ventas", saleId), {
          invoiceDriveUrl: downloadUrl,
          invoiceDriveFileId: data.fileId,
        });
      }

      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("54")
        ? cleanPhone
        : `54${cleanPhone}`;
      const msg = `Hola ${clientData?.name || saleData?.clientName}! Te envío la Boleta N° ${invoiceNumber}.\n\n📄 Descargar PDF: ${downloadUrl}`;

      toast.dismiss();
      toast.success("✅ Link generado");
      window.open(
        `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
    } catch (e: any) {
      toast.dismiss();
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Boleta {invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            Genera y descarga el PDF de la boleta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              <p className="font-bold">Error:</p>
              <p>{error}</p>
            </div>
          )}

          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">
                {clientData?.name || saleData?.clientName || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold">
                ${(saleData?.total || 0).toLocaleString("es-AR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CAE</span>
              <span
                className={
                  invoiceData?.cae
                    ? "text-green-600 font-medium"
                    : "text-muted-foreground"
                }
              >
                {invoiceData?.cae ? `✓ ${invoiceData.cae}` : "Sin CAE"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!pdfGenerated ? (
              <Button
                onClick={handleGenerateAndSave}
                disabled={generating || saving}
                className="gap-2 w-full"
              >
                {generating || saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {generating
                  ? "Generando..."
                  : saving
                    ? "Guardando..."
                    : "Generar PDF"}
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-1 text-green-600 text-sm w-full justify-center mb-1">
                  <Check className="h-4 w-4" />
                  <span>PDF generado y guardado</span>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  className="gap-2 flex-1"
                >
                  <Download className="h-4 w-4" /> Descargar
                </Button>
                {(clientData?.phone || saleData?.clientPhone) && (
                  <Button
                    onClick={handleWhatsapp}
                    className="gap-2 flex-1 bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Send className="h-4 w-4" /> WhatsApp
                  </Button>
                )}
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full gap-2"
            >
              <X className="h-4 w-4" /> Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
