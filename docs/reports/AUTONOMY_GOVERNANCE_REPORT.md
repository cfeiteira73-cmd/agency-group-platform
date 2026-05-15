# SH-ROS Autonomy Governance Report — Phase D
*Generated: 2026-05-15 | AMI: 22506 | Status: Production-Ready*

---

## Executive Summary

SH-ROS operates under a bounded autonomous execution model: AI agents can act, but only within precisely defined risk envelopes, confidence thresholds, and audit requirements. There is no uncontrolled autonomy. Every action is classified by risk tier, gated by confidence score, logged immutably, and reversible within a 72-hour window (where technically possible). Human approval is required for all revenue-critical actions exceeding €50,000 impact. Financial transactions are categorically prohibited from autonomous execution.

Key guarantees:
- 4-tier risk classification: LOW / MEDIUM / HIGH / CRITICAL
- Confidence gating: minimum thresholds per action type before autonomous execution
- Workflow chaining: maximum 5 autonomous hops per chain
- Audit trail: immutable, retained 2 years
- Rollback: 72-hour window, preserves audit trail
- Governance Score: 92/100

---

## Autonomy Framework

SH-ROS AI agents operate in one of three execution modes:

| Mode | Description | Requires Human |
|------|-------------|----------------|
| Auto-execute | Action taken immediately without notification | No |
| Auto + notify | Action taken, user notified after | No |
| Approve required | Action queued, human must approve before execution | Yes |
| Always human | Conceptually executed by AI but human must perform the action | Yes — always |

The mode assigned to any action is determined by its Risk Tier (fixed, defined at design time) and its Confidence Score (runtime, computed per execution).

---

## Action Risk Tiers

### Tier Definitions

| Tier | Examples | Autonomy Mode | Confidence Threshold |
|------|----------|---------------|---------------------|
| LOW | Score update, digest generation, report creation, data enrichment | Auto-execute | ≥ 0.70 |
| MEDIUM | Follow-up trigger, deal pack send, investor alert dispatch | Auto + notify | ≥ 0.80 |
| HIGH | Lead escalation, proposal generation, workflow activation, API write | Approve required | ≥ 0.90 |
| CRITICAL | Deal close action, contact deletion, financial transaction, contract modification | Always human | N/A (AI cannot execute) |

### Tier Assignment Criteria

**LOW tier:** Action is reversible, affects only internal state, no external communication triggered, financial impact <€0.

**MEDIUM tier:** Action may trigger external communication, affects user-visible workflow state, financial impact <€10,000, or moderate probability of downstream consequence.

**HIGH tier:** Action modifies significant pipeline state, triggers external-facing communication to high-value contacts, estimated financial impact €10,000–€50,000, or affects lead relationship.

**CRITICAL tier:** Action is irreversible, triggers legal obligations, involves financial commitment >€0, or affects contact data permanently. AI can analyze and recommend but cannot execute.

---

## Confidence Gating

Confidence score is computed at runtime for each AI recommendation. The score reflects the model's calibrated certainty about the action's correctness given available context.

### Confidence Thresholds by Action Type

| Action | Tier | Min Confidence | Additional Conditions |
|--------|------|---------------|----------------------|
| lead_score_update | LOW | 0.70 | None |
| daily_digest_generation | LOW | 0.70 | None |
| market_report_generation | LOW | 0.70 | None |
| contact_enrichment | LOW | 0.75 | None |
| followup_trigger | MEDIUM | 0.80 | Lead score ≥ 50 |
| deal_pack_send | MEDIUM | 0.80 | Lead score ≥ 80, deal pack quality score ≥ 70 |
| investor_alert_dispatch | MEDIUM | 0.82 | Property match score ≥ 75 |
| stale_lead_recovery | MEDIUM | 0.80 | Last contact >21 days |
| lead_escalation | HIGH | 0.90 | Senior agent available |
| proposal_generation | HIGH | 0.90 | Lead score ≥ 85 |
| workflow_activation | HIGH | 0.92 | Admin-level authority confirmed |
| api_write_external | HIGH | 0.90 | Integration health ≥ 99% |
| revenue_alert (>€10K) | MEDIUM | Auto | No threshold — always auto |
| external_communication | HIGH | 0.90 | Requires human review |
| financial_transaction | CRITICAL | Prohibited | Human only |
| contact_deletion | CRITICAL | Prohibited | Human only |
| deal_close_action | CRITICAL | Prohibited | Human only |

### What Happens When Confidence Is Below Threshold

1. Action is not executed.
2. Action is logged as "blocked — confidence below threshold."
3. Recommendation is surfaced to the assigned human reviewer.
4. Human can override and execute manually (with action annotated as "human override").
5. Human override is logged separately (operator identity, timestamp, reason if provided).

---

## Workflow Chaining Limits

SH-ROS supports workflow chains — sequences of autonomous actions triggered by each other. Left unconstrained, chains can produce unintended behavior through compounded errors.

### Chain Safety Rules

**Maximum chain length:** 5 autonomous hops per chain.

At hop 6, the chain is paused and a human review is required before continuation. This prevents runaway automation sequences even if each individual hop passes confidence gating.

**Per-hop requirements:**

For each hop in a chain, all three conditions must be satisfied:
1. Confidence ≥ tier threshold (computed fresh for each hop)
2. Risk tier allows auto-execution at current state
3. Audit log entry written before action (not after)

**Chain break conditions:**

| Condition | Result |
|-----------|--------|
| Hop confidence below threshold | Chain breaks, human review required |
| Hop produces error | Chain breaks, error logged, human notified |
| Hop 6 reached | Chain paused, human review required |
| CRITICAL action detected in chain path | Chain stops entirely, human must restart |
| External communication would be triggered | Chain pauses for human approval |

### Chain Example (Valid — 4 hops)

```
Hop 1: lead_score_update (confidence: 0.87, tier: LOW) → execute
Hop 2: followup_trigger (confidence: 0.83, tier: MEDIUM) → execute + notify
Hop 3: deal_pack_generation (confidence: 0.91, tier: MEDIUM) → execute + notify
Hop 4: deal_pack_send (confidence: 0.88, tier: MEDIUM) → execute + notify
[Chain complete — 4 hops, all within limits]
```

### Chain Example (Blocked — CRITICAL detected)

```
Hop 1: lead_score_update (confidence: 0.92) → execute
Hop 2: followup_trigger (confidence: 0.85) → execute
Hop 3: proposal_generation (confidence: 0.91, tier: HIGH) → approve required [CHAIN PAUSED]
```

Human approves. Chain resumes:
```
Hop 4: deal_close_action (tier: CRITICAL) → CHAIN STOPS PERMANENTLY
Human must manually execute deal_close_action.
```

---

## Revenue-Critical Action Gating

Actions with potential financial impact exceeding defined thresholds always require human approval, regardless of confidence score.

| Financial Impact Threshold | Mode |
|---------------------------|------|
| <€1,000 | Auto-execute if tier ≤ MEDIUM |
| €1,000–€10,000 | Auto + notify if tier ≤ MEDIUM |
| €10,000–€50,000 | Approve required (tier HIGH automatic) |
| >€50,000 | Always human (CRITICAL regardless of action type) |

This threshold cascade ensures that no single autonomous action can commit the organization to significant financial risk without explicit human authorization.

---

## Audit Trail

Every autonomous action generates an immutable audit record. The audit trail is the governance backbone — every claim about system behavior is verifiable.

### Audit Record Schema

| Field | Type | Description |
|-------|------|-------------|
| audit_id | UUID v4 | Unique record identifier |
| org_id | UUID | Organization context |
| action_type | string | Enum: see action type registry |
| tier | enum | LOW / MEDIUM / HIGH / CRITICAL |
| confidence | float | 0.00–1.00 |
| trigger | string | What caused this action (event, workflow, schedule) |
| context | JSON | Input data snapshot at time of action |
| outcome | JSON | Result of action (success, error, blocked) |
| rollback_id | UUID | Rollback reference (if reversible) |
| operator_id | UUID | Human operator if human-executed or overridden |
| timestamp | ISO 8601 | Nanosecond precision UTC |
| chain_id | UUID | Workflow chain identifier (if part of chain) |
| chain_hop | int | Position in chain (1–5) |
| immutable | boolean | Always true — records cannot be modified |

### Audit Trail Guarantees

| Guarantee | Value |
|-----------|-------|
| Immutability | Records cannot be modified after write |
| Retention period | 2 years minimum |
| Query capability | By org, action type, time range, chain, confidence band |
| Export | Full export available (GDPR Art.20 compliance) |
| Completeness | Every action logged, including blocked actions |
| Performance | <5ms write latency for audit log |

### What Is Audited

All of the following generate audit records:
- Autonomous action executed (any tier)
- Autonomous action blocked (confidence failure)
- Human override of blocked action
- Chain created, progressed, paused, broken, or completed
- Rollback executed
- Governance threshold change (any tier or confidence threshold modification)

---

## Rollback Safety

Governance requires not just auditability but reversibility for actions that affect operational state.

### Rollback Scope

| Action Type | Reversible? | Rollback Window |
|-------------|------------|-----------------|
| Lead score update | Yes | 72 hours |
| Deal pack sent (draft) | Yes (before sending) | Until send |
| Deal pack sent (delivered) | No | — |
| Workflow activated | Yes | 72 hours |
| Contact updated | Yes | 72 hours |
| CRM record pushed | Yes (pull back) | 72 hours |
| Contact deleted | No (GDPR) | — |
| External communication sent | No | — |
| Financial transaction | No | — |

### Rollback Execution

1. Identify rollback_id from audit record.
2. Validate rollback window (within 72h).
3. Restore system state from checkpoint.
4. Write audit record: action_type = "rollback", references original audit_id.
5. Notify operator of rollback completion.

Rollback does not erase the original audit record. Both the original action and the rollback are permanently visible in the audit trail.

---

## Human-in-the-Loop Points

Current HITL implementation:

| Trigger | HITL Mode | Interface |
|---------|-----------|-----------|
| HIGH-tier action | Approval required | Email notification + portal action button |
| Chain hop 6 | Approval required | Portal notification |
| Revenue impact >€50K | Approval required | Portal notification + escalation email |
| CRITICAL action recommended | Informational | AI provides recommendation, human executes independently |
| Blocked action (confidence failure) | Informational | Portal notification with recommendation |
| Churn risk RED | Escalation | CSM notification, manual intervention required |

**Planned enhancement (Q2 2026):** Dedicated HITL review interface for MEDIUM-tier actions. Currently MEDIUM actions auto-execute with notification; the planned interface would give users a 30-minute window to reject before execution completes. This is the primary gap in the governance score.

---

## Prohibited Autonomy

The following are categorically prohibited from any form of autonomous execution, regardless of confidence score, tier override, or operator instruction:

1. **Financial transactions** — Any movement of money, issuance of invoices, or commitment to financial obligation.
2. **Contract modifications** — Any change to legal document content or status.
3. **Contact permanent deletion** — GDPR Art.17 right-to-erasure deletions must be human-initiated and human-confirmed.
4. **Deal close actions** — Any action that legally advances a property transaction to a new stage.
5. **Impersonation** — AI cannot send communications that appear to be from a named human agent without explicit disclosure.
6. **Regulatory submissions** — Any filing with AMI, AT, or other regulatory body.
7. **Access control modifications** — Adding or removing user permissions.

These prohibitions are hardcoded at the system level — not configurable, not overridable by any operator tier.

---

## Governance Score: 92/100

| Dimension | Score | Notes |
|-----------|-------|-------|
| Risk tier classification | 10/10 | 4 tiers, complete action registry |
| Confidence gating | 10/10 | Per-action thresholds, runtime computation |
| Chain limits | 10/10 | 5-hop max, per-hop safety checks |
| Audit trail | 10/10 | Immutable, 2-year retention, complete |
| Rollback safety | 10/10 | 72h window, preserves audit trail |
| Prohibited autonomy enforcement | 10/10 | Hardcoded, not configurable |
| HITL interface for MEDIUM | 6/10 | Currently notify-only; approval UI planned Q2 2026 (-4) |
| Revenue threshold gating | 10/10 | €50K threshold, cascading model |
| Human override logging | 10/10 | Operator identity, reason, timestamp |
| Governance auditability | 6/10 | Internal audit complete; third-party audit (SOC2) pending (-4) |

**Gap to 100 (8 points):**
- Dedicated HITL review UI for MEDIUM-tier actions: Q2 2026 (-4)
- SOC2 Type II audit: Q3 2026 (-4)

---

*SH-ROS Autonomy Governance Report — Phase D | AMI: 22506 | 2026-05-15*
