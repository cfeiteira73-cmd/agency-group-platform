// AGENCY GROUP — SH-ROS: Reality Consistency Engine | AMI: 22506
// Phase Ω∞-11: Validates system state matches Supabase truth continuously
// Detects phantom deals, orphan events, stale caches, data drift
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConsistencyCheckType =
  | 'orphan_events'
  | 'phantom_deals'
  | 'stale_matches'
  | 'missing_org_id'
  | 'event_chain_integrity'
  | 'learning_event_drift'
  | 'deal_stage_validity'

export interface ConsistencyViolation {
  check_type: ConsistencyCheckType
  entity_type: string
  entity_id: string
  org_id: string | null
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  detected_at: string
  auto_correctable: boolean
}

export interface ConsistencyReport {
  org_id: string | null  // null = global scan
  scanned_at: string
  duration_ms: number
  checks_run: ConsistencyCheckType[]
  violations: ConsistencyViolation[]
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  healthy: boolean
}

// ─── Valid deal stages ────────────────────────────────────────────────────────

const VALID_DEAL_STAGES = new Set([
  'qualification', 'price_analysis', 'visit_scheduled', 'proposal',
  'negotiation', 'cpcv_pending', 'cpcv_signed', 'escritura_done',
  'closed_won', 'closed_lost',
])

// ─── Reality Consistency Engine ───────────────────────────────────────────────

export class RealityConsistencyEngine {
  /**
   * Run a full consistency scan for an org (or global if no org_id).
   */
  async scan(org_id?: string): Promise<ConsistencyReport> {
    const start = Date.now()
    const violations: ConsistencyViolation[] = []
    const checks_run: ConsistencyCheckType[] = []

    logger.info('[RealityConsistency] Scan started', { org_id: org_id ?? 'global' })

    // Run all checks in parallel for speed
    const [
      orphanViolations,
      phantomViolations,
      staleViolations,
      missingOrgViolations,
      stageViolations,
      driftViolations,
    ] = await Promise.all([
      this._checkOrphanEvents(org_id),
      this._checkPhantomDeals(org_id),
      this._checkStaleMatches(org_id),
      this._checkMissingOrgId(org_id),
      this._checkDealStageValidity(org_id),
      this._checkLearningEventDrift(org_id),
    ])

    violations.push(...orphanViolations)
    violations.push(...phantomViolations)
    violations.push(...staleViolations)
    violations.push(...missingOrgViolations)
    violations.push(...stageViolations)
    violations.push(...driftViolations)

    checks_run.push(
      'orphan_events', 'phantom_deals', 'stale_matches',
      'missing_org_id', 'deal_stage_validity', 'learning_event_drift'
    )

    const counts = {
      critical: violations.filter(v => v.severity === 'critical').length,
      high: violations.filter(v => v.severity === 'high').length,
      medium: violations.filter(v => v.severity === 'medium').length,
      low: violations.filter(v => v.severity === 'low').length,
    }

    const report: ConsistencyReport = {
      org_id: org_id ?? null,
      scanned_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      checks_run,
      violations,
      critical_count: counts.critical,
      high_count: counts.high,
      medium_count: counts.medium,
      low_count: counts.low,
      healthy: counts.critical === 0 && counts.high === 0,
    }

    if (!report.healthy) {
      logger.warn('[RealityConsistency] Inconsistencies found', {
        org_id: org_id ?? 'global',
        critical: counts.critical,
        high: counts.high,
        total: violations.length,
      })
    } else {
      logger.info('[RealityConsistency] System consistent', {
        org_id: org_id ?? 'global',
        duration_ms: report.duration_ms,
      })
    }

    return report
  }

  // ─── Checks ────────────────────────────────────────────────────────────────

  private async _checkOrphanEvents(org_id?: string): Promise<ConsistencyViolation[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('runtime_events') as any)
      .select('id, org_id, event_type, created_at')
      .is('event_type', null)
      .limit(50)

    if (org_id) q = q.eq('org_id', org_id)
    const { data } = await q

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => ({
      check_type: 'orphan_events' as ConsistencyCheckType,
      entity_type: 'runtime_event',
      entity_id: row.id as string,
      org_id: row.org_id as string | null,
      description: `Runtime event with null event_type (orphan)`,
      severity: 'medium' as const,
      detected_at: new Date().toISOString(),
      auto_correctable: false,
    }))
  }

  private async _checkPhantomDeals(org_id?: string): Promise<ConsistencyViolation[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // Phantom deal: active status but no contact_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('deals') as any)
      .select('id, org_id, status, created_at')
      .eq('status', 'active')
      .is('contact_id', null)
      .limit(20)

    if (org_id) q = q.eq('org_id', org_id)
    const { data } = await q

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => ({
      check_type: 'phantom_deals' as ConsistencyCheckType,
      entity_type: 'deal',
      entity_id: row.id as string,
      org_id: row.org_id as string | null,
      description: `Active deal with no contact_id — phantom deal detected`,
      severity: 'high' as const,
      detected_at: new Date().toISOString(),
      auto_correctable: false,
    }))
  }

  private async _checkStaleMatches(org_id?: string): Promise<ConsistencyViolation[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // Stale match: created >90 days ago, status still 'pending'
    const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('matches') as any)
      .select('id, org_id, created_at')
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .limit(20)

    if (org_id) q = q.eq('org_id', org_id)
    const { data } = await q

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => ({
      check_type: 'stale_matches' as ConsistencyCheckType,
      entity_type: 'match',
      entity_id: row.id as string,
      org_id: row.org_id as string | null,
      description: `Match pending for >90 days — stale match detected`,
      severity: 'low' as const,
      detected_at: new Date().toISOString(),
      auto_correctable: true,
    }))
  }

  private async _checkMissingOrgId(org_id?: string): Promise<ConsistencyViolation[]> {
    const violations: ConsistencyViolation[] = []
    if (org_id) return violations  // Skip if single-tenant check

    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    for (const table of ['deals', 'contacts'] as const) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (sb.from(table) as any)
        .select('id', { count: 'exact', head: true })
        .is('org_id', null)

      if ((count ?? 0) > 0) {
        violations.push({
          check_type: 'missing_org_id',
          entity_type: table,
          entity_id: '*',
          org_id: null,
          description: `${count} rows in ${table} have null org_id — tenancy gap`,
          severity: 'medium',
          detected_at: new Date().toISOString(),
          auto_correctable: false,
        })
      }
    }

    return violations
  }

  private async _checkDealStageValidity(org_id?: string): Promise<ConsistencyViolation[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('deals') as any)
      .select('id, org_id, stage')
      .not('stage', 'is', null)
      .limit(500)

    if (org_id) q = q.eq('org_id', org_id)
    const { data } = await q

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).filter((row: any) => !VALID_DEAL_STAGES.has(row.stage as string))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => ({
        check_type: 'deal_stage_validity' as ConsistencyCheckType,
        entity_type: 'deal',
        entity_id: row.id as string,
        org_id: row.org_id as string | null,
        description: `Deal has invalid stage: "${row.stage}" — not in VALID_DEAL_STAGES`,
        severity: 'high' as const,
        detected_at: new Date().toISOString(),
        auto_correctable: false,
      }))
  }

  private async _checkLearningEventDrift(org_id?: string): Promise<ConsistencyViolation[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // Drift check: learning events without proper metadata (malformed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('learning_events') as any)
      .select('id, org_id, event_type')
      .is('metadata', null)
      .limit(20)

    if (org_id) q = q.eq('org_id', org_id)
    const { data } = await q

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => ({
      check_type: 'learning_event_drift' as ConsistencyCheckType,
      entity_type: 'learning_event',
      entity_id: row.id as string,
      org_id: row.org_id as string | null,
      description: `Learning event with null metadata — data drift detected`,
      severity: 'medium' as const,
      detected_at: new Date().toISOString(),
      auto_correctable: false,
    }))
  }
}

export const realityConsistencyEngine = new RealityConsistencyEngine()
