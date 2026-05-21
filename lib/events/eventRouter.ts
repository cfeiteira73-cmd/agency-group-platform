// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Domain Event Router v1.0
// lib/events/eventRouter.ts
//
// Routes domain events to the correct Kafka topic using a structured
// DomainEvent envelope, then emits via kafkaClient (dual-write pattern).
//
// Topics:
//   property.*   — property.created / property.updated / property.ingested / property.priced
//   investor.*   — investor.bid_placed / investor.bid_updated / investor.profile_updated
//   capital.*    — capital.transaction_initiated / capital.escrow_funded / capital.settlement_advanced
//   execution.*  — execution.legal_signed / execution.notarial_complete / execution.asset_transferred
//   market.*     — market.mpi_updated / market.price_discovered / market.liquidity_graded
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { publishEvent } from './kafkaClient'

// ─── Topic definitions ────────────────────────────────────────────────────────

export type EventTopic =
  | 'property.created'
  | 'property.updated'
  | 'property.ingested'
  | 'property.priced'
  | 'investor.bid_placed'
  | 'investor.bid_updated'
  | 'investor.profile_updated'
  | 'capital.transaction_initiated'
  | 'capital.escrow_funded'
  | 'capital.settlement_advanced'
  | 'execution.legal_signed'
  | 'execution.notarial_complete'
  | 'execution.asset_transferred'
  | 'market.mpi_updated'
  | 'market.price_discovered'
  | 'market.liquidity_graded'

// ─── DomainEvent envelope ─────────────────────────────────────────────────────

export interface DomainEvent {
  /** Globally unique event ID (UUID v4) */
  event_id: string
  /** Topic this event was emitted to */
  topic: EventTopic
  /** Tenant identifier for multi-tenant isolation */
  tenant_id: string
  /** ID of the primary entity (property_id, investor_id, transaction_id …) */
  entity_id: string
  /** Type discriminator for the entity */
  entity_type: string
  /** Domain-specific payload — any shape */
  payload: Record<string, unknown>
  /** Optional distributed tracing correlation ID */
  correlation_id?: string
  /** ISO timestamp when the event was emitted */
  emitted_at: string
  /** Schema version for replay compatibility */
  schema_version: string
}

// ─── emitEvent ────────────────────────────────────────────────────────────────

/**
 * Builds a DomainEvent envelope and publishes it via kafkaClient (dual-write).
 * Fire-and-forget internally — never throws to callers.
 *
 * @param tenantId      Tenant to scope this event
 * @param topic         EventTopic (e.g. 'property.created')
 * @param entityId      ID of the primary entity
 * @param entityType    Entity type string (e.g. 'property', 'investor')
 * @param payload       Domain-specific data
 * @param correlationId Optional tracing correlation ID
 */
export async function emitEvent(
  tenantId: string,
  topic: EventTopic,
  entityId: string,
  entityType: string,
  payload: Record<string, unknown>,
  correlationId?: string,
): Promise<void> {
  try {
    const event: DomainEvent = {
      event_id:       randomUUID(),
      topic,
      tenant_id:      tenantId,
      entity_id:      entityId,
      entity_type:    entityType,
      payload,
      correlation_id: correlationId,
      emitted_at:     new Date().toISOString(),
      schema_version: '1.0',
    }

    void publishEvent({
      topic,
      key:   entityId,
      value: event as unknown as Record<string, unknown>,
      headers: {
        'event-topic':    topic,
        'tenant-id':      tenantId,
        'entity-type':    entityType,
        'schema-version': '1.0',
        ...(correlationId ? { 'correlation-id': correlationId } : {}),
      },
    }).catch(e =>
      log.warn('[eventRouter] publishEvent error', {
        topic,
        entity_id: entityId,
        error:     e instanceof Error ? e.message : String(e),
      })
    )
  } catch (err) {
    log.warn('[eventRouter] emitEvent error', {
      topic,
      entity_id: entityId,
      error:     err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── getEventHistory ──────────────────────────────────────────────────────────

/**
 * Queries the kafka_event_log Supabase table for events matching the given
 * filters. Returns events sorted by emitted_at ASC.
 */
export async function getEventHistory(
  tenantId: string,
  opts?: {
    topic?: EventTopic
    entity_id?: string
    from?: string
    limit?: number
  },
): Promise<DomainEvent[]> {
  try {
    const limit = Math.min(opts?.limit ?? 100, 1000)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('event_id, topic, tenant_id, entity_id, entity_type, payload, correlation_id, schema_version, emitted_at')
      .eq('tenant_id', tenantId)
      .order('emitted_at', { ascending: true })
      .limit(limit)

    if (opts?.topic)     query = query.eq('topic', opts.topic)
    if (opts?.entity_id) query = query.eq('entity_id', opts.entity_id)
    if (opts?.from)      query = query.gte('emitted_at', opts.from)

    const { data, error } = await query as {
      data:  Array<Record<string, unknown>> | null
      error: { message: string } | null
    }

    if (error) {
      log.warn('[eventRouter] getEventHistory query failed', {
        tenant_id: tenantId,
        error:     error.message,
      })
      return []
    }

    return (data ?? []).map(row => ({
      event_id:       String(row['event_id'] ?? ''),
      topic:          (row['topic'] as EventTopic),
      tenant_id:      String(row['tenant_id'] ?? tenantId),
      entity_id:      String(row['entity_id'] ?? ''),
      entity_type:    String(row['entity_type'] ?? ''),
      payload:        (row['payload'] as Record<string, unknown>) ?? {},
      correlation_id: row['correlation_id'] != null ? String(row['correlation_id']) : undefined,
      emitted_at:     String(row['emitted_at'] ?? new Date().toISOString()),
      schema_version: String(row['schema_version'] ?? '1.0'),
    }))
  } catch (err) {
    log.warn('[eventRouter] getEventHistory error', {
      tenant_id: tenantId,
      error:     err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
