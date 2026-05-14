# INFRASTRUCTURE REPORT — FINAL
**SH-ROS Ω∞ | AMI: 22506 | Agency Group**
Generated: 2026-05-14

---

## Infrastructure Stack

| Component | Provider | Tier |
|---|---|---|
| Application | Vercel (Next.js 14) | Production |
| Database | Supabase PostgreSQL | Production |
| Queue (default) | Supabase runtime_events | Production |
| Queue (optional) | Redis Streams (ioredis) | Optional |
| Queue (optional) | Kafka (kafkajs) | Optional |
| Workflow Engine | DB-backed (default) / Temporal Cloud | Production |
| Cache | In-process LRU (HOT memory) | Production |
| Email | Resend | Production |
| AI/LLM | Anthropic Claude + OpenAI Embeddings | Production |
| Rate Limiting | Upstash Redis | Production |
| Automation | n8n (Cloud) | Production |
| Monitoring | OpenTelemetry → OTLP (optional) | Optional |

---

## Queue Provider Architecture

```
createQueueProvider()
├── QUEUE_PROVIDER=redis  → RedisStreamProvider (ioredis)
│                            ├── Stream: sh-ros:events:{org_id}
│                            ├── Consumer Group: sh-ros-agents
│                            └── DLQ: sh-ros:dlq:{org_id}
├── QUEUE_PROVIDER=kafka  → KafkaProvider (kafkajs)
│                            ├── Topics: sh-ros-events-{critical,high,medium,low}
│                            ├── DLQ: sh-ros-events-dlq
│                            └── Partitions: by org_id hash
└── QUEUE_PROVIDER=db     → DBFallbackProvider (Supabase)
     └── Table: runtime_events (default, always available)
```

## Workflow Engine Architecture

```
createWorkflowEngine()
├── TEMPORAL_ADDRESS set  → TemporalProvider
│                            └── Temporal Cloud
└── default              → DBWorkflowEngine
                              └── Table: operator_tasks
```

---

## Resilience Mechanisms

| Mechanism | Implementation |
|---|---|
| Queue fallback chain | Redis → Kafka → DB |
| Workflow fallback | Temporal → DB engine |
| Memory fallback | pgvector → TF-IDF → empty |
| DLQ after MAX_RETRIES=3 | Backoff: 1000/2000/5000ms |
| Orphan recovery | 5-minute threshold |
| Distributed locks | Optimistic locking via operator_tasks |
| Execution leases | Per-event per-agent |
| Split-brain protection | Quorum check before write |

---

## Cost Estimate (Monthly)

| Service | Cost (EUR) |
|---|---|
| Vercel Pro | ~20 |
| Supabase Pro | ~25 |
| Anthropic API (Claude) | ~50–150 (usage-based) |
| OpenAI Embeddings | ~5–15 |
| Resend | ~10 |
| n8n Cloud | ~20 |
| Upstash Redis | ~10 |
| **Total** | **~140–250/month** |

---

## Verdict: PASS ✅

Infrastructure is production-grade with full fallback chains. No single point of failure in revenue-critical paths.
