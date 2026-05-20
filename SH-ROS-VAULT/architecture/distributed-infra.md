# SH-ROS Distributed Infrastructure Architecture

**Classification:** VAULT — Architecture Canonical  
**Version:** 2.0  
**Updated:** 2026-05-19  
**Owner:** SH-ROS Platform Engineering

---

## 1. Current State: Upstash Redis Streams

### RedisStreamsAdapter

The primary event transport layer is implemented via `RedisStreamsAdapter` backed by Upstash Redis.
All tenant events flow through a single logical stream per environment:

```
Stream key:   shros:events:{env}
Consumer CG:  shros-workers-{worker_type}
Entry fields: event_type, tenant_id, payload (JSON), global_seq, partition_key, created_at
```

**Why Upstash Redis Streams now:**
- Serverless-native: no persistent connections, works inside Vercel Edge Functions
- Sub-10ms publish latency from EU-West (primary region)
- At-most-once or at-least-once semantics via XACK
- Cost-effective at current event volume (<500K events/day)
- Instant provisioning: no cluster management overhead

**Upstash connection config** (`lib/streams/redisStreamsAdapter.ts`):
```typescript
const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
```

---

## 2. Event Global Ordering

### global_seq: Redis INCR

Every event published to the stream is assigned a monotonically increasing `global_seq`
via a Redis atomic INCR before the XADD call:

```typescript
const seq = await redis.incr('shros:global_seq')
await redis.xadd('shros:events:prod', '*', {
  global_seq:    String(seq),
  tenant_id:     event.tenant_id,
  event_type:    event.event_type,
  partition_key: `${event.tenant_id}:${event.event_type}`,
  payload:       JSON.stringify(event.payload),
  created_at:    new Date().toISOString(),
})
```

This guarantees total ordering within a single Redis instance.  
Cross-region ordering (Phase 3) will use a distributed sequence via Kafka partition offsets.

### partition_key Strategy

Format: `{tenant_id}:{event_type}`

Examples:
- `agency-group:deal.created`
- `agency-group:lead.qualified`
- `tenant-b2b-001:automation.run`

Partition key drives consumer affinity: all events for a given tenant+event_type are
processed by the same worker consumer group member, preserving causal ordering per tenant.

---

## 3. Consumer Groups & Worker Registry

### Consumer Group Design

Each logical worker type registers its own consumer group against the main stream:

| Consumer Group              | Purpose                            | Max Concurrency |
|-----------------------------|------------------------------------|-----------------|
| `shros-workers-orchestrator`| Event routing + saga dispatch      | 3               |
| `shros-workers-revenue`     | Revenue attribution + causal trace | 2               |
| `shros-workers-ai`          | AI inference jobs + prompt dispatch| 5               |
| `shros-workers-crm`         | Lead/deal CRM mutations            | 3               |
| `shros-workers-notifications`| WhatsApp/email/push delivery      | 4               |
| `shros-workers-billing`     | Usage metering + Stripe sync       | 2               |
| `shros-workers-audit`       | Audit log writes + compliance      | 2               |

**Total: 7 worker types** — each tenant-partitioned via `partition_key` routing.

### Tenant-Partitioned Queue Design

Workers claim messages based on `partition_key` prefix matching their assigned tenant shard.
In the current single-tenant deployment (`agency-group`), all workers consume all events.
In multi-tenant Phase 2, a routing layer will pre-sort events into per-tenant sub-streams:

```
shros:events:prod:agency-group
shros:events:prod:tenant-b2b-001
shros:events:prod:tenant-luxury-002
```

Each tenant stream is isolated: a slow tenant cannot starve fast-tenant workers.

### Worker Heartbeat & Dead Letter Queue

Workers emit a heartbeat event every 30s. If a worker misses 3 consecutive heartbeats,
the orchestrator worker promotes pending messages (XPENDING) to the DLQ stream:

```
shros:dlq:prod
```

DLQ messages are visible in the Control Tower → Queue panel with retry/discard controls.

---

## 4. Migration Path: Kafka / NATS

### Phase 2: KafkaStreamAdapter Stub (Ready)

`lib/streams/kafkaStreamAdapter.ts` exports a `KafkaStreamAdapter` class that implements
the same `IEventStreamAdapter` interface as `RedisStreamsAdapter`. The stub is wire-ready:

```typescript
// To activate: install kafkajs, set KAFKA_BROKER_URL env var
import { Kafka } from 'kafkajs'

export class KafkaStreamAdapter implements IEventStreamAdapter {
  private kafka: Kafka
  private producer: Producer
  // ...publish(), consume(), ack() — interface-compatible with Redis adapter
}
```

**Switching adapters** requires only:
1. `STREAM_ADAPTER=kafka` env var
2. `KAFKA_BROKER_URL`, `KAFKA_SASL_USER`, `KAFKA_SASL_PASS` env vars
3. Factory in `lib/streams/streamFactory.ts` already reads `STREAM_ADAPTER` and returns correct instance

No application code changes needed — all workers use `IEventStreamAdapter` interface.

### Why Kafka at Phase 3

- Persistent log: replay any event from offset 0 (critical for audit + recovery)
- True partitioned parallelism: 12 partitions × 7 consumer groups = 84 concurrent workers
- Cross-datacenter replication (MirrorMaker 2): EU-West ↔ US-East
- Exactly-once semantics via transactional producers (Kafka 2.8+)
- 7-day retention for forensics + compliance replay

### NATS JetStream (Alternative)

If Kafka operational overhead is too high at Phase 2 volume, NATS JetStream is a viable
intermediate step:
- Lighter than Kafka, heavier than Redis (persistent, clustered)
- `NATSStreamAdapter` stub also exists in `lib/streams/natsStreamAdapter.ts`
- Subject hierarchy: `shros.events.{env}.{tenant_id}.{event_type}`

---

## 5. Multi-Region Roadmap

### Current: EU-West Primary (Vercel + Upstash)

| Component         | Provider         | Region        |
|-------------------|------------------|---------------|
| Next.js App       | Vercel Edge      | EU-West-1     |
| Upstash Redis     | Upstash          | EU-West (AWS) |
| Supabase DB       | Supabase         | EU-West-1     |
| Supabase Storage  | Supabase         | EU-West-1     |

All traffic routes through a single EU-West primary. Read replicas for Supabase
are planned but not yet provisioned.

### Phase 2: Vercel Edge Network + Regional Data Residency

Vercel's Edge Network auto-routes requests to the nearest PoP. For SH-ROS:
- Static assets + RSC shell: served from nearest Vercel edge PoP
- API routes: pinned to EU-West via `VERCEL_REGION` routing rules
- Upstash Redis: `global` replication enabled — reads served from nearest replica

Config in `vercel.json`:
```json
{
  "regions": ["fra1"],
  "functions": {
    "app/api/**": { "regions": ["fra1"] }
  }
}
```

### Phase 3 Target: Kafka Cluster + True Multi-Region

```
                    ┌─────────────────┐
                    │  Global LB      │
                    │  (Cloudflare)   │
                    └────────┬────────┘
               ┌─────────────┴─────────────┐
       EU-West (primary)          US-East (replica)
    ┌────────────────────┐    ┌────────────────────┐
    │ Kafka cluster (3n) │◄──►│ Kafka cluster (3n) │
    │ Supabase primary   │    │ Supabase read rep. │
    │ SH-ROS workers ×7  │    │ SH-ROS workers ×7  │
    └────────────────────┘    └────────────────────┘
```

**Failover:** If EU-West becomes unavailable, Cloudflare health checks promote US-East
to primary within 30s. Kafka MirrorMaker 2 ensures EU→US lag <2s under normal conditions.

**Data residency:** EU customer tenant data remains in EU-West. US tenant data in US-East.
Partition key includes region prefix: `eu:agency-group:deal.created`.

---

## 6. Operational Runbook

### Publish an event (application code)
```typescript
const stream = streamFactory.getAdapter()
await stream.publish({
  tenant_id:  'agency-group',
  event_type: 'deal.stage_changed',
  payload:    { deal_id: '...', from: 'qualifying', to: 'proposal' },
})
```

### Check stream lag
```bash
redis-cli XPENDING shros:events:prod shros-workers-ai - + 100
```

### Promote DLQ message to retry
```bash
redis-cli XMOVE shros:dlq:prod shros:events:prod <message-id>
```

### Scale a worker consumer group
Set `WORKER_AI_CONCURRENCY=10` env var and redeploy — the worker reads concurrency
from env at startup and claims up to N messages per XREADGROUP call.

---

## 7. Key Metrics & SLOs

| Metric                    | Target        | Alert Threshold |
|---------------------------|---------------|-----------------|
| Event publish latency     | p99 < 50ms    | > 200ms         |
| Consumer lag (all groups) | < 1,000 msgs  | > 10,000 msgs   |
| DLQ depth                 | 0             | > 100 msgs      |
| Worker heartbeat miss     | 0             | 3 consecutive   |
| Redis memory utilization  | < 70%         | > 85%           |
| Cross-region replication lag | < 2s       | > 10s (Phase 3) |

---

*Next update target: Phase 2 kickoff when tenant count exceeds 5 or event volume exceeds 2M/day.*
