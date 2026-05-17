// Cache en memoria para evitar re-fetch al navegar entre páginas.
// Se invalida automáticamente por TTL o manualmente tras mutaciones.

const cache = new Map<string, { data: any; timestamp: number }>()
const DEFAULT_TTL = 30_000 // 30 segundos

export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() })
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
