# 07 — LEAD ENGINE DNA
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## LEAD UNIVERSE

| Source | Count | Quality | Status |
|--------|-------|---------|--------|
| capital_profiles | 7,342 | A+ institutional | Scored, 0 contacted |
| leads table | 10,665 | B scraped | Raw, unsegmented |
| outreach_queue | 3,120 | B queued | Pending (n8n needed) |
| offmarket_leads | 14 | A off-market | Under evaluation |
| portal contacts | 28 | Mixed | 1 real, 27 demo |
| **TOTAL** | **~21,169** | | **0 contacted** |

---

## SCRAPING ENGINE

### Platform: Apify
```
API Key:    APIFY_TOKEN (configured in env)
Status:     Active (10,665 leads scraped)
Sources:    LinkedIn Sales Navigator, company websites
Last scrape: Unknown (leads imported to DB)
```

### Idealista Integration
```
API Key:    IDEALISTA_API_KEY + IDEALISTA_SECRET (configured)
Purpose:    Property listing scraping / market data
Status:     Configured, usage unknown
Routes:     /api/market/idealista/* (built)
```

---

## ENRICHMENT ENGINE

### Apollo.io
```
Status:     NOT INTEGRATED (mentioned in recommendations)
Free tier:  50 credits/month
Needed for: Email enrichment of A+ capital_profiles
```

### Hunter.io
```
Status:     Referenced in lead-engine project (separate repo)
Not used:   In agency-group main repo
```

### Current enrichment rate
```
capital_profiles with email:   67 / 7,342 = 0.9%
Enrichment gap:                7,275 contacts missing email
Cost to enrich 7,275:          ~€200-500/month (Apollo, Hunter)
Priority:                      Top 116 A+ contacts first (free)
```

---

## SCORING PIPELINE

### Lead Score Algorithm (capital_profiles)
```
Input fields → Score 0-100:

Name completeness:      0-10
Organization name:      0-15
Role/title seniority:   0-20
  CEO/CIO/MD = 20
  Director = 15
  Manager = 8
  Other = 3
Contact info:           0-25
  email + phone = 25
  email only = 18
  phone only = 8
  none = 0
Country:                0-15
  UAE/CH/LX = 15
  US/UK/DE/FR = 12
  PT/ES = 8
  Other = 5
Profile type:           0-15
  Family Office = 15
  Wealth Manager = 12
  Fund = 10
  PE = 8
  VC = 6
  Other = 3

RESULT: 7,342 scored contacts
A+: 116 | A: ~340 | B: ~620 | C: ~6,266
```

---

## SEGMENTATION

### By country × type matrix
```
US Family Offices:      ~350  → Portuguese real estate (NHR regime)
UK Wealth Managers:     ~280  → High-value Algarve/Lisbon
UAE Family Offices:     ~180  → Golden Visa / resort
FR Private Investors:   ~200  → Tax optimization
DE Family Offices:      ~150  → Stable-value real estate
CH Family Offices:      ~120  → Exclusive Cascais/Estoril
```

---

## OUTREACH ENGINE

### Email (Resend)
```
API Key:    RESEND_API_KEY (configured)
Free tier:  3,000 emails/month
Template:   Built (lib/templates/emailTemplates.ts)
Sequence:   1st email → 3-day follow-up → 7-day follow-up
Status:     NEVER SENT (0 emails in history)
```

### WhatsApp (Twilio)
```
Config:     All vars set (TWILIO_*, WHATSAPP_*)
Active:     WHATSAPP_ACTIVE = NOT SET
To activate: Set WHATSAPP_ACTIVE=true in Vercel
Then:       Configure Meta Business Manager webhook
Time:       2-4 hours
Status:     BUILT BUT INACTIVE
```

### n8n Automation
```
Workflows:  11 JSON files
Status:     LOCAL ONLY (never deployed to Railway/cloud)
Sequences:  Configured: 3-touch email sequence + WhatsApp
Time to deploy: 4 hours
Status:     NOT DEPLOYED
```

---

## OUTREACH QUEUE

```
outreach_queue: 3,120 records
status=pending: 3,120 (all pending)
status=sent:    0
status=replied: 0
status=failed:  0

The queue is FULL. The runner is MISSING (n8n not deployed).
```

---

## DEDUPLICATION

```
System:     lib/crm/dedup.ts
Method:     Email + LinkedIn URL match
Status:     Configured
Issue:      99.1% of capital_profiles have no email
            → dedup on email fails for 99.1%
            → LinkedIn URL dedup is main method
```

---

## LEAD LIFECYCLE

```
CONFIGURED FLOW:
  Scrape (Apify) → Score → Segment → Enrich (email) → Queue → n8n Sequence
                                                                    ↓
  Reply → Sofia qualifies → Match to property → Deal pack → Offer

ACTUAL FLOW (today):
  capital_profiles: STATIC (scored, not contacted)
  leads:            STATIC (scraped, not processed)
  outreach_queue:   WAITING (n8n not running)
  
  Nothing moves. System is frozen at "Queue" step.
```

---

## WHAT NEEDS TO HAPPEN

| Priority | Action | Time | Cost | Expected Output |
|----------|--------|------|------|-----------------|
| 1 | Email 67 contacts with email NOW | 60 min | €0 | 1-3 replies |
| 2 | Deploy n8n to Railway | 4 hours | €15/month | Automated sequences |
| 3 | Activate WhatsApp | 2 hours | €0 | New channel |
| 4 | Enrich top 116 A+ contacts (Apollo free) | 2 hours | €0 | +50 emails |
| 5 | Buy Apollo plan (1,000 credits) | 30 min | €49/month | +300-500 emails |

---

*Evidence: Supabase REST API, forensic-inventory/06_LEAD_ENGINE_MAP.md, n8n-workflows/ directory*
