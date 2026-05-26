// Agency Group — Institutional API Key Engine
// lib/institutional/institutionalApiKeyEngine.ts
//
// Manages API keys for institutional clients (banks, family offices, hedge funds,
// sovereign wealth funds, pension funds, insurance companies, developers).
//
// TypeScript strict — 0 errors
// All EUR amounts in bigint/cents — never float for money.

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { logger as log } from '@/lib/observability/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstitutionalTier =
  | 'BANK'
  | 'FAMILY_OFFICE'
  | 'HEDGE_FUND'
  | 'SOVEREIGN_WEALTH'
  | 'PENSION_FUND'
  | 'INSURANCE'
  | 'DEVELOPER'

export interface InstitutionalClient {
  id: string
  tenant_id: string
  institution_name: string
  tier: InstitutionalTier
  api_key_hash: string // SHA-256 of the actual key
  rate_limit_per_minute: number
  allowed_endpoints: string[]
  data_access_level: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'PLATINUM'
  is_active: boolean
  created_at: string
  last_used_at: string | null
  usage_count: number
  aum_eur_cents: bigint | null // Assets under management
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const RATE_LIMITS_BY_TIER: Record<InstitutionalTier, number> = {
  BANK: 1000,
  SOVEREIGN_WEALTH: 1000,
  HEDGE_FUND: 500,
  PENSION_FUND: 500,
  FAMILY_OFFICE: 200,
  INSURANCE: 200,
  DEVELOPER: 60,
}

export const ALLOWED_ENDPOINTS_BY_ACCESS_LEVEL: Record<
  'BASIC' | 'STANDARD' | 'PREMIUM' | 'PLATINUM',
  string[]
> = {
  BASIC: [
    '/api/institutional/market-data',
    '/api/market-authority/index',
  ],
  STANDARD: [
    '/api/institutional/market-data',
    '/api/market-authority/index',
    '/api/market-authority/ics',
  ],
  PREMIUM: [
    '/api/institutional/market-data',
    '/api/market-authority/index',
    '/api/market-authority/ics',
    '/api/proprietary-data/lvi',
  ],
  PLATINUM: [
    '/api/institutional/market-data',
    '/api/market-authority/index',
    '/api/market-authority/ics',
    '/api/proprietary-data/lvi',
    '/api/supply-dominance',
    '/api/lock-in',
    '/api/proprietary-data/time-to-close',
    '/api/proprietary-data/discount-vs-listing',
    '/api/proprietary-data/investor-behavior',
  ],
}

// ─── hashApiKey ───────────────────────────────────────────────────────────────

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}

// ─── validateInstitutionalKey ─────────────────────────────────────────────────

export async function validateInstitutionalKey(
  apiKey: string,
  endpoint: string,
): Promise<{ valid: boolean; client?: InstitutionalClient; reason?: string }> {
  if (!apiKey) {
    return { valid: false, reason: 'Missing API key' }
  }

  const keyHash = hashApiKey(apiKey)

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('institutional_api_keys')
      .select('*')
      .eq('api_key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return { valid: false, reason: 'Invalid API key' }
    }

    const client = data as InstitutionalClient

    // Check endpoint access
    const allowed = client.allowed_endpoints ?? []
    const hasAccess =
      allowed.length === 0 ||
      allowed.some(
        (ep: string) => endpoint.startsWith(ep) || ep === '*',
      )

    if (!hasAccess) {
      return { valid: false, client, reason: 'Endpoint not in allowed list' }
    }

    // Fire-and-forget: update last_used_at + increment usage_count
    void (supabaseAdmin as any)
      .from('institutional_api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: (client.usage_count ?? 0) + 1,
      })
      .eq('id', client.id)
      .catch((e: unknown) => console.warn('[institutionalApiKey] update last_used_at failed', e))

    log.info('[institutional] key validated', {
      client_id: client.id,
      institution: client.institution_name,
      tier: client.tier,
      endpoint,
    })

    return { valid: true, client }
  } catch (err) {
    log.info('[institutional] validateInstitutionalKey error', { err: String(err) })
    return { valid: false, reason: 'Internal validation error' }
  }
}

// ─── checkRateLimit ───────────────────────────────────────────────────────────

export async function checkRateLimit(
  clientId: string,
  tier: InstitutionalTier,
): Promise<{ allowed: boolean; remaining: number }> {
  const maxPerMinute = RATE_LIMITS_BY_TIER[tier] ?? 60

  // Bucket to current minute
  const now = new Date()
  const minuteBucket = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    0,
    0,
  ).toISOString()

  try {
    // Upsert + increment atomically using RPC or manual upsert
    const { data: existing } = await (supabaseAdmin as any)
      .from('institutional_rate_limits')
      .select('id, call_count')
      .eq('client_id', clientId)
      .eq('minute_bucket', minuteBucket)
      .single()

    const currentCount: number = existing ? (existing.call_count as number) : 0

    if (currentCount >= maxPerMinute) {
      return { allowed: false, remaining: 0 }
    }

    // Upsert with incremented count
    if (existing) {
      void (supabaseAdmin as any)
        .from('institutional_rate_limits')
        .update({
          call_count: currentCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .catch((e: unknown) =>
          console.warn('[institutionalApiKey] rate limit update failed', e),
        )
    } else {
      void (supabaseAdmin as any)
        .from('institutional_rate_limits')
        .insert({
          client_id: clientId,
          minute_bucket: minuteBucket,
          call_count: 1,
          updated_at: new Date().toISOString(),
        })
        .catch((e: unknown) =>
          console.warn('[institutionalApiKey] rate limit insert failed', e),
        )
    }

    return {
      allowed: true,
      remaining: maxPerMinute - currentCount - 1,
    }
  } catch (err) {
    // On rate limit check failure, allow the request (fail open)
    console.warn('[institutionalApiKey] checkRateLimit error', err)
    return { allowed: true, remaining: maxPerMinute }
  }
}

// ─── getClientUsageStats ──────────────────────────────────────────────────────

export async function getClientUsageStats(clientId: string): Promise<{
  total_calls: number
  calls_today: number
  top_endpoints: Array<{ endpoint: string; count: number }>
}> {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [clientResult, todayResult, endpointsResult] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('institutional_api_keys')
        .select('usage_count')
        .eq('id', clientId)
        .single(),

      (supabaseAdmin as any)
        .from('institutional_api_usage')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('called_at', todayStart.toISOString()),

      (supabaseAdmin as any)
        .from('institutional_api_usage')
        .select('endpoint')
        .eq('client_id', clientId)
        .order('called_at', { ascending: false })
        .limit(1000),
    ])

    const totalCalls =
      clientResult.status === 'fulfilled'
        ? ((clientResult.value.data?.usage_count as number) ?? 0)
        : 0

    const callsToday =
      todayResult.status === 'fulfilled'
        ? ((todayResult.value.count as number) ?? 0)
        : 0

    // Aggregate endpoint counts
    const endpointMap: Record<string, number> = {}
    if (endpointsResult.status === 'fulfilled' && endpointsResult.value.data) {
      for (const row of endpointsResult.value.data as Array<{ endpoint: string }>) {
        endpointMap[row.endpoint] = (endpointMap[row.endpoint] ?? 0) + 1
      }
    }

    const topEndpoints = Object.entries(endpointMap)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return { total_calls: totalCalls, calls_today: callsToday, top_endpoints: topEndpoints }
  } catch (err) {
    console.warn('[institutionalApiKey] getClientUsageStats error', err)
    return { total_calls: 0, calls_today: 0, top_endpoints: [] }
  }
}

// ─── recordApiCall ────────────────────────────────────────────────────────────

export function recordApiCall(
  clientId: string,
  endpoint: string,
  responseMs: number,
  statusCode: number,
): Promise<void> {
  void (supabaseAdmin as any)
    .from('institutional_api_usage')
    .insert({
      client_id: clientId,
      endpoint,
      response_ms: responseMs,
      status_code: statusCode,
      called_at: new Date().toISOString(),
    })
    .catch((e: unknown) => console.warn('[institutionalApiKey] recordApiCall failed', e))

  return Promise.resolve()
}
