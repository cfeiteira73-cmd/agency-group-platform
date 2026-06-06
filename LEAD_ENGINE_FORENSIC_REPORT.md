# LEAD ENGINE FORENSIC REPORT
Agency Group | Phase 06 | Ultimate Institutional Master Audit | 2026-06-06

---

## LEAD SOURCES INVENTORY

### Source 1: capital_profiles (Supabase)
- Count: 7,342 contacts
- Quality: LinkedIn profiles from institutional outreach scraping
- Status: IMPORTED AND ACTIVE

### Source 2: Desktop Excel Files
From fresh scan of Desktop/AGENCY_GROUP_CRM/:

| File | Rows | Notes |
|------|------|-------|
| CRM_IMPORT_FINAL.xlsx | 7,342 | Master import (in Supabase) |
| MASTER_CRM_DATABASE.xlsx | 7,342 | Same dataset |
| SOFIA_QUEUE.xlsx | **30,901** | Outreach sequence messages (not unique contacts) |
| BUYERS_MASTER.xlsx | 1,184 | Buyer segment |
| CONNECTORS_MASTER.xlsx | 1,292 | Connector segment |
| FAMILY_OFFICES_MASTER.xlsx | 1,701 | FO segment |
| PARTNERS_MASTER.xlsx | 452 | Partner segment |
| ULTRA_CAPITAL_CONTACTABLE.xlsx | 65 | Highest quality contactable |
| FOUNDER_25.xlsx | 25 | Top 25 |
| SOFIA_PRIORITY_1000.xlsx | 1,000 | Sofia priority batch |

**Total unique contacts: 7,342**  
**Total outreach messages queued: 30,901 (SOFIA_QUEUE — multiple messages per contact)**

### Source 3: offmarket_leads (Supabase)
- Count: 14
- Quality: ALL TEST DATA (Direct POST Test, E2E_V4_, Lead Apify 2026-04-12)
- Status: No real off-market leads

---

## THE "8,200+" REFERENCE

The 25-phase mission mentions "8,200+ leads". Evidence suggests this may refer to:
1. **7,342 CRM contacts + 452 partners + 452 co-agency = ~8,246** (combined)
2. **OR:** A pre-deduplication count from an earlier phase
3. **OR:** A count including duplicate entries

**Confirmed unique contacts in Supabase: 7,342**

---

## LEAD QUALITY ANALYSIS

### Score Distribution
| Range | Count | % |
|-------|-------|---|
| Score 80-100 | 111 | 1.5% |
| Score 50-79 | 3,382 | 46.1% |
| Score 30-49 | 3,330 | 45.4% |
| Score 1-29 | 519 | 7.1% |

### Contactability
| Score | Count |
|-------|-------|
| >70 | 67 (same as email count — correlation) |
| 50-70 | ~4,000 |
| <50 | ~3,275 |

### Reachability
| Channel | Count | % |
|---------|-------|---|
| Email | 67 | 0.9% |
| Valid LinkedIn | 7,096 | 96.7% |
| Invalid LinkedIn (cleared) | 246 | 3.3% |
| Completely unreachable | 246 | 3.3% (after clearing) |

---

## LEAD ISSUES

### Critical: 99.1% no email
Cannot send automated email sequences to 7,275 contacts.  
Only manual LinkedIn outreach possible without enrichment.

### Critical: 246 contacts cleared
Special character issue in 246 names caused LinkedIn URL truncation.  
These now have NO reachable channel until manually enriched.

### Medium: offmarket_leads = all test
14 off-market leads in DB, all test data.  
Zero real off-market leads.

### Low: Segmentation files not in Supabase
FOUNDER_25.xlsx, SOFIA_PRIORITY_1000.xlsx, etc. exist on Desktop.  
Not imported to Supabase → cannot query or automate from them.

---

## LEAD ENGINE CODE STATUS

| Component | Status |
|-----------|--------|
| /api/offmarket-leads/* | EXISTS (15+ routes) |
| offmarket_leads table | Has 14 test records |
| Lead scoring cron | /api/offmarket-leads/score (weekdays 7:00) |
| Batch eval cron | /api/offmarket-leads/batch-eval (weekdays 7:30) |
| Lead ingest cron | /api/cron/ingest-listings (daily 5:00) |

**All lead engine crons are defined. Execution unverified for offmarket specifically.**

---

## SUMMARY

| Metric | Reality |
|--------|---------|
| Real institutional leads | 7,342 |
| Real buyer leads | 0 confirmed |
| Real off-market leads | 0 (all test) |
| Reachable by email | 67 |
| Reachable by LinkedIn | 7,096 |
| Not reachable at all | 246 |
| SOFIA outreach messages queued | 30,901 (across multiple sequences) |
