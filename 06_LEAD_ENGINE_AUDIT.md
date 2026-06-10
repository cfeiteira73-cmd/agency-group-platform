# 06 — LEAD ENGINE AUDIT
Agency Group | Final Operating System Audit | 2026-06-11

---

## LEAD ENGINE LOCATION

**Path**: `C:\Users\Carlos\Desktop\CODE & OZ\lead-engine\`
**Status**: Separate project from agencygroup.pt
**DB**: Apify + Hunter + Supabase pipeline

---

## WHAT WAS PRODUCED

| Asset | Count | Status |
|-------|-------|--------|
| capital_profiles (CRM) | **7,342** | ✅ Imported to Supabase |
| SOFIA_QUEUE.xlsx | 30,901 message sequences | ✅ Exists, 0 sent |
| Lead Engine markets | 11 | Built |
| Lead Engine personas | 7 | Built |

---

## CAPITAL_PROFILES BREAKDOWN BY TIER

| Tier | Score | Count | Revenue Priority |
|------|-------|-------|-----------------|
| A+ | 80–100 | 116 | Immediate — contact this week |
| A | 70–79 | ~800 | Contact within 30 days |
| B | 60–69 | ~1,400 | Sequence within 60 days |
| C | <60 | ~5,000 | Long-term nurture |

---

## ENRICHMENT STATUS

| Field | Coverage | Gap |
|-------|----------|-----|
| Full name | ~100% | None |
| LinkedIn | 96.6% | 246 cleared (truncated) |
| Company | ~95% | Acceptable |
| Persona type | 100% | Complete |
| Country ISO | 100% | Fixed (was full names) |
| Capital score | 100% | All scored |
| Email | **0.9%** | **CRITICAL GAP** |
| Phone | <1% | Critical gap |

---

## EMAIL ENRICHMENT PLAN

| Source | Credits | Expected Results |
|--------|---------|-----------------|
| Apollo.io (free) | 50/month | 50 emails |
| Apollo.io (paid $99/mo) | 5,000/month | 5,000 emails |
| Hunter.io (existing) | Varies | Use for company domain lookup |
| LinkedIn Sales Navigator | Manual | High accuracy for top 50 |

**Priority**: Enrich top 116 A+ contacts first. 50 Apollo free credits = all A+ contacts with Apollo coverage.

---

## SOFIA_QUEUE.xlsx

| Metric | Value |
|--------|-------|
| Total rows | 30,901 |
| Unique contacts (approx) | ~7,342 |
| Messages per contact | ~4 (sequence) |
| Sent | **0** |
| Dependency | n8n deployment |

---

## APIFY STATUS

| Component | Status | Evidence |
|-----------|--------|---------|
| Apify integration | Configured | In lead-engine scripts |
| Last run | Unknown | No recent evidence |
| Data freshness | Unknown | 7,342 contacts imported 2026-05-xx |

---

## MARKETS COVERED

11 markets in lead-engine:
1. Portugal (primary)
2. USA
3. UK
4. France
5. UAE
6. Switzerland
7. Germany
8. Singapore
9. Hong Kong
10. Luxembourg
11. Israel

---

## EXECUTION PLAN (next 30 days)

### Immediate (Week 1)
1. Export 116 A+ contacts from capital_profiles (score ≥80)
2. Enrich via Apollo free (50 credits) — focus on Family Offices
3. Manual LinkedIn DM to top 20 (no email needed)
4. Email to 67 contacts who already have email

### Week 2
5. Apollo paid plan ($99) — enrich next 500 (score 70+)
6. Start 5-per-day LinkedIn outreach rhythm
7. Deploy n8n → activate SOFIA_QUEUE sequences

### Week 3-4
8. First meetings from outreach
9. Ask contacts for property mandates or buyer referrals

---

## LEAD ENGINE FINAL EXECUTION PLAN (Export)

| Segment | Count | Action | Timeline |
|---------|-------|--------|----------|
| A+ with email | 8–10 | Email today | NOW |
| A+ LinkedIn only | 100+ | LinkedIn DM | Week 1 |
| FO with email (67) | 67 | Email campaign | Week 1 |
| Brokers/Partners | 452 | WhatsApp/email | Week 2 |
| Wealth Managers top | 100 | Sequence via n8n | Week 3 |

---

## SCORE: 58/100

| Category | Score | Reason |
|----------|-------|--------|
| Volume | 88/100 | 7,342 is solid base |
| Data quality | 30/100 | 99.1% no email |
| Activation | 5/100 | 0 contacts ever contacted |
| Enrichment | 20/100 | Only 67 emails |
| Sequences | 0/100 | SOFIA_QUEUE never sent |
| Tools | 85/100 | Code exists, n8n not deployed |
