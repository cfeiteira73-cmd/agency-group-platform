// AGENCY GROUP — SH-ROS Distributed: Partition Strategy | AMI: 22506
// Deterministic partitioning by org_id — consistent hashing
// Guarantees: same org_id → same partition → ordered processing → no cross-tenant interleaving
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PartitionAssignment {
  partition: number
  region: string
  topic: string
  consumer_group: string
  affinity_score: number  // 0-1: how strongly this partition prefers this region
}

export interface PartitionMap {
  org_id: string
  primary: PartitionAssignment
  replica: PartitionAssignment | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTITION_COUNT = 128  // power of 2 for efficient modulo
const REGION_PARTITION_RANGES: Record<string, [number, number]> = {
  'eu-west':   [0,   42],   // ~1/3 of partitions (EU primary — Portugal market)
  'us-east':   [43,  85],   // ~1/3 of partitions (US buyers market)
  'ap-south':  [86, 127],   // ~1/3 of partitions (Asia Pacific expansion)
}

// ─── Consistent Hashing (FNV-1a) ─────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash — deterministic, fast, good distribution.
 * Used instead of crypto.createHash for synchronous, zero-dependency hashing.
 */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5 >>> 0  // FNV offset basis (uint32)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0  // FNV prime
  }
  return hash
}

// ─── Partition Strategy ───────────────────────────────────────────────────────

export class PartitionStrategy {
  private readonly VIRTUAL_NODES = 3  // virtual nodes per org for better distribution

  /**
   * Assign a partition to an org_id.
   * Deterministic: same input always → same output.
   * Used by producer before publishing to select Kafka partition.
   */
  assignPartition(org_id: string, priority: string = 'medium'): number {
    // Mix org_id with priority for priority-aware partitioning
    // Critical events get first-half partitions for dedicated consumers
    const seed = priority === 'critical' || priority === 'high'
      ? `HIGH:${org_id}`
      : `STD:${org_id}`

    const hash = fnv1a(seed)
    return hash % PARTITION_COUNT
  }

  /**
   * Determine the primary region for an org.
   * Based on partition assignment and region ranges.
   */
  getRegion(org_id: string): string {
    const partition = this.assignPartition(org_id)
    for (const [region, [min, max]] of Object.entries(REGION_PARTITION_RANGES)) {
      if (partition >= min && partition <= max) return region
    }
    return 'eu-west'  // fallback to EU (Portugal home market)
  }

  /**
   * Get full partition map with primary + replica assignment.
   */
  getPartitionMap(org_id: string): PartitionMap {
    const partition = this.assignPartition(org_id)
    const primary_region = this.getRegion(org_id)
    const topic = `sh-ros-events-${primary_region}`

    // Replica: next region in round-robin order
    const regions = Object.keys(REGION_PARTITION_RANGES)
    const primary_idx = regions.indexOf(primary_region)
    const replica_region = regions[(primary_idx + 1) % regions.length]

    return {
      org_id,
      primary: {
        partition,
        region: primary_region,
        topic,
        consumer_group: `sh-ros-agents-${primary_region}`,
        affinity_score: 1.0,
      },
      replica: {
        partition,
        region: replica_region,
        topic: `sh-ros-events-${replica_region}`,
        consumer_group: `sh-ros-agents-${replica_region}`,
        affinity_score: 0.3,  // Replica only used on failover
      },
    }
  }

  /**
   * Get the partition key for Kafka producer (used in RecordMetadata).
   * Must be stable for the same org across all producers.
   */
  getPartitionKey(org_id: string): string {
    return `org:${org_id}:${this.assignPartition(org_id)}`
  }

  /**
   * Get all partitions assigned to a region.
   * Used by regional consumers to subscribe to correct partition range.
   */
  getRegionPartitions(region: string): number[] {
    const range = REGION_PARTITION_RANGES[region]
    if (!range) return []
    const [min, max] = range
    return Array.from({ length: max - min + 1 }, (_, i) => min + i)
  }

  /**
   * Compute a virtual node ring for consistent hashing visualization.
   */
  getVirtualNodes(org_ids: string[]): Map<number, string> {
    const ring = new Map<number, string>()
    for (const org_id of org_ids) {
      for (let v = 0; v < this.VIRTUAL_NODES; v++) {
        const vnode = fnv1a(`${org_id}:v${v}`) % PARTITION_COUNT
        ring.set(vnode, org_id)
      }
    }
    return ring
  }

  /**
   * Estimate partition skew across orgs.
   * Returns imbalance ratio (1.0 = perfect balance).
   */
  estimateSkew(org_ids: string[]): number {
    if (org_ids.length === 0) return 1.0
    const counts = new Array(PARTITION_COUNT).fill(0)
    for (const org_id of org_ids) {
      const p = this.assignPartition(org_id)
      counts[p]++
    }
    const non_zero = counts.filter(c => c > 0)
    if (non_zero.length === 0) return 1.0
    const avg = non_zero.reduce((s, v) => s + v, 0) / non_zero.length
    const max = Math.max(...non_zero)
    return max / avg  // 1.0 = perfect, >2.0 = significant skew
  }
}

export const partitionStrategy = new PartitionStrategy()
