# CONTACT ENRICHMENT MASTER PLAN
Agency Group | Excellence Program Phase 1 | 2026-06-06

---

## CURRENT STATE

| Metric | Value |
|--------|-------|
| Total CRM contacts | 7,342 |
| Have email | 67 (0.9%) |
| LinkedIn only | 7,275 (99.1%) |
| A+ tier | 73 |
| A tier | 1,571 |
| FAMILY_OFFICE persona | 1,701 |
| ULTRA_CAPITAL pipeline | 4,414 |

**Email enrichment is the single highest-ROI action in the entire platform.**  
Without email, automated sequences cannot run.  
Without sequences, the 7,342-contact network stays dormant.

---

## ENRICHMENT TARGETS

| Target | Timeline | Tool | Cost | Expected yield |
|--------|----------|------|------|----------------|
| TOP 73 (A+ tier) | Week 1 | Apollo free | €0 | ~22 new emails |
| TOP 200 | Week 1-2 | Apollo free/trial | €0-49 | ~60 new emails |
| TOP 500 | Month 1 | Apollo Basic | €49 | ~150 new emails |
| TOP 1,000 | Month 1-2 | Apollo Basic | €49 | ~300 new emails |
| A+A tier (1,644) | Month 2-3 | Apollo Pro | €99 | ~493 new emails |
| Full A+B tier (3,734) | Quarter 2 | Multi-tool | €200 | ~1,120 new emails |

---

## TOOL COMPARISON

### Apollo.io (RECOMMENDED #1)
- Free tier: 50 credits/month (sufficient to test A+ tier)
- Basic: €49/month → ~1,200 lookups
- Professional: €99/month → unlimited
- Best for: LinkedIn → email matching
- URL: apollo.io
- **Setup: 30 minutes. Start today.**

### Hunter.io
- Free: 25/month
- Starter: €49/month → 500 lookups
- Best for: domain-based email finding (company name → email format)
- Use case: contacts with company domain known

### Dropcontact (RECOMMENDED #2)
- Pay-per-use: ~€0.08-0.15/contact
- Best for: batch processing with LinkedIn URLs
- API available → automate via Python script
- URL: dropcontact.com

### Prospeo
- Free: 75 credits
- Starter: €39/month → 1,000 credits
- Best for: LinkedIn URL → email

### LinkedIn Sales Navigator
- €79/month
- Best for: direct InMail (bypass email entirely)
- 50 InMails/month on basic
- Allows messaging without connection

### Clay (advanced)
- Data enrichment waterfall: tries multiple sources
- Best for: bulk enrichment automation
- €149/month starting
- Use after first 500 emails proven

---

## EXECUTION PLAN

### Week 1: Apollo Free Tier (73 A+ contacts)
```
1. Sign up Apollo.io (free) → 50 credits
2. Import TOP_ENRICHMENT_MASTER.xlsx → TOP_200 tab
3. Filter: TIER = A+
4. Run enrichment on 50 contacts
5. Export enriched emails
6. Update capital_profiles in Supabase via REST API
```

### Week 2: Expand to TOP 200
```
1. Upgrade Apollo to Basic (€49) if free tier insufficient
2. OR use Prospeo free 75 credits for next batch
3. Target: 60 new emails in TOP 200
4. Import to Supabase
```

### Month 1: TOP 1000 enrichment
```
1. Apollo Basic €49/month
2. Process 200 contacts/day = 1,000 in 5 days
3. Expected: ~300 new emails
4. Cost: €49
5. ROI: 1 meeting booked → €25,000+ commission
```

---

## TECHNICAL IMPLEMENTATION

### Import enriched emails to Supabase (Python)
```python
# After enrichment, update capital_profiles
import requests

key = '[SUPABASE_SERVICE_ROLE_KEY]'
base = 'https://isbfiofwpxqqpgxoftph.supabase.co/rest/v1'
h = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'Prefer': 'return=minimal'}

# For each enriched contact:
requests.patch(f'{base}/capital_profiles?lead_id=eq.{lead_id}',
    headers=h, json={'email': 'enriched@example.com', 'contact_status': 'ENRICHED'})
```

---

## FILES GENERATED

- `TOP_ENRICHMENT_MASTER.xlsx` — 3 tabs: TOP_200, TOP_500, TOP_1000
  - Ranked by capital_score + contactability
  - Ready for Apollo import
  - Fields: name, company, LinkedIn, tier, score, enrichment status

---

## PRIORITY CONTACTS (TOP 25 by capital_score)

| Rank | Name | Country | Persona | Score | Status |
|------|------|---------|---------|-------|--------|
| 1 | Russell Deakin | US | FAMILY_OFFICE | 100 | EMAIL KNOWN |
| 2 | Neil Cabral | AE | FAMILY_OFFICE | 97 | NEEDS ENRICHMENT |
| 3 | Arnaud Barray | CH | FAMILY_OFFICE | 97 | NEEDS ENRICHMENT |
| 4 | W Leclerc | CH | FAMILY_OFFICE | 97 | NEEDS ENRICHMENT |
| 5 | Sagi Kadury | IL | FAMILY_OFFICE | 97 | NEEDS ENRICHMENT |
| 6 | Rachel Tong | HK | REAL_ESTATE_FUND | 96 | NEEDS ENRICHMENT |
| 7 | Darshan Lal | US | REAL_ESTATE_FUND | 94 | NEEDS ENRICHMENT |
| 8 | Eddie Lee | HK | FAMILY_OFFICE | 93 | NEEDS ENRICHMENT |
| 9 | Rosabell Chung Hun | CA | FAMILY_OFFICE | 93 | NEEDS ENRICHMENT |
| 10 | Dafna Gonen | IL | FAMILY_OFFICE | 92 | NEEDS ENRICHMENT |
| 11 | Yamit Gottlieb | IL | FAMILY_OFFICE | 92 | NEEDS ENRICHMENT |
| 12 | Carmen Kramer | US | FAMILY_OFFICE | 91 | NEEDS ENRICHMENT |
| 13 | Kayla Sykes | US | FAMILY_OFFICE | 91 | NEEDS ENRICHMENT |
| 14 | Luda Mirne | US | FAMILY_OFFICE | 91 | NEEDS ENRICHMENT |
| 15 | Emmanuel Poznanski | BE | FAMILY_OFFICE | 91 | NEEDS ENRICHMENT |
| 16 | Joanie Koutsky | US | INVESTOR | 91 | NEEDS ENRICHMENT |
| 17 | Danica Dipaolo | US | FAMILY_OFFICE | 91 | NEEDS ENRICHMENT |
| 18 | Mark Kress CFA | US | FAMILY_OFFICE | 91 | NEEDS ENRICHMENT |
| 19 | Mevlana Alonso | CH | FAMILY_OFFICE | 87 | EMAIL KNOWN |
| 20 | Carol Pepper | US | FAMILY_OFFICE | 86 | EMAIL KNOWN |
| 21 | Kamil Oziemczuk | CH | WEALTH_MANAGER | 90 | NEEDS ENRICHMENT |
| 22 | Jade Kipperman | US | WEALTH_MANAGER | 89 | NEEDS ENRICHMENT |
| 23 | Paul So CFA | HK | INVESTOR | 88 | NEEDS ENRICHMENT |
| 24 | Bertrand Guiot | SG | INVESTOR | 88 | NEEDS ENRICHMENT |
| 25 | Or Shmerling | IL | FAMILY_OFFICE | 87 | NEEDS ENRICHMENT |

---

## ROI CALCULATION

| Scenario | Emails added | Outreach | Meetings (5%) | Qualified (30%) | Deals (20%) | Revenue |
|----------|-------------|---------|--------------|-----------------|-------------|---------|
| Conservative (TOP 200) | 60 | 60 | 3 | 1 | 0.2 | ~€0-50K |
| Base (TOP 500) | 150 | 150 | 7-8 | 2-3 | 0.5 | ~€50-150K |
| Optimistic (TOP 1000) | 300 | 300 | 15 | 4-5 | 1 | €50K+ (1 deal) |

**Cost of enrichment:** €49-99/month  
**Revenue per deal:** €25K (€500K property) to €250K (€5M property)  
**ROI of enrichment:** 500x-2500x if any deal closes
