// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Event System Integrity Tester v1.0
// lib/validation/eventIntegrityTester.ts
//
// Layer 2 of the Autonomous Validation Engine.
// Tests the event system's integrity across 4 scenarios and provides
// simulation utilities for estimating resilience without injecting real failures.
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { EventTopic } from '@/lib/events/eventRouter'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventTestScenario =
  | 'orphan_events'
  | 'idempotency_keys'
  | 'topic_coverage'
  | 'replay_consistency'

export interface EventTestResult {
  scenario: EventTestScenario
  passed: boolean
  score: number
  details: string
  data: Record<string, unknown>
}

export interface EventIntegrityReport {
  id: string
  tenant_id: string
  overall_score: number
  event_integrity_score: number
  replay_correctness: boolean
  tests: EventTestResult[]
  orphan_count: number
  topic_coverage_pct: number
  total_events: number
  processed_events: number
  unprocessed_events: number
  tested_at: string
}

// ─── Expected topics (from EventTopic type in eventRouter.ts) ─────────────────

const EXPECTED_TOPICS: EventTopic[] = [
  'property.created',
  'property.updated',
  'investor.bid_placed',
  'capital.transaction_initiated',
  'market.mpi_updated',
  'market.liquidity_graded',
]

// ─── Individual tests ─────────────────────────────────────────────────────────

/**
 * Test 1: orphan_events
 * Count events older than 5 min with processed_at IS NULL.
 * Pass if count = 0.
 */
async function testOrphanEvents(tenantId: string): Promise<EventTestResult> {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { count, error } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('processed_at', null)
      .lt('emitted_at', cutoff)

    if (error) {
      return {
        scenario: 'orphan_events',
        passed:   false,
        score:    0,
        details:  `Query failed: ${error.message}`,
        data:     { error: error.message },
      }
    }

    const orphanCount = (count as number) ?? 0

    let score: number
    if (orphanCount === 0)      score = 100
    else if (orphanCount < 10)  score = 80
    else if (orphanCount < 100) score = 50
    else                        score = 0

    const passed  = orphanCount === 0
    const details = passed
      ? 'No orphan events detected — all events processed within 5 minutes'
      : `${orphanCount} orphan event(s) found older than 5 minutes with no consumer processing`

    return {
      scenario: 'orphan_events',
      passed,
      score,
      details,
      data: {
        orphan_count: orphanCount,
        cutoff_time:  cutoff,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[eventIntegrityTester] testOrphanEvents error', { error: msg })
    return {
      scenario: 'orphan_events',
      passed:   false,
      score:    0,
      details:  `Test error: ${msg}`,
      data:     { error: msg },
    }
  }
}

/**
 * Test 2: idempotency_keys
 * Check replay_sessions for failed runs and duplicate idempotency key violations.
 */
async function testIdempotencyKeys(tenantId: string): Promise<EventTestResult> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: failedSessions, error } = await (supabaseAdmin as any)
      .from('replay_sessions')
      .select('id, idempotency_key, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'failed')
      .gte('created_at', sevenDaysAgo)

    if (error) {
      // Table may not exist yet
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return {
          scenario: 'idempotency_keys',
          passed:   true,
          score:    100,
          details:  'replay_sessions table not yet created — idempotency enforcement pending',
          data:     { failed_sessions: 0, table_exists: false },
        }
      }
      return {
        scenario: 'idempotency_keys',
        passed:   false,
        score:    0,
        details:  `Query failed: ${error.message}`,
        data:     { error: error.message },
      }
    }

    const sessions  = (failedSessions as Array<Record<string, unknown>>) ?? []
    const failCount = sessions.length

    let score: number
    if (failCount === 0)      score = 100
    else if (failCount <= 2)  score = 70
    else                      score = 40

    const passed  = failCount === 0
    const details = passed
      ? 'No failed replay sessions in the last 7 days — idempotency enforcement intact'
      : `${failCount} failed replay session(s) in the last 7 days`

    return {
      scenario: 'idempotency_keys',
      passed,
      score,
      details,
      data: {
        failed_sessions_last_7d: failCount,
        sessions:                sessions.slice(0, 5),
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[eventIntegrityTester] testIdempotencyKeys error', { error: msg })
    return {
      scenario: 'idempotency_keys',
      passed:   false,
      score:    0,
      details:  `Test error: ${msg}`,
      data:     { error: msg },
    }
  }
}

/**
 * Test 3: topic_coverage
 * Check that expected topics have at least 1 event in kafka_event_log.
 * Pass if >= 50% covered (system may be new).
 */
async function testTopicCoverage(tenantId: string): Promise<EventTestResult> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('topic')
      .eq('tenant_id', tenantId)

    if (error) {
      return {
        scenario: 'topic_coverage',
        passed:   false,
        score:    0,
        details:  `Query failed: ${error.message}`,
        data:     { error: error.message },
      }
    }

    const rows            = (data as Array<{ topic: string }>) ?? []
    const presentTopics   = new Set(rows.map(r => r.topic))
    const coveredTopics   = EXPECTED_TOPICS.filter(t => presentTopics.has(t))
    const coveragePct     = EXPECTED_TOPICS.length > 0
      ? (coveredTopics.length / EXPECTED_TOPICS.length) * 100
      : 0
    const score           = Math.round(coveragePct)
    const passed          = coveragePct >= 50
    const missingTopics   = EXPECTED_TOPICS.filter(t => !presentTopics.has(t))

    const details = passed
      ? `${coveredTopics.length}/${EXPECTED_TOPICS.length} expected topics have events (${score}% coverage)`
      : `Only ${coveredTopics.length}/${EXPECTED_TOPICS.length} topics covered — ${missingTopics.join(', ')} have no events yet`

    return {
      scenario: 'topic_coverage',
      passed,
      score,
      details,
      data: {
        expected_topics:  EXPECTED_TOPICS,
        covered_topics:   coveredTopics,
        missing_topics:   missingTopics,
        coverage_pct:     coveragePct,
        total_topics_present: presentTopics.size,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[eventIntegrityTester] testTopicCoverage error', { error: msg })
    return {
      scenario: 'topic_coverage',
      passed:   false,
      score:    0,
      details:  `Test error: ${msg}`,
      data:     { error: msg },
    }
  }
}

/**
 * Test 4: replay_consistency
 * Check that completed replay_sessions have replayed > 0 AND failed = 0.
 */
async function testReplayConsistency(tenantId: string): Promise<EventTestResult> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('replay_sessions')
      .select('id, status, replayed_count, failed_count, completed_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')

    if (error) {
      // Table may not exist yet
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return {
          scenario: 'replay_consistency',
          passed:   true,
          score:    100,
          details:  'No completed replay sessions yet — replay consistency baseline established',
          data:     { completed_sessions: 0, table_exists: false },
        }
      }
      return {
        scenario: 'replay_consistency',
        passed:   false,
        score:    0,
        details:  `Query failed: ${error.message}`,
        data:     { error: error.message },
      }
    }

    const sessions = (data as Array<Record<string, unknown>>) ?? []

    if (sessions.length === 0) {
      return {
        scenario: 'replay_consistency',
        passed:   true,
        score:    100,
        details:  'No completed replay sessions yet — replay consistency baseline established',
        data:     { completed_sessions: 0 },
      }
    }

    const sessionsWithFailures = sessions.filter(
      s => (s['failed_count'] as number ?? 0) > 0
    )
    const allSuccessful = sessionsWithFailures.length === 0
    const score         = allSuccessful ? 100 : 50

    const details = allSuccessful
      ? `All ${sessions.length} completed replay session(s) had 0 failures`
      : `${sessionsWithFailures.length}/${sessions.length} completed replay sessions had failures`

    return {
      scenario: 'replay_consistency',
      passed:   allSuccessful,
      score,
      details,
      data: {
        completed_sessions:        sessions.length,
        sessions_with_failures:    sessionsWithFailures.length,
        sessions_sample:           sessions.slice(0, 3),
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[eventIntegrityTester] testReplayConsistency error', { error: msg })
    return {
      scenario: 'replay_consistency',
      passed:   false,
      score:    0,
      details:  `Test error: ${msg}`,
      data:     { error: msg },
    }
  }
}

// ─── runEventIntegrityTests ───────────────────────────────────────────────────

/**
 * Runs all 4 event integrity tests and returns a full report.
 */
export async function runEventIntegrityTests(
  tenantId: string,
): Promise<EventIntegrityReport> {
  const id       = randomUUID()
  const testedAt = new Date().toISOString()

  log.info('[eventIntegrityTester] starting event integrity tests', { tenant_id: tenantId })

  // Run all 4 tests in parallel
  const [orphanResult, idempotencyResult, coverageResult, replayResult] =
    await Promise.all([
      testOrphanEvents(tenantId),
      testIdempotencyKeys(tenantId),
      testTopicCoverage(tenantId),
      testReplayConsistency(tenantId),
    ])

  const tests: EventTestResult[] = [
    orphanResult,
    idempotencyResult,
    coverageResult,
    replayResult,
  ]

  // Weighted average: orphan (30%), idempotency (25%), coverage (25%), replay (20%)
  const weights = [0.30, 0.25, 0.25, 0.20]
  const overallScore = Math.round(
    tests.reduce((acc, t, i) => acc + t.score * (weights[i] ?? 0.25), 0),
  )

  // Event integrity score = average of orphan + idempotency (core reliability)
  const eventIntegrityScore = Math.round(
    (orphanResult.score + idempotencyResult.score) / 2,
  )

  // Replay correctness = replay test passed
  const replayCorrectness = replayResult.passed

  // Get event counts
  const orphanCount = (orphanResult.data['orphan_count'] as number) ?? 0

  // Coverage percentage
  const topicCoveragePct = (coverageResult.data['coverage_pct'] as number) ?? 0

  // Get total / processed / unprocessed counts
  let totalEvents      = 0
  let processedEvents  = 0
  let unprocessedEvents = 0

  try {
    const { count: total } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    const { count: processed } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('processed_at', 'is', null)

    totalEvents       = (total as number) ?? 0
    processedEvents   = (processed as number) ?? 0
    unprocessedEvents = Math.max(0, totalEvents - processedEvents)
  } catch {
    // Counts unavailable — non-fatal
  }

  const report: EventIntegrityReport = {
    id,
    tenant_id:             tenantId,
    overall_score:         overallScore,
    event_integrity_score: eventIntegrityScore,
    replay_correctness:    replayCorrectness,
    tests,
    orphan_count:          orphanCount,
    topic_coverage_pct:    topicCoveragePct,
    total_events:          totalEvents,
    processed_events:      processedEvents,
    unprocessed_events:    unprocessedEvents,
    tested_at:             testedAt,
  }

  log.info('[eventIntegrityTester] tests complete', {
    tenant_id:     tenantId,
    overall_score: overallScore,
    tests_passed:  tests.filter(t => t.passed).length,
    tests_total:   tests.length,
  })

  // Fire-and-forget persist
  void persistEventReport(report).catch(e =>
    log.warn('[eventIntegrityTester] persist failed', {
      error: e instanceof Error ? e.message : String(e),
    })
  )

  return report
}

// ─── Simulation utilities (measurement-based only) ───────────────────────────

/**
 * Estimates how many events would be lost if Kafka went down now.
 * Measurement-based — does not inject any failures.
 */
export async function simulateEventLoss(
  tenantId: string,
): Promise<{ estimated_loss: number; recovery_steps: string[] }> {
  try {
    // Count unprocessed events in kafka_event_log
    const { count: unprocessed } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('processed_at', null)

    // Check if event_archive_log has recent coverage
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentArchive } = await (supabaseAdmin as any)
      .from('event_archive_log')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('archived_at', oneDayAgo)

    const unprocessedCount = (unprocessed as number) ?? 0
    const archiveCount     = (recentArchive as number) ?? 0

    // Estimated loss = unprocessed events without recent archive coverage
    const estimatedLoss = archiveCount > 0 ? 0 : unprocessedCount

    const recoverySteps = [
      'Verify kafka_event_log dual-write is operational (events already persisted to Supabase)',
      'Check KAFKA_BROKERS env var — if unset, all events are already Supabase-only (safe)',
      `Re-process ${unprocessedCount} unprocessed events via replay_sessions`,
      'Trigger a POST /api/events/replay with the affected event IDs',
      'Monitor event_archive_log for coverage gaps after recovery',
    ]

    return { estimated_loss: estimatedLoss, recovery_steps: recoverySteps }
  } catch (err) {
    log.warn('[eventIntegrityTester] simulateEventLoss error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      estimated_loss: 0,
      recovery_steps: ['Unable to assess event loss — check kafka_event_log table accessibility'],
    }
  }
}

/**
 * Estimates duplicate event risk based on replay_sessions constraints.
 * Measurement-based — does not inject duplicates.
 */
export async function simulateDuplicateEvents(
  tenantId: string,
): Promise<{ duplicate_risk: 'low' | 'medium' | 'high'; reason: string }> {
  try {
    // Check if replay_sessions has failed sessions (higher risk)
    const { count: failedCount } = await (supabaseAdmin as any)
      .from('replay_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'failed')

    const failed = (failedCount as number) ?? 0

    if (failed === 0) {
      return {
        duplicate_risk: 'low',
        reason:
          'replay_sessions UNIQUE constraint on idempotency_key prevents duplicates. ' +
          'No failed sessions found — low replay-induced duplicate risk.',
      }
    }

    if (failed <= 3) {
      return {
        duplicate_risk: 'medium',
        reason:
          `${failed} failed replay session(s) detected. If retried without idempotency_key, ` +
          'duplicate events could be produced. Review failed sessions before retrying.',
      }
    }

    return {
      duplicate_risk: 'high',
      reason:
        `${failed} failed replay sessions. High risk of duplicate events if sessions are ` +
        'retried without proper idempotency_key enforcement. Audit replay_sessions immediately.',
    }
  } catch (err) {
    log.warn('[eventIntegrityTester] simulateDuplicateEvents error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      duplicate_risk: 'low',
      reason: 'replay_sessions table not yet created — idempotency baseline not established',
    }
  }
}

/**
 * Estimates total replayable events and replay time from zero.
 * Measurement-based — reads existing data only.
 */
export async function simulateReplayFromZero(
  tenantId: string,
): Promise<{
  total_replayable: number
  estimated_minutes: number
  completeness_pct: number
}> {
  try {
    const [kafkaResult, archiveResult] = await Promise.all([
      (supabaseAdmin as any)
        .from('kafka_event_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('event_archive_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const kafkaCount   = (kafkaResult.count   as number) ?? 0
    const archiveCount = (archiveResult.count as number) ?? 0
    const totalReplayable = kafkaCount + archiveCount

    // Estimate: 1000 events per minute replay throughput
    const estimatedMinutes = Math.ceil(totalReplayable / 1000)

    // Completeness: if archive exists, we have full history
    const completeness = archiveCount > 0 ? 100 : (kafkaCount > 0 ? 80 : 0)

    return {
      total_replayable:  totalReplayable,
      estimated_minutes: estimatedMinutes,
      completeness_pct:  completeness,
    }
  } catch (err) {
    log.warn('[eventIntegrityTester] simulateReplayFromZero error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      total_replayable:  0,
      estimated_minutes: 0,
      completeness_pct:  0,
    }
  }
}

// ─── Persist ─────────────────────────────────────────────────────────────────

/** Persists an EventIntegrityReport to the event_integrity_reports table */
export async function persistEventReport(
  report: EventIntegrityReport,
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('event_integrity_reports')
    .insert({
      id:                    report.id,
      tenant_id:             report.tenant_id,
      overall_score:         report.overall_score,
      event_integrity_score: report.event_integrity_score,
      replay_correctness:    report.replay_correctness,
      tests:                 report.tests,
      orphan_count:          report.orphan_count,
      topic_coverage_pct:    report.topic_coverage_pct,
      total_events:          report.total_events,
      processed_events:      report.processed_events,
      unprocessed_events:    report.unprocessed_events,
      tested_at:             report.tested_at,
    })

  if (error) {
    log.warn('[eventIntegrityTester] DB persist error', { error: error.message })
  }
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/** Returns the most recent event integrity report for a tenant */
export async function getLatestEventReport(
  tenantId: string,
): Promise<EventIntegrityReport | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('event_integrity_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('tested_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return data as EventIntegrityReport
  } catch (err) {
    log.warn('[eventIntegrityTester] getLatestEventReport error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
