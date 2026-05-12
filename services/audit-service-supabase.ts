// services/audit-service-supabase.ts
import { supabase } from '@/lib/supabase'
import type { AuditAction, AuditEntry } from '@/lib/types'
import { generateReadableId } from '@/services/supabase-helpers'

export const logAudit = async (entry: {
  action: AuditAction
  userId: string
  userName: string
  description: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, any>
}) => {
  try {
    const id = await generateReadableId('auditoria', 'auditoria', entry.userName)
    await supabase.from('auditoria').insert({
      id,
      action: entry.action,
      user_id: entry.userId,
      user_name: entry.userName,
      description: entry.description,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
    })
  } catch {
    // Audit should never break the main operation
  }
}

export const getAuditLog = async (maxEntries = 100): Promise<AuditEntry[]> => {
  const { data, error } = await supabase
    .from('auditoria')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(maxEntries)
  if (error) throw error
  return (data || []).map(r => ({
    id: r.id,
    action: r.action,
    userId: r.user_id,
    userName: r.user_name,
    description: r.description,
    entityType: r.entity_type,
    entityId: r.entity_id,
    metadata: r.metadata,
    createdAt: new Date(r.created_at),
  }))
}

export const getAuditByEntity = async (entityType: string, entityId: string): Promise<AuditEntry[]> => {
  const { data, error } = await supabase
    .from('auditoria')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(r => ({
    id: r.id,
    action: r.action,
    userId: r.user_id,
    userName: r.user_name,
    description: r.description,
    entityType: r.entity_type,
    entityId: r.entity_id,
    metadata: r.metadata,
    createdAt: new Date(r.created_at),
  }))
}
