// services/price-list-service-supabase.ts
import { supabase } from '@/lib/supabase'
import type { PriceList } from '@/lib/types'
import { generateReadableId } from '@/services/supabase-helpers'

export const getPriceLists = async (): Promise<PriceList[]> => {
  const { data, error } = await supabase
    .from('listas_precios')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    multiplier: r.multiplier,
    isActive: r.is_active,
    createdAt: new Date(r.created_at),
  }))
}

export const createPriceList = async (data: Omit<PriceList, 'id' | 'createdAt'>): Promise<PriceList> => {
  const id = await generateReadableId('listas_precios', 'lista', data.name)
  const { error } = await supabase.from('listas_precios').insert({
    id,
    name: data.name,
    type: data.type,
    description: data.description,
    multiplier: data.multiplier,
    is_active: data.isActive,
  })
  if (error) throw error
  return { id, ...data, createdAt: new Date() }
}

export const updatePriceList = async (id: string, updates: Partial<PriceList>): Promise<void> => {
  const row: any = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.type !== undefined) row.type = updates.type
  if (updates.description !== undefined) row.description = updates.description
  if (updates.multiplier !== undefined) row.multiplier = updates.multiplier
  if (updates.isActive !== undefined) row.is_active = updates.isActive

  const { error } = await supabase.from('listas_precios').update(row).eq('id', id)
  if (error) throw error
}

export const deletePriceList = async (id: string): Promise<void> => {
  const { error } = await supabase.from('listas_precios').delete().eq('id', id)
  if (error) throw error
}

export const calculatePrice = (basePrice: number, priceList: PriceList | null): number => {
  if (!priceList || !priceList.isActive) return basePrice
  return Math.round(basePrice * priceList.multiplier)
}
