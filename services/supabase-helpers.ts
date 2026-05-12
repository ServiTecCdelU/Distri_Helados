// services/supabase-helpers.ts — Reemplaza services/firestore-helpers.ts
import { supabase } from '@/lib/supabase'

export const toDate = (value: unknown): Date => {
  if (!value) return new Date(0)
  if (value instanceof Date) return value
  return new Date(value as string)
}

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export const generateReadableId = async (
  table: string,
  prefix: string,
  identifier: string,
): Promise<string> => {
  const { data, error } = await supabase.rpc('generate_readable_id', {
    p_table: table,
    p_prefix: prefix,
    p_identifier: identifier,
  })
  if (error || !data) {
    // Fallback local
    const slug = slugify(identifier)
    return `${prefix}_${slug}_${Date.now()}`
  }
  return data
}
