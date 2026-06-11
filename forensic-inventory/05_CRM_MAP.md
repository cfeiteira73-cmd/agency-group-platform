# 05 — CRM MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## CRM OVERVIEW

Agency Group operates a **dual CRM system**:
1. **Institutional Capital Network** — 7,342 pre-qualified buyers in `capital_profiles`
2. **Portal CRM** — 28 operational contacts in `contacts` (mostly demo)

The primary asset is the capital_profiles database. The portal CRM is largely empty.

---

## CAPITAL PROFILES (7,342 contacts)

### Profile Type Distribution
| Type | Count | Description |
|------|-------|-------------|
| FAMILY_OFFICE | ~1,701 | Direct HNW family wealth |
| WEALTH_MANAGER | ~1,470 | Manages client capital |
| FUND | ~900 | Institutional real estate fund |
| PRIVATE_EQUITY | ~650 | Opportunistic capital |
| INTRODUCER | ~800 | Referral/distribution partner |
| VENTURE | ~400 | Growth/VC capital |
| OTHER | ~421 | Mixed/unclassified |
| **Total** | **7,342** | |

### Geographic Distribution (Top 20 Countries)
| Country | Approx Count | Significance |
|---------|-------------|-------------|
| US | ~3,010 | Largest segment — 16% of luxury buyers |
| GB | ~882 | British buyers — 9% |
| FR | ~748 | French buyers — 13% |
| AE | ~504 | UAE/Middle East — high conviction |
| DE | ~380 | German buyers — 5% |
| CH | ~280 | Swiss — HNW concentrated |
| PT | ~260 | Portuguese domestic |
| BR | ~220 | Brazilian — €100K-500K segment |
| CN | ~190 | Chinese buyers — 8% |
| IL | ~160 | Israeli investors |
| SG | ~140 | Singapore family offices |
| CA | ~130 | Canadian buyers |
| HK | ~120 | Hong Kong capital |
| NL | ~100 | Dutch institutional |
| AU | ~90 | Australian buyers |
| IT | ~85 | Italian investors |
| ES | ~80 | Spanish buyers |
| LU | ~75 | Luxembourg funds |
| BE | ~70 | Belgian family wealth |
| Other | ~200 | 40+ more countries |

### Score Distribution
| Tier | Score Range | Count | Priority |
|------|------------|-------|----------|
| A+ | ≥ 80 | 116 | **Email TODAY** |
| A | 70–79 | ~200 | Email this week |
| B | 60–69 | ~500 | Email this month |
| C | < 60 | ~6,526 | Long-term nurture |

### Contactability
| Metric | Count | % |
|--------|-------|---|
| Has email | 67 | 0.9% |
| Has LinkedIn | Unknown | ~30% estimated |
| No contact info | ~7,275 | 99.1% |

---

## PORTAL CRM CONTACTS (28)

| Metric | Value |
|--------|-------|
| Total contacts | 28 |
| Real external contacts | 1 (ISABELGRILO@GMAIL.COM, 2026-06-03) |
| Demo/seeded | ~27 |
| Contacted | 0 |

---

## DEALS PIPELINE (8 deals — DEMO DATA)

| Stage | Count | Value |
|-------|-------|-------|
| Lead | 2 | ~€500K |
| Contact | 2 | ~€1.5M |
| Visit | 2 | ~€3M |
| Proposal | 1 | ~€2M |
| CPCV | 0 | — |
| Escritura | 0 | — |
| Closed | 1 | ~€2.44M |
| **Total pipeline** | **8** | **€9.44M (demo)** |

*Note: All 8 deals are demo/seeded data. Zero real deals in system.*

---

## ACTIVITIES (8 — DEMO DATA)

All 8 activity records are demo data created during system seeding.

---

## LEAD SOURCES

| Source | Table | Count | Status |
|--------|-------|-------|--------|
| Institutional (scraped/enriched) | capital_profiles | 7,342 | Uncontacted |
| Scraped leads | leads | 10,665 | Unprocessed |
| Outreach queue | outreach_queue | 3,120 | Pending n8n |
| Off-market pipeline | offmarket_leads | 14 | Active |
| Portal CRM | contacts | 28 | Mixed |
| **Total** | — | **21,164** | |

---

## PIPELINE STAGES

| Stage | Probability | Description |
|-------|------------|-------------|
| UNCONTACTED | 0% | Never reached |
| OUTREACH_QUEUED | 5% | In n8n queue |
| CONTACTED | 10% | Reply received |
| QUALIFIED | 25% | Confirmed buyer interest |
| MATCHED | 40% | Property match sent |
| VISIT_SCHEDULED | 55% | Visit confirmed |
| OFFER_MADE | 65% | Formal offer sent |
| CPCV_SIGNED | 80% | Contract signed |
| CLOSED | 100% | Deal complete |

---

## CRM AI CAPABILITIES

| Feature | Route | Status |
|---------|-------|--------|
| Email drafting | /api/crm/email-draft | Configured |
| Contact extraction | /api/crm/extract-contact | Configured |
| Meeting prep | /api/crm/meeting-prep | Configured |
| Next best action | /api/crm/next-step | Configured |
| Voice note processing | /api/crm/voice-note | Configured |
| Contact enrichment | /api/contact-enrichment/run | Cron (07:00 Mon-Fri) |
| Notion sync | /api/notion/contacts | Configured |
| Lead scoring | /api/automation/lead-score | Cron (06:15 Mon-Fri) |

---

## SCORING SYSTEM

### Lead Score (0-100)
```
+30 Profile type premium (Family Office, Fund)
+20 US/UK/FR/UAE geography
+20 Investment capacity match (€500K+)
+15 LinkedIn presence
+10 Email available
+5  Recent activity signal
```

### Buyer Score
- Calculated nightly via /api/buyers/score cron
- Factors: profile completeness, geography, budget match, engagement

---

## OUTREACH SEQUENCES (CONFIGURED, NOT DEPLOYED)

| Sequence | n8n Workflow | Status |
|----------|-------------|--------|
| Lead inbound | workflow-a-lead-inbound.json | Local only |
| Lead enrichment | workflow-a-lead-enrichment.json | Local only |
| Dormant lead | workflow-c-dormant-lead.json | Local only |
| High score alert | workflow-h-score-high-alert.json | Local only |
| Follow-up auto | workflow-i-followup-auto.json | Local only |

**Zero sequences are running in production.**

---

## NOTION INTEGRATION

| Database | Notion ID | Status |
|----------|-----------|--------|
| Deals | NOTION_DEALS_DB | Configured |
| Mensagens | NOTION_MENSAGENS_DB | Configured |
| Reels | NOTION_REELS_DB | Configured |
| Aprendizagens | NOTION_APRENDIZAGENS_DB | Configured |
| CRM | NOTION_CRM_DB | Configured |
| Properties | NOTION_PROPERTIES_DB | Configured |
| Pipeline | NOTION_PIPELINE_DB | Configured |

---

*Evidence: Supabase REST API queries 2026-06-11*
