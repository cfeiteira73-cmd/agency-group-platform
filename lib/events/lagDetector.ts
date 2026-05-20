// Agency Group — Kafka Consumer Lag Detector
// lib/events/lagDetector.ts
// TypeScript strict — 0 errors
//
// Real consumer lag detection using the kafkajs Admin client.
// Fetches committed offsets per consumer group and compares against
// the log-end offset for each topic-partition to compute lag.
//
// Design decisions:
// - Dynamic import of kafkajs (zero cost when KAFKA_BROKERS not set)
// - Returns [] when KAFKA_BROKERS is unset — never throws
// - All errors are caught and logged; callers always get a safe result
// - Imports CONSUMER_GROUPS from kafkaTopics as default groupIds

import { CONSUMER_GROUPS, KAFKA_TOPICS } from './kafkaTopics'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TopicLagInfo {
  topic: string
  partition: number
  groupId: string
  currentOffset: number
  logEndOffset: number
  lag: number
}

export interface ConsumerGroupLag {
  groupId: string
  topics: TopicLagInfo[]
  totalLag: number
  /** healthy: totalLag < 1 000 | warning: 1 000–9 999 | critical: ≥ 10 000 */
  status: 'healthy' | 'warning' | 'critical'
}

// ─── kafkajs minimal admin types (dynamic import surface) ─────────────────────

interface PartitionOffset {
  partition: number
  offset: string
}

interface TopicPartitionOffset {
  topic: string
  partitions: PartitionOffset[]
}

interface GroupOffsets {
  topic: string
  partitions: Array<{
    partition: number
    offset: string
    metadata: string | null
  }>
}

interface KafkaAdminClient {
  connect(): Promise<void>
  disconnect(): Promise<void>
  fetchOffsets(opts: { groupId: string; topics: string[] }): Promise<GroupOffsets[]>
  fetchTopicOffsets(topic: string): Promise<PartitionOffset[]>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyLag(totalLag: number): 'healthy' | 'warning' | 'critical' {
  if (totalLag >= 10_000) return 'critical'
  if (totalLag >= 1_000)  return 'warning'
  return 'healthy'
}

function safeParseOffset(raw: string): number {
  const n = parseInt(raw, 10)
  return isNaN(n) || n < 0 ? 0 : n
}

// All canonical topics as a flat array for admin queries
const ALL_TOPICS: string[] = Object.values(KAFKA_TOPICS)

// Default group IDs from the topic registry
const DEFAULT_GROUP_IDS: string[] = Object.values(CONSUMER_GROUPS)

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Fetches consumer lag for the given group IDs (defaults to all CONSUMER_GROUPS).
 *
 * Returns an empty array when:
 * - KAFKA_BROKERS env var is not set
 * - Any error occurs during the admin API call
 *
 * Never throws.
 */
export async function detectConsumerLag(
  groupIds: string[] = DEFAULT_GROUP_IDS,
): Promise<ConsumerGroupLag[]> {
  const brokersEnv = process.env.KAFKA_BROKERS
  if (!brokersEnv) return []

  const brokers = brokersEnv
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean)

  if (brokers.length === 0) return []

  let admin: KafkaAdminClient | null = null

  try {
    const { Kafka, logLevel } = await import('kafkajs')

    const kafka = new Kafka({
      clientId: 'ag-lag-detector',
      brokers,
      logLevel: logLevel.ERROR,
      retry: { initialRetryTime: 200, retries: 2 },
    })

    admin = kafka.admin() as unknown as KafkaAdminClient
    await admin.connect()

    // Fetch log-end offsets for all topics once (shared across groups)
    const topicEndOffsetMap = new Map<string, Map<number, number>>()

    for (const topic of ALL_TOPICS) {
      try {
        const partitionOffsets: PartitionOffset[] = await admin.fetchTopicOffsets(topic)
        const partMap = new Map<number, number>()
        for (const po of partitionOffsets) {
          partMap.set(po.partition, safeParseOffset(po.offset))
        }
        topicEndOffsetMap.set(topic, partMap)
      } catch {
        // Topic may not exist yet — skip without failing the whole detector
      }
    }

    const results: ConsumerGroupLag[] = []

    for (const groupId of groupIds) {
      try {
        // Only query topics that actually exist in the cluster
        const availableTopics = ALL_TOPICS.filter((t) => topicEndOffsetMap.has(t))

        const groupOffsets: GroupOffsets[] = await admin.fetchOffsets({
          groupId,
          topics: availableTopics,
        })

        const topicLagInfos: TopicLagInfo[] = []

        for (const groupTopicOffsets of groupOffsets) {
          const endOffsets = topicEndOffsetMap.get(groupTopicOffsets.topic)
          if (!endOffsets) continue

          for (const partitionData of groupTopicOffsets.partitions) {
            const currentOffset = safeParseOffset(partitionData.offset)
            const logEndOffset  = endOffsets.get(partitionData.partition) ?? currentOffset
            const lag           = Math.max(0, logEndOffset - currentOffset)

            topicLagInfos.push({
              topic:         groupTopicOffsets.topic,
              partition:     partitionData.partition,
              groupId,
              currentOffset,
              logEndOffset,
              lag,
            })
          }
        }

        const totalLag = topicLagInfos.reduce((sum, t) => sum + t.lag, 0)

        results.push({
          groupId,
          topics:   topicLagInfos,
          totalLag,
          status:   classifyLag(totalLag),
        })
      } catch (err) {
        console.warn(
          `[LagDetector] failed to fetch offsets for group "${groupId}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
        // Include group with zero lag rather than omitting it entirely
        results.push({
          groupId,
          topics:   [],
          totalLag: 0,
          status:   'healthy',
        })
      }
    }

    return results
  } catch (err) {
    console.error(
      `[LagDetector] admin client error: ${err instanceof Error ? err.message : String(err)}`,
    )
    return []
  } finally {
    if (admin) {
      try {
        await admin.disconnect()
      } catch {
        // Ignore disconnect errors — best effort cleanup
      }
    }
  }
}

// ─── Quick health signal ──────────────────────────────────────────────────────

/**
 * Returns the total lag summed across all consumer groups.
 * Convenience function for a single health-check number.
 * Returns 0 when KAFKA_BROKERS is not set or any error occurs.
 */
export async function getTotalLag(): Promise<number> {
  const groups = await detectConsumerLag()
  return groups.reduce((sum, g) => sum + g.totalLag, 0)
}
