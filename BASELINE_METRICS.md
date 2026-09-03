# AGENCY GROUP — BASELINE METRICS
**Established: 2026-09-03 | Source: Multi-audit history + verified data**

---

## PURPOSE
These are the verified baseline measurements as of today. Every future session compares against these. Improvements must be demonstrated, not assumed.

---

## PLATFORM METRICS

| Metric | Baseline | Date verified | Method |
|--------|----------|---------------|--------|
| TypeScript errors | 0 | 2026-09-03 | `pnpm tsc --noEmit` |
| Test suite passing | 2,222/2,222 | 2026-06-24 | `pnpm vitest run` |
| OWASP security score | 87/100 | 2026-06-25 | Wave 7 audit |
| Next.js pages | 155 | 2026-06-24 | Build output |
| API routes | 542 | 2026-06-24 | Build output |
| Blog articles | 55 | 2026-06-24 | /blog directory |
| Active cron jobs | 41 | 2026-06-24 | Cron directories |
| n8n status | NOT DEPLOYED | 2026-09-03 | n8n cloud trial expired |
| Vercel region | Paris cdg1 | 2026-06-24 | Vercel dashboard |
| Database | Supabase Frankfurt eu-central-1 | 2026-06-24 | Supabase dashboard |

---

## COMMERCIAL METRICS

| Metric | Baseline | Date verified | Method |
|--------|----------|---------------|--------|
| Revenue (GCI) | €0 | 2026-09-03 | No closed deals |
| Closed deals | 0 | 2026-09-03 | — |
| Active mandates | UNKNOWN | 2026-09-03 | Not in system |
| CRM contacts (leads) | 18,042 | 2026-06-24 | Supabase leads table |
| Capital profiles | 25,384 | 2026-06-24 | capital_profiles table |
| Contacts with email (confirmed) | 113 | 2026-06-24 | LEADS_WITH_EMAIL_117.csv |
| Outreach emails sent (total) | 113 | 2026-09-03 | Resend API log |
| Sofia conversations (real) | 0 | 2026-09-03 | sofia_conversations table empty |
| WhatsApp status | INACTIVE | 2026-09-03 | WHATSAPP_ACCESS_TOKEN=PREENCHER |

---

## AI METRICS

| Metric | Baseline | Date verified |
|--------|----------|---------------|
| Sofia roles | 7 | 2026-06-24 |
| Sofia tools | 8 | 2026-06-24 |
| Sofia conversations (real) | 0 | 2026-09-03 |
| Sofia model | claude-sonnet-4-6 | 2026-06-24 |
| AVM accuracy | UNVERIFIED (claimed ±4.2%) | — |
| Semantic search quality | UNVERIFIED | — |

---

## SEO METRICS (UNKNOWN — NOT YET VERIFIED)

| Metric | Baseline | Status |
|--------|----------|--------|
| Google impressions/month | UNKNOWN | GSC not checked |
| Organic sessions/month | UNKNOWN | GA4 not checked |
| Indexed articles | UNKNOWN (55 exist) | Need GSC verification |
| Top ranking keyword | UNKNOWN | — |

---

## IMPROVEMENT TARGETS (NEXT 90 DAYS)

| Metric | Current | 90-day target | How |
|--------|---------|---------------|-----|
| Closed deals | 0 | 1+ | Activate HNWI outreach |
| Sofia conversations | 0 | 50+ | Traffic + WhatsApp |
| Email-enriched contacts | 113 | 500+ | Apollo $49/mo |
| n8n workflows active | 0 | 10+ | Deploy to Railway |
| Blog articles | 55 | 61+ | 2/month |
| OWASP score | 87 | 87+ (maintain) | Never degrade |
