# CAPITAL SYSTEM REPORT
Agency Group | Wave 60 | Evidence: lib/capital/ + lib/financial/ + migrations

---

## COMPLETE CAPITAL FLOW MAP

```
LEAD → QUALIFICATION → MATCHING → DEAL PACK → NEGOTIATION → SETTLEMENT → ESCROW → FINALITY → COMMISSION

1. LEAD IDENTIFIED
   ├── Source: Sofia SDR | Off-market engine | Manual CRM
   ├── Table: contacts
   └── Score: /api/buyers/score (cron 06:15)

2. QUALIFICATION
   ├── Buyer: Sofia BUYER_QUALIFIER (budget/location/timeline extraction)
   ├── Seller: Sofia SELLER_QUALIFIER (asking price/motivation)
   └── Score threshold: ≥60 = send properties, ≥85 = escalate

3. CAPITAL MATCHING (lib/matching/capitalMatchingEngine.ts)
   ├── 6 dimensions: budget(30%) + location(25%) + yield(20%) + risk(15%) + type(10%)
   ├── Match types: BUYER_TO_ASSET, ASSET_TO_BUYER, FO_TO_OPPORTUNITY, etc.
   ├── Tables: capital_profiles ← EMPTY, asset_opportunities ← EMPTY
   └── Output: capital_matches table (grade: PERFECT/STRONG/GOOD/FAIR/WEAK)

4. DEAL PACK GENERATION
   ├── Route: /api/deal-packs
   ├── Table: deal_packs
   └── AI-generated presentation materials

5. NEGOTIATION
   ├── Route: /api/deal
   ├── Table: deals (stage_history)
   └── SLA tracking

6. SETTLEMENT (lib/capital/settlementStateMachine.ts — 392 lines)
   ├── States: INTENT→COMMITTED→FUNDED→LOCKED→CONTRACTED→NOTARIZED→SETTLED→TRANSFERRED
   ├── Rules: FORWARD-ONLY, IMMUTABLE, SHA-256 chain hash per transition
   ├── Evidence: 'TRANSFERRED is terminal — maps to itself (idempotent, no re-entry)'
   └── Table: settlement_transitions

7. ESCROW (lib/capital/escrowLayer.ts — 184 lines)
   ├── Max hold: 72 hours
   ├── Alert at: 48 hours
   ├── Block at: 72 hours
   └── Table: liquidity_locks

8. FINANCIAL FINALITY (lib/financial/financialFinalityEngine.ts — 438 lines)
   ├── HARD RULE: bank_confirmed = TRUE required
   ├── Reconciliation accuracy target: ≥99.5%
   └── Table: finality_records

9. COMMISSION CALCULATION
   ├── PT: 5% + VAT 23% + IMT (bracket-based)
   ├── ES: 3-5% commission (regional ITP rates)
   ├── Conservation law: BUYER_DEBIT = SELLER_CREDIT + AGENCY + TAXES
   └── Table: commission_records
```

---

## STATE MACHINE — CONFIRMED CODE

```typescript
// VALID transitions (from code):
INTENT     → COMMITTED  (commit)
COMMITTED  → FUNDED     (fund)
FUNDED     → LOCKED     (lock)
LOCKED     → CONTRACTED (contract)
CONTRACTED → NOTARIZED  (notarize)
NOTARIZED  → SETTLED    (settle)
SETTLED    → TRANSFERRED(transfer)
TRANSFERRED → TRANSFERRED (idempotent terminal)
```

---

## CAPITAL FINALIZATION GUARD — HARD BLOCKS

```typescript
// lib/system/institutionalOS.ts
if (!tx.bank_confirmed) throw new Error('CAPITAL BLOCKED: No external bank confirmation')
if (!tx.ledger_match)   throw new Error('CAPITAL BLOCKED: Ledger mismatch')
if (!tx.idempotency_valid) throw new Error('CAPITAL BLOCKED: Duplicate transaction risk')
```

---

## IDEMPOTENCY IMPLEMENTATION

| Level | Implementation | Evidence |
|-------|---------------|---------|
| Application | PSP_EVENT_ID + settlement_id + state transition | Code confirmed |
| PSP webhooks | `webhook_key: "PSP_EVENT_ID"` in CAPITAL_EXECUTION_MAP.json | ✅ |
| DB level | No UNIQUE constraint on idempotency_key | ⚠️ RISK |

---

## FEE TABLES (from lib/financial/financialTruthCertification.ts)

### Portugal
```
IMT brackets:
  €0–97,064:      0%
  €97,064–132,774: 2%
  €132,774–181,034: 5%
  €181,034–301,688: 7%
  €301,688–578,598: 8%
  >€578,598:       Fixed €34,650

Stamp duty: 0.8%
Registry: €250 fixed
Notary: €500 fixed
Agency commission: 5% + VAT 23%
```

### Spain (by region)
```
ITP: Andalucia 7%, Madrid 6%, Catalonia 10%, Valencia 10%, Default 8%
IVA new build: 10% + AJD 1%
Agency commission: 3-5%
```

---

## CURRENT CAPITAL SYSTEM STATUS

| Component | Code status | Production status |
|-----------|------------|-------------------|
| Settlement state machine | ✅ COMPLETE | ✅ DEPLOYED — €0 processed |
| Escrow layer | ✅ COMPLETE | ✅ DEPLOYED — €0 in escrow |
| Financial finality | ✅ COMPLETE | ⚠️ REQUIRES bank_confirmed |
| Capital matching | ✅ COMPLETE | ⚠️ TABLES EMPTY |
| Stripe checkout | ✅ COMPLETE | ❌ TEST MODE |
| Bank reconciliation | ✅ CODE ONLY | ❌ NO BANK FEED |
| Commission calculation | ✅ COMPLETE | ✅ DEPLOYED — never executed |

---

## BLOCKERS TO FIRST REAL CAPITAL FLOW

1. **Stripe TEST mode** → no real payment processing
2. **capital_profiles empty** → no buyers to match
3. **asset_opportunities empty** → no assets to match
4. **No bank feed** → BANK_CONFIRMED never becomes TRUE

**Time to unblock**: Stripe live = 30 min. First deal = requires real operations.
