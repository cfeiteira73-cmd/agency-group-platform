# CAPITAL NETWORK 80 REPORT
Agency Group | Phase 10 | 2026-06-06

---

## CURRENT STATE: 52/100

(Updated from 48 after score + country fixes)

---

## NETWORK INVENTORY

| Segment | Count | Contactable | Notes |
|---------|-------|-------------|-------|
| Total CRM | 7,342 | LinkedIn 100% | Institutional quality |
| Tier A+ | 73 | LinkedIn only (email: unknown %) | Family offices, top tier |
| Tier A | 1,571 | LinkedIn only | High-value investors |
| Tier B | 2,090 | LinkedIn only | Qualified prospects |
| Tier C | 3,089 | LinkedIn only | Nurture pool |
| Tier D | 519 | LinkedIn only | Marketing only |
| Has email | 67 | Email + LinkedIn | Critical segment |

---

## GEOGRAPHY (post-fix, ISO-2)

| Country | Count | % | Significance |
|---------|-------|---|--------------|
| US | 3,010 | 41% | Family offices, fund managers |
| GB | 882 | 12% | PE firms, wealth managers |
| FR | 748 | 10% | Family offices, UHNWIs |
| AE | 504 | 7% | Sovereign wealth, family offices |
| HK | 264 | 4% | Asian capital, family offices |
| CH | 261 | 4% | Swiss private banking |
| BE | 218 | 3% | Brussels institutional |
| IL | 215 | 3% | Tech capital, family offices |
| PT | 129 | 2% | Local institutional |
| AU | 115 | 2% | Australian capital |

**Quality assessment:** Top 6 geographies (US/UK/FR/AE/HK/CH) represent 77% of network  
These are exactly the institutional capital geographies for Portugal real estate.

---

## PERSONA ANALYSIS (sample 1,000)

| Persona | Count | Investment Profile |
|---------|-------|-------------------|
| FAMILY_OFFICE | 790 | €5M-€50M+ tickets |
| REAL_ESTATE_FUND | 101 | €10M-€500M tickets |
| INVESTOR | 59 | €500K-€10M tickets |
| WEALTH_MANAGER | 44 | Represents HNW clients |
| CONNECTOR | 6 | Deal flow, introductions |

**This is an excellent institutional network for Portuguese luxury real estate.**

---

## ACTIVATION SYSTEM

### Tier A+ (73 contacts) — FOUNDER PERSONAL OUTREACH

**Carlos's action:**
1. Filter: capital_profiles WHERE tier = 'A+' ORDER BY capital_score DESC LIMIT 25
2. Open each LinkedIn profile
3. Send connection request with personalized note:
   - Message template: "Dear [Name], I'm Carlos from Agency Group, a boutique institutional real estate capital platform in Lisbon. Given your [FAMILY_OFFICE/FUND] profile, I'd welcome a brief conversation about current investment opportunities in Portuguese premium real estate. Best regards"
4. Track in contacts table (add entry per conversation)

**Expected conversion:**  
- 25 connection requests → 8-12 accept (30-50% acceptance for A+)
- 8 accepts → 2-4 reply to message (25-50% reply rate)
- 2-4 replies → 1-2 meetings (50% conversion)

**Time to first meeting: 2-4 weeks**

### Tier A (1,571 contacts) — SOFIA CAPITAL INTRODUCTION SEQUENCE

**System action (requires email enrichment first):**
1. Enrich top 200 A-tier for email
2. Start Sofia "Capital Introduction" sequence
3. Template: market report + specific opportunity

### Tier B+C (5,179 contacts) — NEWSLETTER + AUTOMATED

1. Weekly market insights email
2. Monthly property portfolio update
3. Sofia automated nurture sequence

---

## GAPS TO 65 (Internal Max)

1. ⬜ Fix total_score ✅ (done today)
2. ⬜ Fix country_iso ✅ (done today)
3. ⬜ Send 25 LinkedIn connections to A+ contacts (2 hours)
4. ⬜ Log first 3 conversations in Supabase contacts table
5. ⬜ Book first real meeting

**Time: 1-2 weeks of personal outreach**

---

## GAPS TO 85 (Market Max)

1. Email enrichment for 2,000 contacts
2. 200+ real conversations logged
3. 25+ meetings in the last 90 days
4. Capital matching engine proven (opportunity → investor)
5. First co-investment or deal referral confirmed

---

## CAPITAL ACTIVATION SYSTEM

### Step 1: IDENTIFY (Today)
- Carlos reviews top 73 A+ contacts
- Selects 25 most aligned (geography + persona + capital capacity)

### Step 2: CONNECT (Week 1)
- LinkedIn connection requests: 25
- Expected accepts: 8-12

### Step 3: ENGAGE (Week 1-2)
- Personalized message: current market opportunity
- Link to: agencygroup.pt/relatorio-2026

### Step 4: QUALIFY (Week 2-4)
- Sofia call script for first calls
- Budget, timeline, mandate type

### Step 5: PRESENT (Week 4-8)
- Property match from 55-property portfolio
- Deal pack generated via /api/deal-packs

### Step 6: CLOSE
- First CPCV → Revenue

---

## BIGGEST SINGLE BLOCKER

**99.1% of 7,342 contacts have no email.**  
Without email, automated sequences cannot run.  
Without sequences, the system cannot operate at scale.  

**Minimum viable fix:**  
Apollo.io trial (free tier: 50 credits/month) → enrich A+ tier (73 contacts)  
Cost: €0 to start. Takes 2 hours to set up.
