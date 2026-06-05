# REVENUE READINESS REPORT
Agency Group | Wave 60 | Evidence-based classification

---

## REVENUE STREAMS

### Stream 1: Deal Commissions (5% of transaction value)
**Model**: €100K deal = €5K commission | €1M deal = €50K | €5M deal = €250K
**Status**: BLOCKED
**Blocker**: No real deals in new tables + Stripe TEST mode (for subscription features)
**What's ready**: Settlement engine, commission calculation, deal pack generation

### Stream 2: Portal Subscriptions
**Plans**:
- Intelligence: €49/month (from `lib/stripe.ts`)
- Elite: €199/month (from `lib/stripe.ts`)
**Status**: BLOCKED — Stripe in TEST mode
**Code evidence**: `app/api/stripe/checkout/route.ts` — creates checkout sessions

### Stream 3: Investor Introductions / Capital Introductions
**Potential**: 1-2% introduction fee on institutional deals
**Status**: NOT YET IMPLEMENTED (code framework exists, product not launched)

---

## COMPONENT READINESS MATRIX

### READY ✅ (can generate revenue immediately if activated)
| Component | What it does | Activation needed |
|-----------|-------------|------------------|
| Stripe checkout | Portal subscriptions | Switch to sk_live_ |
| Sofia web SDR | Qualifies leads 24/7 | Already live |
| AVM tool | Attracts sellers/buyers | Already live |
| Deal pack generation | Presents opportunities | Already live |
| Investor alerts (cron) | Auto-sends opportunities | Already live |
| Property search | Public lead generation | Already live |
| Match scoring | Ranks buyer-asset fits | Needs data in tables |

### PARTIAL ⚠️ (works but dependent on data/activation)
| Component | Gap | Fix |
|-----------|-----|-----|
| Capital matching engine | capital_profiles + asset_opportunities empty | Add real data |
| Sofia WhatsApp | Access token missing | Meta Business Manager |
| AVM accuracy | Static 2026 data | Idealista API |
| Investor notifications | No investors in capital_profiles | Populate table |
| Off-market acquisition | Citius scraper needs activation | Enable in config |

### BLOCKED ❌ (cannot generate revenue until external action)
| Component | Blocker | Owner |
|-----------|---------|-------|
| Real payment processing | Stripe sk_test_ → sk_live_ | Carlos (30 min) |
| Bank reconciliation | SaltEdge not contracted | Carlos (2 weeks) |
| External market data | Idealista API approval pending | External (5-10 days) |

---

## REVENUE PATH TO €0 → €1

**Minimum viable path**:
1. Stripe live key (30 min) → first subscription = €49
2. Sofia qualifies first real lead (already happening)
3. First property shown → first deal interest
4. First deal closed → €5K-€500K commission

**Everything above is already built. Nothing requires more code.**

---

## 30-DAY REVENUE FORECAST (if activated today)

| Action | Revenue potential | Probability |
|--------|-----------------|------------|
| Stripe live + marketing | €49-€199/mo subscriptions | HIGH — instant |
| First deal from pipeline | €5K-€50K commission | MEDIUM — 30-60 days |
| Sofia lead qualification | Pipeline growth | HIGH — ongoing |

---

## VERDICT
Revenue infrastructure: **COMPLETE**. Revenue: **€0**. Gap: **OPERATIONAL ACTIVATION ONLY**.
