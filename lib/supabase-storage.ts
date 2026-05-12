// lib/supabase-storage.ts
// Reemplaza lib/storage.ts (Firebase Storage) con Supabase Storage
import { supabase } from '@/lib/supabase'

const BUCKET = 'pdfs'

export const storageService = {
  /**
   * Sube un archivo PDF a Supabase Storage
   */
  async uploadPDF(
    fileBuffer: Buffer | Uint8Array,
    path: string,
    filename: string
  ): Promise<string> {
    const filePath = `${path}/${filename}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (error) throw error

    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath)

    return data.publicUrl
  },

  /**
   * Elimina un archivo de Storage
   */
  async deleteFile(path: string): Promise<void> {
    try {
      await supabase.storage.from(BUCKET).remove([path])
    } catch (error) {
      console.error('Error eliminando archivo:', error)
    }
  },

  /**
   * Genera nombre único para el archivo
   */
  generateFilename(saleId: string, type: 'boleta' | 'remito'): string {
    const timestamp = Date.now()
    return `${type}-${saleId}-${timestamp}.pdf`
  },
}
