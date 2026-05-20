// AGENCY GROUP — SH-ROS Observability: correlationEngine | AMI: 22506
//
// Correlation chains and contexts are backed by Redis (Upstash REST) with a
// 300-second TTL so they survive across serverless cold starts within the same
// workflow window.  In-memory Maps serve as a write-through cache for the
// duration of a single invocation.  On cold start, warmFromRedis() restores
// state for a given correlation ID before any operations proceed.
//
// Fail-open: if Redis is unavailable, in-memory Maps are used exclusively
// (same behaviour as before this change) — no errors are thrown.
//
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import { tracingProvider } from './tracingProvider'

export interface CorrelatedContext {
  correlation_id: string
  trace_id: string
  span_id: string
  org_id: string
  parent_correlation_id?: string
  depth: number
  timestamp: string
}

export interface CorrelationLink {
  parent: string
  child: string
  type: string
  timestamp: string
}

export interface CorrelationChain {
  root_id: string
  links: CorrelationLink[]
  depth: number
}

// ─── Redis helpers (Upstash REST — same pattern as incidentCache.ts) ──────────

interface RedisConfig { url: string; token: string }

function getRedisConfig(): RedisConfig | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return
  try {
    await fetch(
      `${cfg.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?ex=${ttlSeconds}`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(500),
      },
    )
  } catch {
    // fail-open: ignore Redis write errors
  }
}

async function redisGet(key: string): Promise<string | null> {
  const cfg = getRedisConfig()
  if (!cfg) return null
  try {
    const res = await fetch(
      `${cfg.url}/get/${encodeURIComponent(key)}`,
      {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(500),
      },
    )
    if (!res.ok) return null
    const body = await res.json() as { result: string | null }
    return body.result
  } catch {
    return null
  }
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

const CORRELATION_TTL = 300 // 5 minutes — enough to correlate events in one workflow

function chainKey(correlationId: string): string {
  return `correlation:chain:${correlationId}`
}

function ctxKey(correlationId: string): string {
  return `correlation:ctx:${correlationId}`
}

// ─── CorrelationEngine ────────────────────────────────────────────────────────

export class CorrelationEngine {
  /** Write-through in-memory cache for the current invocation */
  private readonly _chains: Map<string, CorrelationLink[]> = new Map()
  private readonly _contexts: Map<string, CorrelatedContext> = new Map()

  generate(): string {
    return crypto.randomUUID()
  }

  /**
   * Warm in-memory state from Redis for a given correlationId.
   * Call this at the start of any operation where the ID may have been created
   * in a previous serverless invocation (i.e., cross-request correlation).
   * Safe to call even when the key is absent — it simply returns without effect.
   */
  async warmFromRedis(correlationId: string): Promise<void> {
    if (!this._contexts.has(correlationId)) {
      const rawCtx = await redisGet(ctxKey(correlationId))
      if (rawCtx) {
        try {
          const ctx = JSON.parse(rawCtx) as CorrelatedContext
          this._contexts.set(correlationId, ctx)
        } catch {
          // corrupted — ignore
        }
      }
    }

    if (!this._chains.has(correlationId)) {
      const rawChain = await redisGet(chainKey(correlationId))
      if (rawChain) {
        try {
          const links = JSON.parse(rawChain) as CorrelationLink[]
          this._chains.set(correlationId, links)
        } catch {
          // corrupted — ignore
        }
      }
    }
  }

  async enrich(event: { correlation_id: string; org_id: string; [k: string]: unknown }): Promise<CorrelatedContext> {
    // Warm from Redis on cold start before enriching
    await this.warmFromRedis(event.correlation_id)

    const activeTraceId = tracingProvider.getActiveTraceId()
    const traceId = activeTraceId ?? crypto.randomUUID().replace(/-/g, '')
    const spanId = crypto.randomUUID().replace(/-/g, '').slice(0, 16)

    const ctx: CorrelatedContext = {
      correlation_id: event.correlation_id,
      trace_id: traceId,
      span_id: spanId,
      org_id: event.org_id,
      parent_correlation_id: undefined,
      depth: 0,
      timestamp: new Date().toISOString(),
    }

    this._contexts.set(event.correlation_id, ctx)
    // Fire-and-forget Redis write (best-effort)
    void redisSet(ctxKey(event.correlation_id), JSON.stringify(ctx), CORRELATION_TTL)
    return ctx
  }

  async propagate(context: CorrelatedContext, child_type: string): Promise<CorrelatedContext> {
    const child_id = this.generate()
    const child: CorrelatedContext = {
      correlation_id: child_id,
      trace_id: context.trace_id,
      span_id: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      org_id: context.org_id,
      parent_correlation_id: context.correlation_id,
      depth: context.depth + 1,
      timestamp: new Date().toISOString(),
    }

    this._contexts.set(child_id, child)
    // Fire-and-forget Redis write
    void redisSet(ctxKey(child_id), JSON.stringify(child), CORRELATION_TTL)

    await this.link(context.correlation_id, child_id, child_type)
    return child
  }

  async link(parent_id: string, child_id: string, type: string): Promise<void> {
    // Warm parent chain from Redis on cold start before appending
    await this.warmFromRedis(parent_id)

    const entry: CorrelationLink = {
      parent: parent_id,
      child: child_id,
      type,
      timestamp: new Date().toISOString(),
    }

    const existing = this._chains.get(parent_id) ?? []
    const updated  = [...existing, entry]
    this._chains.set(parent_id, updated)
    // Fire-and-forget Redis write
    void redisSet(chainKey(parent_id), JSON.stringify(updated), CORRELATION_TTL)
  }

  async getChain(correlation_id: string): Promise<CorrelationChain> {
    // Warm the requested ID from Redis before walking the tree
    await this.warmFromRedis(correlation_id)

    // Walk up to find root
    let root_id = correlation_id
    const visited = new Set<string>()

    while (true) {
      if (visited.has(root_id)) break
      visited.add(root_id)
      const ctx = this._contexts.get(root_id)
      if (!ctx?.parent_correlation_id) break
      const parent = ctx.parent_correlation_id
      // Warm parent from Redis if needed
      await this.warmFromRedis(parent)
      root_id = parent
    }

    // Collect all links under root
    const allLinks: CorrelationLink[] = []
    const queue = [root_id]
    const seen  = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()!
      if (seen.has(current)) continue
      seen.add(current)

      await this.warmFromRedis(current)
      const links = this._chains.get(current) ?? []
      allLinks.push(...links)
      for (const l of links) {
        queue.push(l.child)
      }
    }

    return {
      root_id,
      links: allLinks,
      depth: allLinks.length > 0 ? Math.max(...allLinks.map((_, i) => i + 1)) : 0,
    }
  }

  async flush(correlation_id: string): Promise<void> {
    // Warm from Redis so flush works even on a fresh invocation
    await this.warmFromRedis(correlation_id)

    const ctx = this._contexts.get(correlation_id)
    if (!ctx) return

    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type: 'correlation_chain',
        org_id: ctx.org_id,
        correlation_id: ctx.correlation_id,
        metadata: {
          trace_id: ctx.trace_id,
          span_id: ctx.span_id,
          parent_correlation_id: ctx.parent_correlation_id,
          depth: ctx.depth,
          chain: await this.getChain(correlation_id),
        },
        created_at: ctx.timestamp,
      })
    } catch (err) {
      console.warn('[CorrelationEngine] flush error:', err)
    }
  }
}

export const correlationEngine = new CorrelationEngine()
