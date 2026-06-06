# REVENUE ACTIVATION REPORT + EXECUTION SYSTEM
Agency Group | Phase 14 | 2026-06-06

---

## CURRENT STATE: 0/100

**Reality:** €0 revenue. Stripe in TEST mode. No real transactions. 8 deals in DB (status unknown).

---

## REVENUE FUNNEL MAP

```
CONTACT (7,342 in CRM)
    ↓ LinkedIn outreach / email / referral
CONVERSATION (0 confirmed)
    ↓ qualify: budget, timeline, mandate
MEETING (0 confirmed)
    ↓ present property + deal pack
MANDATE / NDA (0 confirmed)
    ↓ formal agreement + exclusivity
OFFER (0 confirmed)
    ↓ negotiation
CPCV (0 confirmed)
    ↓ 14-30 days, funds check
ESCRITURA (0 confirmed)
    ↓ notarization, registration
COMMISSION INVOICE
    ↓ 50% at CPCV + 50% at Escritura
REVENUE (€0)
```

---

## COMMISSION ECONOMICS

| Property Value | Commission (5%) | 50% at CPCV | 50% at Escritura |
|----------------|----------------|-------------|-----------------|
| €500,000 | €25,000 | €12,500 | €12,500 |
| €1,000,000 | €50,000 | €25,000 | €25,000 |
| €2,000,000 | €100,000 | €50,000 | €50,000 |
| €5,000,000 | €250,000 | €125,000 | €125,000 |

**One deal at €1M = €50,000 commission.**  
**This is Carlos's entire annual salary at many companies.**

---

## REVENUE EXECUTION SYSTEM

### Phase 1: Pipeline (Next 30 days)

**Objective:** Get 3 active deal opportunities in pipeline

**Steps:**
1. Verify 10 properties from existing 55 → confirm real availability
2. Contact A+ buyers with matching property profile
3. Book 3 qualification calls (via Sofia script)
4. Log each in deals table with initial valuation

**Minimum viable deal machine:**
- 1 verified property + 1 qualified buyer = 1 deal opportunity
- Agency Group's network (7,342) → find 3 matching buyers
- Cost: €0 extra (network already built)

---

### Phase 2: Mandate (Week 4-8)

**Objective:** Sign first co-agency or exclusive mandate

**Documents needed:**
- Co-agency agreement template (needs lawyer review)
- Exclusive mandate template (needs lawyer review)
- AMI number: 22506 ✅ (already have it)

**Cost:** €500-2,000 for lawyer to draft standard templates  
**Without lawyer:** Use existing standard templates from APEMIP

---

### Phase 3: Offer + CPCV (Week 8-16)

**Objective:** First formal offer from a qualified buyer

**System support:**
- Deal pack: /api/deal-packs (generates PDF)
- AVM: /api/avm (provides price benchmark)
- Legal check: /api/juridico (AI legal review)
- Match score: /api/matches (buyer-property fit)

---

### Phase 4: Escritura + Commission

**Payment flow:**
1. CPCV signed → issue invoice for 50% commission
2. Escritura signed → issue invoice for remaining 50%

**Stripe activation (when first deal imminent):**
- Switch from TEST to LIVE in Stripe dashboard
- Configure invoice in Stripe Billing OR issue manually
- Note: Real estate commission ≠ SaaS subscription. Simple bank transfer may be cleaner.

---

## SHORTEST PATH TO FIRST REVENUE

```
TODAY:
  1. Identify 3 most compelling properties from existing 55
  2. Match to A+ buyers by country + budget

WEEK 1:
  3. Send LinkedIn to 10 best-matched A+ buyers
  4. Template: "We have an off-market [property type] in [zone] at [price range]. Given your institutional profile, this may be relevant."

WEEK 2-4:
  5. 2-4 accept → qualify by call
  6. 1-2 qualify → present deal pack

WEEK 4-8:
  7. 1 qualifies → formal offer
  8. Offer → CPCV negotiation

WEEK 8-20:
  9. CPCV signed → €X,000 (50% commission)
  10. Escritura → remaining 50%
```

**Best case scenario:** 60-90 days to first commission  
**Realistic scenario:** 90-180 days  
**Failure scenario:** No outreach started → €0 indefinitely

---

## BLOCKING FACTS

1. **No confirmed real mandates** — cannot sell without confirmed availability
2. **No email for 99.1% of CRM** — cannot email, only LinkedIn
3. **No active conversations** — system built but unused
4. **Carlos is the only operator** — bottleneck at scale
5. **No brand evidence** — foreign buyers need trust signals before committing

---

## GAPS TO FIRST €1

1. ⬜ Verify 5 properties are real + available
2. ⬜ Contact 10 A+ CRM buyers by LinkedIn (match to properties)
3. ⬜ Book 1 call with interested buyer
4. ⬜ Qualify budget + timeline + Portugal interest
5. ⬜ Present property
6. ⬜ Receive offer → negotiate CPCV
7. ⬜ CPCV → invoice → bank transfer

**Every step above is doable by Carlos alone.**  
**Technology is not the bottleneck.**  
**The bottleneck is starting.**
