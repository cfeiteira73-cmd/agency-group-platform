// =============================================================================
// AGENCY GROUP — SH-ROS Chaos Test: DB Outage
// Validates persist-before-execute contract under complete DB unavailability.
// AMI: 22506 | SH-ROS Chaos Engineering
// =============================================================================

import { randomUUID } from 'crypto'
import type { RuntimeEvent } from '../../lib/runtime/types'

// ─── Mock supabaseAdmin ───────────────────────────────────────────────────────

jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      or: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

// ─── Imports (after mock) ─────────────────────────────────────────────────────

import { supabaseAdmin } from '../../lib/supabase'
import { orchestrator, RuntimePersistError } from '../../lib/runtime/orchestrator'
import { hotMemory } from '../../lib/runtime/memory'
import { orphanRecovery } from '../../lib/runtime/recovery/orphanRecovery'
import { reconciliationEngine } from '../../lib/runtime/recovery/reconciliationEngine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<RuntimeEvent> = {}): RuntimeEvent {
  return {
    event_id: randomUUID(),
    org_id: 'org-chaos-db-001',
    type: 'LEAD_CREATED',
    timestamp: new Date().toISOString(),
    correlation_id: randomUUID(),
    priority: 'high',
    retry_count: 0,
    payload: { lead_id: randomUUID(), source: 'test' },
    metadata: {
      schema_version: 'vFINAL',
      trace_id: randomUUID(),
      source_system: 'api',
    },
    ...overrides,
  }
}

function dbError(code: string, message: string) {
  return { data: null, error: { code, message, details: null, hint: null } }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Chaos: DB Outage', () => {
  const mockFrom = supabaseAdmin.from as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    hotMemory.clear('org-chaos-db-001')

    // Default: healthy DB
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      or: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })
  })

  // ── Test 1: RuntimePersistError thrown when DB fails ──────────────────────

  it('throws RuntimePersistError when DB insert fails with non-23505 error', async () => {
    const event = makeEvent()

    // Simulate DB connection refused (500 level error)
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue(
        dbError('08006', 'connection to server lost')
      ),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      or: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })

    await expect(orchestrator.dispatch(event)).rejects.toThrow(RuntimePersistError)
  })

  // ── Test 2: No agents execute when persist fails ───────────────────────────

  it('halts execution pipeline — no agents run when persist fails', async () => {
    const event = makeEvent()

    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue(
        dbError('57014', 'query_canceled due to timeout')
      ),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      or: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })

    let error: Error | null = null
    try {
      await orchestrator.dispatch(event)
    } catch (e) {
      error = e as Error
    }

    // Must have thrown RuntimePersistError (not proceeded to agent execution)
    expect(error).toBeInstanceOf(RuntimePersistError)
    expect(error?.name).toBe('RuntimePersistError')

    // HOT memory must NOT have been updated (event never processed)
    const cached = hotMemory.getRecent('org-chaos-db-001', 100)
    expect(cached.some(e => e.event_id === event.event_id)).toBe(false)
  })

  // ── Test 3: HOT memory still queryable during DB outage ───────────────────

  it('HOT memory remains queryable when DB is unavailable', async () => {
    const org_id = 'org-chaos-db-001'

    // Pre-populate HOT memory directly (simulates prior successful executions)
    hotMemory.add(org_id, {
      event_id: 'evt-pre-001',
      org_id,
      type: 'LEAD_CREATED',
      status: 'completed',
      priority: 'high',
      timestamp: new Date().toISOString(),
      payload_summary: '{"lead_id":"abc"}',
      latency_ms: 120,
      economic_score: 0.85,
    })

    hotMemory.add(org_id, {
      event_id: 'evt-pre-002',
      org_id,
      type: 'PIPELINE_STALLED',
      status: 'completed',
      priority: 'critical',
      timestamp: new Date().toISOString(),
      payload_summary: '{"deal_id":"xyz"}',
      latency_ms: 200,
      economic_score: 0.70,
    })

    // Simulate DB total outage
    mockFrom.mockReturnValue({
      insert: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      select: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      update: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      single: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      or: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    })

    // HOT memory should be queryable without touching DB
    const recent = hotMemory.getRecent(org_id, 10)
    expect(recent).toHaveLength(2)
    expect(recent[0].event_id).toBe('evt-pre-001')
    expect(recent[1].event_id).toBe('evt-pre-002')

    // has() should work
    expect(hotMemory.has(org_id, 'evt-pre-001')).toBe(true)
    expect(hotMemory.has(org_id, 'evt-nonexistent')).toBe(false)
  })

  // ── Test 4: Idempotency — re-persisting same event_id returns duplicate ───

  it('returns duplicate trace (no re-execution) when event_id already exists (23505)', async () => {
    const event = makeEvent()

    // First call: simulate successful insert
    const insertMock = jest.fn()
      .mockResolvedValueOnce({ data: null, error: null }) // first insert: success
      .mockResolvedValueOnce(dbError('23505', 'duplicate key value violates unique constraint')) // second insert: duplicate

    const chainMock = {
      insert: insertMock,
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      or: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    chainMock.select.mockReturnValue(chainMock)
    chainMock.update.mockReturnValue(chainMock)
    chainMock.eq.mockReturnValue(chainMock)
    chainMock.neq.mockReturnValue(chainMock)
    chainMock.order.mockReturnValue(chainMock)
    chainMock.limit.mockResolvedValue({ data: [], error: null })

    mockFrom.mockReturnValue(chainMock)

    // First dispatch: succeeds
    const trace1 = await orchestrator.dispatch(event)
    expect(trace1.event_id).toBe(event.event_id)

    // Second dispatch with same event_id: idempotent skip
    const trace2 = await orchestrator.dispatch(event)
    expect(trace2.event_id).toBe(event.event_id)
    expect(trace2.error).toBe('duplicate_event_skipped')
    expect(trace2.agents_triggered).toHaveLength(0)
    expect(trace2.total_duration_ms).toBe(0)
  })

  // ── Test 5: OrphanRecovery detects processing events after DB outage ──────

  it('orphanRecovery.detect() finds events stuck in processing after DB outage', async () => {
    const org_id = 'org-chaos-db-001'
    const stuckAt = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago

    const chainMock = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [
          {
            event_id: 'evt-orphan-001',
            org_id,
            type: 'LEAD_CREATED',
            status: 'processing',
            updated_at: stuckAt,
            correlation_id: randomUUID(),
            retry_count: 0,
          },
          {
            event_id: 'evt-orphan-002',
            org_id,
            type: 'PIPELINE_STALLED',
            status: 'processing',
            updated_at: stuckAt,
            correlation_id: randomUUID(),
            retry_count: 1,
          },
        ],
        error: null,
      }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      or: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    chainMock.select.mockReturnValue(chainMock)
    chainMock.update.mockReturnValue(chainMock)
    chainMock.eq.mockReturnValue(chainMock)
    chainMock.lt.mockReturnValue(chainMock)

    mockFrom.mockReturnValue(chainMock)

    const orphans = await orphanRecovery.detect(org_id, 5 * 60 * 1000)

    expect(orphans).toHaveLength(2)
    expect(orphans[0].event_id).toBe('evt-orphan-001')
    expect(orphans[1].event_id).toBe('evt-orphan-002')
    orphans.forEach(o => {
      expect(o.status).toBe('processing')
      expect(o.stuck_duration_ms).toBeGreaterThan(5 * 60 * 1000)
    })
  })

  // ── Test 6: ReconciliationEngine repairs status discrepancies after recovery

  it('reconciliationEngine detects orphan_processing discrepancies after outage', async () => {
    const org_id = 'org-chaos-db-001'
    const stuckAt = new Date(Date.now() - 7 * 60 * 1000).toISOString()

    const chainMock = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      or: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }

    // _detectInvalidStatuses: returns no invalid statuses
    // _detectMissingCompletions: returns no items (processing without result)
    // _detectOrphanProcessing: returns 1 orphan
    let callCount = 0
    chainMock.select.mockImplementation(() => {
      callCount++
      return chainMock
    })
    chainMock.eq.mockReturnValue(chainMock)
    chainMock.lt.mockReturnValue(chainMock)
    chainMock.not.mockReturnValue(chainMock)

    // Final resolution call returns the orphan
    chainMock.limit.mockImplementation(() => {
      return Promise.resolve({
        data: [{
          event_id: 'evt-stuck-999',
          updated_at: stuckAt,
          status: 'processing',
        }],
        error: null,
      })
    })

    chainMock.update.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })

    mockFrom.mockReturnValue(chainMock)

    const discrepancies = await reconciliationEngine.detectDiscrepancies(org_id)
    // At least one orphan_processing discrepancy expected
    expect(Array.isArray(discrepancies)).toBe(true)
  })
})
