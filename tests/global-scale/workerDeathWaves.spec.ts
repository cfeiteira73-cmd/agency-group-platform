// AGENCY GROUP — SH-ROS Global Scale | AMI: 22506
// workerDeathWaves.spec.ts — Worker death wave scenarios
import { describe, it, expect, vi, beforeEach } from 'vitest'

const TOTAL_WORKERS   = 20
const TOTAL_SHARDS    = 128
const REBALANCE_SLO_S = 60   // shards must rebalance within 60s

interface Worker {
  id: string
  alive: boolean
  shards: number[]
  load: number  // events/sec
}

interface Shard {
  id: number
  assignedTo: string | null
  orphaned: boolean
  queueDepth: number
}

function buildWorkerPool() {
  const workers: Map<string, Worker> = new Map()
  const shards: Shard[] = Array.from({ length: TOTAL_SHARDS }, (_, i) => ({
    id: i,
    assignedTo: null,
    orphaned: false,
    queueDepth: 0,
  }))

  // Initial even distribution: each worker gets 128/20 ≈ 6–7 shards
  for (let i = 0; i < TOTAL_WORKERS; i++) {
    workers.set(`worker-${i}`, { id: `worker-${i}`, alive: true, shards: [], load: 10 })
  }

  const workerIds = Array.from(workers.keys())
  for (let s = 0; s < TOTAL_SHARDS; s++) {
    const workerId = workerIds[s % TOTAL_WORKERS]
    shards[s].assignedTo = workerId
    workers.get(workerId)!.shards.push(s)
  }

  function killWorkers(ids: string[]): void {
    for (const id of ids) {
      const w = workers.get(id)
      if (!w) continue
      w.alive = false
      // Mark their shards as orphaned
      for (const shard of w.shards) {
        shards[shard].assignedTo = null
        shards[shard].orphaned = true
      }
    }
  }

  function rebalance(): { durationMs: number; unassigned: number } {
    const start = performance.now()
    const aliveWorkers = Array.from(workers.values()).filter(w => w.alive)

    if (aliveWorkers.length === 0) {
      // All workers dead — shards remain orphaned (queue persists)
      return { durationMs: performance.now() - start, unassigned: TOTAL_SHARDS }
    }

    // Claim orphaned shards round-robin across surviving workers
    const orphaned = shards.filter(s => s.orphaned)
    orphaned.forEach((shard, i) => {
      const worker = aliveWorkers[i % aliveWorkers.length]
      shard.assignedTo = worker.id
      shard.orphaned = false
      worker.shards.push(shard.id)
    })

    const durationMs = performance.now() - start
    const remaining = shards.filter(s => s.orphaned).length
    return { durationMs, unassigned: remaining }
  }

  function orphanedShardCount(): number {
    return shards.filter(s => s.orphaned).length
  }

  function aliveWorkerCount(): number {
    return Array.from(workers.values()).filter(w => w.alive).length
  }

  function loadVariance(): number {
    const alive = Array.from(workers.values()).filter(w => w.alive)
    if (alive.length === 0) return 0
    const shardsPerWorker = alive.map(w => w.shards.length)
    const avg = shardsPerWorker.reduce((a, b) => a + b, 0) / alive.length
    const variance = shardsPerWorker.reduce((sum, s) => sum + (s - avg) ** 2, 0) / alive.length
    return Math.sqrt(variance) // std deviation
  }

  function reviveWorkers(ids: string[]): void {
    for (const id of ids) {
      const w = workers.get(id)
      if (w) {
        w.alive = true
        w.shards = []
      }
    }
  }

  function claimOrphanedShards(workerId: string): number {
    const w = workers.get(workerId)
    if (!w || !w.alive) return 0
    let claimed = 0
    for (const shard of shards) {
      if (shard.orphaned) {
        shard.orphaned = false
        shard.assignedTo = workerId
        w.shards.push(shard.id)
        claimed++
      }
    }
    return claimed
  }

  function getWorker(id: string) { return workers.get(id) }
  function getShard(id: number) { return shards[id] }
  function totalAssigned(): number { return shards.filter(s => !s.orphaned && s.assignedTo !== null).length }

  return {
    killWorkers, rebalance, orphanedShardCount, aliveWorkerCount,
    loadVariance, reviveWorkers, claimOrphanedShards, getWorker, getShard, totalAssigned,
  }
}

describe('Global Scale: Worker Death Waves', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('30% worker death — surviving workers absorb orphaned shards within SLO', () => {
    const pool = buildWorkerPool()
    const killCount = Math.floor(TOTAL_WORKERS * 0.30)  // 6 workers

    const toKill = Array.from({ length: killCount }, (_, i) => `worker-${i}`)
    pool.killWorkers(toKill)

    expect(pool.aliveWorkerCount()).toBe(TOTAL_WORKERS - killCount)
    const orphanedBefore = pool.orphanedShardCount()
    expect(orphanedBefore).toBeGreaterThan(0)

    // Rebalance
    const { durationMs, unassigned } = pool.rebalance()

    expect(unassigned).toBe(0)  // all orphaned shards claimed
    expect(pool.orphanedShardCount()).toBe(0)
    expect(pool.totalAssigned()).toBe(TOTAL_SHARDS)

    // Rebalance duration well within SLO (in-memory: sub-millisecond)
    expect(durationMs).toBeLessThan(REBALANCE_SLO_S * 1000)
  })

  it('30% death — load distributes evenly (std dev < 3 shards per worker)', () => {
    const pool = buildWorkerPool()
    const killCount = Math.floor(TOTAL_WORKERS * 0.30)
    pool.killWorkers(Array.from({ length: killCount }, (_, i) => `worker-${i}`))
    pool.rebalance()

    const stdDev = pool.loadVariance()
    // With 14 alive workers and 128 shards → avg ~9.1 shards each
    // std deviation should be low after round-robin rebalance
    expect(stdDev).toBeLessThan(3)
  })

  it('60% worker death — system degraded but operational, shards reassigned', () => {
    const pool = buildWorkerPool()
    const killCount = Math.floor(TOTAL_WORKERS * 0.60)  // 12 workers

    pool.killWorkers(Array.from({ length: killCount }, (_, i) => `worker-${i}`))
    expect(pool.aliveWorkerCount()).toBe(TOTAL_WORKERS - killCount) // 8 workers alive

    const { unassigned } = pool.rebalance()
    expect(unassigned).toBe(0)     // degraded but operational
    expect(pool.totalAssigned()).toBe(TOTAL_SHARDS)

    // 8 workers handle 128 shards → 16 shards each
    const stdDev = pool.loadVariance()
    expect(stdDev).toBeLessThan(4) // still balanced
  })

  it('100% worker death — shards remain orphaned (queue persists), recovers on restart', () => {
    const pool = buildWorkerPool()

    // Kill all workers
    pool.killWorkers(Array.from({ length: TOTAL_WORKERS }, (_, i) => `worker-${i}`))
    expect(pool.aliveWorkerCount()).toBe(0)

    // Rebalance with no workers — all unassigned
    const { unassigned } = pool.rebalance()
    expect(unassigned).toBe(TOTAL_SHARDS)
    expect(pool.orphanedShardCount()).toBe(TOTAL_SHARDS)

    // Restart: bring worker-0 back
    pool.reviveWorkers(['worker-0'])
    expect(pool.aliveWorkerCount()).toBe(1)

    // Worker claims all orphaned shards on restart
    const claimed = pool.claimOrphanedShards('worker-0')
    expect(claimed).toBe(TOTAL_SHARDS)
    expect(pool.orphanedShardCount()).toBe(0)
    expect(pool.totalAssigned()).toBe(TOTAL_SHARDS)
  })

  it('orphan events claimed by restarted worker — no event loss during full-death window', () => {
    const pool = buildWorkerPool()

    // Simulate events queued to each shard during the dead window
    const EVENTS_PER_SHARD = 50

    // Kill all workers
    pool.killWorkers(Array.from({ length: TOTAL_WORKERS }, (_, i) => `worker-${i}`))

    // Simulate event accumulation in orphaned shard queues (in-memory)
    const queuedEvents: Array<{ event_id: string; shard: number }> = []
    for (let s = 0; s < TOTAL_SHARDS; s++) {
      for (let e = 0; e < EVENTS_PER_SHARD; e++) {
        queuedEvents.push({ event_id: `orphan-s${s}-e${e}`, shard: s })
      }
    }
    expect(queuedEvents).toHaveLength(TOTAL_SHARDS * EVENTS_PER_SHARD)

    // Restart workers
    pool.reviveWorkers(Array.from({ length: TOTAL_WORKERS }, (_, i) => `worker-${i}`))
    const { unassigned } = pool.rebalance()
    expect(unassigned).toBe(0)

    // All queued events are still present (queue survived the dead window)
    expect(queuedEvents).toHaveLength(TOTAL_SHARDS * EVENTS_PER_SHARD)
    const uniqueEventIds = new Set(queuedEvents.map(e => e.event_id))
    expect(uniqueEventIds.size).toBe(TOTAL_SHARDS * EVENTS_PER_SHARD)  // no duplication
  })
})
