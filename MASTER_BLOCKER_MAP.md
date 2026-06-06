# MASTER BLOCKER MAP
Agency Group | Excellence Program Phase 11 | 2026-06-06
Every blocker, classified, ranked, with fix method.

---

## RANKING METHODOLOGY

Priority Score = Impact (1-10) × Speed to fix (1-10 = faster is higher) ÷ Cost (1-5 = cheaper is higher)

---

## CATEGORY: REVENUE (Directly blocks money)

| # | Blocker | Impact | Speed | Cost | Score | Fix |
|---|---------|--------|-------|------|-------|-----|
| R1 | Zero inventory verified | 10 | 8 | 1 | 80 | Call sources of 55 properties over 3 days |
| R2 | Zero active conversations | 10 | 9 | 1 | 90 | Send 25 LinkedIn messages today |
| R3 | No co-agency agreement | 9 | 7 | 1 | 63 | Contact 3 developers this week |
| R4 | Stripe in TEST mode | 3 | 9 | 1 | 27 | Switch to live when first deal is imminent |
| R5 | No mandate template | 6 | 8 | 2 | 24 | Download APEMIP standard template |

---

## CATEGORY: DATA (Blocks automation)

| # | Blocker | Impact | Speed | Cost | Score | Fix |
|---|---------|--------|-------|------|-------|-----|
| D1 | Email: 0.9% coverage | 9 | 8 | 2 | 36 | Apollo.io free tier this week |
| D2 | Properties unverified | 8 | 7 | 1 | 56 | Call each source (3 days) |
| D3 | Casafari unpaid (no live data) | 7 | 9 | 3 | 21 | €99/month when first mandate |
| D4 | Score calibration: capital_score only | 4 | 6 | 1 | 24 | Add phone calls to scoring |
| D5 | Country city names in DB | 2 | 8 | 1 | 16 | FIXED TODAY |

---

## CATEGORY: OPERATIONS (Blocks daily execution)

| # | Blocker | Impact | Speed | Cost | Score | Fix |
|---|---------|--------|-------|------|-------|-----|
| O1 | Carlos not logging in daily | 10 | 10 | 1 | 100 | Start tomorrow — no technical fix needed |
| O2 | No operations cadence | 8 | 9 | 1 | 72 | Follow EXECUTION_OS.md today |
| O3 | No daily tracking of conversations | 7 | 9 | 1 | 63 | Use REVENUE_OPERATING_SYSTEM.xlsx |
| O4 | No team | 8 | 2 | 4 | 4 | After first revenue |
| O5 | No verified inventory list | 8 | 7 | 1 | 56 | INVENTORY_WAR_ROOM.xlsx |

---

## CATEGORY: TECHNICAL

| # | Blocker | Impact | Speed | Cost | Score | Fix |
|---|---------|--------|-------|------|-------|-----|
| T1 | n8n not in production | 6 | 7 | 1 | 42 | Railway deployment (3-4 hours) |
| T2 | WhatsApp not active | 5 | 7 | 1 | 35 | Meta Business Manager webhook |
| T3 | Cron execution unverified | 4 | 8 | 1 | 32 | Check Vercel logs (10 min) |
| T4 | Supabase types stale | 3 | 8 | 1 | 24 | `supabase gen types` |
| T5 | W54-W58 migrations | FIXED | — | — | DONE | Applied today |
| T6 | TS errors | FIXED | — | — | DONE | 0 errors today |

---

## CATEGORY: CRM

| # | Blocker | Impact | Speed | Cost | Score | Fix |
|---|---------|--------|-------|------|-------|-----|
| C1 | 0 active contacts in pipeline | 10 | 9 | 1 | 90 | Add first real buyer today |
| C2 | contacts table: 12 real records | 8 | 8 | 1 | 64 | Log every conversation |
| C3 | sofia_conversations: 0 | 6 | 7 | 1 | 42 | Start web chat |
| C4 | No follow-up sequences running | 6 | 5 | 2 | 15 | After n8n deployment + email enrichment |
| C5 | capital_profiles not linked to deals | 3 | 6 | 1 | 18 | When first deal starts |

---

## CATEGORY: INVENTORY

| # | Blocker | Impact | Speed | Cost | Score | Fix |
|---|---------|--------|-------|------|-------|-----|
| I1 | 0 verified mandates | 10 | 7 | 1 | 70 | Call each of 55 properties |
| I2 | 0 developer agreements | 9 | 6 | 1 | 54 | Contact Vanguard, Norfin, Imofid |
| I3 | 0 co-agency broker agreements | 7 | 7 | 1 | 49 | Contact 5 boutique agencies |
| I4 | No off-market pipeline | 6 | 5 | 1 | 30 | Ask 3 lawyers for referrals |
| I5 | 0 judicial auction monitoring | 4 | 7 | 1 | 28 | Weekly citius.mj.pt check |

---

## CATEGORY: BRAND

| # | Blocker | Impact | Speed | Cost | Score | Fix |
|---|---------|--------|-------|------|-------|-----|
| B1 | 0 transactions (brand cannot grow) | 9 | 1 | 1 | 9 | Requires deal closure — no shortcut |
| B2 | No LinkedIn content | 5 | 9 | 1 | 45 | Post 3x/week starting today |
| B3 | No press coverage | 5 | 6 | 1 | 30 | Pitch Eco/JN (use template in playbook) |
| B4 | No institutional associations | 4 | 7 | 2 | 14 | APFIN + ULI (€800/year) |
| B5 | No market report | 4 | 6 | 1 | 24 | 3 days to write, huge leverage |

---

## CATEGORY: SECURITY

| # | Blocker | Impact | Speed | Cost | Score | Fix |
|---|---------|--------|-------|------|-------|-----|
| S1 | DR never tested | 4 | 6 | 1 | 24 | Supabase PITR restore test (2 hours) |
| S2 | No external SIEM | 3 | 5 | 2 | 8 | Datadog free tier when needed |
| S3 | PagerDuty missing | 2 | 7 | 2 | 7 | When team exists |
| S4 | No pen test | 3 | 2 | 4 | 2 | After first revenue |

---

## TOP 10 BLOCKERS BY PRIORITY

| Rank | Blocker | Score | Fix | Time |
|------|---------|-------|-----|------|
| 1 | Carlos not logging in daily (O1) | 100 | **Start tomorrow** | 0 min setup |
| 2 | Zero active conversations (R2) | 90 | Send 25 LinkedIn messages | 2 hours today |
| 3 | Zero active pipeline (C1) | 90 | Add first real buyer | 30 min |
| 4 | Zero inventory verified (R1) | 80 | Call 10 property sources | 3 days |
| 5 | No operations cadence (O2) | 72 | Follow EXECUTION_OS.md | Immediate |
| 6 | No co-agency agreement (R3) | 63 | Contact developers | This week |
| 7 | Email 0.9% coverage (D1) | 36+ | Apollo.io free tier | Today |
| 8 | No LinkedIn content (B2) | 45 | Post today | 30 min |
| 9 | n8n not in production (T1) | 42 | Railway deployment | 4 hours |
| 10 | Properties unverified (D2/I1) | 56 | Phone calls over 3 days | 3 days |

---

## THE META-BLOCKER

Every technical blocker has a workaround or fix.  
Every data blocker can be resolved with budget.  
Every automation blocker can be fixed in hours.

**The only unbuildable blocker is inaction.**

The system is ready. The pipeline is empty because no outreach has started.  
The inventory is unverified because no calls have been made.  
The revenue is zero because no conversations have been started.

**Every other blocker is downstream of this one.**
