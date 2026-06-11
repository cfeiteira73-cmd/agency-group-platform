# 06 — LEAD ENGINE MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## SUMMARY

| Metric | Value |
|--------|-------|
| Total leads in system | 21,164+ |
| capital_profiles (institutional) | 7,342 |
| leads table (scraped) | 10,665 |
| outreach_queue | 3,120 |
| offmarket_leads | 14 |
| Sequences deployed | 0 |
| Emails sent total | 0 |

---

## SCRAPING SYSTEM

### Apify Integration
- **Token**: APIFY_TOKEN env var (configured)
- **Purpose**: Web scraping of LinkedIn, company sites, real estate portals
- **Files**: `lib/acquisition/offMarketAcquisitionEngine.ts`
- **Status**: Configured, usage unknown

### Idealista Integration
- **Credentials**: IDEALISTA_API_KEY + IDEALISTA_SECRET
- **Files**: `lib/ingestion/idealistaAdapter.ts`, `lib/ingestion/idealistaClient.ts`
- **Routes**: /api/cron/ingest-listings (05:00 daily), /api/cron/sync-listings (06:00 daily)
- **Status**: Configured, cron running status unknown

### Casafari Integration
- **Files**: `lib/ingestion/casafariAdapter.ts`, `lib/ingestion/casafariClient.ts`
- **Status**: Configured

### Other Providers
- `lib/providers/citius/citiusClient.ts` — Portuguese public court records
- `lib/providers/npl/bankNplFeedClient.ts` — Bank non-performing loan feeds
- `lib/ingestion/pipeline.ts` — Main ingestion pipeline

---

## HUNTER INTEGRATION
- Hunter.io for email finding
- Referenced in lead enrichment scripts
- Status: API key not found in .env.example — may need configuration

---

## ENRICHMENT SYSTEM

| Step | Component | Status |
|------|-----------|--------|
| Email find | /api/contact-enrichment/run (cron 07:00) | Configured |
| LinkedIn lookup | lib/buyer-intelligence/index.ts | Configured |
| Company data | lib/crm/canonicalEntityManager.ts | Configured |
| Deduplication | lib/crm/dedupEngine.ts | Configured |
| Scoring | lib/scoring/ | Active |
| Country normalization | Applied June 2026 | Done ✅ |

---

## DEDUPLICATION

- `lib/crm/dedupEngine.ts` — entity dedup
- `lib/ingestion/dedupEngine.ts` — ingestion dedup
- `lib/ingestion/probabilisticDedup.ts` — fuzzy matching
- Matching: email, phone, LinkedIn URL, name+company

---

## SCORING SYSTEM

### Lead Score Formula (0-100)
```
Profile type premium     +30  (Family Office, Fund)
Geography premium        +20  (US, UK, FR, AE, CH, DE)
Investment capacity      +20  (€500K+)
LinkedIn presence        +15
Email available          +10
Activity signal          +5
```

### Score Distribution (capital_profiles)
```
A+ (≥80): 116  — Email these TODAY
A  (70-79): ~200 — Email this week
B  (60-69): ~500 — This month
C  (<60): ~6,526 — Long-term
```

---

## SEGMENTATION

### By Market
| Market | Buyer Type | Primary Source |
|--------|-----------|---------------|
| Portugal luxury | HNWI, Family Office | capital_profiles |
| Portugal residential | Locals, Brazilians | leads |
| Algarve | British, North American | capital_profiles |
| Cascais | French, German | capital_profiles |
| Madeira | Remote workers, tax optimization | leads |

### By Persona (from lib/ config)
1. **Institutional Investor** — Family Office, Fund — €3M+
2. **Lifestyle Buyer** — Expat, retiree — €500K-€2M
3. **Tax Optimizer** — NHR/IFICI — €300K-€1M
4. **Developer Partner** — Co-agency — project value
5. **Introducer** — Referral network — commission
6. **Domestic Buyer** — Portuguese — €150K-€500K
7. **Off-market Hunter** — Distressed, special situations — all ranges

### Buying Power Tiers
| Tier | Budget | Profiles |
|------|--------|---------|
| Ultra HNW | €10M+ | ~50 |
| Very HNW | €3M-€10M | ~200 |
| HNW | €1M-€3M | ~800 |
| Affluent | €500K-€1M | ~2,000 |
| Standard | €100K-€500K | ~4,292 |

---

## LEAD QUALIFICATION PIPELINE

```
1. INGESTED         — Lead scraped or imported
2. SCORED           — lead_score calculated
3. ENRICHED         — email/phone/LinkedIn added (if possible)
4. SEGMENTED        — profile_type assigned
5. OUTREACH_QUEUED  — Added to outreach_queue
6. CONTACTED        — First message sent
7. REPLIED          — Response received
8. QUALIFIED        — Budget/timeline confirmed
9. MATCHED          — Property match sent
```

---

## OUTREACH ENGINE

### Email Templates (configured in outreach-templates.ts)
```
- Cold outreach (EN/PT/FR/DE/AR/ZH)
- Follow-up sequence (3-touch)
- Property match alert
- Market intelligence report
- Off-market opportunity
```

### Channels
| Channel | Status | Volume |
|---------|--------|--------|
| Email (Resend) | Configured, 0 sent | 0 |
| WhatsApp | Configured, inactive | 0 |
| LinkedIn | Manual only | 0 |
| HeyGen video | Configured | 0 |

---

## EXPORTS & REPORTS

| Feature | Route | Status |
|---------|-------|--------|
| Lead export | /api/leads | Configured |
| Daily report | /api/reporting/daily (cron 08:30) | Unknown |
| Weekly report | /api/reporting/weekly-negotiation | Configured |
| Radar digest | /api/radar/digest (cron 08:00) | Unknown |
| n8n daily report | workflow-b-daily-report.json | Local only |

---

*Evidence: lib/ file scan, Supabase REST API, .env.example analysis — 2026-06-11*
