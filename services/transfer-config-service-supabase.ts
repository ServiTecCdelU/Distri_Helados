// services/transfer-config-service-supabase.ts
import { supabase } from '@/lib/supabase'

export interface TransferConfig {
  alias: string
  titular: string
  banco: string
}

export async function getTransferConfig(): Promise<TransferConfig> {
  const { data } = await supabase
    .from('configuracion')
    .select('value')
    .eq('key', 'transferencia')
    .single()

  if (data?.value) {
    const v = data.value as any
    return {
      alias: v.alias || '',
      titular: v.titular || '',
      banco: v.banco || '',
    }
  }
  return { alias: '', titular: '', banco: '' }
}

export async function saveTransferConfig(config: TransferConfig): Promise<void> {
  await supabase.from('configuracion').upsert({
    key: 'transferencia',
    value: config,
    updated_at: new Date().toISOString(),
  })
}
