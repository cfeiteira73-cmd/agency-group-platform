// =============================================================================
// Agency Group — Kafka Topic Registry
// lib/events/kafkaTopics.ts
//
// Canonical topic names, partition/retention configs, consumer group IDs,
// partition key helper, and throughput estimates for the SH-ROS event bus.
//
// TypeScript strict — 0 errors
// =============================================================================

// ─── Topic name constants ─────────────────────────────────────────────────────

export const KAFKA_TOPICS = {
  // Property lifecycle
  PROPERTY_INGESTED:       'property.ingested',
  PROPERTY_NORMALIZED:     'property.normalized',
  PROPERTY_ENRICHED:       'property.enriched',
  PROPERTY_SCORED:         'property.scored',
  // Lead lifecycle
  LEAD_CREATED:            'lead.created',
  LEAD_QUALIFIED:          'lead.qualified',
  // Investor
  INVESTOR_CREATED:        'investor.created',
  INVESTOR_MATCHED:        'investor.matched',
  // Deal lifecycle
  DEAL_CREATED:            'deal.created',
  DEAL_UPDATED:            'deal.updated',
  DEAL_CLOSED:             'deal.closed',
  // Revenue
  REVENUE_RECOGNIZED:      'revenue.recognized',
  COMMISSION_CALCULATED:   'commission.calculated',
  // Market intelligence
  MARKET_SNAPSHOT:         'market.snapshot',
  // AI governance
  AI_REQUESTED:            'ai.requested',
  AI_EXECUTED:             'ai.executed',
  // System health
  SYSTEM_FAILURE:          'system.failure',
  SYSTEM_RECOVERY:         'system.recovery',
} as const

// ─── Domain-level topic names (match producer EVENT_TOPIC_MAP in kafkaAdapter.ts) ─
// Consumers MUST subscribe to these topics — they are what producers actually emit to.
// The dot-notation names above are per-event-type names used only in TOPIC_CONFIGS for
// Redpanda/Kafka configuration; producers route all events to domain-level topics.

export const KAFKA_DOMAIN_TOPICS = {
  DEAL_EVENTS:        'deal-events',
  REVENUE_EVENTS:     'revenue-events',
  PROPERTY_EVENTS:    'property-events',
  INVESTOR_EVENTS:    'investor-events',
  LEAD_EVENTS:        'lead-events',
  AI_EVENTS:          'ai-events',
  SYSTEM_EVENTS:      'system-events',
  GOVERNANCE_EVENTS:  'governance-events',
  INTELLIGENCE_EVENTS: 'intelligence-events',
  PLATFORM_EVENTS:    'platform-events',
} as const

export type KafkaDomainTopic = typeof KAFKA_DOMAIN_TOPICS[keyof typeof KAFKA_DOMAIN_TOPICS]

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS]

// ─── Per-topic configuration ──────────────────────────────────────────────────

export interface KafkaTopicConfig {
  name: KafkaTopic
  partitions: number
  replicationFactor: number
  retentionMs: number
  cleanupPolicy: 'delete' | 'compact'
}

// Retention constants (milliseconds)
const RETENTION_72H   =   259_200_000  // system topics
const RETENTION_168H  =   604_800_000  // revenue / deal topics  (7 days)
const RETENTION_336H  = 1_209_600_000  // lead / investor / AI   (14 days)
const RETENTION_720H  = 2_592_000_000  // property topics        (30 days)

export const TOPIC_CONFIGS: Record<KafkaTopic, KafkaTopicConfig> = {
  // ── Revenue / deal — 12 partitions, 168 h ──────────────────────────────────
  'deal.created': {
    name: 'deal.created', partitions: 12, replicationFactor: 3,
    retentionMs: RETENTION_168H, cleanupPolicy: 'delete',
  },
  'deal.updated': {
    name: 'deal.updated', partitions: 12, replicationFactor: 3,
    retentionMs: RETENTION_168H, cleanupPolicy: 'delete',
  },
  'deal.closed': {
    name: 'deal.closed', partitions: 12, replicationFactor: 3,
    retentionMs: RETENTION_168H, cleanupPolicy: 'delete',
  },
  'revenue.recognized': {
    name: 'revenue.recognized', partitions: 12, replicationFactor: 3,
    retentionMs: RETENTION_168H, cleanupPolicy: 'delete',
  },
  'commission.calculated': {
    name: 'commission.calculated', partitions: 12, replicationFactor: 3,
    retentionMs: RETENTION_168H, cleanupPolicy: 'delete',
  },
  // ── Property — 6 partitions, 720 h ────────────────────────────────────────
  'property.ingested': {
    name: 'property.ingested', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_720H, cleanupPolicy: 'delete',
  },
  'property.normalized': {
    name: 'property.normalized', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_720H, cleanupPolicy: 'delete',
  },
  'property.enriched': {
    name: 'property.enriched', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_720H, cleanupPolicy: 'delete',
  },
  'property.scored': {
    name: 'property.scored', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_720H, cleanupPolicy: 'delete',
  },
  // ── Lead / investor / market / AI — 6 partitions, 336 h ───────────────────
  'lead.created': {
    name: 'lead.created', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_336H, cleanupPolicy: 'delete',
  },
  'lead.qualified': {
    name: 'lead.qualified', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_336H, cleanupPolicy: 'delete',
  },
  'investor.created': {
    name: 'investor.created', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_336H, cleanupPolicy: 'delete',
  },
  'investor.matched': {
    name: 'investor.matched', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_336H, cleanupPolicy: 'delete',
  },
  'market.snapshot': {
    name: 'market.snapshot', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_336H, cleanupPolicy: 'delete',
  },
  'ai.requested': {
    name: 'ai.requested', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_336H, cleanupPolicy: 'delete',
  },
  'ai.executed': {
    name: 'ai.executed', partitions: 6, replicationFactor: 3,
    retentionMs: RETENTION_336H, cleanupPolicy: 'delete',
  },
  // ── System — 3 partitions, 72 h ───────────────────────────────────────────
  'system.failure': {
    name: 'system.failure', partitions: 3, replicationFactor: 3,
    retentionMs: RETENTION_72H, cleanupPolicy: 'delete',
  },
  'system.recovery': {
    name: 'system.recovery', partitions: 3, replicationFactor: 3,
    retentionMs: RETENTION_72H, cleanupPolicy: 'delete',
  },
}

// ─── Consumer group IDs ───────────────────────────────────────────────────────

export const CONSUMER_GROUPS = {
  INGESTION:     'ingestion-consumers',
  SCORING:       'scoring-consumers',
  MATCHING:      'matching-consumers',
  REVENUE:       'revenue-consumers',
  PROJECTION:    'projection-consumers',
  OBSERVABILITY: 'observability-consumers',
} as const

export type ConsumerGroup = typeof CONSUMER_GROUPS[keyof typeof CONSUMER_GROUPS]

// ─── Partition key helper ─────────────────────────────────────────────────────

/**
 * Builds a stable partition key that colocates all events for the same entity
 * within a tenant on the same partition, enabling per-entity ordered processing.
 *
 * Format: '{tenantId}:{entityId}'
 */
export function getPartitionKey(tenantId: string, entityId: string): string {
  return `${tenantId}:${entityId}`
}

// ─── Throughput estimates (documentation object) ──────────────────────────────

/**
 * Conservative daily throughput estimates for capacity planning.
 * Used to size consumer thread pools and Redpanda storage projections.
 */
export const THROUGHPUT_ESTIMATES = {
  'property.ingested':  { msg_per_day: 500,  peak_msg_per_sec: 2   },
  'lead.created':       { msg_per_day: 2000, peak_msg_per_sec: 5   },
  'deal.updated':       { msg_per_day: 300,  peak_msg_per_sec: 1   },
  'revenue.recognized': { msg_per_day: 50,   peak_msg_per_sec: 0.5 },
  'market.snapshot':    { msg_per_day: 5,    peak_msg_per_sec: 0.1 },
  'system.failure':     { msg_per_day: 20,   peak_msg_per_sec: 1   },
} as const
