interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null }
    return entry.value as T
  }

  delete(key: string): void { this.store.delete(key) }
  clear(): void { this.store.clear() }

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) return cached
    const value = await fetcher()
    this.set(key, value, ttlSeconds)
    return value
  }
}

export const marketCache = new MemoryCache()
export const ratesCache = new MemoryCache()
export const avmCache = new MemoryCache()
export const radarCache = new MemoryCache()

export const CacheKeys = {
  avm: (zona: string, tipo: string, area: number) => `avm:${zona}:${tipo}:${area}`,
  rates: () => 'rates:current',
  marketData: (zona: string) => `market:${zona}`,
  radar: (query: string) => `radar:${btoa(encodeURIComponent(query)).slice(0, 32)}`,
}
