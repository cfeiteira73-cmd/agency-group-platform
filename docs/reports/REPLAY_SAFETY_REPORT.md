# REPLAY_SAFETY_REPORT — SH-ROS Ω∞∞
**Agency Group | Institutional Autonomous Revenue OS**
**Report Date:** 2026-05-15 | **Auditor:** SH-ROS Internal Audit Engine v1.0
**Classification:** Engineering Truth — No Optimism Bias

---

## Executive Summary

Event replay is a powerful recovery mechanism in an event-sourced architecture — it allows the system to reprocess past events to recover from failures, backfill missing state, or re-execute workflows that failed silently. However, replay is also one of the highest-risk operations in any production system that interfaces with external services. Sending a duplicate email, triggering a duplicate webhook, or re-recording a financial transaction can have real-world consequences that cannot be undone by rollback.

SH-ROS Omega implements replay through `queueReplayEngine` (Ω-1) and `replayArchive` in the cold memory subsystem. The deduplication infrastructure is present: `replayArchive` has an idempotency guard; `QueueReplayEngine` has a deduplication window covering the last 1,000 events in the replay batch. However, the system does not currently classify events by replay safety at the type level — this classification must be enforced by the operator at replay time, relying on documentation rather than code.

**Replay Safety Score: 88/100**

The score reflects strong deduplication infrastructure and a well-defined safe/unsafe classification. The deductions reflect the absence of enforcement at the type level and the lack of user-level replay authorization.

---

## Score Breakdown

| Dimension | Score | Notes |
|---|---|---|
| Deduplication Coverage | 18/20 | idempotency guard in replayArchive; 1000-event DLQ dedup |
| Safe/Unsafe Event Classification | 17/20 | Classification defined; not enforced by code |
| Replay Authorization | 14/20 | System-level only; no user-level granularity |
| Max Replay Window Safety | 19/20 | 90-day window; schema drift risk documented |
| Recovery Completeness | 20/20 | All failure scenarios have a replay recovery path |
| **TOTAL** | **88/100** | |

---

## Safe-to-Replay Event Types

The following event types are classified as safe to replay because they are idempotent — replaying them will produce the same system state without side effects.

### kpi_snapshot
**Why safe:** KPI snapshots are read-only aggregations persisted to the analytics warehouse. Replaying a kpi_snapshot event overwrites the existing snapshot with identical data (or the recomputed value, which is deterministic given the same underlying data). No external system is notified.
**Idempotency mechanism:** Upsert on (org_id, snapshot_date, kpi_type) key
**Replay use case:** Recovering from an analytics warehouse corruption or backfilling KPI history after a schema migration

### learning_outcome
**Why safe:** Learning outcome records are append-only. A duplicate learning_outcome event will attempt to insert a record with the same outcome_id. The idempotency guard in `replayArchive` detects this and skips the duplicate write.
**Idempotency mechanism:** Unique constraint on outcome_id in learning_events table; replayArchive idempotency guard
**Replay use case:** Recovering from a learning engine processing failure; re-running calibration after a weight rollback

### cold_archive
**Why safe:** Cold archive events represent the compression and cold storage of warm memory records. Replaying a cold_archive event re-compresses already-compressed records, producing identical output. The compression engine is deterministic.
**Idempotency mechanism:** Content-addressable storage key; duplicate archive event produces same cold storage entry
**Replay use case:** Recovering from a cold memory store failure; migrating cold storage to a new provider

### pipeline_stage_transition (internal read-only)
**Why safe:** Internal stage transition events update pipeline state in the database. The orchestrator applies an idempotent upsert — replaying a transition to the same stage produces no change if the deal is already in that stage.
**Idempotency mechanism:** Upsert on (deal_id, stage) with timestamp check — only advances stage, never reverses
**Replay use case:** Recovering from an orchestrator crash mid-transition

### score_computed
**Why safe:** Score computation is deterministic given the same input features. Replaying a score_computed event overwrites the stored score with an identical value.
**Idempotency mechanism:** Upsert on (entity_id, score_type, computed_at)
**Replay use case:** Backfilling scores after a scoring model update (though this requires explicit decision to replay historical scoring)

---

## Unsafe-to-Replay Event Types

The following event types must NOT be replayed without explicit operator review and confirmation of no prior execution. Replaying these events causes external side effects that cannot be undone by the system.

### deal_pack_sent
**Why unsafe:** Triggers an outbound email via Resend containing the deal pack PDF. If replayed, the buyer/seller receives a duplicate email with the deal pack. This is not a data integrity issue — it is a client experience issue that can damage trust and create confusion.
**External effect:** Resend email sent to buyer/seller
**Idempotency status:** NOT idempotent — Resend does not deduplicate on message content; each API call sends a new email
**Safe replay condition:** Only safe if the recipient email address is confirmed to have NOT received the original. Verify in Resend dashboard before replay.
**Recommendation:** Add a pre-replay check that queries Resend email log API to confirm delivery status before allowing deal_pack_sent replay.

### webhook_triggered
**Why unsafe:** Webhook delivery to external systems (CRM, partner APIs, n8n) does not carry idempotency guarantees in the current implementation. A replayed webhook_triggered event will re-deliver the webhook payload to the external endpoint.
**External effect:** HTTP POST to external endpoint; downstream processing by receiving system
**Idempotency status:** Depends on receiving system — many webhook receivers are not idempotent
**Safe replay condition:** Only safe if the receiving system implements idempotency keyed on the event_id, AND the event_id is included in the webhook payload. Verify before replay.
**Recommendation:** Include a stable `event_id` field in all webhook payloads. Document which receiving systems are idempotent.

### payment_confirmed
**Why unsafe:** Represents a financial transaction confirmation. Replaying this event could trigger a duplicate commission payment request, a duplicate Stripe charge, or a duplicate financial record.
**External effect:** Financial side effect — potential double payment
**Idempotency status:** NOT safe to replay without financial reconciliation
**Safe replay condition:** Only safe if the payment record does not exist in the financial ledger. Requires manual audit before replay.
**Recommendation:** payment_confirmed events should require Tier 5 governance approval before any replay is permitted. This should be enforced by code, not just documentation.

### email_notification_sent
**Why unsafe:** Similar to deal_pack_sent. Duplicate notification emails degrade the client experience and create confusion.
**External effect:** Outbound Resend email
**Idempotency status:** NOT idempotent
**Safe replay condition:** Verify original email delivery failed before replaying.

### visit_confirmation_sent
**Why unsafe:** Sends an SMS or email confirmation to a buyer confirming a visit time. Replaying sends a duplicate confirmation, potentially causing the buyer to contact the agent about the duplicate.
**External effect:** SMS or email to buyer
**Idempotency status:** NOT idempotent
**Safe replay condition:** Only if original delivery is confirmed to have failed.

---

## Deduplication Coverage

### replayArchive Idempotency Guard
The `replayArchive` module (cold memory subsystem) implements an idempotency guard that checks for the existence of an `archive_id` before writing a new cold archive record. This prevents duplicate cold-storage entries when the same event is replayed multiple times.

**Coverage:** All cold archive operations
**Gap:** The idempotency guard covers cold memory replay only. It does not cover queue replay (events that re-enter the live queue for reprocessing).

### QueueReplayEngine Deduplication Window
The `queueReplayEngine` implements deduplication within a sliding window of the last 1,000 events in the current replay batch. If the same event_id appears twice within this window, the second occurrence is discarded.

**Coverage:** All events in a single replay batch, within the 1,000-event window
**Gap 1:** If the same event_id appears in two separate replay batches (not within the same 1,000-event window), both will be processed. This means large replays (>1,000 events) require careful batch construction to avoid cross-batch duplicates.
**Gap 2:** The deduplication window is in-memory only — it does not consult the database to check whether an event_id was processed in a previous session. A restart of the replay engine resets the dedup window.

**Recommendation:** Implement a persistent dedup set (Redis or database table) for replay operations on events with external side effects. The in-memory 1,000-event window is sufficient for pure idempotent event types but insufficient for unsafe event types.

---

## Replay Authorization

### Current State: System-Level Authorization Only

The `queueReplayEngine` and `replayArchive` do not implement user-level authorization. Any authenticated system service (any caller with a valid service role key) can replay any event in the replay window. There is no check that:
- The replaying principal belongs to the same org as the event being replayed
- The replaying principal has explicit permission to replay events of this type
- The replay has been approved through the governance layer for unsafe event types

**Risk:** An authenticated operator with system-level access (e.g., a developer with access to the service role key) could replay financial events belonging to any org, or replay unsafe event types without proper review.

**Recommendation:** Add the following authorization checks to replay operations:
1. Verify calling principal's org_id matches event's org_id (prevents cross-tenant replay)
2. For unsafe event types (payment_confirmed, deal_pack_sent, webhook_triggered), require a governance approval token in the replay request
3. Log all replay operations to `lib/auth/auditLog.ts` with full principal context

---

## Maximum Replay Window

### Safe Replay Window: 90 Days

Events older than 90 days are classified as outside the safe replay window. This limit exists for two reasons:

1. **Schema drift risk:** The data schema of SH-ROS evolves over time. An event payload serialized 120 days ago may have fields that no longer exist in the current schema, or may be missing fields that are now required. Replaying such an event through the current orchestrator may produce unexpected behavior.

2. **Orphan recovery window:** The `orphanRecovery` module has a maximum lookback window. Events older than 90 days are beyond this window and would not be recognized as orphans even if their leases are still open.

**Schema drift risk assessment:** The riskiest scenario is a database migration that adds a NOT NULL column without a default. An event replayed after such a migration would fail to insert if its payload does not include the new column. **Recommendation:** When running database migrations, add the replay exclusion date to the event archive metadata so the replay engine knows which schema version applies to historical events.

---

## Known Risks

| Risk | Severity | Likelihood | Mitigation Status |
|---|---|---|---|
| Unsafe event replayed without review | HIGH | LOW | Documentation only — no code enforcement |
| Cross-batch dedup window miss (>1000 events) | MEDIUM | LOW | Architecture limitation |
| Schema drift on events older than 90 days | MEDIUM | MEDIUM | 90-day limit documented; not enforced by code |
| Cross-tenant replay by privileged principal | HIGH | LOW | No authorization check currently |
| payment_confirmed replayed → double payment | CRITICAL | VERY LOW | No code guard; manual process only |

---

## Summary of Replay Safety Recommendations

| Priority | Action | Effort | Severity |
|---|---|---|---|
| P1 | Add user-level replay authorization (org_id check + governance for unsafe types) | 2 days | HIGH |
| P2 | Persist dedup set to Redis for cross-batch and cross-session deduplication | 1 day | MEDIUM |
| P3 | Enforce payment_confirmed replay requires Tier 5 governance approval — in code | 1 day | CRITICAL |
| P4 | Add pre-replay Resend delivery check for email event types | 1 day | MEDIUM |
| P5 | Log all replay operations to auditLog.ts with full principal context | 0.5 days | MEDIUM |
| P6 | Store schema version tag on all archived events | 2 days | LOW-MEDIUM |

---

*This report was generated by the SH-ROS Internal Audit Engine. Replay safety classifications are based on static analysis of event type definitions and external integration behavior as of 2026-05-15. Replay operations in production must always be preceded by a manual review of this classification table.*
