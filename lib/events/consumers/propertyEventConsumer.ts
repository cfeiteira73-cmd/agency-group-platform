// =============================================================================
// Agency Group — Property Event Consumer
// lib/events/consumers/propertyEventConsumer.ts
//
// Consumes 'property.scored' events and triggers demand score computation.
// Failures in the demand-score computation are non-blocking — the consumer
// continues processing regardless.
// Extends IdempotentKafkaConsumer for at-most-once processing per message.
//
// TypeScript strict — 0 errors
// =============================================================================

import { IdempotentKafkaConsumer }       from '@/lib/events/idempotentConsumer'
import { type ConsumeResult }            from '@/lib/events/kafkaConsumerBase'
import { KAFKA_TOPICS, CONSUMER_GROUPS } from '@/lib/events/kafkaTopics'
import { computePropertyDemandScore }    from '@/lib/investors/demandScoreEngine'

// ─── Expected message shape for property.scored ───────────────────────────────

interface PropertyScoredPayload {
  property_id: string
  tenant_id:   string
  score:       number
}

function isPropertyScoredPayload(v: unknown): v is PropertyScoredPayload {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o['property_id'] === 'string' &&
    typeof o['tenant_id']   === 'string' &&
    typeof o['score']       === 'number'
  )
}

// ─── Consumer class ────────────────────────────────────────────────────────────

export class PropertyEventConsumer extends IdempotentKafkaConsumer {
  constructor() {
    super({
      groupId:  CONSUMER_GROUPS.SCORING,
      topics:   [KAFKA_TOPICS.PROPERTY_SCORED],
      fromBeginning: false,
      maxRetries: 3,
    })
  }

  override async processUniqueMessage(
    topic:     string,
    partition: number,
    offset:    string,
    _key:      string | null,
    value:     unknown,
  ): Promise<ConsumeResult> {
    // ── 1. Schema validation ─────────────────────────────────────────────────
    if (!isPropertyScoredPayload(value)) {
      console.warn(
        `[PropertyEventConsumer] schema_invalid — ${topic}:${partition}:${offset}`,
        value,
      )
      return { success: false, retryable: false, error: 'schema_invalid: missing property_id, tenant_id, or score' }
    }

    const { property_id, tenant_id, score } = value

    // ── 2. Log property scoring completion ───────────────────────────────────
    console.log(
      `[PropertyEventConsumer] property.scored processed — property_id=${property_id} tenant=${tenant_id} score=${score}`,
    )

    // ── 3. Fire-and-forget: compute demand score update (non-blocking) ───────
    void computePropertyDemandScore(property_id, tenant_id).catch(err => {
      // Non-blocking: failures must not stop the consumer
      console.warn(
        `[PropertyEventConsumer] computePropertyDemandScore failed (property_id=${property_id}):`,
        err instanceof Error ? err.message : String(err),
      )
    })

    return { success: true, retryable: false }
  }
}
