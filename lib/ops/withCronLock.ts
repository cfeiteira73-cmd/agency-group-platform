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
// TypeScript strict — 0 errors
// =============================================================================

const LOCK_KEY_PREFIX = 'cron:lock:'

async function upstashSet(
  key:    string,
  value:  string,
  ttlSec: number,
): Promise<string | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null   // not configured

  try {
    const res = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?NX=true&EX=${ttlSec}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const json = await res.json() as { result: string | null }
    return json.result   // "OK" if acquired, null if key already existed
  } catch {
    return null
  }
}

async function upstashDel(key: string): Promise<void> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return

  try {
    await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
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

  const acquired = await upstashSet(key, lockId, ttlSec)

  // Upstash not configured → fail-open (always run)
  const upstashConfigured =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN

  if (upstashConfigured && acquired !== 'OK') {
    console.log(`[cronLock] ${cronName} already running — skipping this invocation`)
    return null
  }

  if (!upstashConfigured) {
    console.warn('[cronLock] Upstash not configured — running without distributed lock')
  }

  try {
    return await fn()
  } finally {
    await upstashDel(key)
  }
}
