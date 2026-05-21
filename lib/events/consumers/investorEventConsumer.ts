// =============================================================================
// Agency Group — Investor Event Consumer
// lib/events/consumers/investorEventConsumer.ts
//
// Consumes 'investor.matched' events and records engagement in the watchlist
// service for downstream investor analytics.
// Extends IdempotentKafkaConsumer for at-most-once processing per message.
//
// TypeScript strict — 0 errors
// =============================================================================

import { IdempotentKafkaConsumer }                  from '@/lib/events/idempotentConsumer'
import { type ConsumeResult }                       from '@/lib/events/kafkaConsumerBase'
import { KAFKA_DOMAIN_TOPICS, CONSUMER_GROUPS }     from '@/lib/events/kafkaTopics'
import { recordEngagement }                         from '@/lib/investors/watchlistService'

// ─── Expected message shape for investor_matched events on investor-events topic ─

interface InvestorMatchedPayload {
  event_type:   string
  investor_id:  string
  property_id:  string
  tenant_id:    string
  match_score:  number
}

function isInvestorMatchedPayload(v: unknown): v is InvestorMatchedPayload {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o['investor_id'] === 'string' &&
    typeof o['property_id'] === 'string' &&
    typeof o['tenant_id']   === 'string' &&
    typeof o['match_score'] === 'number'
  )
}

// ─── Consumer class ────────────────────────────────────────────────────────────

export class InvestorEventConsumer extends IdempotentKafkaConsumer {
  constructor() {
    super({
      groupId:  CONSUMER_GROUPS.MATCHING,
      // Subscribe to the domain topic that producers actually emit to
      topics:   [KAFKA_DOMAIN_TOPICS.INVESTOR_EVENTS],
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
    // ── 0. Filter: only process investor_matched / match_created events ───────
    if (
      !value ||
      typeof value !== 'object' ||
      !['investor_matched', 'investor.matched', 'match_created'].includes((value as Record<string, unknown>)['event_type'] as string)
    ) {
      return { success: true, retryable: false }
    }

    // ── 1. Schema validation ─────────────────────────────────────────────────
    if (!isInvestorMatchedPayload(value)) {
      console.warn(
        `[InvestorEventConsumer] schema_invalid — ${topic}:${partition}:${offset}`,
        value,
      )
      return { success: false, retryable: false, error: 'schema_invalid: missing investor_id, property_id, tenant_id, or match_score' }
    }

    const { investor_id, property_id, tenant_id, match_score } = value

    // ── 2. Record engagement in watchlist service ────────────────────────────
    try {
      await recordEngagement({
        tenantId:   tenant_id,
        investorId: investor_id,
        eventType:  'match_viewed',
        propertyId: property_id,
        matchScore: match_score,
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn(
        `[InvestorEventConsumer] recordEngagement failed (investor_id=${investor_id}): ${errMsg}`,
      )
      // Retryable: transient DB error — let Kafka retry delivery
      return { success: false, retryable: true, error: errMsg }
    }

    // ── 3. Log the match event ───────────────────────────────────────────────
    console.log(
      `[InvestorEventConsumer] investor.matched processed — investor_id=${investor_id} property_id=${property_id} tenant=${tenant_id} score=${match_score}`,
    )

    return { success: true, retryable: false }
  }
}
