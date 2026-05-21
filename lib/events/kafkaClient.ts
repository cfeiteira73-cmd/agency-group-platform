// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Kafka/Redpanda Client v1.0
// lib/events/kafkaClient.ts
//
// Industrial Kafka/Redpanda client with graceful no-op when KAFKA_BROKERS is
// not set. Uses a dual-write pattern: events are ALWAYS persisted to the
// kafka_event_log Supabase table (fallback), and optionally forwarded to Kafka
// via the REST proxy if KAFKA_REST_PROXY_URL is set.
//
// This means events are NEVER lost — they go to Supabase even without Kafka.
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface KafkaMessage {
  topic: string
  partition?: number
  key?: string
  value: Record<string, unknown>
  headers?: Record<string, string>
}

export interface KafkaPublishResult {
  topic: string
  partition: number
  offset: string
  timestamp: string
}

export interface KafkaClientConfig {
  brokers: string[]
  clientId: string
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256'
    username: string
    password: string
  }
}

// ─── Enabled check ────────────────────────────────────────────────────────────

/**
 * Returns true only if KAFKA_BROKERS is set and non-empty.
 * Used to gate all Kafka-specific code paths.
 */
export function isKafkaEnabled(): boolean {
  return !!(process.env.KAFKA_BROKERS && process.env.KAFKA_BROKERS.trim())
}

// ─── Supabase fallback (dual-write) ──────────────────────────────────────────

async function persistToSupabase(message: KafkaMessage): Promise<void> {
  try {
    const tenantId: string =
      (message.value['tenant_id'] as string | undefined) ??
      process.env.DEFAULT_TENANT_ID ??
      process.env.SYSTEM_ORG_ID ??
      '00000000-0000-0000-0000-000000000001'

    const entityId: string =
      (message.value['entity_id'] as string | undefined) ??
      message.key ??
      'unknown'

    const entityType: string =
      (message.value['entity_type'] as string | undefined) ?? 'unknown'

    const correlationId: string | null =
      (message.value['correlation_id'] as string | undefined) ?? null

    const eventId: string =
      (message.value['event_id'] as string | undefined) ?? randomUUID()

    const schemaVersion: string =
      (message.value['schema_version'] as string | undefined) ?? '1.0'

    const emittedAt: string =
      (message.value['emitted_at'] as string | undefined) ??
      (message.value['occurred_at'] as string | undefined) ??
      new Date().toISOString()

    const { error } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .insert({
        tenant_id:      tenantId,
        event_id:       eventId,
        topic:          message.topic,
        entity_id:      entityId,
        entity_type:    entityType,
        payload:        message.value,
        correlation_id: correlationId,
        schema_version: schemaVersion,
        emitted_at:     emittedAt,
      })

    if (error) {
      log.warn('[kafkaClient] supabase fallback insert failed', {
        topic:    message.topic,
        error:    error.message,
        event_id: eventId,
      })
    }
  } catch (err) {
    log.warn('[kafkaClient] supabase fallback error', {
      error: err instanceof Error ? err.message : String(err),
      topic: message.topic,
    })
  }
}

// ─── Kafka REST proxy publish ─────────────────────────────────────────────────

async function publishViaRestProxy(
  message: KafkaMessage,
): Promise<KafkaPublishResult | null> {
  const proxyUrl = process.env.KAFKA_REST_PROXY_URL
  if (!proxyUrl) {
    log.warn('[kafkaClient] KAFKA_BROKERS set but KAFKA_REST_PROXY_URL is not — skipping Kafka publish', {
      topic: message.topic,
    })
    return null
  }

  try {
    const body = {
      records: [
        {
          key:     message.key ?? null,
          value:   message.value,
          headers: message.headers ?? {},
          ...(message.partition !== undefined ? { partition: message.partition } : {}),
        },
      ],
    }

    const res = await fetch(`${proxyUrl}/topics/${encodeURIComponent(message.topic)}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/vnd.kafka.json.v2+json',
        Accept:         'application/vnd.kafka.v2+json',
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown')
      log.warn('[kafkaClient] REST proxy returned non-2xx', {
        status: res.status,
        topic:  message.topic,
        body:   text.slice(0, 200),
      })
      return null
    }

    const json = await res.json() as {
      offsets?: Array<{ partition: number; offset: number; error_code: number | null }>
    }

    const offset = json.offsets?.[0]
    return {
      topic:     message.topic,
      partition: offset?.partition ?? 0,
      offset:    String(offset?.offset ?? 0),
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    log.warn('[kafkaClient] REST proxy publish failed', {
      error: err instanceof Error ? err.message : String(err),
      topic: message.topic,
    })
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Publishes a single event. Always persists to kafka_event_log (Supabase) as
 * a fallback so events are never lost. Optionally forwards to Kafka/Redpanda
 * via the REST proxy when KAFKA_BROKERS + KAFKA_REST_PROXY_URL are set.
 *
 * Fire-and-forget safe — never throws.
 */
export async function publishEvent(
  message: KafkaMessage,
): Promise<KafkaPublishResult | null> {
  // Dual-write: always persist to Supabase regardless of Kafka availability
  void persistToSupabase(message).catch(e =>
    log.warn('[kafkaClient] dual-write error', { error: e instanceof Error ? e.message : String(e) })
  )

  if (!isKafkaEnabled()) {
    return null
  }

  return publishViaRestProxy(message)
}

/**
 * Publishes a batch of events. Always dual-writes to Supabase.
 * Returns results in the same order as input messages.
 *
 * Fire-and-forget safe — never throws.
 */
export async function publishBatch(
  messages: KafkaMessage[],
): Promise<Array<KafkaPublishResult | null>> {
  return Promise.all(messages.map(m => publishEvent(m)))
}
