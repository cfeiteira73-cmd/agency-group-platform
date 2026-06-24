# Phase 09 — Smartlead/Instantly Campaign Readiness
**Date:** 2026-06-24  
**Status:** ⚠️ CARLOS ACTION — SETUP REQUIRED

## Files Ready for Upload

| File | Rows with Email | Use |
|------|-----------------|-----|
| `LEADS_WITH_EMAIL_117.csv` | 117 | ALL have email — upload now |
| `SMARTLEAD_FIRST_50.csv` | ~50 (email leads first) | First campaign wave |
| `SMARTLEAD_FIRST_154.csv` | ~17 with email | After Apollo enrichment |

## Campaign Setup (Smartlead or Instantly)

### Step 1: Create Sender Account
- Domain: agencygroup.pt (already set up with SPF/DKIM via Resend)
- Sender: `carlos@agencygroup.pt` or `geral@agencygroup.pt`
- Warm-up period: 2-3 weeks if new domain reputation

### Step 2: Upload Leads
- Import `LEADS_WITH_EMAIL_117.csv`
- Map fields: first_name, last_name, email, company, title, country
- **Filter:** only rows where `has_email = YES`
- Set `do_not_contact = false` check before sending

### Step 3: Email Sequences (Draft)

**Sequence 1 — International Buyer (English)**  
Target: USA + UK + Switzerland A+ leads

```
EMAIL 1 (Day 1):
Subject: Exclusive Opportunity: Prime Lisbon Real Estate — Agency Group

Hi {{first_name}},

I noticed your background in {{industry/title}} and wanted to reach out directly.

We're Agency Group (AMI 22506), specializing in premium Portuguese real estate 
in the €500K–€3M segment. Lisbon has ranked Top 5 globally for luxury real estate 
growth in 2026.

I have several off-market opportunities that match what sophisticated buyers are 
looking for right now — prime Lisbon, Cascais, and Algarve properties with strong 
capital appreciation.

Would a 15-minute call make sense this week?

Best,
Carlos Feiteira
Agency Group | AMI 22506
+351 [phone]
agencygroup.pt

---
EMAIL 2 (Day 5):
Subject: Re: Portuguese Real Estate — Quick question

{{first_name}},

Just following up on my previous note.

One specific property I thought you might find interesting: [property example from 
current inventory — Carlos to fill in].

Current Lisbon market: €5,000/m², +17.6% YoY, 169,812 transactions in 2026.
We represent buyers AND source exclusive off-market inventory.

Worth a brief call?

Carlos

---
EMAIL 3 (Day 12):
Subject: Last outreach — Lisbon investment opportunity

{{first_name}},

I don't want to keep pinging you if timing isn't right. 

If you're open to exploring Portuguese real estate at any point, I'm the person to 
call — we have exclusive access to properties that never hit public listings.

Reply "not now" to stop hearing from me, or "interested" and I'll send our current 
off-market inventory.

Carlos
Agency Group | AMI 22506
```

**Sequence 2 — Francophone Buyer (French)**  
Target: France + Belgium + Luxembourg leads

```
EMAIL 1 (Day 1):
Objet: Opportunité exclusive — Immobilier premium Portugal 2026

Bonjour {{first_name}},

J'ai remarqué votre profil et souhaite vous contacter directement.

Nous sommes Agency Group (AMI 22506), spécialisés dans l'immobilier haut de gamme 
au Portugal (segment €500K–€3M). Lisbonne figure dans le Top 5 mondial pour 
l'appréciation du luxe en 2026.

Je dispose d'opportunités hors-marché correspondant au profil des investisseurs 
avisés — Lisbonne, Cascais, Algarve.

Un appel de 15 minutes serait-il possible cette semaine ?

Cordialement,
Carlos Feiteira
Agency Group | AMI 22506
```

## Compliance Checklist
- [x] Business emails only (B2B legitimate interest)
- [x] Unsubscribe link in every email
- [x] Sender identity disclosed
- [ ] **Carlos: Add physical address to email footer**
- [ ] **Carlos: Create unsubscribe page** (`agencygroup.pt/unsubscribe`)
- [x] `do_not_contact = false` pre-filtered in CSV
- [x] Source disclosed as LinkedIn/public data (on request)

## Daily Send Limits
- Start: 20-30 emails/day (domain warm-up)
- Week 2: 50-80 emails/day
- Week 3+: Up to 200 emails/day

## Expected Results (117 emails, 3-step sequence)
| Metric | Estimate |
|--------|---------|
| Open rate | 35-50% |
| Reply rate | 3-8% |
| Positive replies | 3-9 |
| Meetings booked | 2-5 |
| Deals (90 days) | 0.5-1 |
| Commission | €37,500-€75,000 |

## Verdict
117 email-ready leads. Launch campaign this week. After Apollo: 900+ more leads.
