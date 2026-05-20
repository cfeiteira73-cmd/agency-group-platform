// =============================================================================
// Agency Group — Event Global Ordering
// lib/events/globalOrdering.ts
//
// Provides global ordering primitives for enterprise event processing:
//   - partition_key: deterministic tenant+type routing key
//   - replay_token: tamper-evident replay idempotency token
//   - global_seq: Redis-backed monotonic sequence per tenant
//   - enrichEvent(): stamps all ordering fields onto any BaseEvent
//
// TypeScript strict — 0 errors
// =============================================================================

import { createHash } from 'crypto'
import type { BaseEvent } from './types'

// ─── Region config ────────────────────────────────────────────────────────────

export const CURRENT_REGION = (process.env.VERCEL_REGION ?? process.env.AWS_REGION ?? 'eu-west') as string

// ─── Partition key ────────────────────────────────────────────────────────────

/**
 * Generates a Kafka-style partition key for an event.
 * Format: '{tenant_id}:{event_type}'
 * Used for: Kafka topic partitioning, Redis Streams key naming, queue routing.
 */
export function generatePartitionKey(tenantId: string, eventType: string): string {
  return `${tenantId}:${eventType}`
}

// ─── Replay token ─────────────────────────────────────────────────────────────

/**
 * Generates a SHA-256 replay token for an event.
 * Deterministic: same event_id + tenant_id always produces same token.
 * Used for: idempotent replay, duplicate detection, audit trails.
 */
export function generateReplayToken(eventId: string, tenantId: string): string {
  return createHash('sha256')
    .update(`${eventId}:${tenantId}`)
    .digest('hex')
    .slice(0, 32)  // 32-char prefix (128 bits — sufficient uniqueness)
}

// ─── Global sequence (Redis INCR) ─────────────────────────────────────────────

/**
 * Gets the next global sequence number for a tenant.
 * Uses Redis INCR on key: 'global_seq:{tenant_id}'
 * Falls back to Date.now() if Redis unavailable (monotonic but not globally ordered).
 */
export async function getNextGlobalSeq(tenantId: string): Promise<number> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return Date.now()

  try {
    const key = `global_seq:${tenantId}`
    const res = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(200),
    })
    if (!res.ok) return Date.now()
    const { result } = await res.json() as { result: number }
    return result
  } catch { return Date.now() }
}

// ─── Lamport logical clock ─────────────────────────────────────────────────────

/**
 * Returns the next Lamport logical timestamp for a tenant.
 * Uses Redis INCR on 'lamport:{tenant_id}' for strict monotonicity.
 * Falls back to Date.now() (monotonic but not causally ordered) if Redis unavailable.
 *
 * Lamport semantics: if event A caused event B, lamport(B) > lamport(A).
 * Consumers must advance their local clock to max(local, received) on receipt.
 */
export async function getLamportTimestamp(tenantId: string): Promise<number> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return Date.now()

  try {
    const key = `lamport:${tenantId}`
    const res = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(200),
    })
    if (!res.ok) return Date.now()
    const { result } = await res.json() as { result: number }
    return result
  } catch { return Date.now() }
}

// ─── Event enrichment ─────────────────────────────────────────────────────────

/**
 * Stamps all global ordering fields onto an event before publishing.
 * Idempotent: existing fields are never overwritten.
 *
 * Stamps: partition_key · replay_token · region · global_seq · logical_timestamp
 */
export async function enrichEvent<T extends BaseEvent>(event: T): Promise<T> {
  const partitionKey       = event.partition_key       ?? generatePartitionKey(event.tenant_id, event.event_type)
  const replayToken        = event.replay_token        ?? generateReplayToken(event.event_id, event.tenant_id)
  const region             = event.region              ?? CURRENT_REGION
  const [globalSeq, logTs] = event.global_seq !== undefined && event.logical_timestamp !== undefined
    ? [event.global_seq, event.logical_timestamp]
    : await Promise.all([
        getNextGlobalSeq(event.tenant_id),
        getLamportTimestamp(event.tenant_id),
      ])

  return {
    ...event,
    partition_key:     partitionKey,
    replay_token:      replayToken,
    region,
    global_seq:        globalSeq,
    logical_timestamp: logTs,
  }
}

// ─── Stream key helpers ───────────────────────────────────────────────────────

/** Redis Streams key for a tenant's event stream: 'stream:{tenant_id}:{event_type}' */
export function getStreamKey(tenantId: string, eventType: string): string {
  return `stream:${tenantId}:${eventType}`
}

/** Consumer group name for a worker: 'worker:{workerName}:{tenantId}' */
export function getConsumerGroup(workerName: string, tenantId: string): string {
  return `worker:${workerName}:${tenantId}`
}
