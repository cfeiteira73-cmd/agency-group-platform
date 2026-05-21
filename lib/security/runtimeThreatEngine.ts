// Agency Group — Runtime Threat Engine
// lib/security/runtimeThreatEngine.ts
// TypeScript strict — 0 errors
//
// Behavioral threat detection using pattern matching on recent events.
// All detection is measurement-based — NO external calls, NO simulation.
// Detects: impossible_travel, capital_anomaly, replay_abuse, tenant_scraping, ransomware_pattern

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ThreatType =
  | 'impossible_travel'
  | 'unusual_capital_movement'
  | 'abnormal_replay_volume'
  | 'tenant_data_scraping'
  | 'ransomware_pattern'
  | 'privilege_escalation'
  | 'credential_stuffing'

export interface ThreatSignal {
  signal_id: string
  tenant_id: string
  threat_type: ThreatType
  severity: 'low' | 'medium' | 'high' | 'critical'
  actor_id: string | null
  evidence: Record<string, unknown>
  confidence: number     // 0–100
  detected_at: string
  acknowledged: boolean
  response_actions: string[]
}

export interface ThreatScanResult {
  scan_id: string
  tenant_id: string
  signals_detected: ThreatSignal[]
  highest_severity: 'none' | 'low' | 'medium' | 'high' | 'critical'
  scan_duration_ms: number
  scanned_at: string
}

// ─── Persist signal ────────────────────────────────────────────────────────────

async function persistSignal(signal: ThreatSignal): Promise<void> {
  void (supabaseAdmin as any)
    .from('threat_signals')
    .insert({
      id:               signal.signal_id,
      tenant_id:        signal.tenant_id,
      threat_type:      signal.threat_type,
      severity:         signal.severity,
      actor_id:         signal.actor_id,
      evidence:         signal.evidence,
      confidence:       signal.confidence,
      acknowledged:     signal.acknowledged,
      response_actions: signal.response_actions,
      detected_at:      signal.detected_at,
    })
    .catch((e: unknown) =>
      log.warn('[runtimeThreatEngine] persistSignal failed', {
        signal_id: signal.signal_id,
        error: e instanceof Error ? e.message : String(e),
      }),
    )
}

// ─── detectImpossibleTravel ────────────────────────────────────────────────────

export async function detectImpossibleTravel(tenantId: string): Promise<ThreatSignal[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('access_decisions_log')
      .select('actor_id, evaluated_at, reason')
      .eq('tenant_id', tenantId)
      .gte('evaluated_at', oneHourAgo)
      .eq('allowed', true)
      .order('evaluated_at', { ascending: true })
      .limit(5000) as {
        data: Array<{ actor_id: string; evaluated_at: string; reason: string }> | null
        error: { message: string } | null
      }

    if (error || !data) return []

    // Group by actor_id and count distinct geo regions extracted from reason field
    const actorRegions: Record<string, Set<string>> = {}
    const actorEvents: Record<string, Array<{ evaluated_at: string; reason: string }>> = {}

    for (const row of data) {
      if (!actorRegions[row.actor_id]) {
        actorRegions[row.actor_id] = new Set()
        actorEvents[row.actor_id] = []
      }
      // Extract geo hint from reason if present (format: "geo:EU-WEST" etc)
      const geoMatch = row.reason.match(/geo:([A-Z0-9-]+)/i)
      if (geoMatch) actorRegions[row.actor_id].add(geoMatch[1])
      actorEvents[row.actor_id].push({ evaluated_at: row.evaluated_at, reason: row.reason })
    }

    const signals: ThreatSignal[] = []

    for (const [actorId, regions] of Object.entries(actorRegions)) {
      if (regions.size >= 3) {
        const signal: ThreatSignal = {
          signal_id:        randomUUID(),
          tenant_id:        tenantId,
          threat_type:      'impossible_travel',
          severity:         regions.size >= 5 ? 'critical' : 'high',
          actor_id:         actorId,
          evidence:         {
            distinct_regions: Array.from(regions),
            region_count:     regions.size,
            events_count:     actorEvents[actorId]?.length ?? 0,
            window_hours:     1,
          },
          confidence:       Math.min(60 + (regions.size - 3) * 15, 95),
          detected_at:      new Date().toISOString(),
          acknowledged:     false,
          response_actions: [],
        }
        signals.push(signal)
        await persistSignal(signal)
      }
    }

    return signals
  } catch (err) {
    log.warn('[runtimeThreatEngine] detectImpossibleTravel error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── detectCapitalAnomaly ──────────────────────────────────────────────────────

export async function detectCapitalAnomaly(tenantId: string): Promise<ThreatSignal[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('capital_transactions')
      .select('id, actor_id, amount, created_at, status')
      .eq('tenant_id', tenantId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true })
      .limit(10000) as {
        data: Array<{ id: string; actor_id: string; amount: number; created_at: string; status: string }> | null
        error: { message: string } | null
      }

    if (error || !data || data.length === 0) return []

    // Group by actor_id and compute stats
    const actorAmounts: Record<string, number[]> = {}
    for (const row of data) {
      if (!actorAmounts[row.actor_id]) actorAmounts[row.actor_id] = []
      actorAmounts[row.actor_id].push(row.amount)
    }

    const signals: ThreatSignal[] = []

    for (const [actorId, amounts] of Object.entries(actorAmounts)) {
      if (amounts.length < 3) continue

      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
      const variance = amounts.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / amounts.length
      const stdDev = Math.sqrt(variance)

      if (stdDev === 0) continue

      // Find transactions > 3 stddev from mean
      const anomalous = amounts.filter(a => Math.abs(a - mean) > 3 * stdDev)

      if (anomalous.length > 0) {
        const signal: ThreatSignal = {
          signal_id:        randomUUID(),
          tenant_id:        tenantId,
          threat_type:      'unusual_capital_movement',
          severity:         anomalous[0] > mean + 5 * stdDev ? 'critical' : 'high',
          actor_id:         actorId,
          evidence:         {
            mean_amount:      mean,
            std_dev:          stdDev,
            anomalous_amounts: anomalous,
            anomalous_count:  anomalous.length,
            total_transactions: amounts.length,
            threshold_multiplier: 3,
          },
          confidence:       Math.min(70 + anomalous.length * 5, 95),
          detected_at:      new Date().toISOString(),
          acknowledged:     false,
          response_actions: [],
        }
        signals.push(signal)
        await persistSignal(signal)
      }
    }

    return signals
  } catch (err) {
    log.warn('[runtimeThreatEngine] detectCapitalAnomaly error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── detectReplayAbuse ─────────────────────────────────────────────────────────

export async function detectReplayAbuse(tenantId: string): Promise<ThreatSignal[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('event_replay_log')
      .select('actor_id, replayed_at')
      .eq('tenant_id', tenantId)
      .gte('replayed_at', oneHourAgo)
      .order('replayed_at', { ascending: true })
      .limit(10000) as {
        data: Array<{ actor_id: string; replayed_at: string }> | null
        error: { message: string } | null
      }

    if (error || !data) return []

    // Count replays per actor in the last hour
    const actorCounts: Record<string, number> = {}
    for (const row of data) {
      actorCounts[row.actor_id] = (actorCounts[row.actor_id] ?? 0) + 1
    }

    const signals: ThreatSignal[] = []
    const REPLAY_THRESHOLD = 50

    for (const [actorId, count] of Object.entries(actorCounts)) {
      if (count > REPLAY_THRESHOLD) {
        const signal: ThreatSignal = {
          signal_id:        randomUUID(),
          tenant_id:        tenantId,
          threat_type:      'abnormal_replay_volume',
          severity:         count > 500 ? 'critical' : count > 200 ? 'high' : 'medium',
          actor_id:         actorId,
          evidence:         {
            replay_count:   count,
            threshold:      REPLAY_THRESHOLD,
            window_hours:   1,
            excess_replays: count - REPLAY_THRESHOLD,
          },
          confidence:       Math.min(50 + Math.floor(count / 10), 95),
          detected_at:      new Date().toISOString(),
          acknowledged:     false,
          response_actions: [],
        }
        signals.push(signal)
        await persistSignal(signal)
      }
    }

    return signals
  } catch (err) {
    log.warn('[runtimeThreatEngine] detectReplayAbuse error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── detectTenantScraping ──────────────────────────────────────────────────────

export async function detectTenantScraping(tenantId: string): Promise<ThreatSignal[]> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('access_decisions_log')
      .select('actor_id, evaluated_at, permission')
      .eq('tenant_id', tenantId)
      .gte('evaluated_at', tenMinutesAgo)
      .like('permission', '%.read%')
      .order('evaluated_at', { ascending: true })
      .limit(20000) as {
        data: Array<{ actor_id: string; evaluated_at: string; permission: string }> | null
        error: { message: string } | null
      }

    if (error || !data) return []

    const actorReadCounts: Record<string, number> = {}
    for (const row of data) {
      actorReadCounts[row.actor_id] = (actorReadCounts[row.actor_id] ?? 0) + 1
    }

    const signals: ThreatSignal[] = []
    const SCRAPING_THRESHOLD = 1000

    for (const [actorId, count] of Object.entries(actorReadCounts)) {
      if (count > SCRAPING_THRESHOLD) {
        const signal: ThreatSignal = {
          signal_id:        randomUUID(),
          tenant_id:        tenantId,
          threat_type:      'tenant_data_scraping',
          severity:         count > 5000 ? 'critical' : count > 2000 ? 'high' : 'medium',
          actor_id:         actorId,
          evidence:         {
            read_count:     count,
            threshold:      SCRAPING_THRESHOLD,
            window_minutes: 10,
            excess_reads:   count - SCRAPING_THRESHOLD,
          },
          confidence:       Math.min(55 + Math.floor(count / 100), 95),
          detected_at:      new Date().toISOString(),
          acknowledged:     false,
          response_actions: [],
        }
        signals.push(signal)
        await persistSignal(signal)
      }
    }

    return signals
  } catch (err) {
    log.warn('[runtimeThreatEngine] detectTenantScraping error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── detectRansomwarePattern ───────────────────────────────────────────────────

export async function detectRansomwarePattern(tenantId: string): Promise<ThreatSignal[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('audit_log_entries')
      .select('actor_id, action, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', oneHourAgo)
      .in('action', [
        'asset_ingested',         // bulk ingestion
        'capital_transaction_initiated',
        'escrow_created',
        'legal_document_signed',
        'kyc_status_changed',
      ])
      .order('created_at', { ascending: true })
      .limit(5000) as {
        data: Array<{ actor_id: string; action: string; created_at: string }> | null
        error: { message: string } | null
      }

    if (error || !data) return []

    // Detect bulk destructive patterns: actor with >50 actions in 1 hour across multiple action types
    const actorStats: Record<string, { count: number; actions: Set<string> }> = {}
    for (const row of data) {
      if (!actorStats[row.actor_id]) {
        actorStats[row.actor_id] = { count: 0, actions: new Set() }
      }
      actorStats[row.actor_id].count++
      actorStats[row.actor_id].actions.add(row.action)
    }

    const signals: ThreatSignal[] = []
    const BULK_OPS_THRESHOLD = 50
    const MIN_DISTINCT_ACTIONS = 3

    for (const [actorId, stats] of Object.entries(actorStats)) {
      if (stats.count > BULK_OPS_THRESHOLD && stats.actions.size >= MIN_DISTINCT_ACTIONS) {
        const signal: ThreatSignal = {
          signal_id:   randomUUID(),
          tenant_id:   tenantId,
          threat_type: 'ransomware_pattern',
          severity:    stats.count > 500 ? 'critical' : 'high',
          actor_id:    actorId,
          evidence:    {
            total_operations:    stats.count,
            distinct_action_types: stats.actions.size,
            action_types:        Array.from(stats.actions),
            threshold:           BULK_OPS_THRESHOLD,
            window_hours:        1,
          },
          confidence:       Math.min(65 + Math.floor(stats.count / 50), 95),
          detected_at:      new Date().toISOString(),
          acknowledged:     false,
          response_actions: [],
        }
        signals.push(signal)
        await persistSignal(signal)
      }
    }

    return signals
  } catch (err) {
    log.warn('[runtimeThreatEngine] detectRansomwarePattern error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── runThreatScan ─────────────────────────────────────────────────────────────

export async function runThreatScan(tenantId: string): Promise<ThreatScanResult> {
  const startMs = Date.now()
  const scannedAt = new Date().toISOString()

  const [
    travelSignals,
    capitalSignals,
    replaySignals,
    scrapingSignals,
    ransomwareSignals,
  ] = await Promise.all([
    detectImpossibleTravel(tenantId),
    detectCapitalAnomaly(tenantId),
    detectReplayAbuse(tenantId),
    detectTenantScraping(tenantId),
    detectRansomwarePattern(tenantId),
  ])

  const allSignals = [
    ...travelSignals,
    ...capitalSignals,
    ...replaySignals,
    ...scrapingSignals,
    ...ransomwareSignals,
  ]

  const severityRank: Record<string, number> = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }

  let highestSeverity: ThreatScanResult['highest_severity'] = 'none'
  for (const signal of allSignals) {
    if ((severityRank[signal.severity] ?? 0) > (severityRank[highestSeverity] ?? 0)) {
      highestSeverity = signal.severity as ThreatScanResult['highest_severity']
    }
  }

  return {
    scan_id:          randomUUID(),
    tenant_id:        tenantId,
    signals_detected: allSignals,
    highest_severity: highestSeverity,
    scan_duration_ms: Date.now() - startMs,
    scanned_at:       scannedAt,
  }
}

// ─── acknowledgeSignal ─────────────────────────────────────────────────────────

export async function acknowledgeSignal(
  signalId: string,
  acknowledgedBy: string,
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('threat_signals')
    .update({ acknowledged: true })
    .eq('id', signalId) as { error: { message: string } | null }

  if (error) {
    log.warn('[runtimeThreatEngine] acknowledgeSignal failed', {
      signal_id: signalId,
      acknowledged_by: acknowledgedBy,
      error: error.message,
    })
    return
  }

  log.info('[runtimeThreatEngine] Signal acknowledged', {
    signal_id:       signalId,
    acknowledged_by: acknowledgedBy,
  })
}
