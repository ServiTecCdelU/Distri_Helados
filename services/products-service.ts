// services/products-service-supabase.ts
import { supabase } from '@/lib/supabase'
import type { Product } from '@/lib/types'
import { generateReadableId } from '@/services/supabase-helpers'

function mapRow(r: any): Product {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    price: r.price,
    stock: r.stock,
    imageUrl: r.image_url,
    category: r.category,
    base: r.base ?? 'crema',
    marca: r.marca ?? 'Sin identificar',
    sinTacc: r.sin_tacc ?? false,
    disabled: r.disabled ?? false,
    createdAt: new Date(r.created_at),
  }
}

export const getProducts = async (limit: number = 500): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('productos')
    .select('id, name, description, price, stock, image_url, category, base, marca, sin_tacc, disabled, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map(mapRow)
}

export const getProductById = async (id: string): Promise<Product | undefined> => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return undefined
  return mapRow(data)
}

export const createProduct = async (
  product: Omit<Product, 'id' | 'createdAt'>
): Promise<Product> => {
  const id = await generateReadableId('productos', 'producto', product.name)
  const row = {
    id,
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    image_url: product.imageUrl,
    category: product.category,
    base: (product as any).base ?? 'crema',
    marca: (product as any).marca ?? 'Sin identificar',
    sin_tacc: (product as any).sinTacc ?? false,
    disabled: (product as any).disabled ?? false,
  }
  const { error } = await supabase.from('productos').insert(row)
  if (error) throw error
  return { ...product, id, disabled: (product as any).disabled ?? false, createdAt: new Date() }
}

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product> => {
  const row: any = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.description !== undefined) row.description = updates.description
  if (updates.price !== undefined) row.price = updates.price
  if (updates.stock !== undefined) row.stock = updates.stock
  if (updates.imageUrl !== undefined) row.image_url = updates.imageUrl
  if (updates.category !== undefined) row.category = updates.category
  if ((updates as any).base !== undefined) row.base = (updates as any).base
  if ((updates as any).marca !== undefined) row.marca = (updates as any).marca
  if ((updates as any).sinTacc !== undefined) row.sin_tacc = (updates as any).sinTacc
  if ((updates as any).disabled !== undefined) row.disabled = (updates as any).disabled

  const { error } = await supabase.from('productos').update(row).eq('id', id)
  if (error) throw error
  const updated = await getProductById(id)
  if (!updated) throw new Error('Product not found')
  return updated
}

export const deleteProduct = async (id: string): Promise<void> => {
  const { error } = await supabase.from('productos').delete().eq('id', id)
  if (error) throw error
}

export const getProductsPaginated = async (
  pageSize: number = 50,
  page: number = 0,
): Promise<{ data: Product[]; page: number; hasMore: boolean }> => {
  const from = page * pageSize
  const to = from + pageSize - 1
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  const rows = (data || []).map(mapRow)
  return { data: rows, page, hasMore: rows.length === pageSize }
}
