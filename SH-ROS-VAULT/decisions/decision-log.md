# SH-ROS Decision Log
## Version: 1.0.0 | Created: 2026-05-19
## Status: APPEND-ONLY — Never delete or modify existing entries

> Format: DECISION-{YYYY-MM-DD}-{N}
> All architecture decisions, trade-offs, and reversals must be logged here.

---

## DECISION-2026-05-19-001

**Date**: 2026-05-19
**Author**: SH-ROS Architecture Agent
**Category**: AI Control Plane
**Decision**: Policy engine fail-open for unregistered agents
**Context**: `withAI()` passes circuit names (e.g., 'anthropic-haiku') not agent registry IDs.
  If policy engine DENY'd unknown circuit names, all AI calls would be blocked on startup.
**Reason**: Fail-open preserves revenue operations. A silent DENY would kill all AI features
  with no visible error — harder to debug than an overspend.
**Impact**: Unregistered agent IDs pass through policy gate without token budget enforcement.
  Risk mitigated by: circuit breaker (Layer 7) + ai_audit_log (Layer 5) catching cost spikes.
**Alternatives considered**: DENY unknown agents (rejected — breaks all AI calls);
  ESCALATE unknown (rejected — would require human approval for every request)
**Monitoring**: `unusual AI spend` intrusion detection rule (3× daily average) compensates.
**Reversible**: Yes — change Rule 1 in `lib/ai/policyEngine.ts` to DENY and update agentRegistry.ts

---

## DECISION-2026-05-19-002

**Date**: 2026-05-19
**Author**: SH-ROS Architecture Agent
**Category**: Infrastructure
**Decision**: Queue adapter uses Supabase as primary backend (not Kafka or RabbitMQ)
**Context**: Background job processing needed for DLQ, match computation, follow-up workers.
**Reason**: Zero additional infrastructure cost. Supabase already in stack. PostgreSQL SKIP LOCKED
  provides reliable queue semantics without a separate message broker.
**Impact**: Queue throughput limited by PostgreSQL IOPS (~1,000 msg/s sustained, ~5,000/s burst).
  Sufficient for current scale (Agency Group processes <100 deals/day).
**Upgrade path**: Swap `QueueAdapter` implementation to Kafka/NATS. Interface is already
  abstracted in `lib/queue/QueueAdapter.ts` — no consumer code changes required.
**Cost**: Current: €0/month additional. Kafka managed: +€200-400/month.
**Reversible**: Yes — interface-based design isolates implementation

---

## DECISION-2026-05-19-003

**Date**: 2026-05-19
**Author**: SH-ROS Architecture Agent
**Category**: Data / Analytics
**Decision**: Causal graph uses Supabase queries (not Neo4j graph database)
**Context**: Revenue causal tracing requires graph traversal to answer "why did this deal close?"
**Reason**: Neo4j adds €200+/month infrastructure cost. Current deal volume (< 500/month)
  is well within PostgreSQL's ability to handle graph-like recursive CTE queries efficiently.
**Impact**: Graph queries with >100 hops may be slow (>500ms). Acceptable for analytical
  workloads (not user-facing latency). Currently max causal chain depth is ~12 steps.
**Upgrade path**: Neo4j adapter in `lib/graph/intelligence.ts` is interface-ready.
  When deal volume exceeds 2,000/month or query latency > 2s, migrate.
**Reversible**: Yes

---

## DECISION-2026-05-19-004

**Date**: 2026-05-19
**Author**: SH-ROS Architecture Agent
**Category**: AI Model Selection
**Decision**: Use claude-haiku-4-5 for volume agents, claude-opus-4-6 for reasoning agents
**Context**: Need to balance response quality vs. cost across 10 AI agents.
**Reason**:
  - haiku-4-5: Fast (< 1s), cheap (~€0.0002/1K tokens), sufficient for: chat, scoring, generation
  - opus-4-6: Slow (3-8s), expensive (~€0.015/1K tokens), needed for: legal, deal risk, orchestration
**Model assignment**:
  - Haiku: sofia-chat, avm-engine, lead-scorer, followup-generator, daily-brief, photo-scorer, heygen-script
  - Opus: crm-orchestrator, deal-risk, legal-advisor
**Cost impact**: ~85% of token volume on Haiku (cheap), ~15% on Opus (expensive)
  Estimated monthly AI cost at current scale: €150-250/month
**Reversible**: Yes — change model in agentRegistry.ts per agent

---

## DECISION-2026-05-19-005

**Date**: 2026-05-19
**Author**: SH-ROS Architecture Agent
**Category**: Security
**Decision**: Magic link tokens stored as SHA-256 hashes (never plaintext)
**Context**: Passwordless login via magic links sent to email.
**Reason**: If `used_magic_tokens` table is compromised, raw tokens cannot be reused
  (SHA-256 is one-way). Attacker cannot reverse hash to valid token.
**Implementation**: Token = `crypto.randomBytes(32)`. Store `sha256(token)`. Email contains raw token.
  On verify: compute sha256(submitted_token), check against DB.
**Race condition**: Handled by `timingSafeEqual` comparison to prevent timing attacks.
**Impact**: Slightly more complex verification logic. No user-visible change.
**Reversible**: Yes, but do not revert — security downgrade

---

## DECISION-2026-05-19-006

**Date**: 2026-05-19
**Author**: SH-ROS Architecture Agent
**Category**: Vault / Immutability
**Decision**: SH-ROS Master Bible is append-only (no overwrites)
**Context**: The system bible is the reconstruction document. Any modification risks losing
  canonical architecture decisions.
**Reason**: Append-only ensures all historical context is preserved. Amendments are versioned
  addenda at the bottom. This follows the immutable event log principle from Layer 1.
**Impact**: Slightly larger file over time. Benefit: full audit trail of all architecture evolutions.
**Enforcement**: vault_events table logs all vault writes. integrity score check detects
  unexpected modifications. Git history provides additional protection.
**Reversible**: N/A — this is a governance decision, not a technical trade-off

---

*New decisions: append below this line.*
