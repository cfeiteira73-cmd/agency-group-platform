// AGENCY GROUP — SH-ROS Global Scale | AMI: 22506
// kafkaPartitionLoss.spec.ts — Kafka partition loss and recovery simulation
import { describe, it, expect, vi, beforeEach } from 'vitest'

const NUM_PARTITIONS = 128
const LOSS_PERCENT   = 0.20   // 20% partition loss

type RoutingMode = 'kafka' | 'db-queue' | 'kafka+db-fallback'

interface Partition {
  id: number
  available: boolean
  replicaAvailable: boolean
  queueDepth: number
}

interface RoutedEvent {
  event_id: string
  destination: 'kafka-primary' | 'kafka-replica' | 'db-queue'
  partition: number
}

// FNV-1a for deterministic partition assignment
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (Math.imul(hash, 0x01000193) >>> 0)
  }
  return hash
}

function buildKafkaSimulator() {
  const partitions: Partition[] = Array.from({ length: NUM_PARTITIONS }, (_, i) => ({
    id: i,
    available: true,
    replicaAvailable: true,
    queueDepth: 0,
  }))

  const dbQueue: string[] = []
  let distributedMode = true
  let routingMode: RoutingMode = 'kafka'

  function getPartition(eventId: string): number {
    return fnv1a32(eventId) % NUM_PARTITIONS
  }

  function losePartitions(indices: number[]): void {
    for (const i of indices) {
      if (i >= 0 && i < NUM_PARTITIONS) partitions[i].available = false
    }
  }

  function loseAllPartitions(): void {
    for (const p of partitions) {
      p.available = false
      p.replicaAvailable = false
    }
    distributedMode = false
    routingMode = 'db-queue'
  }

  function recoverPartitions(indices: number[]): void {
    for (const i of indices) {
      if (i >= 0 && i < NUM_PARTITIONS) {
        partitions[i].available = true
        // replica was always available, kafka-primary now back
      }
    }
  }

  function recoverAllKafka(): void {
    for (const p of partitions) {
      p.available = true
      p.replicaAvailable = true
    }
    distributedMode = true
    routingMode = 'kafka'
  }

  async function routeEvent(eventId: string): Promise<RoutedEvent> {
    const partition = getPartition(eventId)
    const p = partitions[partition]

    // Full kafka outage → db-queue only
    if (!distributedMode) {
      dbQueue.push(eventId)
      return { event_id: eventId, destination: 'db-queue', partition }
    }

    // Primary partition available
    if (p.available) {
      p.queueDepth++
      return { event_id: eventId, destination: 'kafka-primary', partition }
    }

    // Replica available — reroute
    if (p.replicaAvailable) {
      return { event_id: eventId, destination: 'kafka-replica', partition }
    }

    // Both unavailable → DB fallback (no event loss)
    dbQueue.push(eventId)
    return { event_id: eventId, destination: 'db-queue', partition }
  }

  function drainDbBacklog(): string[] {
    const drained = [...dbQueue]
    dbQueue.length = 0
    return drained
  }

  function unavailablePartitionIds(): number[] {
    return partitions.filter(p => !p.available).map(p => p.id)
  }

  function availablePartitionCount(): number {
    return partitions.filter(p => p.available).length
  }

  function getDbQueue() { return [...dbQueue] }
  function isDistributedMode() { return distributedMode }
  function getRoutingMode() { return routingMode }

  return {
    losePartitions, loseAllPartitions, recoverPartitions, recoverAllKafka,
    routeEvent, drainDbBacklog, unavailablePartitionIds, availablePartitionCount,
    getDbQueue, isDistributedMode, getRoutingMode, partitions,
  }
}

describe('Global Scale: Kafka Partition Loss and Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('20% partition loss — affected events reroute to replica, zero event loss', async () => {
    const kafka = buildKafkaSimulator()
    const lossCount = Math.floor(NUM_PARTITIONS * LOSS_PERCENT) // 25 partitions lost

    // Mark 25 partitions unavailable (primaries only, replicas still available)
    const lostIds = Array.from({ length: lossCount }, (_, i) => i * (NUM_PARTITIONS / lossCount) | 0)
    kafka.losePartitions(lostIds)

    expect(kafka.unavailablePartitionIds().length).toBe(lossCount)
    expect(kafka.availablePartitionCount()).toBe(NUM_PARTITIONS - lossCount)

    // Route 1000 events — all must land somewhere (primary, replica, or db)
    const EVENTS = 1000
    const results = await Promise.all(
      Array.from({ length: EVENTS }, (_, i) => kafka.routeEvent(`evt-partition-${i}`)),
    )

    const toPrimary = results.filter(r => r.destination === 'kafka-primary').length
    const toReplica = results.filter(r => r.destination === 'kafka-replica').length
    const toDb      = results.filter(r => r.destination === 'db-queue').length

    // Zero event loss: all events routed to exactly one destination
    expect(toPrimary + toReplica + toDb).toBe(EVENTS)
    expect(toReplica).toBeGreaterThan(0)  // some events hit replica cluster
    expect(toPrimary).toBeGreaterThan(0)  // most events still hit primary
    expect(toDb).toBe(0)                  // no db fallback — replicas available
  }, 15_000)

  it('full Kafka cluster outage → DB queue fallback activates, distributed mode deactivates', async () => {
    const kafka = buildKafkaSimulator()

    expect(kafka.isDistributedMode()).toBe(true)
    kafka.loseAllPartitions()

    expect(kafka.isDistributedMode()).toBe(false)
    expect(kafka.getRoutingMode()).toBe('db-queue')

    // Route events → all should land in DB queue
    const EVENTS = 200
    const results = await Promise.all(
      Array.from({ length: EVENTS }, (_, i) => kafka.routeEvent(`evt-fallback-${i}`)),
    )

    const toDb = results.filter(r => r.destination === 'db-queue').length
    expect(toDb).toBe(EVENTS)
    expect(kafka.getDbQueue()).toHaveLength(EVENTS)
  }, 10_000)

  it('recovery re-activates Kafka and drains DB backlog without duplication', async () => {
    const kafka = buildKafkaSimulator()

    // Simulate outage: fill DB backlog
    kafka.loseAllPartitions()
    const BACKLOG_SIZE = 500
    for (let i = 0; i < BACKLOG_SIZE; i++) {
      await kafka.routeEvent(`backlog-evt-${i}`)
    }
    expect(kafka.getDbQueue()).toHaveLength(BACKLOG_SIZE)

    // Recovery
    kafka.recoverAllKafka()
    expect(kafka.isDistributedMode()).toBe(true)
    expect(kafka.getRoutingMode()).toBe('kafka')

    // Drain backlog — each event drained exactly once
    const drained = kafka.drainDbBacklog()
    expect(drained).toHaveLength(BACKLOG_SIZE)
    expect(kafka.getDbQueue()).toHaveLength(0)

    // Dedup check: all drained IDs are unique
    const uniqueIds = new Set(drained)
    expect(uniqueIds.size).toBe(BACKLOG_SIZE)
  }, 10_000)

  it('partial partition loss does not affect overall FNV-1a assignment determinism', () => {
    const kafka = buildKafkaSimulator()

    // Same event ID must always map to same partition
    const eventId = 'determinism-test-event-fixed-id'
    const p1 = fnv1a32(eventId) % NUM_PARTITIONS
    const p2 = fnv1a32(eventId) % NUM_PARTITIONS

    expect(p1).toBe(p2)
    expect(p1).toBeGreaterThanOrEqual(0)
    expect(p1).toBeLessThan(NUM_PARTITIONS)

    // After partition loss — partition ID is the same (routing may differ, but assignment is stable)
    kafka.losePartitions([p1])
    const p3 = fnv1a32(eventId) % NUM_PARTITIONS
    expect(p3).toBe(p1) // assignment unchanged; routing logic handles failover
  })

  it('partition availability check correctly identifies lost and recovered partitions', () => {
    const kafka = buildKafkaSimulator()

    // Lose 10 specific partitions
    const tolose = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]
    kafka.losePartitions(tolose)
    expect(kafka.unavailablePartitionIds()).toEqual(expect.arrayContaining(tolose))
    expect(kafka.unavailablePartitionIds()).toHaveLength(tolose.length)

    // Recover 5 of them
    const toRecover = [0, 10, 20, 30, 40]
    kafka.recoverPartitions(toRecover)
    const stillDown = kafka.unavailablePartitionIds()
    expect(stillDown).toHaveLength(tolose.length - toRecover.length)
    expect(stillDown).toEqual(expect.arrayContaining([50, 60, 70, 80, 90]))
    expect(stillDown).not.toContain(0)
    expect(stillDown).not.toContain(10)
  })
})
