// hooks/use-afip-invoice.ts
import { useState } from 'react'
import { createInvoice, type InvoiceResult } from '@/services/invoice-service'
import { toast } from 'sonner'

interface UseAfipInvoiceOptions {
  onSuccess?: (data: InvoiceResult) => void
  onError?: (error: Error) => void
}

export function useAfipInvoice(options: UseAfipInvoiceOptions = {}) {
  const [isLoading, setIsLoading] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<InvoiceResult | null>(null)

  const emitirFactura = async (
    saleId: string,
    client?: {
      name?: string
      phone?: string
      email?: string
      taxCategory?: string
      cuit?: string
      dni?: string
    }
  ) => {
    setIsLoading(true)

    try {
      const result = await createInvoice({
        saleId,
        client,
      })

      setLastInvoice(result)
      toast.success(
        result.mock
          ? 'Factura generada (modo prueba)'
          : `Factura ${result.invoiceNumber} emitida correctamente`
      )
      options.onSuccess?.(result)
      return result
    } catch (error: any) {
      toast.error(error.message || 'Error al emitir factura')
      options.onError?.(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    emitirFactura,
    isLoading,
    lastInvoice,
  }
}