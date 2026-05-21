// Agency Group — Deep Health Check
// lib/sre/healthCheck.ts
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import { detectConsumerLag } from '@/lib/events/lagDetector'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  ok: boolean
  latency_ms: number
  error?: string
}

export interface KafkaHealthStatus extends HealthStatus {
  lag_total?: number
}

export interface DeepHealthResult {
  healthy: boolean
  timestamp: string
  services: {
    database: HealthStatus
    redis: HealthStatus
    ai_provider: HealthStatus
    queue: HealthStatus
    event_bus: HealthStatus
    kafka: KafkaHealthStatus
  }
  degraded: string[]
  failed: string[]
  summary: 'healthy' | 'degraded' | 'critical'
}

// ─── Timeout race helper ──────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  const timer = new Promise<T>(resolve => setTimeout(() => resolve(fallback), timeoutMs))
  return Promise.race([promise, timer])
}

// ─── Individual service checks ────────────────────────────────────────────────

export async function checkDatabase(timeoutMs = 3000): Promise<HealthStatus> {
  const t0 = Date.now()
  try {
    const result = await withTimeout(
      (supabaseAdmin as any).from('organizations').select('id').limit(1),
      timeoutMs,
      { error: { message: 'timeout' }, data: null },
    )
    const latency_ms = Date.now() - t0
    if (result.error) {
      return { ok: false, latency_ms, error: result.error.message }
    }
    return { ok: true, latency_ms }
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function checkRedis(timeoutMs = 1000): Promise<HealthStatus> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return { ok: true, latency_ms: 0, error: 'redis not configured' }
  }

  const t0 = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${url}/get/health:canary`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      clearTimeout(timer)
      const latency_ms = Date.now() - t0
      if (!res.ok) {
        return { ok: false, latency_ms, error: `HTTP ${res.status}` }
      }
      return { ok: true, latency_ms }
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    const latency_ms = Date.now() - t0
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort') || msg.includes('signal')) {
      return { ok: false, latency_ms, error: 'timeout' }
    }
    return { ok: false, latency_ms, error: msg }
  }
}

export async function checkAiProvider(timeoutMs = 5000): Promise<HealthStatus> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: true, latency_ms: 0, error: 'ai not configured' }
  }

  const t0 = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch('https://api.anthropic.com', {
        method: 'HEAD',
        signal: controller.signal,
      })
      clearTimeout(timer)
      const latency_ms = Date.now() - t0
      // 4xx or 5xx means provider error (401 is acceptable — means reachable)
      if (res.status >= 500) {
        return { ok: false, latency_ms, error: `HTTP ${res.status}` }
      }
      return { ok: true, latency_ms }
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    const latency_ms = Date.now() - t0
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort') || msg.includes('signal')) {
      return { ok: false, latency_ms, error: 'timeout' }
    }
    return { ok: false, latency_ms, error: msg }
  }
}

export async function checkQueue(timeoutMs = 2000): Promise<HealthStatus> {
  const t0 = Date.now()
  try {
    const { getQueueAdapter } = await import('@/lib/queue/adapter')
    const adapter = getQueueAdapter()
    // QueueAdapter does not expose getStats — use getQueueDepth as a liveness probe
    if (typeof (adapter as any).getQueueDepth === 'function') {
      await withTimeout(
        (adapter as any).getQueueDepth('default'),
        timeoutMs,
        0,
      )
    }
    return { ok: true, latency_ms: Date.now() - t0 }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Queue check failed', latency_ms: Date.now() - t0 }
  }
}

export async function checkEventBus(_timeoutMs = 1000): Promise<HealthStatus> {
  const t0 = Date.now()
  try {
    const { eventBus } = await import('@/lib/events/bus')
    const ok = typeof (eventBus as any).publish === 'function'
    return { ok, latency_ms: Date.now() - t0 }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'EventBus check failed', latency_ms: Date.now() - t0 }
  }
}

export async function checkKafka(): Promise<KafkaHealthStatus> {
  if (!process.env.KAFKA_BROKERS) {
    return { ok: true, latency_ms: 0, error: 'not_configured' }
  }
  const t0 = Date.now()
  try {
    const groups = await detectConsumerLag()
    const lag_total = groups.reduce((sum, g) => sum + g.totalLag, 0)
    return { ok: true, latency_ms: Date.now() - t0, lag_total }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Kafka check failed',
      latency_ms: Date.now() - t0,
    }
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

const DEGRADED_THRESHOLDS: Record<string, number> = {
  database:   500,
  redis:      100,
  ai_provider: 2000,
  queue:      500,
  event_bus:  200,
  kafka:      3000,
}

export async function runDeepHealthCheck(_options?: Record<string, unknown>): Promise<DeepHealthResult> {
  const timestamp = new Date().toISOString()

  const timeoutFallback = (name: string, ms: number): HealthStatus => ({
    ok: false,
    latency_ms: ms,
    error: `${name} timeout`,
  })

  const [dbResult, redisResult, aiResult, queueResult, busResult, kafkaResult] = await Promise.allSettled([
    withTimeout(checkDatabase(3000),    3100, timeoutFallback('database', 3000)),
    withTimeout(checkRedis(1000),       1100, timeoutFallback('redis', 1000)),
    withTimeout(checkAiProvider(5000),  5100, timeoutFallback('ai_provider', 5000)),
    withTimeout(checkQueue(2000),       2100, timeoutFallback('queue', 2000)),
    withTimeout(checkEventBus(1000),    1100, timeoutFallback('event_bus', 1000)),
    withTimeout(checkKafka(),           8100, timeoutFallback('kafka', 8000)),
  ])

  const unwrap = (r: PromiseSettledResult<HealthStatus>, name: string): HealthStatus =>
    r.status === 'fulfilled' ? r.value : { ok: false, latency_ms: 0, error: `${name} check threw` }

  const services = {
    database:   unwrap(dbResult,    'database'),
    redis:      unwrap(redisResult, 'redis'),
    ai_provider: unwrap(aiResult,   'ai_provider'),
    queue:      unwrap(queueResult, 'queue'),
    event_bus:  unwrap(busResult,   'event_bus'),
    kafka:      unwrap(kafkaResult, 'kafka') as KafkaHealthStatus,
  }

  const failed: string[] = []
  const degraded: string[] = []

  for (const [name, status] of Object.entries(services) as [string, HealthStatus][]) {
    if (!status.ok) {
      failed.push(name)
    } else if (status.latency_ms > (DEGRADED_THRESHOLDS[name] ?? 1000)) {
      degraded.push(name)
    }
  }

  const summary: DeepHealthResult['summary'] =
    failed.length > 0 ? 'critical' :
    degraded.length > 0 ? 'degraded' :
    'healthy'

  return {
    healthy: summary === 'healthy',
    timestamp,
    services,
    degraded,
    failed,
    summary,
  }
}
