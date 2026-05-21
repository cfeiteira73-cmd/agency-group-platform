// =============================================================================
// Agency Group — Revenue Event Consumer
// lib/events/consumers/revenueEventConsumer.ts
//
// Consumes 'revenue.recognized' events, emits structured logs, and alerts on
// major deals (amount_eur > 1_000_000).
// Extends IdempotentKafkaConsumer for at-most-once processing per message.
//
// TypeScript strict — 0 errors
// =============================================================================

import { IdempotentKafkaConsumer }       from '@/lib/events/idempotentConsumer'
import { type ConsumeResult }            from '@/lib/events/kafkaConsumerBase'
import { KAFKA_TOPICS, CONSUMER_GROUPS } from '@/lib/events/kafkaTopics'

// ─── Expected message shape for revenue.recognized ────────────────────────────

interface RevenueRecognizedPayload {
  deal_id:   string | null
  tenant_id: string
  amount_eur: number
}

function isRevenueRecognizedPayload(v: unknown): v is RevenueRecognizedPayload {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o['tenant_id']  === 'string' &&
    typeof o['amount_eur'] === 'number'
  )
}

// ─── Major-deal threshold ──────────────────────────────────────────────────────

const MAJOR_DEAL_THRESHOLD_EUR = 1_000_000

// ─── Consumer class ────────────────────────────────────────────────────────────

export class RevenueEventConsumer extends IdempotentKafkaConsumer {
  constructor() {
    super({
      groupId:  CONSUMER_GROUPS.REVENUE,
      topics:   [KAFKA_TOPICS.REVENUE_RECOGNIZED],
      fromBeginning: false,
      maxRetries: 5,
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
    if (!isRevenueRecognizedPayload(value)) {
      console.warn(
        `[RevenueEventConsumer] schema_invalid — ${topic}:${partition}:${offset}`,
        value,
      )
      return { success: false, retryable: false, error: 'schema_invalid: missing tenant_id or amount_eur' }
    }

    const { deal_id, tenant_id, amount_eur } = value

    // ── 2. Structured log of revenue recognition event ───────────────────────
    console.log(
      JSON.stringify({
        event:      'revenue.recognized',
        deal_id,
        tenant_id,
        amount_eur,
        topic,
        partition,
        offset,
        logged_at:  new Date().toISOString(),
      }),
    )

    // ── 3. Major-deal alert ──────────────────────────────────────────────────
    if (amount_eur > MAJOR_DEAL_THRESHOLD_EUR) {
      console.warn(
        `[RevenueEventConsumer] MAJOR DEAL ALERT — deal_id=${deal_id ?? 'n/a'} tenant=${tenant_id} amount_eur=${amount_eur}`,
      )
    }

    return { success: true, retryable: false }
  }
}
