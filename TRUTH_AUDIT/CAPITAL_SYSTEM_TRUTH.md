# CAPITAL SYSTEM TRUTH
Agency Group | 2026-06-05 | Evidence: lib/capital/ + lib/financial/ + migrations

---

## SETTLEMENT STATE MACHINE
- **States**: INTENT→COMMITTED→FUNDED→LOCKED→CONTRACTED→NOTARIZED→SETTLED→TRANSFERRED ✅
- **Properties**: Forward-only, immutable, SHA-256 chain hash per transition ✅
- **Code**: lib/capital/settlementStateMachine.ts (392 lines) ✅
- **Reality**: 0 real transactions ever processed ❌

---

## CAPITAL MATCHING ENGINE
- **Match types**: 6 (BUYER_TO_ASSET, ASSET_TO_BUYER, FO_TO_OPPORTUNITY, etc.) ✅
- **Dimensions**: budget(30%) + location(25%) + yield(20%) + risk(15%) + type(10%) ✅
- **Tables created**: capital_profiles, asset_opportunities ✅
- **Reality**: capital_profiles EMPTY, asset_opportunities EMPTY ❌

---

## FINANCIAL FINALITY
- **Hard blocks**: bank_confirmed + ledger_match + idempotency_valid ✅
- **Fee tables**: IMT brackets PT + ITP by region ES ✅
- **Conservation law**: BUYER_DEBIT = SELLER_CREDIT + AGENCY + TAXES ✅
- **Reality**: BANK_CONFIRMED never triggered (no bank feed) ❌

---

## ESCROW LAYER
- **Max hold**: 72 hours with alert at 48h ✅
- **Block at**: 72h ✅
- **Code**: lib/capital/escrowLayer.ts (184 lines) ✅
- **Reality**: 0 escrow records created ❌

---

## AUDIT CHAIN
- **SHA-256 chain**: settlement_transitions, forensic_audit_log ✅
- **Tamper detection**: verifyLogChainIntegrity() ✅
- **Immutability**: append-only pattern confirmed ✅

---

## BLOCKERS TO FIRST REAL TRANSACTION
1. Stripe TEST mode → no real payment
2. No bank feed (SaltEdge) → BANK_CONFIRMED never becomes TRUE
3. capital_profiles empty → no buyers to match
4. asset_opportunities empty → no assets to match

---

## VERDICT
Capital architecture: ✅ INSTITUTIONAL GRADE
Capital code: ✅ 100% COMPLETE
Capital data: ❌ EMPTY (no transactions, no profiles, no assets)
Capital operations: ❌ 0 real euros processed
Reconciliation: ❌ Internal-only (no external bank feed)
