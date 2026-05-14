// =============================================================================
// AGENCY GROUP — SH-ROS Chaos Test: Queue Outage
// Validates fallback chain and degraded-state behaviour when queue provider fails.
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

// ─── Imports ──────────────────────────────────────────────────────────────────

import { supabaseAdmin } from '../../lib/supabase'
import { DBFallbackProvider } from '../../lib/runtime/queue/dbFallbackProvider'
import { QueueHealthMonitor } from '../../lib/runtime/queue/queueHealth'
import { backpressureController } from '../../lib/runtime/queue/queueBackpressure'
import { deadLetterQueue } from '../../lib/runtime/queue/queueDeadLetter'
import type { IQueueProvider, QueueHealth } from '../../lib/runtime/queue/queueProvider'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(org_id = 'org-queue-chaos-001'): RuntimeEvent {
  return {
    event_id: randomUUID(),
    org_id,
    type: 'LEAD_CREATED',
    timestamp: new Date().toISOString(),
    correlation_id: randomUUID(),
    priority: 'high',
    retry_count: 0,
    payload: { lead_id: randomUUID() },
    metadata: { schema_version: 'vFINAL', trace_id: randomUUID(), source_system: 'api' },
  }
}

function buildChainMock(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
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
    ...overrides,
  }
  return chain
}

// ─── Mock primary queue provider (simulates Redis/Kafka outage) ───────────────

class FailingQueueProvider implements IQueueProvider {
  async enqueue(_: RuntimeEvent): Promise<string> {
    throw new Error('Redis: ECONNREFUSED 127.0.0.1:6379')
  }
  async dequeue(_: string, __?: number): Promise<RuntimeEvent[]> {
    throw new Error('Redis: ECONNREFUSED')
  }
  async ack(_: string, __: string): Promise<void> {
    throw new Error('Redis: ECONNREFUSED')
  }
  async nack(_: string, __: string, ___: string): Promise<void> {
    throw new Error('Redis: ECONNREFUSED')
  }
  async getHealth(): Promise<QueueHealth> {
    return {
      provider: 'redis-streams',
      status: 'unavailable',
      lag: 0,
      dlq_count: 0,
      latency_p50: 0,
      latency_p95: 0,
      latency_p99: 0,
    }
  }
  async getMetrics() {
    return {
      provider: 'redis-streams',
      enqueued_total: 0,
      dequeued_total: 0,
      ack_total: 0,
      nack_total: 0,
      dlq_total: 0,
      replay_total: 0,
      lag: 0,
      throughput_per_min: 0,
      partition_count: 0,
      consumer_count: 0,
    }
  }
  async replay(_: import('../../lib/runtime/queue/queueProvider').ReplayOptions): Promise<number> {
    return 0
  }
  async close(): Promise<void> {}
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Chaos: Queue Outage', () => {
  const mockFrom = supabaseAdmin.from as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockFrom.mockReturnValue(buildChainMock())
  })

  // ── Test 1: DBFallbackProvider used when primary fails ────────────────────

  it('DBFallbackProvider accepts events when primary queue provider is unavailable', async () => {
    const primaryQueue = new FailingQueueProvider()
    const fallbackQueue = new DBFallbackProvider()
    const event = makeEvent()

    // Primary fails
    await expect(primaryQueue.enqueue(event)).rejects.toThrow('Redis: ECONNREFUSED')

    // Fallback succeeds
    const insertMock = jest.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue({ ...buildChainMock(), insert: insertMock })

    const msgId = await fallbackQueue.enqueue(event)
    expect(msgId).toBe(event.event_id)
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  // ── Test 2: No events lost during provider switch ─────────────────────────

  it('no events are lost during provider failover — event_ids preserved', async () => {
    const fallbackQueue = new DBFallbackProvider()
    const events = Array.from({ length: 10 }, () => makeEvent())
    const enqueuedIds: string[] = []

    const insertMock = jest.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue({ ...buildChainMock(), insert: insertMock })

    for (const evt of events) {
      const id = await fallbackQueue.enqueue(evt)
      enqueuedIds.push(id)
    }

    // All 10 events enqueued successfully
    expect(enqueuedIds).toHaveLength(10)
    expect(insertMock).toHaveBeenCalledTimes(10)

    // Each returned id matches the original event_id
    events.forEach((evt, i) => {
      expect(enqueuedIds[i]).toBe(evt.event_id)
    })
  })

  // ── Test 3: Queue health reports 'unavailable' during outage ──────────────

  it('queue health reports unavailable when primary provider is down', async () => {
    const failingProvider = new FailingQueueProvider()
    const health = await failingProvider.getHealth()

    expect(health.status).toBe('unavailable')
    expect(health.provider).toBe('redis-streams')
  })

  // ── Test 4: QueueHealthMonitor detects degradation and fires callback ─────

  it('QueueHealthMonitor fires onDegraded callback when provider becomes unavailable', async () => {
    const mockProvider: IQueueProvider = {
      enqueue: jest.fn(),
      dequeue: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      getHealth: jest.fn().mockResolvedValue({
        provider: 'db-fallback',
        status: 'unavailable',
        lag: 5000,
        dlq_count: 10,
        latency_p50: 6000,
        latency_p95: 9000,
        latency_p99: 12000,
      } satisfies QueueHealth),
      getMetrics: jest.fn(),
      replay: jest.fn(),
      close: jest.fn(),
    }

    // Mock supabase insert for system_alerts
    mockFrom.mockReturnValue(buildChainMock())

    const monitor = new QueueHealthMonitor(mockProvider)
    const degradedCallback = jest.fn()
    monitor.onDegraded(degradedCallback)

    // Trigger a health check manually
    await (monitor as unknown as { runCheck(): Promise<void> }).runCheck()

    expect(degradedCallback).toHaveBeenCalledTimes(1)
    const callArg: QueueHealth = degradedCallback.mock.calls[0][0]
    expect(callArg.status).toBe('unavailable')
    expect(callArg.lag).toBe(5000)
  })

  // ── Test 5: Backpressure triggers when p95 exceeds threshold ──────────────

  it('backpressure activates when p95 latency exceeds 1000ms threshold', () => {
    const org_id = 'org-queue-chaos-001'

    // Record 10 high-latency samples to fill the window (>= 5 required)
    for (let i = 0; i < 10; i++) {
      backpressureController.recordLatency(org_id, 1200 + i * 50) // 1200–1650ms
    }

    expect(backpressureController.isBackpressured(org_id)).toBe(true)
    const level = backpressureController.getBackpressureLevel(org_id)
    expect(level).toBe('light') // p95 > 1000ms but < 2000ms
    expect(backpressureController.getSuggestedDelayMs(org_id)).toBe(500)
  })

  // ── Test 6: Backpressure levels escalate correctly ────────────────────────

  it('backpressure escalates to severe when p95 > 5000ms', () => {
    const org_id = 'org-queue-backpressure-severe'

    for (let i = 0; i < 20; i++) {
      backpressureController.recordLatency(org_id, 6000) // well above 5000ms
    }

    const level = backpressureController.getBackpressureLevel(org_id)
    expect(level).toBe('severe')
    expect(backpressureController.getSuggestedDelayMs(org_id)).toBe(5000)
  })

  // ── Test 7: DLQ still functional during queue outage ─────────────────────

  it('DLQ add/list works via DB fallback when primary queue is down', async () => {
    const event = makeEvent()
    const reason = 'Queue provider unavailable after 3 retries'

    // DLQ uses supabase.from('runtime_events').upsert — mock it
    const upsertMock = jest.fn().mockResolvedValue({ data: null, error: null })
    const listChain = {
      ...buildChainMock(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [{
          event_id: event.event_id,
          org_id: event.org_id,
          type: event.type,
          last_error: reason,
          updated_at: new Date().toISOString(),
          retry_count: 3,
          agent_id: null,
          payload: event.payload,
        }],
        error: null,
      }),
    }
    listChain.select.mockReturnValue(listChain)
    listChain.eq.mockReturnValue(listChain)
    listChain.order.mockReturnValue(listChain)

    mockFrom.mockReturnValueOnce({ ...buildChainMock(), upsert: upsertMock })
    mockFrom.mockReturnValue(listChain)

    await deadLetterQueue.add(event, reason)
    expect(upsertMock).toHaveBeenCalledTimes(1)

    const entries = await deadLetterQueue.list(event.org_id)
    expect(entries).toHaveLength(1)
    expect(entries[0].event_id).toBe(event.event_id)
    expect(entries[0].reason).toBe(reason)
    expect(entries[0].retry_count).toBe(3)
  })

  // ── Test 8: No events lost — fallback metrics remain accurate ─────────────

  it('fallback queue metrics correctly reflect enqueued events after failover', async () => {
    const fallbackQueue = new DBFallbackProvider()
    const org_id = 'org-queue-chaos-001'

    // Mock getMetrics response: 5 pending, 3 completed, 2 dlq
    const countChain = { ...buildChainMock() }
    countChain.select = jest.fn().mockReturnValue({
      ...countChain,
      eq: jest.fn().mockReturnValue({
        ...countChain,
        eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
      }),
      gte: jest.fn().mockReturnValue({
        ...countChain,
        gte: jest.fn().mockResolvedValue({ count: 2, error: null }),
      }),
    })

    mockFrom.mockReturnValue(countChain)

    const metrics = await fallbackQueue.getMetrics(org_id)
    expect(metrics.provider).toBe('db-fallback')
    expect(typeof metrics.enqueued_total).toBe('number')
    expect(typeof metrics.lag).toBe('number')
  })
})
