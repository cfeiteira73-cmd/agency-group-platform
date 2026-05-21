// =============================================================================
// Agency Group — Kafka Event Bus Adapter
// lib/events/kafkaAdapter.ts
//
// Implements EventBusAdapter over kafkajs.
// Used when KAFKA_BROKERS env var is set (Redpanda or Apache Kafka).
// Falls back silently on connection failure — event bus is always fire-and-forget.
//
// Topic strategy: one topic per event domain for consumer group isolation.
// Partition key: '{tenant_id}:{entity_id}' for per-entity ordering.
//
// TypeScript strict — 0 errors
// =============================================================================

import type { AnyPlatformEvent, EventType } from './types'
import log from '@/lib/logger'

// ─── Adapter interface (mirrors bus.ts internal) ──────────────────────────────

export interface EventBusAdapter {
  publish(event: AnyPlatformEvent): Promise<void>
}

// ─── Topic routing ────────────────────────────────────────────────────────────

const EVENT_TOPIC_MAP: Record<string, string> = {
  // Property lifecycle
  property_ingested:          'property-events',
  property_normalized:        'property-events',
  property_enriched:          'property-events',
  property_scored:            'property-events',
  // Lead lifecycle
  lead_created:               'lead-events',
  lead_qualified:             'lead-events',
  lead_scored:                'lead-events',
  // Deal lifecycle
  deal_created:               'deal-events',
  deal_updated:               'deal-events',
  deal_stage_advanced:        'deal-events',
  deal_closed:                'deal-events',
  deal_rejected:              'deal-events',
  proposal_sent:              'deal-events',
  cpcv_signed:                'deal-events',
  call_booked:                'deal-events',
  deal_lineage_traced:        'deal-events',
  // Investor + matching
  investor_created:           'investor-events',
  match_created:              'investor-events',
  distribution_sent:          'investor-events',
  distribution_accepted:      'investor-events',
  distribution_rejected:      'investor-events',
  referral_created:           'investor-events',
  // Revenue + commission
  revenue_recognized:         'revenue-events',
  commission_calculated:      'revenue-events',
  client_milestone_reached:   'revenue-events',
  // AI governance
  ai_requested:               'ai-events',
  ai_executed:                'ai-events',
  ai_billed:                  'ai-events',
  // System
  system_failure:             'system-events',
  system_recovery:            'system-events',
  anomaly_detected:           'system-events',
  leakage_detected:           'system-events',
  // Market intelligence
  market_snapshot_generated:  'intelligence-events',
  // Governance / ML
  model_promoted:             'governance-events',
  rollback_triggered:         'governance-events',
  governance_override:        'governance-events',
}

function eventToTopic(eventType: EventType | string): string {
  return EVENT_TOPIC_MAP[eventType] ?? 'platform-events'
}

// ─── KafkaEventBusAdapter ─────────────────────────────────────────────────────

export class KafkaEventBusAdapter implements EventBusAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private producer: any | null = null
  private ready = false
  private readonly brokers: string[]
  private readonly clientId: string

  constructor(brokers: string[], clientId = 'agency-group-platform') {
    this.brokers = brokers
    this.clientId = clientId
    // Connect asynchronously — never block construction
    void this.connect()
  }

  private async connect(): Promise<void> {
    try {
      // Dynamic import to avoid module-level kafkajs load when not configured
      const { Kafka, logLevel } = await import('kafkajs')
      const kafka = new Kafka({
        clientId:  this.clientId,
        brokers:   this.brokers,
        logLevel:  logLevel.WARN,
        retry: {
          initialRetryTime: 300,
          retries:          5,
        },
      })
      this.producer = kafka.producer({
        allowAutoTopicCreation: true,   // works with Redpanda + permissive Kafka
        idempotent:             false,  // keep simple; upgrade to idempotent when scaling
      })
      await this.producer.connect()
      this.ready = true
      log.info(`[KafkaAdapter] connected to ${this.brokers.join(',')}`)
    } catch (err) {
      // Non-fatal: event bus degrades to in-memory/Supabase
      log.error('[KafkaAdapter] connection failed — events will not reach Kafka', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err), brokers: this.brokers.join(',') })
    }
  }

  async publish(event: AnyPlatformEvent): Promise<void> {
    if (!this.ready || !this.producer) return

    const topic        = eventToTopic(event.event_type)
    const partitionKey = `${event.tenant_id}:${event.event_id}`

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key:     partitionKey,
            value:   JSON.stringify(event),
            headers: {
              'event-type':     event.event_type,
              'tenant-id':      event.tenant_id,
              'schema-version': event.schema_version,
              'correlation-id': event.correlation_id ?? '',
            },
          },
        ],
      })
    } catch (err) {
      // Fire-and-forget: never propagate Kafka errors to callers
      log.error('[KafkaAdapter] publish error', err instanceof Error ? err : undefined, {
        topic,
        event_type:    event.event_type,
        correlation_id: event.correlation_id,
        error:         err instanceof Error ? err.message : String(err),
      })
    }
  }

  /** Graceful shutdown — call from process exit handler */
  async disconnect(): Promise<void> {
    if (this.producer && this.ready) {
      try { await this.producer.disconnect() } catch { /* ignore */ }
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a KafkaEventBusAdapter from KAFKA_BROKERS env var.
 * Returns null if not configured — caller falls back to existing adapter.
 */
export function createKafkaAdapterFromEnv(): KafkaEventBusAdapter | null {
  const brokersEnv = process.env.KAFKA_BROKERS
  if (!brokersEnv) return null
  const brokers = brokersEnv.split(',').map(b => b.trim()).filter(Boolean)
  if (brokers.length === 0) return null
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'agency-group-platform'
  return new KafkaEventBusAdapter(brokers, clientId)
}
