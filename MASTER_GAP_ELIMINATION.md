# MASTER GAP ELIMINATION
Agency Group | Phase 15 | 2026-06-06

---

All gaps ranked by: Impact × (1/Difficulty) × (1/Time)  
Format: Gap | Impact | Difficulty | Time | Auto-fix?

---

## CATEGORY: TECHNICAL

| Gap | Impact | Difficulty | Time | Auto-fix? | Owner |
|-----|--------|-----------|------|-----------|-------|
| Apply W54-W58 migrations (5 tables) | HIGH | Easy | 30 min | YES (SQL) | System |
| ~~TypeScript errors~~ | ~~DONE~~ | ~~Easy~~ | ~~5 min~~ | ~~YES~~ | ~~DONE~~ |
| ~~total_score = 0~~ | ~~DONE~~ | ~~Easy~~ | ~~10 min~~ | ~~YES~~ | ~~DONE~~ |
| ~~country_iso truncated~~ | ~~DONE~~ | ~~Easy~~ | ~~5 min~~ | ~~YES~~ | ~~DONE~~ |
| Regenerate Supabase types | MEDIUM | Easy | 5 min | YES | System |
| Fix dual properties schema (PT vs EN) | MEDIUM | Medium | 2h | PARTIAL | System |

---

## CATEGORY: DATA

| Gap | Impact | Difficulty | Time | Auto-fix? | Owner |
|-----|--------|-----------|------|-----------|-------|
| Email enrichment for 7,275 contacts | CRITICAL | Medium | 2 weeks | NO (cost) | Carlos |
| Verify 55 properties are real mandates | CRITICAL | Medium | 3 days | NO | Carlos |
| Subscribe Casafari/Idealista | HIGH | Easy | 30 min | NO (cost) | Carlos |
| Add real buyer contacts (first 10) | HIGH | Easy | 1 day | NO | Carlos |
| Populate office leaks (off-market) | MEDIUM | Medium | 2 weeks | NO | Carlos |

---

## CATEGORY: CRM

| Gap | Impact | Difficulty | Time | Auto-fix? | Owner |
|-----|--------|-----------|------|-----------|-------|
| ~~total_score for all 7342~~ | ~~DONE~~ | ~~Easy~~ | ~~DONE~~ | ~~YES~~ | ~~DONE~~ |
| ~~country_iso normalization~~ | ~~DONE~~ | ~~Easy~~ | ~~DONE~~ | ~~YES~~ | ~~DONE~~ |
| Start 25 A+ LinkedIn conversations | CRITICAL | Easy | 2 hours | NO | Carlos |
| Add first 5 real buyers to contacts | HIGH | Easy | 1 day | NO | Carlos |
| Sofia sequences start | HIGH | Medium | 2 days | NO (config) | Carlos |
| Link capital_profiles → deals | MEDIUM | Easy | 30 min | PARTIAL | System |

---

## CATEGORY: SOFIA

| Gap | Impact | Difficulty | Time | Auto-fix? | Owner |
|-----|--------|-----------|------|-----------|-------|
| First 10 web conversations | HIGH | Easy | This week | NO | Carlos |
| Activate WhatsApp channel | HIGH | Medium | 2 hours | NO (Meta) | Carlos |
| First email sequence (10 contacts) | HIGH | Medium | 3 hours | NO | Carlos |
| First meeting creation via Sofia | MEDIUM | Medium | After above | NO | Carlos |

---

## CATEGORY: SECURITY

| Gap | Impact | Difficulty | Time | Auto-fix? | Owner |
|-----|--------|-----------|------|-----------|-------|
| Apply W54 migrations | HIGH | Easy | 30 min | YES (SQL) | System |
| Verify Slack SOC alerts firing | MEDIUM | Easy | 15 min | YES (test) | System |
| DR restore test | MEDIUM | Medium | 2 hours | NO | Carlos |
| External pen test | LOW (now) | Hard | 3 weeks | NO ($) | Future |

---

## CATEGORY: AUTOMATION

| Gap | Impact | Difficulty | Time | Auto-fix? | Owner |
|-----|--------|-----------|------|-----------|-------|
| Deploy n8n to Railway | HIGH | Medium | 3-4 hours | NO | Carlos |
| Verify Vercel cron execution | MEDIUM | Easy | 10 min | NO | Carlos |
| Start first email sequence | HIGH | Medium | After n8n | NO | Carlos |
| WhatsApp sequence setup | MEDIUM | Medium | After Meta | NO | Carlos |

---

## CATEGORY: OPERATIONS

| Gap | Impact | Difficulty | Time | Auto-fix? | Owner |
|-----|--------|-----------|------|-----------|-------|
| Carlos logs in daily | CRITICAL | Easy | IMMEDIATE | NO | Carlos |
| Start 3 real deal conversations | CRITICAL | Easy | This week | NO | Carlos |
| Verify properties portfolio | HIGH | Medium | 3 days | NO | Carlos |
| First real buyer in contacts | HIGH | Easy | Today | NO | Carlos |
| Confirm crons running | MEDIUM | Easy | 10 min | NO | Carlos |

---

## CATEGORY: INVENTORY

| Gap | Impact | Difficulty | Time | Auto-fix? | Owner |
|-----|--------|-----------|------|-----------|-------|
| Verify existing 55 properties | CRITICAL | Medium | 3 days | NO | Carlos |
| 1 developer co-agency agreement | HIGH | Medium | 2 weeks | NO | Carlos |
| 1 broker co-agency agreement | HIGH | Medium | 1 week | NO | Carlos |
| First off-market lead | HIGH | Medium | 2-4 weeks | NO | Carlos |

---

## CATEGORY: BRAND

| Gap | Impact | Difficulty | Time | Auto-fix? | Owner |
|-----|--------|-----------|------|-----------|-------|
| LinkedIn 3x/week posting | MEDIUM | Easy | Ongoing | NO | Carlos |
| 1 press article (Eco/JN) | MEDIUM | Medium | 2 weeks | NO | Carlos |
| Market report PDF | MEDIUM | Medium | 3 days | PARTIAL | System |
| First deal case study | HIGH | Medium | After first deal | NO | Carlos |

---

## CATEGORY: REVENUE

| Gap | Impact | Difficulty | Time | Auto-fix? | Owner |
|-----|--------|-----------|------|-----------|-------|
| First 10 buyer outreach messages | CRITICAL | Easy | 2 hours | NO | Carlos |
| First qualification call | CRITICAL | Easy | This week | NO | Carlos |
| First property presentation | CRITICAL | Medium | After above | NO | Carlos |
| First CPCV | CRITICAL | Hard | 60-180 days | NO | Carlos |

---

## PRIORITY ORDER (by Impact × Speed)

1. **IMMEDIATELY (today, <30 min each):**
   - Apply W54-W58 migrations via Monaco SQL
   - Regenerate Supabase types
   - Send first 5 LinkedIn messages to A+ CRM contacts
   - Check Vercel cron logs

2. **THIS WEEK (2-4 hours each):**
   - Activate WhatsApp in Vercel env + Meta webhook
   - Deploy n8n to Railway
   - Add first real buyer to contacts table
   - Start 3 outreach conversations

3. **THIS MONTH (days each):**
   - Verify 55 properties (real vs seeded)
   - Email enrichment for A+ tier (73 contacts)
   - First co-agency agreement with developer
   - First real deal in pipeline

4. **NEXT 90 DAYS:**
   - First CPCV
   - 25+ LinkedIn A+ connections
   - Email enrichment for A-tier (1,571)
   - n8n sequences running
