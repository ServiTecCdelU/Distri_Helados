// lib/storage.ts
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export const storageService = {
  /**
   * Sube un archivo PDF a Firebase Storage
   */
  async uploadPDF(
    fileBuffer: Buffer,
    path: string,
    filename: string
  ): Promise<string> {
    const storageRef = ref(storage, `${path}/${filename}`);
    const metadata = {
      contentType: 'application/pdf',
      customMetadata: {
        uploadedAt: new Date().toISOString(),
      },
    };

    await uploadBytes(storageRef, fileBuffer, metadata);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  },

  /**
   * Elimina un archivo de Storage
   */
  async deleteFile(url: string): Promise<void> {
    try {
      const storageRef = ref(storage, url);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error eliminando archivo:', error);
    }
  },

  /**
   * Genera nombre único para el archivo
   */
  generateFilename(saleId: string, type: 'boleta' | 'remito'): string {
    const timestamp = Date.now();
    return `${type}-${saleId}-${timestamp}.pdf`;
  },
};