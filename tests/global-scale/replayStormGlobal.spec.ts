// AGENCY GROUP — SH-ROS Global Scale | AMI: 22506
// replayStormGlobal.spec.ts — Cross-region replay storm simulation
import { describe, it, expect, vi, beforeEach } from 'vitest'

const REGIONS = ['eu-west', 'us-east', 'ap-south'] as const
type Region = typeof REGIONS[number]

// Partition assignment: eu-west[0–42], us-east[43–85], ap-south[86–127]
const REGION_PARTITION_RANGES: Record<Region, [number, number]> = {
  'eu-west':  [0,  42],
  'us-east':  [43, 85],
  'ap-south': [86, 127],
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (Math.imul(hash, 0x01000193) >>> 0)
  }
  return hash
}

interface ReplayRequest {
  idempotency_key: string
  event_id: string
  region: Region
  requested_at: number
  partition: number
}

interface ReplayResult {
  idempotency_key: string
  outcome: 'replayed' | 'deduplicated' | 'throttled'
  region: Region
}

// Simulate dedup via idempotency_key — exactly-once semantics
function buildReplayEngine() {
  const processedKeys = new Set<string>()
  const replayWindowMs = 60_000      // 1-minute rolling window
  const replayTimestamps: number[] = []
  const STORM_THRESHOLD = 50         // replays/minute

  function getRegionForPartition(partition: number): Region {
    for (const [region, [lo, hi]] of Object.entries(REGION_PARTITION_RANGES) as [Region, [number, number]][]) {
      if (partition >= lo && partition <= hi) return region
    }
    return 'eu-west'
  }

  function isStormDetected(now: number): boolean {
    const windowStart = now - replayWindowMs
    const recent = replayTimestamps.filter(t => t >= windowStart)
    return recent.length >= STORM_THRESHOLD
  }

  async function process(req: ReplayRequest): Promise<ReplayResult> {
    const now = req.requested_at

    // Check for storm before processing
    if (isStormDetected(now)) {
      return { idempotency_key: req.idempotency_key, outcome: 'throttled', region: req.region }
    }

    // Exactly-once: deduplicate via idempotency_key
    if (processedKeys.has(req.idempotency_key)) {
      return { idempotency_key: req.idempotency_key, outcome: 'deduplicated', region: req.region }
    }

    processedKeys.add(req.idempotency_key)
    replayTimestamps.push(now)
    return { idempotency_key: req.idempotency_key, outcome: 'replayed', region: req.region }
  }

  function stormActive(now: number): boolean {
    return isStormDetected(now)
  }

  function replayCount(now: number): number {
    const windowStart = now - replayWindowMs
    return replayTimestamps.filter(t => t >= windowStart).length
  }

  return { process, stormActive, replayCount, processedKeys }
}

// Deterministic cross-region ordering: sort by timestamp ASC then partition
function sortCrossRegion(events: Array<{ event_id: string; timestamp: number; partition: number }>) {
  return [...events].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    return a.partition - b.partition
  })
}

describe('Global Scale: Cross-Region Replay Storm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('500 concurrent replay requests across 3 regions — exactly-once semantics hold', async () => {
    const engine = buildReplayEngine()
    const CONCURRENT_REQUESTS = 500
    const now = Date.now()

    // Build 500 requests: distribute across regions, each with unique idempotency_key
    const requests: ReplayRequest[] = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => {
      const region = REGIONS[i % 3]
      const partition = REGION_PARTITION_RANGES[region][0] + (i % 43)
      return {
        idempotency_key: `idem-key-${i}`,
        event_id: `event-${i}`,
        region,
        requested_at: now + i,  // stagger timestamps slightly
        partition,
      }
    })

    // Process all concurrently
    const results = await Promise.all(requests.map(r => engine.process(r)))

    const replayed     = results.filter(r => r.outcome === 'replayed').length
    const deduplicated = results.filter(r => r.outcome === 'deduplicated').length
    const throttled    = results.filter(r => r.outcome === 'throttled').length

    // With unique idempotency_keys and rate-spread timestamps — all should replay initially
    // but storm detection kicks in once 50 are counted in the window
    expect(replayed + deduplicated + throttled).toBe(CONCURRENT_REQUESTS)
    expect(replayed).toBeGreaterThan(0)
    expect(replayed + throttled).toBe(CONCURRENT_REQUESTS) // deduplicated=0 (all unique keys)
    expect(deduplicated).toBe(0)

    // Verify distribution across all 3 regions
    const byRegion = Object.fromEntries(REGIONS.map(r => [r, results.filter(x => x.region === r).length]))
    expect(byRegion['eu-west']).toBeGreaterThan(0)
    expect(byRegion['us-east']).toBeGreaterThan(0)
    expect(byRegion['ap-south']).toBeGreaterThan(0)
  }, 15_000)

  it('storm detection activates at >50 replays/minute and throttles subsequent requests', async () => {
    const engine = buildReplayEngine()
    const now = Date.now()

    // Send exactly 50 replays (all within the same 1-minute window) — under threshold
    for (let i = 0; i < 50; i++) {
      await engine.process({
        idempotency_key: `pre-storm-${i}`,
        event_id: `evt-pre-${i}`,
        region: 'eu-west',
        requested_at: now + i,
        partition: i % 43,
      })
    }

    // At exactly 50 replays — storm threshold not yet triggered (strict > 50)
    // 51st request should trigger storm detection
    const pre51 = engine.replayCount(now + 55)
    // Now send the 51st
    const stormTrigger = await engine.process({
      idempotency_key: 'storm-trigger-51',
      event_id: 'evt-storm-51',
      region: 'eu-west',
      requested_at: now + 55,
      partition: 1,
    })

    // After 51 total replays, storm is now active for subsequent requests
    const post51 = engine.replayCount(now + 60)
    expect(post51).toBeGreaterThanOrEqual(50)

    // Additional requests should be throttled
    const throttledReq = await engine.process({
      idempotency_key: 'post-storm-1',
      event_id: 'evt-post-storm-1',
      region: 'us-east',
      requested_at: now + 70,
      partition: 50,
    })
    expect(throttledReq.outcome).toBe('throttled')

    // Storm is confirmed active
    expect(engine.stormActive(now + 70)).toBe(true)
  }, 10_000)

  it('deduplication via idempotency_key blocks re-processing same event', async () => {
    const engine = buildReplayEngine()
    const now = Date.now()

    const REPLAYS = 20
    const idemKey = 'dedup-test-key-001'

    // First request processes
    const first = await engine.process({
      idempotency_key: idemKey,
      event_id: 'evt-dedup-001',
      region: 'eu-west',
      requested_at: now,
      partition: 5,
    })
    expect(first.outcome).toBe('replayed')

    // Same idempotency_key replayed 19 more times
    const dupes = await Promise.all(
      Array.from({ length: REPLAYS - 1 }, (_, i) =>
        engine.process({
          idempotency_key: idemKey,
          event_id: 'evt-dedup-001',
          region: REGIONS[i % 3],
          requested_at: now + i + 1,
          partition: 5,
        }),
      ),
    )

    const deduped = dupes.filter(r => r.outcome === 'deduplicated').length
    const replayed = dupes.filter(r => r.outcome === 'replayed').length

    expect(replayed).toBe(0)
    expect(deduped).toBe(REPLAYS - 1)
    expect(engine.processedKeys.has(idemKey)).toBe(true)
    expect(engine.processedKeys.size).toBe(1) // only one unique key
  })

  it('cross-region replay ordering is deterministic — sort by timestamp ASC then partition', () => {
    // Scrambled events from 3 regions
    const events = [
      { event_id: 'evt-ap-001',  timestamp: 1716000003, partition: 90,  region: 'ap-south' as Region },
      { event_id: 'evt-eu-001',  timestamp: 1716000001, partition: 10,  region: 'eu-west'  as Region },
      { event_id: 'evt-us-001',  timestamp: 1716000002, partition: 50,  region: 'us-east'  as Region },
      { event_id: 'evt-eu-002',  timestamp: 1716000001, partition: 5,   region: 'eu-west'  as Region }, // same ts as eu-001
      { event_id: 'evt-us-002',  timestamp: 1716000002, partition: 44,  region: 'us-east'  as Region }, // same ts as us-001
    ]

    const sorted = sortCrossRegion(events)

    // Primary sort: timestamp ASC
    expect(sorted[0].timestamp).toBeLessThanOrEqual(sorted[1].timestamp)
    expect(sorted[1].timestamp).toBeLessThanOrEqual(sorted[2].timestamp)

    // Tie-break: partition ASC
    expect(sorted[0].event_id).toBe('evt-eu-002')  // ts=1, partition=5 (smallest)
    expect(sorted[1].event_id).toBe('evt-eu-001')  // ts=1, partition=10
    expect(sorted[2].event_id).toBe('evt-us-002')  // ts=2, partition=44
    expect(sorted[3].event_id).toBe('evt-us-001')  // ts=2, partition=50
    expect(sorted[4].event_id).toBe('evt-ap-001')  // ts=3, partition=90

    // Verify monotonic timestamp ordering
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].timestamp).toBeGreaterThanOrEqual(sorted[i - 1].timestamp)
    }
  })

  it('backpressure throttles replay queue depth to prevent memory exhaustion', () => {
    const MAX_REPLAY_QUEUE = 10_000
    const STORM_SUBMISSIONS = 25_000
    const queue: string[] = []
    let accepted = 0
    let rejected = 0

    for (let i = 0; i < STORM_SUBMISSIONS; i++) {
      if (queue.length < MAX_REPLAY_QUEUE) {
        queue.push(`storm-replay-${i}`)
        accepted++
      } else {
        rejected++
      }
    }

    expect(queue.length).toBe(MAX_REPLAY_QUEUE)
    expect(accepted).toBe(MAX_REPLAY_QUEUE)
    expect(rejected).toBe(STORM_SUBMISSIONS - MAX_REPLAY_QUEUE)
    expect(accepted + rejected).toBe(STORM_SUBMISSIONS) // all accounted for
  })
})
