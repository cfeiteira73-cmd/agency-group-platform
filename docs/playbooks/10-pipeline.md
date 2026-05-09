# SOP 10 — Pipeline Progression
**Owner:** Agent (execution) + Carlos (review) | **Cadence:** Weekly hygiene every Monday | **Platform:** `/portal/crm`

## Pipeline Stage Definitions

| Stage | Code | Definition | Required to Enter | Required to Advance |
|---|---|---|---|---|
| Lead | `lead` | Inbound contact, not yet qualified | Name + phone or email | Qualification call complete |
| Prospect | `prospect` | Contacted, intent unclear | Response received | Budget + zone confirmed |
| Qualified | `qualified` | BANT-RE complete | All BANT-RE fields in CRM | First property match sent |
| Active | `active` | Visits scheduled or completed | ≥1 visit scheduled | Written offer submitted |
| Proposal | `proposal` | Formal offer submitted | Written offer on file | Offer accepted or countered |
| Negotiation | `negotiation` | Counter-offers exchanged | Counter documented in CRM | Agreement on price reached |
| CPCV | `cpcv` | Contract signed + deposit paid | Signed CPCV on file + deposit confirmed | All pre-escritura docs collected |
| Escritura | `escritura` | Final deed stage | Pre-escritura checklist complete | Deed signed |
| Won | `won` | Closed successfully | Escritura signed | Commission received |
| Lost | `lost` | Deal abandoned | Loss reason documented | N/A |
| Dormant | `dormant` | No activity >30 days | Dormant flag set | Reactivation required |

---

## Probability by Stage

| Stage | Probability | Expected Value Multiplier |
|---|---|---|
| Lead | 5% | 0.05 × deal size |
| Prospect | 10% | 0.10 × deal size |
| Qualified | 20% | 0.20 × deal size |
| Active | 35% | 0.35 × deal size |
| Proposal | 55% | 0.55 × deal size |
| Negotiation | 70% | 0.70 × deal size |
| CPCV | 90% | 0.90 × deal size |
| Escritura | 98% | 0.98 × deal size |

**Expected Value (EV) formula:**
`EV = deal_size × commission_rate × stage_probability`
Example: €800K deal in Proposal stage = €800K × 5% × 55% = €22,000 EV

---

## Weekly Pipeline Hygiene — Monday Protocol

**Time:** Monday morning, before any client contact
**Owner:** Each agent (individual) + Carlos (aggregate review)
**Duration:** 20–30 min per agent

### Step-by-Step

1. **Open `/portal` → CRM → Pipeline View**
2. **Review all deals in active stages** (Active, Proposal, Negotiation, CPCV, Escritura)
3. **For each deal, check:**
   - Last activity date: is it within SLA?
   - Next action: is it scheduled?
   - Stage: should it advance, regress, or stay?
   - Data quality: all required fields filled?

4. **Update or flag:**
   - Advance stage if criteria met
   - Regress stage if criteria not met (see regression protocol)
   - Flag for escalation if stalled
   - Add a note with this week's plan

5. **For Carlos:** Review aggregate pipeline after individual updates complete
   - Total pipeline value by stage
   - Expected value (probability-weighted)
   - Deals at risk (no activity >5 days in active stages)
   - Commission forecast: next 30 / 60 / 90 days

---

## Stage Advancement Criteria (Summary)

```
lead → prospect:          Response received + source logged
prospect → qualified:     Budget + zone + timeline confirmed
qualified → active:       First property match sent + visit in progress
active → proposal:        Written offer submitted
proposal → negotiation:   Counter-offer exchanged
negotiation → cpcv:       Price agreed, CPCV drafted
cpcv → escritura:         CPCV signed + deposit received + all docs collected
escritura → won:          Deed signed + commission received
```

---

## Stage Regression Protocol

Stage regression is not failure — it's accuracy. Deals must reflect reality in CRM.

### When to Regress
- Buyer re-qualifies: budget changes significantly → regress to Qualified
- Offer rejected with no counter → regress from Proposal to Active
- Financing falls through at CPCV stage → regress to Negotiation + immediate escalation
- Client goes silent for >14 days → regress to Dormant

### How to Regress
1. Update stage in CRM
2. Add note: reason for regression + date
3. Adjust next_followup_at
4. If regression from CPCV: Carlos must be notified immediately (P1)

---

## Forecast Categories

| Category | Definition | Deals Included |
|---|---|---|
| **Commit** | High confidence, expected to close this month | CPCV + Escritura |
| **Best Case** | Could close if everything goes right | Negotiation + strong Proposals |
| **Pipeline** | Active, real deals in progress | Active + Proposal |
| **Upside** | Qualified, uncertain timeline | Qualified |

### Monthly Forecast Calculation

```
Commit revenue = SUM(Escritura deals × 98% × 5%)
Best Case revenue = Commit + SUM(Negotiation deals × 70% × 5%)
Pipeline revenue = Best Case + SUM(Active + Proposal × weighted prob × 5%)
```

---

## Deal Hygiene Rules
These are non-negotiable. Carlos enforces weekly:

1. **No deal without a next action.** Every active deal must have `next_followup_at` set.
2. **No deal without a note in the last 7 days** (for Active+).
3. **No deal in 'Active' for >30 days without a visit log.** Either visits happened (and are logged) or stage is wrong.
4. **No deal in 'CPCV' without a signed document on file.** CPCV stage requires physical file.
5. **No 'Won' deal without commission confirmed.** Won = money received, not just deed signed.
6. **No 'Lost' deal without a loss reason.** Mandatory field before closing.

### Loss Reason Taxonomy
Log one of the following (required before marking 'lost'):
- `price_gap` — Buyer and seller could not agree on price
- `competitor_won` — Another agency or direct deal
- `financing_failed` — Buyer financing fell through
- `property_issue` — Legal, structural, or title problem
- `buyer_withdrew` — Buyer changed mind or paused search
- `seller_withdrew` — Seller pulled property from market
- `timeline_mismatch` — Timing didn't align
- `lost_contact` — Unable to re-engage after multiple attempts
- `other` — Document in notes

---

## Pipeline KPIs

| KPI | Target | Alert |
|---|---|---|
| Total pipeline EV | >€500K | <€250K |
| Deals in active stages | ≥10 | <5 |
| Data quality avg score | >80/100 | <65 |
| Deals without next action | 0 | >3 |
| Deals stalled >14 days | 0 | >2 |
| CPCV → Escritura fall-through | <5% | >10% |
| Monthly conversion: Qualified → CPCV | >15% | <8% |
