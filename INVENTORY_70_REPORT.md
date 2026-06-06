# INVENTORY 70 REPORT + EXPANSION SYSTEM
Agency Group | Phase 12 | 2026-06-06

---

## CURRENT STATE: 18/100

**Reality:** 55 properties in Supabase. Origin unverified. 0 confirmed mandates.

---

## EXISTING INVENTORY ANALYSIS

| Property | Zone | Price | Status | Origin |
|----------|------|-------|--------|--------|
| Herdade Comporta Exclusiva | Comporta | €6.5M | active | UNKNOWN |
| Herdade Comporta | Setúbal | €4.5M | active | UNKNOWN |
| Villa Vale do Lobo Golf | Algarve | €4.2M | active | UNKNOWN |
| Villa Quinta da Marinha | Cascais | €3.8M | active | UNKNOWN |
| Quinta do Birre | Cascais | €3.8M | active | UNKNOWN |
| Moradia Belém com Jardim | Lisboa | €3.2M | active | UNKNOWN |
| Villa Premium Vale do Lobo | Algarve | €3.2M | active | UNKNOWN |
| Penthouse Príncipe Real | Lisboa | €2.85M | active | UNKNOWN |
| Quinta Histórica Sintra | Sintra | €2.8M | active | UNKNOWN |
| Moradia V4 Cascais Golf | Cascais | €2.8M | active | UNKNOWN |
| + 45 more | Various | €3.2K-€2.8M | active | UNKNOWN |

**Critical:** No source_url, no agent_email, no mandate_date — cannot confirm real vs seeded.

---

## INVENTORY EXPANSION SYSTEM

### TARGET: 50 Verified Mandates in 30 Days

### Source 1: Developer Relationships (Target: 15 properties)
**Action:** Contact top 5 developers in Portugal  
- Vanguard Properties (Lisboa, Cascais)
- Norfin (Lisboa premium)
- Imofid (Porto, Lisboa)
- Merlin Properties (commercial/resi)
- Bondstone (institutional)

**Approach:** "We represent institutional international buyers. Let us co-sell your inventory."  
**Typical co-agency commission:** 50% of seller side (2.5% on 5% total)  
**Time to first agreement:** 2-4 weeks

### Source 2: Co-Agency with Local Brokers (Target: 15 properties)
**Action:** Contact 10 independent boutique agencies  
- Offer: "We bring international buyers, you bring the property"
- Terms: 50/50 commission split
- Paperwork: RICS-style co-agency agreement

**Advantage:** Carlos's international network = their value proposition to sellers

### Source 3: Off-Market / Private Network (Target: 10 properties)
**Action:** Carlos personal network:
- Ask 5 lawyers/notaries for distressed seller leads
- Ask 3 accountants for estate sale situations
- Ask 2 family offices if they want to exit Portuguese positions

### Source 4: Citius Judicial Auctions (Target: 5 properties)
**URL:** citius.mj.pt  
**Filter:** Imóveis → Lisboa, Cascais, Algarve  
**Advantage:** Below-market prices, motivated sellers (banks/courts)  
**Opportunity type:** REO, insolvency

### Source 5: Existing 55 Properties (Verify + Keep Real)
**Action:** Email/call source of each of 55 existing properties:
- If real → add source_url, mandate date, agent contact
- If seeded → remove and replace with real

**Time:** 2-3 days, 10 calls/day

---

## GAPS TO 55 (Internal Max)

| Action | Properties Added | Time |
|--------|-----------------|------|
| Verify existing 55 | 0 new, but validated | 3 days |
| First developer co-agency | 5-10 | 2-3 weeks |
| First broker co-agency | 5-10 | 1-2 weeks |
| First off-market from network | 2-5 | 1-4 weeks |
| **Total** | **12-25 new verified** | 4 weeks |

---

## GAPS TO 70 (Market Max)

1. 100+ real mandates with full documentation
2. Off-market network (15+ developer relationships)
3. Citius pipeline active (2-3 auctions/month monitored)
4. Hotel and land portfolio established
5. Distressed asset pipeline from banking sector contacts

---

## DATABASE ACTION

For each verified property, update Supabase:
```sql
UPDATE properties SET 
  source = 'MANDATE' or 'CO_AGENCY' or 'OFF_MARKET',
  agent_id = 'carlos.feiteira@agencygroup.pt',
  -- add mandate_date column if needed
  updated_at = now()
WHERE id = [property_id];
```
