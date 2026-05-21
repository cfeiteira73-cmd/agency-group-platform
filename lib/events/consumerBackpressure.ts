// =============================================================================
// Agency Group — Consumer Backpressure Controller
// lib/events/consumerBackpressure.ts
//
// Broker-level backpressure: tracks in-flight messages and consumer lag per
// topic, pauses processing when thresholds are breached, and persists metrics
// to Supabase for observability.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface BackpressureConfig {
  /** Pause consumption when lag exceeds this. Default: 50 000 */
  maxLagThreshold: number
  /** Resume consumption when lag drops below this. Default: 10 000 */
  resumeLagThreshold: number
  /** Maximum number of in-flight messages before pausing. Default: 100 */
  maxConcurrentMessages: number
  /** How long to wait per pause-retry iteration (ms). Default: 5 000 */
  pauseDurationMs: number
}

interface TopicState {
  inFlight:     number
  lag:          number
  paused:       boolean
  pauseCount:   number
  pausedAt:     Date | null
  lastLagCheck: Date
  groupId:      string
}

// ─── ConsumerBackpressure class ───────────────────────────────────────────────

export class ConsumerBackpressure {
  private readonly config: Required<BackpressureConfig>
  // Key = `${topic}:${groupId}` for lag tracking; in-flight is topic-only
  private readonly state: Map<string, TopicState>

  constructor(config?: Partial<BackpressureConfig>) {
    this.config = {
      maxLagThreshold:      config?.maxLagThreshold      ?? 50_000,
      resumeLagThreshold:   config?.resumeLagThreshold    ?? 10_000,
      maxConcurrentMessages: config?.maxConcurrentMessages ?? 100,
      pauseDurationMs:      config?.pauseDurationMs       ?? 5_000,
    }
    this.state = new Map()
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private stateKey(topic: string, groupId = ''): string {
    return `${topic}:${groupId}`
  }

  private getOrCreate(topic: string, groupId = ''): TopicState {
    const key = this.stateKey(topic, groupId)
    let entry = this.state.get(key)
    if (!entry) {
      entry = {
        inFlight:     0,
        lag:          0,
        paused:       false,
        pauseCount:   0,
        pausedAt:     null,
        lastLagCheck: new Date(),
        groupId,
      }
      this.state.set(key, entry)
    }
    return entry
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Acquires a processing slot for the given topic/partition.
   * If backpressure is active, sleeps up to 10 × pauseDurationMs before
   * proceeding regardless (best-effort — consumer must not deadlock).
   */
  async acquireSlot(topic: string, partition: number): Promise<void> {
    // Ensure state entry exists (group-agnostic for in-flight tracking)
    const entry = this.getOrCreate(topic)

    if (this.shouldPause(topic)) {
      log.warn('[consumerBackpressure] backpressure active — pausing slot acquisition', {
        topic,
        partition,
        inFlight: entry.inFlight,
        lag:      entry.lag,
      })

      if (!entry.paused) {
        entry.paused    = true
        entry.pausedAt  = new Date()
        entry.pauseCount += 1
      }

      for (let i = 0; i < 10; i++) {
        await new Promise<void>((r) => setTimeout(r, this.config.pauseDurationMs))
        if (!this.shouldPause(topic)) break
      }
    }

    entry.inFlight += 1
  }

  /**
   * Releases a previously acquired slot for the given topic/partition.
   * In-flight count is clamped to 0.
   */
  releaseSlot(topic: string, _partition: number): void {
    const entry = this.getOrCreate(topic)
    entry.inFlight = Math.max(0, entry.inFlight - 1)
  }

  /**
   * Updates the consumer lag for a specific topic+groupId pair.
   * Automatically clears the paused flag when lag drops below the resume
   * threshold.
   */
  updateLag(topic: string, groupId: string, lag: number): void {
    const entry          = this.getOrCreate(topic, groupId)
    entry.lag            = lag
    entry.lastLagCheck   = new Date()

    if (lag < this.config.resumeLagThreshold) {
      if (entry.paused) {
        log.info('[consumerBackpressure] lag below resume threshold — resuming', {
          topic, groupId, lag,
        })
      }
      entry.paused   = false
      entry.pausedAt = null
    }

    // Mirror lag onto the topic-level (group-agnostic) entry too
    const topicEntry = this.getOrCreate(topic)
    topicEntry.lag   = lag
  }

  /**
   * Returns true if any state entry for this topic exceeds the concurrent
   * message or lag thresholds.
   */
  shouldPause(topic: string): boolean {
    for (const [key, entry] of this.state.entries()) {
      if (!key.startsWith(`${topic}:`)) continue
      if (entry.inFlight >= this.config.maxConcurrentMessages) return true
      if (entry.lag > this.config.maxLagThreshold)              return true
    }
    return false
  }

  /**
   * Returns a serializable snapshot of state for a specific topic+groupId.
   */
  getState(topic: string, groupId: string): {
    topic:               string
    groupId:             string
    current_lag:         number
    is_paused:           boolean
    paused_at:           string | null
    messages_in_flight:  number
    pause_count:         number
    last_lag_check:      string
  } {
    const entry = this.getOrCreate(topic, groupId)
    return {
      topic,
      groupId,
      current_lag:        entry.lag,
      is_paused:          entry.paused,
      paused_at:          entry.pausedAt?.toISOString() ?? null,
      messages_in_flight: entry.inFlight,
      pause_count:        entry.pauseCount,
      last_lag_check:     entry.lastLagCheck.toISOString(),
    }
  }

  /**
   * Persists all tracked states to `consumer_backpressure_metrics` via upsert.
   * Uses (tenant_id, topic, group_id) as the conflict target.
   */
  async persistMetrics(tenantId: string): Promise<void> {
    const rows: {
      tenant_id:          string
      topic:              string
      group_id:           string
      current_lag:        number
      is_paused:          boolean
      messages_in_flight: number
      pause_count:        number
      paused_at:          string | null
      recorded_at:        string
    }[] = []

    for (const [key, entry] of this.state.entries()) {
      // key = `${topic}:${groupId}` — split on first colon only
      const colonIdx = key.indexOf(':')
      const topic    = key.slice(0, colonIdx)
      const groupId  = key.slice(colonIdx + 1)

      rows.push({
        tenant_id:          tenantId,
        topic,
        group_id:           groupId,
        current_lag:        entry.lag,
        is_paused:          entry.paused,
        messages_in_flight: entry.inFlight,
        pause_count:        entry.pauseCount,
        paused_at:          entry.pausedAt?.toISOString() ?? null,
        recorded_at:        new Date().toISOString(),
      })
    }

    if (rows.length === 0) return

    const { error } = await (supabaseAdmin as any)
      .from('consumer_backpressure_metrics')
      .upsert(rows, { onConflict: 'tenant_id,topic,group_id' })

    if (error) {
      log.error('[consumerBackpressure] persistMetrics failed', error, { tenantId })
    } else {
      log.info('[consumerBackpressure] metrics persisted', {
        tenantId, rows: rows.length,
      })
    }
  }
}

// ─── Default singleton ────────────────────────────────────────────────────────

export const defaultBackpressure = new ConsumerBackpressure()
