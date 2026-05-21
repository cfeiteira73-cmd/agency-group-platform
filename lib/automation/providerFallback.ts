// Agency Group — Provider Fallback Chain
// lib/automation/providerFallback.ts
// Casafari → Idealista → Cached fallback chain.
// Tracks provider health, auto-routes to best available.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataProvider = 'casafari' | 'idealista' | 'cache' | 'internal'

export interface ProviderResult<T> {
  data: T | null
  provider_used: DataProvider
  latency_ms: number
  from_cache: boolean
  error?: string
}

export interface ProviderHealthStatus {
  provider: DataProvider
  healthy: boolean
  avg_latency_ms: number
  error_rate: number
  last_checked_at: string
}

// ─── getProviderHealth ────────────────────────────────────────────────────────

/**
 * Reads last 100 entries per provider from provider_health_log.
 * Computes error_rate and avg_latency_ms for each provider.
 */
export async function getProviderHealth(tenantId: string): Promise<ProviderHealthStatus[]> {
  const providers: DataProvider[] = ['casafari', 'idealista', 'cache', 'internal']
  const results: ProviderHealthStatus[] = []

  for (const provider of providers) {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('provider_health_log')
        .select('success, latency_ms, recorded_at')
        .eq('tenant_id', tenantId)
        .eq('provider', provider)
        .order('recorded_at', { ascending: false })
        .limit(100)

      if (error) {
        log.info('[providerFallback] health query error', { provider, error: error.message })
        results.push({
          provider,
          healthy: false,
          avg_latency_ms: 0,
          error_rate: 1,
          last_checked_at: new Date().toISOString(),
        })
        continue
      }

      const rows = (data as { success: boolean; latency_ms: number | null; recorded_at: string }[]) ?? []

      if (rows.length === 0) {
        results.push({
          provider,
          healthy: true,
          avg_latency_ms: 0,
          error_rate: 0,
          last_checked_at: new Date().toISOString(),
        })
        continue
      }

      const failures = rows.filter(r => !r.success).length
      const error_rate = failures / rows.length
      const latencies = rows.filter(r => r.latency_ms != null).map(r => r.latency_ms as number)
      const avg_latency_ms =
        latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0

      results.push({
        provider,
        healthy: error_rate < 0.5 && avg_latency_ms < 5000,
        avg_latency_ms: Math.round(avg_latency_ms),
        error_rate: Math.round(error_rate * 1000) / 1000,
        last_checked_at: rows[0]?.recorded_at ?? new Date().toISOString(),
      })
    } catch (err) {
      log.info('[providerFallback] unexpected health error', {
        provider,
        error: String(err),
      })
      results.push({
        provider,
        healthy: false,
        avg_latency_ms: 0,
        error_rate: 1,
        last_checked_at: new Date().toISOString(),
      })
    }
  }

  return results
}

// ─── recordProviderCall ───────────────────────────────────────────────────────

/**
 * Fire-and-forget insert into provider_health_log.
 */
export async function recordProviderCall(
  provider: DataProvider,
  tenantId: string,
  success: boolean,
  latencyMs: number,
): Promise<void> {
  void (supabaseAdmin as any)
    .from('provider_health_log')
    .insert({
      tenant_id: tenantId,
      provider,
      success,
      latency_ms: Math.round(latencyMs),
      recorded_at: new Date().toISOString(),
    })
    .catch((e: unknown) => console.warn('[providerFallback] recordProviderCall error', e))
}

// ─── withProviderFallback ─────────────────────────────────────────────────────

/**
 * Tries primary provider, then each fallback in order.
 * Stops on first success. Records each attempt via recordProviderCall.
 * 'cache' provider always returns null (placeholder for real cache integration).
 */
export async function withProviderFallback<T>(
  tenantId: string,
  primary: DataProvider,
  fallbacks: DataProvider[],
  fn: (provider: DataProvider) => Promise<T | null>,
): Promise<ProviderResult<T>> {
  const providersToTry = [primary, ...fallbacks]
  let lastError: string | undefined

  for (const provider of providersToTry) {
    // 'cache' provider is a placeholder — always returns null
    if (provider === 'cache') {
      log.info('[providerFallback] skipping cache provider (placeholder)', { provider })
      void recordProviderCall(provider, tenantId, false, 0).catch(e =>
        console.warn('[providerFallback] record error', e),
      )
      continue
    }

    const startedAt = Date.now()

    try {
      const data = await fn(provider)
      const latency_ms = Date.now() - startedAt

      void recordProviderCall(provider, tenantId, data !== null, latency_ms).catch(e =>
        console.warn('[providerFallback] record error', e),
      )

      if (data !== null) {
        log.info('[providerFallback] success', { provider, latency_ms })
        return {
          data,
          provider_used: provider,
          latency_ms,
          from_cache: false,
        }
      }

      log.info('[providerFallback] provider returned null, trying next', { provider })
    } catch (err) {
      const latency_ms = Date.now() - startedAt
      lastError = err instanceof Error ? err.message : String(err)

      log.info('[providerFallback] provider error', { provider, error: lastError, latency_ms })

      void recordProviderCall(provider, tenantId, false, latency_ms).catch(e =>
        console.warn('[providerFallback] record error', e),
      )
    }
  }

  log.info('[providerFallback] all providers failed', { primary, fallbacks, lastError })

  return {
    data: null,
    provider_used: primary,
    latency_ms: 0,
    from_cache: false,
    error: lastError ?? 'All providers failed or returned null',
  }
}

// ─── getOptimalProvider ───────────────────────────────────────────────────────

/**
 * Returns the provider with lowest error_rate AND latency_ms < 2000.
 * Defaults to 'internal' if none qualify.
 */
export async function getOptimalProvider(tenantId: string): Promise<DataProvider> {
  const healthStatuses = await getProviderHealth(tenantId)

  const qualified = healthStatuses
    .filter(s => s.healthy && s.avg_latency_ms < 2000 && s.error_rate < 0.5)
    .sort((a, b) => a.error_rate - b.error_rate || a.avg_latency_ms - b.avg_latency_ms)

  if (qualified.length === 0) {
    return 'internal'
  }

  return qualified[0].provider
}
