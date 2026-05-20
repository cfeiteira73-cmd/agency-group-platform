// =============================================================================
// Agency Group — withCronLock: Distributed Cron Job Lock
// lib/ops/withCronLock.ts
//
// Prevents concurrent execution of the same cron job across multiple
// Vercel serverless instances using Upstash Redis SET NX EX.
//
// USAGE:
//   const result = await withCronLock('kpi-snapshot', 2, async () => {
//     // ... cron body ...
//     return NextResponse.json({ ... })
//   })
//   if (result === null) {
//     return NextResponse.json({ skipped: true, reason: 'already_running' })
//   }
//   return result
//
// FALLBACK:
//   If Upstash is not configured, the lock is skipped (fail-open) so crons
//   always run — better than silently blocking in development.
//
// ERROR HANDLING:
//   429 (rate limit): exponential backoff — 3 retries with 200ms, 400ms, 800ms delays.
//   Unreachable after all retries: fail-open (cron runs) + writes to incidents table.
//   This prevents a transient Redis outage from silently skipping critical crons.
//
// TypeScript strict — 0 errors
// =============================================================================

const LOCK_KEY_PREFIX = 'cron:lock:'

/** Write a structured incident to Supabase when Redis is unreachable — fire-and-forget. */
async function logRedisIncident(cronName: string, errorMsg: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    await supabaseAdmin.from('incidents').insert({
      tenant_id:        process.env.SYSTEM_ORG_ID ?? 'agency-group',
      severity:         'P1',
      subsystem:        'cache',
      raw_error:        `Redis unreachable for cron lock '${cronName}' after 3 retries: ${errorMsg}`,
      status:           'open',
      metrics_snapshot: { cron_name: cronName, error: errorMsg },
      detected_at:      new Date().toISOString(),
    })
  } catch {
    // Supabase also unavailable — log to console as last resort
    console.error(`[withCronLock] Redis AND Supabase unreachable for cron '${cronName}'`)
  }
}

/**
 * Attempt SET NX EX with exponential backoff on 429.
 * Returns:
 *   'OK'       — lock acquired
 *   null       — lock already held (key exists)
 *   'FAILED'   — Redis unreachable after all retries (caller should fail-open)
 */
async function upstashSet(
  key:    string,
  value:  string,
  ttlSec: number,
): Promise<string | null | 'FAILED'> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null   // not configured → caller treats as fail-open

  let attempt = 0
  const MAX_ATTEMPTS = 3

  while (attempt < MAX_ATTEMPTS) {
    try {
      // AbortSignal.timeout(5000): prevents infinite hang when Upstash is up but
      // extremely slow. Without this, a hanging fetch burns the entire cron budget
      // (up to maxDuration) before the lock is even acquired.
      const res = await fetch(
        `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?NX=true&EX=${ttlSec}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) },
      )

      if (res.status === 429) {
        // Rate-limited — backoff and retry
        const delayMs = Math.pow(2, attempt) * 200   // 200ms, 400ms, 800ms
        await new Promise(r => setTimeout(r, delayMs))
        attempt++
        continue
      }

      if (!res.ok) {
        console.warn(`[withCronLock] Upstash HTTP ${res.status} for key ${key}`)
        return 'FAILED'
      }

      const json = await res.json() as { result: string | null }
      return json.result   // "OK" if acquired, null if key already existed
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[withCronLock] Upstash fetch error (attempt ${attempt + 1}): ${msg}`)
      attempt++
    }
  }

  return 'FAILED'
}

async function upstashDel(key: string): Promise<void> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return

  try {
    await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(3_000),  // Best-effort — TTL will expire it anyway
    })
  } catch {
    // Best-effort release — TTL will expire it anyway
  }
}

/**
 * Execute a cron job body with a distributed lock.
 *
 * @param cronName   Unique name for this cron (used as Redis key suffix)
 * @param ttlMinutes Lock TTL in minutes (should be >= maxDuration + buffer)
 * @param fn         Async function to execute while holding the lock
 * @returns          Result of fn(), or null if the lock is already held
 */
export async function withCronLock<T>(
  cronName:   string,
  ttlMinutes: number,
  fn:         () => Promise<T>,
): Promise<T | null> {
  const key    = `${LOCK_KEY_PREFIX}${cronName}`
  const ttlSec = ttlMinutes * 60
  const lockId = crypto.randomUUID()

  const upstashConfigured =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN

  if (!upstashConfigured) {
    console.warn('[cronLock] Upstash not configured — running without distributed lock')
    return await fn()
  }

  const acquired = await upstashSet(key, lockId, ttlSec)

  if (acquired === 'FAILED') {
    // Redis unreachable after retries — fail-open so the cron still runs.
    // Log incident asynchronously — don't block the cron.
    void logRedisIncident(cronName, 'Upstash unreachable after 3 retries')
    console.warn(`[cronLock] Redis unreachable for '${cronName}' — running without lock (fail-open)`)
    return await fn()
  }

  if (acquired !== 'OK') {
    // Lock held by another instance — skip this invocation
    console.log(`[cronLock] ${cronName} already running — skipping this invocation`)
    return null
  }

  try {
    return await fn()
  } finally {
    await upstashDel(key)
  }
}
