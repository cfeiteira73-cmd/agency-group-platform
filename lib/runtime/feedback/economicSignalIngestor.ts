// AGENCY GROUP — SH-ROS Feedback: Economic Signal Ingestor | AMI: 22506
// Ingests raw economic signals from deal outcomes, market data, and user behavior
// First stage of the Real Economic Feedback Loop pipeline
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalSource =
  | 'deal_closed'
  | 'deal_lost'
  | 'match_rejected'
  | 'match_accepted'
  | 'proposal_sent'
  | 'proposal_accepted'
  | 'time_to_close'
  | 'price_negotiation'
  | 'market_price_update'
  | 'agent_feedback'

export type SignalStrength = 'strong' | 'moderate' | 'weak'

export interface EconomicSignal {
  signal_id: string
  org_id: string
  source: SignalSource
  entity_type: 'deal' | 'match' | 'property' | 'contact'
  entity_id: string
  value: number           // normalized 0–1 or raw monetary value (context-dependent)
  raw_value: number       // unprocessed original value
  signal_strength: SignalStrength
  confidence: number      // 0–1 confidence in signal validity
  context: Record<string, unknown>
  ingested_at: string
}

export interface SignalBatch {
  batch_id: string
  org_id: string
  signals: EconomicSignal[]
  total_value: number     // sum of monetary signals
  avg_confidence: number
  ingested_at: string
}

export interface IngestionStats {
  org_id: string
  total_ingested: number
  by_source: Record<SignalSource, number>
  avg_confidence: number
  strong_signal_pct: number
  last_ingested_at: string | null
}

// ─── Signal Normalization Rules ───────────────────────────────────────────────

const SIGNAL_WEIGHTS: Record<SignalSource, number> = {
  deal_closed:         1.0,   // Strongest signal — ground truth
  deal_lost:           0.9,   // Strong negative signal
  proposal_accepted:   0.8,
  match_accepted:      0.7,
  proposal_sent:       0.5,
  price_negotiation:   0.6,
  time_to_close:       0.5,
  match_rejected:      0.6,
  market_price_update: 0.3,
  agent_feedback:      0.4,
}

// ─── Economic Signal Ingestor ─────────────────────────────────────────────────

export class EconomicSignalIngestor {
  private _buffer = new Map<string, EconomicSignal[]>()  // org_id → signals
  private _stats  = new Map<string, IngestionStats>()

  /**
   * Ingest a single economic signal.
   * Normalizes, validates, and buffers for downstream processing.
   */
  ingest(params: {
    org_id: string
    source: SignalSource
    entity_type: EconomicSignal['entity_type']
    entity_id: string
    raw_value: number
    context?: Record<string, unknown>
  }): EconomicSignal {
    const signal: EconomicSignal = {
      signal_id: randomUUID(),
      org_id: params.org_id,
      source: params.source,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      value: this._normalize(params.source, params.raw_value),
      raw_value: params.raw_value,
      signal_strength: this._classifyStrength(params.source, params.raw_value),
      confidence: this._estimateConfidence(params.source, params.context ?? {}),
      context: params.context ?? {},
      ingested_at: new Date().toISOString(),
    }

    // Buffer by org
    const existing = this._buffer.get(params.org_id) ?? []
    this._buffer.set(params.org_id, [...existing, signal])

    // Update stats
    this._updateStats(signal)

    logger.info('[EconomicSignal] Ingested', {
      signal_id: signal.signal_id,
      source: signal.source,
      strength: signal.signal_strength,
      confidence: signal.confidence.toFixed(2),
    })

    return signal
  }

  /**
   * Ingest multiple signals as a batch.
   * Used for deal closure events that emit multiple correlated signals.
   */
  ingestBatch(signals: Array<Parameters<EconomicSignalIngestor['ingest']>[0]>): SignalBatch {
    const ingested = signals.map(s => this.ingest(s))
    const org_id = ingested[0]?.org_id ?? 'unknown'

    const total_value = ingested
      .filter(s => ['deal_closed', 'deal_lost', 'proposal_accepted'].includes(s.source))
      .reduce((sum, s) => sum + s.raw_value, 0)

    const avg_confidence = ingested.length > 0
      ? ingested.reduce((s, sig) => s + sig.confidence, 0) / ingested.length
      : 0

    const batch: SignalBatch = {
      batch_id: randomUUID(),
      org_id,
      signals: ingested,
      total_value,
      avg_confidence,
      ingested_at: new Date().toISOString(),
    }

    logger.info('[EconomicSignal] Batch ingested', {
      batch_id: batch.batch_id,
      org_id,
      count: ingested.length,
      total_value,
      avg_confidence: avg_confidence.toFixed(2),
    })

    return batch
  }

  /**
   * Flush buffered signals to Supabase for persistence.
   * Called after downstream processing confirms consumption.
   */
  async flush(org_id: string): Promise<number> {
    const signals = this._buffer.get(org_id) ?? []
    if (signals.length === 0) return 0

    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    const rows = signals.map(s => ({
      event_type: `signal:${s.source}`,
      org_id: s.org_id,
      metadata: s as unknown as Record<string, unknown>,
      created_at: s.ingested_at,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from('learning_events') as any).insert(rows)
    if (error) {
      logger.error('[EconomicSignal] Flush failed', { org_id, error })
      return 0
    }

    this._buffer.delete(org_id)
    logger.info('[EconomicSignal] Flushed', { org_id, count: signals.length })
    return signals.length
  }

  /**
   * Drain buffered signals for an org — returns and clears.
   * Used by downstream stages to pull signals.
   */
  drain(org_id: string): EconomicSignal[] {
    const signals = this._buffer.get(org_id) ?? []
    this._buffer.delete(org_id)
    return signals
  }

  /**
   * Peek at buffered signals without consuming them.
   */
  peek(org_id: string): EconomicSignal[] {
    return this._buffer.get(org_id) ?? []
  }

  /**
   * Get ingestion stats for an org.
   */
  getStats(org_id: string): IngestionStats | null {
    return this._stats.get(org_id) ?? null
  }

  /**
   * Load historical signals from Supabase for backtesting.
   */
  async loadHistorical(org_id: string, since_ts: string): Promise<EconomicSignal[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('learning_events') as any)
      .select('metadata, created_at')
      .eq('org_id', org_id)
      .like('event_type', 'signal:%')
      .gte('created_at', since_ts)
      .order('created_at', { ascending: true })
      .limit(5_000)

    if (error || !data) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[])
      .map((row: { metadata: unknown }) => row.metadata as EconomicSignal)
      .filter(Boolean)
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _normalize(source: SignalSource, raw_value: number): number {
    // Normalize to 0–1 range based on signal type
    switch (source) {
      case 'deal_closed':
      case 'deal_lost':
      case 'proposal_accepted':
        // Deal values: normalize against €3M ceiling (Portugal luxury market)
        return Math.min(1, raw_value / 3_000_000)

      case 'match_accepted':
      case 'match_rejected':
        // Match scores are already 0–100 → normalize to 0–1
        return Math.min(1, Math.max(0, raw_value / 100))

      case 'time_to_close':
        // Days to close: normalize against 210-day benchmark (inversely — faster is better)
        return Math.min(1, Math.max(0, 1 - raw_value / 210))

      case 'price_negotiation':
        // Negotiation delta (% off asking): normalize 0–20% range
        return Math.min(1, Math.max(0, 1 - raw_value / 0.2))

      case 'market_price_update':
        // Price per m²: normalize against €5000 ceiling
        return Math.min(1, raw_value / 5_000)

      case 'agent_feedback':
      case 'proposal_sent':
        // Binary or percentage signals
        return Math.min(1, Math.max(0, raw_value))

      default:
        return Math.min(1, Math.max(0, raw_value))
    }
  }

  private _classifyStrength(source: SignalSource, raw_value: number): SignalStrength {
    const weight = SIGNAL_WEIGHTS[source] ?? 0.5
    if (weight >= 0.8 && raw_value > 0) return 'strong'
    if (weight >= 0.5) return 'moderate'
    return 'weak'
  }

  private _estimateConfidence(
    source: SignalSource,
    context: Record<string, unknown>
  ): number {
    let base = SIGNAL_WEIGHTS[source] ?? 0.5

    // Boost confidence if context is rich
    const context_keys = Object.keys(context).length
    if (context_keys >= 5) base = Math.min(1, base + 0.1)
    if (context_keys >= 10) base = Math.min(1, base + 0.05)

    // Reduce confidence for signals without a direct outcome
    if (source === 'agent_feedback') base *= 0.8
    if (source === 'market_price_update') base *= 0.7

    return Math.round(base * 100) / 100
  }

  private _updateStats(signal: EconomicSignal): void {
    const existing = this._stats.get(signal.org_id)

    if (!existing) {
      this._stats.set(signal.org_id, {
        org_id: signal.org_id,
        total_ingested: 1,
        by_source: { [signal.source]: 1 } as Record<SignalSource, number>,
        avg_confidence: signal.confidence,
        strong_signal_pct: signal.signal_strength === 'strong' ? 1 : 0,
        last_ingested_at: signal.ingested_at,
      })
      return
    }

    const total = existing.total_ingested + 1
    const by_source = {
      ...existing.by_source,
      [signal.source]: (existing.by_source[signal.source] ?? 0) + 1,
    } as Record<SignalSource, number>

    const strong_count = existing.strong_signal_pct * existing.total_ingested
      + (signal.signal_strength === 'strong' ? 1 : 0)

    this._stats.set(signal.org_id, {
      ...existing,
      total_ingested: total,
      by_source,
      avg_confidence: (existing.avg_confidence * existing.total_ingested + signal.confidence) / total,
      strong_signal_pct: strong_count / total,
      last_ingested_at: signal.ingested_at,
    })
  }
}

export const economicSignalIngestor = new EconomicSignalIngestor()
