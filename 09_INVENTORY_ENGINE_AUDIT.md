# 09 — INVENTORY ENGINE AUDIT
Agency Group | Final Operating System Audit | 2026-06-11

---

## INVENTORY REALITY

| Classification | Count | Evidence |
|---------------|-------|---------|
| **Verified mandates** | **0** | No mandate_date, no source_url |
| Exclusive mandates | 0 | Not tracked |
| Co-brokerage agreements | 0 | No partner agreements signed |
| Properties in DB | 55 | Sequential IDs 1001-1055 = seeded |
| Off-market leads (real) | 0 | 14 offmarket_leads = test data |
| Real confirmed inventory | **0** | |

**TOTAL CONFIRMED REAL INVENTORY: ZERO**

---

## THE 55 PROPERTIES IN DB (SUPABASE)

Evidence confirmed via REST API 2026-06-11:

| Field | Value |
|-------|-------|
| IDs | 1001–1055 (sequential = seeded data) |
| Nome | "Apartamento T3 Chiado Vista Rio", etc. |
| Status | All "active" (static) |
| Zones | Lisboa, Cascais, Algarve, Comporta, Sintra, Setúbal |
| Price range | €3,200 – €6,500,000 |
| lat/lng | null (no real coordinates) |
| images | [] (empty arrays) |
| matterport_url | null |
| source_url | null |
| agent_id | 27062d13-aa1e-45c9-b7a6-2b943f88e1ab (same for all) |
| mandate_date | Column may not exist |
| embedding | null |

**Assessment**: Demo data seeded to demonstrate UI. Not real listings.

---

## STATUS AFTER PROPERTY API FIX

The properties/public route previously fell to static fallback because of wrong column names. Now fixed — the route will serve the 55 DB properties.

However: DB properties are still demo/seeded data. Fix enables the DB pipe; Carlos must fill with real mandates.

---

## OFF-MARKET ENGINE STATUS

| Component | Status |
|-----------|--------|
| offmarket_leads table | 14 records = test data |
| acquisition_sources table | Exists, 0 records |
| acquisition_opportunities table | Exists, 0 records |
| /api/acquisition/off-market | Code exists |
| Citius integration | Code exists, not activated |
| /api/offmarket-leads/* | 15+ routes exist |
| Real off-market leads | **0** |

---

## INVENTORY SCORE

| Component | Score |
|-----------|-------|
| Infrastructure | 80/100 |
| Real mandates | 0/100 |
| Off-market | 0/100 |
| Co-agency agreements | 0/100 |
| **Average** | **20/100** |

---

## 30-DAY INVENTORY PLAN

### Week 1: Verify the 55
- Review each of 55 properties manually
- Check if any have real owner contact info
- Identify which zones they're in
- Remove confirmed fakes, update real ones
- Expected: 0–5 real, 50–55 to remove or mark "demo"

### Week 2: Developer Co-Agency
Target: Vanguard Properties, Norfin, Imofid, Bondstone
Pitch: "We represent 7,342 international institutional buyers"
Terms: 50% of seller commission (2.5% of 5%)
Expected: 5–15 properties per agreement signed

### Week 3: Broker Co-Agency
Target: 5 boutique Lisboa/Cascais agencies
Offer: "Our buyers don't use Idealista"
Terms: 50/50 buyer side OR 30% seller side
Expected: 3–8 properties per broker

### Week 4: Off-Market Sourcing
- Contact 5–10 real estate lawyers: ask for distressed seller referrals
- Check Citius (judicial auctions): 5+ opportunities
- Ask CONNECTOR contacts from CRM for family office exits
Expected: 1–3 real off-market leads

---

## INVENTORY ACTION PLAN

| Action | Who | When | Expected Result |
|--------|-----|------|-----------------|
| Delete/mark seeded properties as demo | Carlos | Day 1 | Clean DB |
| Email developer co-agency pitch | Carlos | Week 1 | 3 meetings |
| Sign first developer agreement | Carlos | Week 2 | 5-15 properties |
| Contact 3 Lisboa brokers | Carlos | Week 2 | 3 meetings |
| Sign first broker agreement | Carlos | Week 3 | 5-10 properties |
| Ask lawyers for distressed leads | Carlos | Week 3-4 | 1-2 leads |

---

## REVENUE POTENTIAL (when real inventory exists)

| Property Type | Avg Value | Commission (5%) | Deals/Year |
|--------------|-----------|----------------|------------|
| Lisboa T2-T3 | €600K | €30K | — |
| Cascais moradia | €1.5M | €75K | — |
| Algarve villa | €2.5M | €125K | — |
| Comporta herdade | €5M | €250K | — |

**5 deals at average €1.5M = €375K commission/year**
