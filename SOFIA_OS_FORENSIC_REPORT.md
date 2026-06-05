# SOFIA OS FORENSIC REPORT
Agency Group | Wave 60 | Evidence: lib/ai/sofia/sofiaOS.ts + route files

---

## SOFIA ARCHITECTURE

### Versions deployed
| Version | Routes | Status |
|---------|--------|--------|
| Sofia v2 (OS) | /api/sofia/* | ✅ CURRENT — monitored |
| Sofia v1 (legacy) | /api/sofia-agent/* | ⚠️ LEGACY — not monitored |

**RISK**: sofia-agent routes bypass rate limiting and monitoring of the newer OS. Should be deprecated.

---

## 7 ROLES — EVIDENCE FROM CODE

```typescript
// lib/ai/sofia/sofiaOS.ts
export type SofiaRole =
  | 'SDR'                // Sales Development Representative
  | 'ISA'                // Inside Sales Agent
  | 'BUYER_QUALIFIER'
  | 'SELLER_QUALIFIER'
  | 'CAPITAL_INTRODUCER'
  | 'DEAL_CONCIERGE'
  | 'INVESTOR_ASSISTANT'
```

| Role | Trigger logic | Output | Status |
|------|--------------|--------|--------|
| SDR | Default — no prior context | Greeting + qualification questions | ✅ ACTIVE |
| ISA | `context.is_qualified = true` | Continue qualification, propose meeting | ✅ ACTIVE |
| BUYER_QUALIFIER | Intent = BUY | Budget/location/timeline extraction | ✅ ACTIVE |
| SELLER_QUALIFIER | `context.is_seller = true` | Asking price, motivation, timeline | ✅ ACTIVE |
| CAPITAL_INTRODUCER | intent contains "capital/fund" | Investor routing | ✅ ACTIVE |
| DEAL_CONCIERGE | intent contains "deal/close" | Transaction coordination | ✅ ACTIVE |
| INVESTOR_ASSISTANT | budget ≥ €500K or intent = INVEST | Institutional service | ✅ ACTIVE |

---

## QUALIFICATION SCORING

```typescript
function scoreLead(qual: Partial<LeadQualification>): number {
  // Budget (30 pts): ≥€500K=30, ≥€200K=20, ≥€100K=10
  // Timeline (20 pts): ≤3mo=20, ≤6mo=12, ≤12mo=6
  // Financing (15 pts): CASH=15, MIXED=10, MORTGAGE=5
  // Urgency (15 pts): HIGH=15, MEDIUM=8
  // Location (10 pts): specified=10
  // Investment purpose (10 pts): INVESTMENT/BOTH=10
}
```

**Score thresholds**:
- ≥85 + URGENT → IMMEDIATE human escalation
- ≥70 → meeting suggestion triggered
- ≥60 → send curated properties
- budget ≥ €3M → IMMEDIATE escalation (HIGH_VALUE)

---

## ENTITY EXTRACTION (from code)

```typescript
// Extracts automatically:
budget_mentioned: regex match on €/amount patterns
locations: ['Lisboa','Porto','Cascais','Algarve','Madeira','Madrid','Barcelona','Sintra','Comporta','Lagos',...]
timeline: regex on "meses/months/semanas/weeks/dias/days"
intent: BUY/SELL/INVEST
urgency: HIGH if "urgente/urgent/imediato/asap"
```

---

## FOLLOW-UP ENGINE

```typescript
// Generates tasks based on:
// - Score ≥ 30: follow-up created
// - Channel: WhatsApp (if configured) > Email > Call
// - Timing: HIGH urgency = 1 day, MEDIUM = 3 days, LOW = 7 days
```

**Status**: ✅ Task generation works. ✅ Email via Resend. ❌ WhatsApp blocked (no access token).

---

## ESCALATION PATHS

| Trigger | Action | External dependency |
|---------|--------|---------------------|
| Budget ≥ €3M | Email to ADMIN_EMAIL | ✅ Resend configured |
| Score ≥ 85 + URGENT | Email escalation | ✅ Resend configured |
| SEV1 SOC event | PagerDuty | ❌ Not configured |
| SOC event | Slack | ✅ Webhook configured |

---

## MEMORY & PERSISTENCE

| Data | Table | Status |
|------|-------|--------|
| Conversation turns | sofia_conversation_turns | ✅ Live (needs migration 000151) |
| Escalations | sofia_escalations | ✅ Live (needs migration 000151) |
| Legacy conversations | sofia_conversations | ✅ Pre-W47 table |

---

## CHANNELS

| Channel | Status | Blocker |
|---------|--------|---------|
| Web chat | ✅ FULLY OPERATIONAL | None |
| Email (Resend) | ✅ OPERATIONAL | None |
| WhatsApp | ❌ BLOCKED | WHATSAPP_ACCESS_TOKEN = PREENCHER |
| HeyGen video | ✅ OPERATIONAL | HeyGen key configured |

---

## WHAT SOFIA CANNOT DO (code confirms)

1. Execute financial transactions directly — Sofia only creates task records, never writes to settlement/capital tables
2. Send WhatsApp messages — access token missing
3. Learn from real deals — no real transactions to train on
4. Give accurate market prices — uses static 2026 fallback (Idealista not configured)

---

## PROMPT INJECTION RISK

**Risk level**: LOW-MEDIUM
**Mitigation**: System prompt isolation via Anthropic API. Sofia has no direct database write access to capital tables. All outputs are text + task records.
**Gap**: No explicit prompt injection filter on inputs (relies on Anthropic's built-in filtering).

---

## VERDICT
Sofia is fully operational on web + email channels. WhatsApp requires 1 hour of activation. The AI quality is bounded by available market data (static fallback currently).
