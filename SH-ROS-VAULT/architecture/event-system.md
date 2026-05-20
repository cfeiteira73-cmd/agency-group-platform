# SH-ROS Event System Design
## Version: 1.0.0 | Created: 2026-05-19

> Full spec in system-bible/SH-ROS_MASTER_BIBLE.md Section 4.

---

## BaseEvent Interface

```typescript
interface BaseEvent {
  id: string;                       // UUID v4, globally unique
  type: EventType;                  // typed enum
  correlation_id: string;           // from X-Correlation-ID header
  tenant_id: string;                // default: 'agency-group'
  timestamp: string;                // ISO 8601 UTC
  payload: Record<string, unknown>; // event-specific data
  source?: string;                  // originating service/route
  version?: string;                 // schema version, default '1.0'
}
```

---

## EventBus Implementation

**File**: `lib/events/eventBus.ts`

```
publish(event) flow:
  1. Compute dedup key: sha256(event.id + event.type + JSON(event.payload))
  2. Check Redis: GET {tenant_id}:ev_dedup:{hash}
     → If exists: DROP event (already processed within 24h)
     → If not: SET with TTL 86400s
  3. Fan-out to all registered handlers for event.type
     → Each handler in isolated try/catch
     → Failures logged but do not block other handlers
  4. Persist to Supabase event_history (fire-and-forget, void)
```

**Subscriber registration**:
```typescript
eventBus.subscribe('match_created', async (event: BaseEvent) => { ... });
eventBus.unsubscribe('match_created', handlerRef);
```

---

## Dedup Strategy

- **Mechanism**: Redis key per event (content-addressed by payload hash)
- **TTL**: 24 hours (events cannot be replayed more than once per 24h without force flag)
- **Key format**: `{tenant_id}:ev_dedup:{sha256(id+type+payload)}`
- **Force replay**: Only available to `super_admin` via `?force=true` on replay endpoint
- **Idempotency guarantee**: Safe to call publish() multiple times; only first will process

---

## Persistence

**Table**: `event_history`
```sql
CREATE TABLE event_history (
  id             UUID PRIMARY KEY,
  type           TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  tenant_id      TEXT NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL,
  payload        JSONB NOT NULL,
  source         TEXT,
  version        TEXT DEFAULT '1.0',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_event_history_correlation ON event_history(correlation_id);
CREATE INDEX idx_event_history_type_tenant ON event_history(type, tenant_id, timestamp DESC);
```
- No RLS (system-level table — accessed only by service role)
- Retention: indefinite (source of truth for replay engine)

---

## Tenant Scoping

- Every event carries `tenant_id`
- Redis keys are namespaced: `{tenant_id}:ev_dedup:...`
- Supabase queries always filter: `WHERE tenant_id = $1`
- `TENANT_ISOLATION_ENABLED=true` → subscribers check tenant match before processing
- Current deployment: single tenant `'agency-group'`

---

## Mandatory Event Types

| Event Type | Trigger Condition | Handler |
|-----------|-------------------|---------|
| `match_created` | New match score computed | deal-pack auto-trigger (if ≥ 80) |
| `deal_pack_generated` | Deal pack assembled | agent notification |
| `deal_pack_sent` | Deal pack delivered to buyer | 3-day follow-up timer start |
| `response_received` | Buyer replies (any channel) | CRM orchestrator handoff |
| `call_booked` | Viewing scheduled | viewing prep pack generation |
| `proposal_sent` | Formal offer submitted | legal team alert |
| `cpcv_signed` | CPCV document signed | 50% commission trigger |
| `escritura_signed` | Deed signed | final 50% commission trigger |
| `deal_closed` | Transaction complete | investor relations update |
| `deal_lost` | Deal fell through | causal analysis trigger |
| `ai_policy_violation` | DENY from policy engine | SIEM alert |
| `circuit_opened` | Circuit breaker trips | Sentry alert |
| `vault_integrity_failed` | Score < 95 | SIEM alert CRITICAL |
