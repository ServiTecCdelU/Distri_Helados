// lib/inventory-history.ts
export interface StockMovement {
  id: string
  productId: string
  productName: string
  type: 'sale' | 'manual_edit' | 'deletion' | 'creation' | 'bulk_operation'
  previousStock: number
  newStock: number
  change: number
  date: Date
  reason?: string
  saleId?: string
  saleTotal?: number
  sellerId?: string
  sellerName?: string
  clientId?: string
  clientName?: string
  userId?: string
  userName?: string
  details?: string
}

const STORAGE_KEY = 'stockHistory'
// lib/inventory-history.ts
export interface StockMovement {
  id: string
  productId: string
  productName: string
  type
}
export const inventoryHistoryService = {
  getAll(): StockMovement[] {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []
    return JSON.parse(saved).map((h: any) => ({
      ...h,
      date: new Date(h.date)
    }))
  },

  save(movement: Omit<StockMovement, 'id' | 'date'>): StockMovement {
    const history = this.getAll()
    const newMovement: StockMovement = {
      ...movement,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: new Date()
    }
    const updated = [newMovement, ...history].slice(0, 200)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return newMovement
  },

  getByProductId(productId: string): StockMovement[] {
    return this.getAll().filter(h => h.productId === productId)
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
  
}