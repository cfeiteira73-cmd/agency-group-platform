# Phase 07 — Lead Engine → CRM Activation
**Date:** 2026-06-24  
**Status:** ✅ EXPORTS GENERATED

## CSV Files Generated
All files at: `C:\Users\Carlos\Desktop\CODE & OZ\lead-engine\exports\revenue-activation\`

| File | Rows | Purpose | Priority |
|------|------|---------|----------|
| `FOUNDER_95_A_PLUS.csv` | **95** | Carlos personal LinkedIn/email — A+ leads | 🔴 TODAY |
| `SMARTLEAD_FIRST_154.csv` | **95** | Full A+ batch for email campaign | 🔴 TODAY |
| `LEADS_WITH_EMAIL_117.csv` | **117** | Email-ready, send NOW | 🔴 TODAY |
| `SMARTLEAD_FIRST_50.csv` | **50** | First 50 for Smartlead campaign v1 | 🔴 TODAY |
| `TOP_500_APOLLO_ENRICHMENT.csv` | **500** | Apollo upload batch 1 | 🟠 DAY 1 |
| `TOP_1000_APOLLO_ENRICHMENT.csv` | **1,000** | Apollo upload batch 2 | 🟠 DAY 1 |
| `TOP_2500_APOLLO_ENRICHMENT.csv` | **2,500** | Apollo upload batch 3 | 🟠 DAY 1-2 |
| `USA_TOP_500.csv` | **500** | USA market priority | 🟡 WEEK 1 |
| `INVENTORY_CONNECTORS_PORTUGAL.csv` | **142** | PT/ES brokers for mandates | 🟡 WEEK 1 |
| `SOFIA_NURTURE_300.csv` | **300** | B-tier Sofia automated nurture | 🟡 WEEK 1 |
| `PARTNERS_BROKERS_EUROPE_TOP500.csv` | **500** | European co-agency leads | 🟡 WEEK 1 |

## Data Quality Notes
- All leads: `is_suppressed = false` ✅
- Email fields populated where available (117 leads with email)
- `email_status` + `email_confidence` included for prioritization
- `compliance_status = PENDING_CONSENT` — Carlos must obtain consent before emailing
- `do_not_contact = false` — pre-checked, update before campaign launch

## Lead Tier Breakdown
| Tier | Leads | Strategy |
|------|-------|----------|
| A+ (95) | Score ≥ 80 | Carlos direct personal outreach |
| A (3,434) | Score 60-79 | Email campaign + LinkedIn |
| B (7,128) | Score 40-59 | Sofia automated nurture |
| C (7,326) | Score < 40 | Archive / dormant monitor |

## Email Coverage Gap
| With Email | 117 | Can email TODAY |
|------------|-----|-----------------|
| No email | 17,925 | Need Apollo enrichment |

## How to Use These Files

### For Apollo Enrichment:
1. Go to https://www.apollo.io
2. Import → Upload CSV → Use `TOP_500_APOLLO_ENRICHMENT.csv`
3. Select columns: `full_name`, `company_name`, `linkedin_url`
4. Run enrichment → Download with emails
5. Re-import enriched CSV to Supabase `leads` table (update `email` column)

### For Smartlead Campaign:
1. Create campaign in Smartlead/Instantly
2. Import `SMARTLEAD_FIRST_50.csv` (or `LEADS_WITH_EMAIL_117.csv`)
3. Only use leads where `has_email = YES`
4. See Phase 09 for full campaign setup

### For Notion CRM:
- Import top 10-20 from `FOUNDER_95_A_PLUS.csv` manually
- Set `compliance_status` appropriately
- These trigger the `cron/followups` email automation

## Compliance Reminder
⚠️ GDPR/PECR: Cold email to business emails is permitted under legitimate interest IF:
- The email is business-to-business
- Content is relevant to their business
- Unsubscribe mechanism is provided
- Source is disclosed on request

All 117 emails in `LEADS_WITH_EMAIL_117.csv` are business emails from LinkedIn/public sources.
