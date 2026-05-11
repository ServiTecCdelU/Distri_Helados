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
import { Truck, X, Download, Send, Loader2, Check } from "lucide-react";
import { savePdfToDatabase } from "@/services/pdf-service";
import { toast } from "sonner";
import type { Venta } from "@/hooks/useVentas";

interface ModalRemitoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remitoNumber: string;
  saleData: Venta | any;
  saleId: string;
  onPdfGenerated?: () => void;
}

export function ModalRemito({
  open,
  onOpenChange,
  remitoNumber,
  saleData,
  saleId,
  onPdfGenerated,
}: ModalRemitoProps) {
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  const handleGenerateAndSave = async () => {
    setGenerating(true);
    try {
      // Construir objeto venta con remitoNumber incluido
      const venta: Venta = {
        ...saleData,
        id: saleId,
        remitoNumber,
      };

      // ✅ Genera PDF client-side sin Chromium ni usePdfGenerator
      const { generarPdfCliente } = await import("@/hooks/useGenerarPdf");
      const base64 = await generarPdfCliente(venta, "remito");
      setPdfBase64(base64);
      setGenerating(false);
      setSaving(true);

      await savePdfToDatabase(saleId, "remito", {
        base64,
        filename: `Remito-${remitoNumber}.pdf`,
        contentType: "application/pdf",
        size: Math.ceil((base64.length * 3) / 4),
        generatedAt: new Date().toISOString(),
      });

      setPdfGenerated(true);
      toast.success("Remito guardado correctamente");
      onPdfGenerated?.();
    } catch (error: any) {
      // Error silenciado
      toast.error(
        "Error al generar el remito: " + (error.message || "Error desconocido"),
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
    link.download = `Remito-${remitoNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Descargando remito...");
  };

  const handleWhatsapp = async () => {
    if (!pdfBase64 || !saleData?.clientPhone) {
      toast.error("Falta teléfono o PDF");
      return;
    }

    try {
      toast.loading("Subiendo PDF a Drive...");

      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: pdfBase64,
          filename: `Remito-${remitoNumber}.pdf`,
        }),
      });

      if (!res.ok) throw new Error("Error al subir a Drive");
      const { downloadUrl } = await res.json();

      const cleanPhone = saleData.clientPhone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("54")
        ? cleanPhone
        : `54${cleanPhone}`;
      const msg = `Hola ${saleData?.clientName}! Te envío el Remito N° ${remitoNumber}.\n\n📄 Descargar PDF: ${downloadUrl}`;

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
            <Truck className="h-5 w-5" />
            Remito N° {remitoNumber}
          </DialogTitle>
          <DialogDescription>
            Genera y descarga el remito de entrega
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">
                {saleData?.clientName || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dirección</span>
              <span className="font-medium text-right max-w-[60%]">
                {saleData?.deliveryAddress || saleData?.clientAddress || "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold">
                ${(saleData?.total || 0).toLocaleString("es-AR")}
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
                  <Truck className="h-4 w-4" />
                )}
                {generating
                  ? "Generando..."
                  : saving
                    ? "Guardando..."
                    : "Generar Remito"}
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-1 text-green-600 text-sm w-full justify-center mb-1">
                  <Check className="h-4 w-4" />
                  <span>Remito generado y guardado</span>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  className="gap-2 flex-1"
                >
                  <Download className="h-4 w-4" /> Descargar
                </Button>
                {saleData?.clientPhone && (
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
