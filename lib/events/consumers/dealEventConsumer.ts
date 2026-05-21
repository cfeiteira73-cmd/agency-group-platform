// =============================================================================
// Agency Group — Deal Event Consumer
// lib/events/consumers/dealEventConsumer.ts
//
// Consumes 'deal.closed' events and triggers ML feedback loop recording.
// Extends IdempotentKafkaConsumer for at-most-once processing per message.
//
// TypeScript strict — 0 errors
// =============================================================================

import { IdempotentKafkaConsumer } from '@/lib/events/idempotentConsumer'
import { type ConsumeResult }       from '@/lib/events/kafkaConsumerBase'
import { KAFKA_TOPICS, CONSUMER_GROUPS } from '@/lib/events/kafkaTopics'
import { recordDealOutcome }        from '@/lib/ml/feedbackLoop'

// ─── Expected message shape for deal.closed ───────────────────────────────────

interface DealClosedPayload {
  deal_id:        string
  tenant_id:      string
  deal_value_eur: number | null
  agent_email:    string | null
}

function isDealClosedPayload(v: unknown): v is DealClosedPayload {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o['deal_id']   === 'string' &&
    typeof o['tenant_id'] === 'string'
  )
}

// ─── Consumer class ────────────────────────────────────────────────────────────

export class DealEventConsumer extends IdempotentKafkaConsumer {
  constructor() {
    super({
      groupId:  CONSUMER_GROUPS.REVENUE,
      topics:   [KAFKA_TOPICS.DEAL_CLOSED],
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
    if (!isDealClosedPayload(value)) {
      console.warn(
        `[DealEventConsumer] schema_invalid — ${topic}:${partition}:${offset}`,
        value,
      )
      // Non-retryable: malformed messages go straight to DLQ
      return { success: false, retryable: false, error: 'schema_invalid: missing deal_id or tenant_id' }
    }

    const { deal_id, tenant_id, deal_value_eur, agent_email } = value

    // ── 2. Fire-and-forget: record deal outcome in ML feedback loop ──────────
    void recordDealOutcome({
      dealId:         deal_id,
      tenantId:       tenant_id,
      outcome:        'closed_won',
      dealValueEur:   deal_value_eur,
      daysInPipeline: null,
      agentEmail:     agent_email,
      closedAt:       new Date().toISOString(),
    }).catch(err => {
      // DB error: log but don't fail — offset already committed
      console.warn(
        `[DealEventConsumer] recordDealOutcome failed (deal_id=${deal_id}):`,
        err instanceof Error ? err.message : String(err),
      )
    })

    // ── 3. Log success ───────────────────────────────────────────────────────
    console.log(
      `[DealEventConsumer] deal.closed processed — deal_id=${deal_id} tenant=${tenant_id} value_eur=${deal_value_eur ?? 'n/a'}`,
    )

    return { success: true, retryable: false }
  }
}
